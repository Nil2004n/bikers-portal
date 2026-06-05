// ════════════════════════════════════════════════════════════════
// Bikers Portal — Posts + Realtime (SSE)
// ════════════════════════════════════════════════════════════════
import { Router } from 'express'
import { db, uid, now } from '../db.js'
import { requireAuth, optionalAuth } from '../auth.js'
import { bus } from '../realtime.js'

const r = Router()

// ── List posts (with profile + counts) ───────────────────────
r.get('/', optionalAuth, (req, res) => {
  const { limit = 50, offset = 0, user_id } = req.query
  let sql = `
    SELECT
      p.id, p.user_id, p.content, p.image_url, p.created_at,
      pr.username, pr.full_name, pr.avatar_url
    FROM posts p
    JOIN profiles pr ON pr.id = p.user_id
  `
  const params = []
  if (user_id) { sql += ' WHERE p.user_id = ?'; params.push(user_id) }
  sql += ' ORDER BY p.created_at DESC LIMIT ? OFFSET ?'
  params.push(Number(limit), Number(offset))

  const posts = db.prepare(sql).all(...params)
  if (posts.length === 0) return res.json([])

  // Compute like & comment counts in bulk
  const ids = posts.map(p => p.id)
  const placeholders = ids.map(() => '?').join(',')
  const likeCounts    = Object.fromEntries(db.prepare(`SELECT post_id, COUNT(*) AS n FROM likes    WHERE post_id IN (${placeholders}) GROUP BY post_id`).all(...ids).map(r => [r.post_id, r.n]))
  const commentCounts = Object.fromEntries(db.prepare(`SELECT post_id, COUNT(*) AS n FROM comments WHERE post_id IN (${placeholders}) GROUP BY post_id`).all(...ids).map(r => [r.post_id, r.n]))

  let myLikes = new Set()
  if (req.user) {
    const rows = db.prepare(`SELECT post_id FROM likes WHERE user_id = ? AND post_id IN (${placeholders})`).all(req.user.id, ...ids)
    myLikes = new Set(rows.map(r => r.post_id))
  }

  res.json(posts.map(p => ({
    id: p.id,
    user_id: p.user_id,
    content: p.content,
    image_url: p.image_url,
    created_at: p.created_at,
    profiles: { username: p.username, full_name: p.full_name, avatar_url: p.avatar_url },
    like_count: likeCounts[p.id] || 0,
    comment_count: commentCounts[p.id] || 0,
    liked_by_me: myLikes.has(p.id)
  })))
})

// ── Create post ──────────────────────────────────────────────
r.post('/', requireAuth, (req, res) => {
  const { content, image_url } = req.body || {}
  if (!content && !image_url) {
    return res.status(400).json({ error: 'Post must have content or an image.' })
  }
  if (content && String(content).length > 4000) {
    return res.status(400).json({ error: 'Post is too long.' })
  }
  const id = uid()
  const ts = now()
  db.prepare(`
    INSERT INTO posts (id, user_id, content, image_url, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, req.user.id, content || null, image_url || null, ts)

  const row = db.prepare(`
    SELECT p.id, p.user_id, p.content, p.image_url, p.created_at,
           pr.username, pr.full_name, pr.avatar_url
    FROM posts p
    JOIN profiles pr ON pr.id = p.user_id
    WHERE p.id = ?
  `).get(id)
  const shaped = {
    ...row,
    profiles: { username: row.username, full_name: row.full_name, avatar_url: row.avatar_url },
    like_count: 0, comment_count: 0, liked_by_me: false
  }
  bus.emit('post:new', shaped)
  res.json(shaped)
})

// ── Delete a post (own only) ─────────────────────────────────
r.delete('/:id', requireAuth, (req, res) => {
  const row = db.prepare('SELECT user_id FROM posts WHERE id = ?').get(req.params.id)
  if (!row) return res.status(404).json({ error: 'not_found' })
  if (row.user_id !== req.user.id) return res.status(403).json({ error: 'forbidden' })
  db.prepare('DELETE FROM posts WHERE id = ?').run(req.params.id)
  bus.emit('post:delete', { id: req.params.id })
  res.json({ ok: true })
})

// ── Likes (bulk read) ────────────────────────────────────────
// Accepts the api.js convention `?post_id__in=a,b,c` (or `?post_ids=...`).
// If `?user_id=...` is provided, restricts the result to that user's likes.
r.get('/likes', (req, res) => {
  const ids = readIdList(req.query, 'post_id')
  if (ids.length === 0) return res.json([])
  const placeholders = ids.map(() => '?').join(',')
  const params = [...ids]
  let where = `post_id IN (${placeholders})`
  if (req.query.user_id) {
    where += ' AND user_id = ?'
    params.push(req.query.user_id)
  }
  res.json(db.prepare(`SELECT post_id, user_id FROM likes WHERE ${where}`).all(...params))
})

// ── Comments (bulk read) ─────────────────────────────────────
r.get('/comments', (req, res) => {
  const ids = readIdList(req.query, 'post_id')
  if (ids.length === 0) return res.json([])
  const placeholders = ids.map(() => '?').join(',')
  res.json(db.prepare(`
    SELECT c.id, c.post_id, c.user_id, c.body, c.created_at,
           pr.username, pr.full_name, pr.avatar_url
    FROM comments c
    JOIN profiles pr ON pr.id = c.user_id
    WHERE c.post_id IN (${placeholders})
    ORDER BY c.created_at ASC
  `).all(...ids))
})

function readIdList(query, baseCol) {
  const inKey  = `${baseCol}__in`
  const plurKey = `${baseCol}s`
  const raw = query[inKey] || query[plurKey]
  if (!raw) return []
  return String(raw).split(',').map(s => s.trim()).filter(Boolean)
}

// ── Realtime stream (SSE) ────────────────────────────────────
r.get('/stream', (req, res) => {
  res.setHeader('Content-Type',      'text/event-stream')
  res.setHeader('Cache-Control',     'no-cache, no-transform')
  res.setHeader('Connection',        'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  res.flushHeaders?.()

  let closed = false
  const safeWrite = (chunk) => {
    if (closed || res.writableEnded) return
    try { res.write(chunk) } catch (err) { cleanup() }
  }

  const onPost = (post) => safeWrite(`event: new-post\ndata: ${JSON.stringify(post)}\n\n`)
  const onDel  = (p)    => safeWrite(`event: delete-post\ndata: ${JSON.stringify(p)}\n\n`)

  bus.on('post:new',    onPost)
  bus.on('post:delete', onDel)

  const hb = setInterval(() => safeWrite(`: ping\n\n`), 25000)

  function cleanup() {
    if (closed) return
    closed = true
    clearInterval(hb)
    bus.off('post:new', onPost)
    bus.off('post:delete', onDel)
  }
  req.on('close', cleanup)
  req.on('error', cleanup)
  res.on('error', cleanup)
})

export default r
