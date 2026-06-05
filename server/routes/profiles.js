// ════════════════════════════════════════════════════════════════
// Bikers Portal — Profiles routes
// ════════════════════════════════════════════════════════════════
import { Router } from 'express'
import { db } from '../db.js'
import { requireAuth } from '../auth.js'

const r = Router()

// ── Allowed values for dynamic ORDER BY (no SQL injection) ──
const ALLOWED_ORDER = [
  'created_at DESC', 'created_at ASC',
  'username ASC',   'username DESC'
]
function safeOrder(value, fallback = 'created_at DESC') {
  if (typeof value !== 'string') return fallback
  return ALLOWED_ORDER.includes(value) ? value : fallback
}

// ── List profiles (with optional exclude + limit) ───────────
r.get('/', (req, res) => {
  const { limit = 50, exclude } = req.query
  const order = safeOrder(req.query.order)
  let sql = `SELECT id, username, full_name, bio, bike_model, avatar_url, created_at FROM profiles`
  const params = []
  if (exclude) {
    sql += ` WHERE id != ?`
    params.push(exclude)
  }
  sql += ` ORDER BY ${order} LIMIT ?`
  params.push(Number(limit))
  res.json(db.prepare(sql).all(...params))
})

// ── Get one profile ─────────────────────────────────────────
r.get('/:id', (req, res) => {
  const row = db.prepare(
    'SELECT id, username, full_name, bio, bike_model, avatar_url, created_at FROM profiles WHERE id = ?'
  ).get(req.params.id)
  if (!row) return res.status(404).json({ error: 'not_found' })
  res.json(row)
})

// ── Update / upsert current profile ─────────────────────────
// Two paths into the same update logic:
//   • PATCH /me       — used by the in-page editor
//   • POST  /         — used by the register flow (avatar upload)
function updateOwnProfile(req, res) {
  const { full_name, username, bio, bike_model, avatar_url } = req.body || {}
  const cur = db.prepare('SELECT * FROM profiles WHERE id = ?').get(req.user.id)
  if (!cur) return res.status(404).json({ error: 'not_found' })

  // Username validation (case-insensitive uniqueness)
  if (username && username.toLowerCase() !== cur.username.toLowerCase()) {
    if (!/^[a-z0-9_]{3,20}$/i.test(username)) {
      return res.status(400).json({ error: 'Username must be 3–20 characters (letters, numbers, underscore).' })
    }
    const taken = db.prepare('SELECT id FROM profiles WHERE username = ? COLLATE NOCASE AND id != ?').get(username, req.user.id)
    if (taken) return res.status(409).json({ error: 'That username is already taken.' })
  }

  db.prepare(`
    UPDATE profiles
       SET full_name  = COALESCE(?, full_name),
           username   = COALESCE(?, username),
           bio        = COALESCE(?, bio),
           bike_model = COALESCE(?, bike_model),
           avatar_url = COALESCE(?, avatar_url)
     WHERE id = ?
  `).run(
    full_name  ?? null,
    username ? String(username).toLowerCase() : null,
    bio        ?? null,
    bike_model ?? null,
    avatar_url ?? null,
    req.user.id
  )
  const updated = db.prepare(
    'SELECT id, username, full_name, bio, bike_model, avatar_url, created_at FROM profiles WHERE id = ?'
  ).get(req.user.id)
  res.json(updated)
}

r.post('/',  requireAuth, updateOwnProfile)
r.patch('/me', requireAuth, updateOwnProfile)

// PATCH /:id — same handler, but verify the path id matches the current user.
r.patch('/:id', requireAuth, (req, res, next) => {
  if (req.params.id !== req.user.id) return res.status(403).json({ error: 'forbidden' })
  return updateOwnProfile(req, res, next)
})

export default r
