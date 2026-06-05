// ════════════════════════════════════════════════════════════════
// Bikers Portal — Likes
// ════════════════════════════════════════════════════════════════
import { Router } from 'express'
import { db, uid, now } from '../db.js'
import { requireAuth } from '../auth.js'

const r = Router()

// Toggle: returns the new state { liked: true|false }
r.post('/toggle', requireAuth, (req, res) => {
  const { post_id } = req.body || {}
  if (!post_id) return res.status(400).json({ error: 'post_id is required.' })
  const existing = db.prepare('SELECT id FROM likes WHERE post_id = ? AND user_id = ?').get(post_id, req.user.id)
  if (existing) {
    db.prepare('DELETE FROM likes WHERE id = ?').run(existing.id)
    return res.json({ liked: false })
  }
  db.prepare('INSERT INTO likes (id, post_id, user_id, created_at) VALUES (?, ?, ?, ?)')
    .run(uid(), post_id, req.user.id, now())
  res.json({ liked: true })
})

export default r
