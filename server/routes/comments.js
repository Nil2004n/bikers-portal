// ════════════════════════════════════════════════════════════════
// Bikers Portal — Comments
// ════════════════════════════════════════════════════════════════
import { Router } from 'express'
import { db, uid, now } from '../db.js'
import { requireAuth } from '../auth.js'

const r = Router()

r.post('/', requireAuth, (req, res) => {
  const { post_id, body } = req.body || {}
  if (!post_id || !body || !String(body).trim()) {
    return res.status(400).json({ error: 'post_id and body are required.' })
  }
  if (String(body).length > 1200) {
    return res.status(400).json({ error: 'Comment is too long.' })
  }
  const id = uid()
  db.prepare('INSERT INTO comments (id, post_id, user_id, body, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(id, post_id, req.user.id, String(body).trim(), now())
  const row = db.prepare(`
    SELECT c.id, c.post_id, c.user_id, c.body, c.created_at,
           pr.username, pr.full_name, pr.avatar_url
    FROM comments c
    JOIN profiles pr ON pr.id = c.user_id
    WHERE c.id = ?
  `).get(id)
  res.json({ ...row, profiles: { username: row.username, full_name: row.full_name, avatar_url: row.avatar_url } })
})

r.delete('/:id', requireAuth, (req, res) => {
  const row = db.prepare('SELECT user_id FROM comments WHERE id = ?').get(req.params.id)
  if (!row) return res.status(404).json({ error: 'not_found' })
  if (row.user_id !== req.user.id) return res.status(403).json({ error: 'forbidden' })
  db.prepare('DELETE FROM comments WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

export default r
