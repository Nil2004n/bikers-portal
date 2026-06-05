// ════════════════════════════════════════════════════════════════
// Bikers Portal — Trips
// ════════════════════════════════════════════════════════════════
import { Router } from 'express'
import { db, uid, now } from '../db.js'
import { requireAuth } from '../auth.js'

const r = Router()

r.get('/', (req, res) => {
  const { user_id, is_public, limit = 200, offset = 0 } = req.query
  let sql = `
    SELECT t.*, pr.username, pr.full_name
    FROM trips t
    JOIN profiles pr ON pr.id = t.user_id
    WHERE 1 = 1
  `
  const params = []
  if (user_id)   { sql += ' AND t.user_id = ?'; params.push(user_id) }
  if (is_public !== undefined) { sql += ' AND t.is_public = ?'; params.push(is_public === 'true' || is_public === '1' ? 1 : 0) }
  sql += ' ORDER BY COALESCE(t.trip_date, t.created_at) DESC, t.created_at DESC LIMIT ? OFFSET ?'
  params.push(Number(limit), Number(offset))
  res.json(db.prepare(sql).all(...params).map(t => ({
    ...t,
    waypoints: t.waypoints ? JSON.parse(t.waypoints) : [],
    profiles: { username: t.username, full_name: t.full_name }
  })))
})

r.post('/', requireAuth, (req, res) => {
  const { title, start_loc, end_loc, waypoints, distance_km, trip_date, difficulty, notes, is_public } = req.body || {}
  if (!title || !start_loc || !end_loc) {
    return res.status(400).json({ error: 'Title, start, and end are required.' })
  }
  const id = uid()
  db.prepare(`
    INSERT INTO trips (id, user_id, title, start_loc, end_loc, waypoints, distance_km, trip_date, difficulty, notes, is_public, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, req.user.id, title, start_loc, end_loc,
    waypoints ? JSON.stringify(waypoints) : null,
    distance_km || null, trip_date || null, difficulty || 'Medium', notes || null,
    is_public ? 1 : 0, now()
  )
  res.json({ id, ok: true })
})

r.patch('/:id', requireAuth, (req, res) => {
  const row = db.prepare('SELECT user_id FROM trips WHERE id = ?').get(req.params.id)
  if (!row) return res.status(404).json({ error: 'not_found' })
  if (row.user_id !== req.user.id) return res.status(403).json({ error: 'forbidden' })
  const { title, start_loc, end_loc, waypoints, distance_km, trip_date, difficulty, notes, is_public } = req.body || {}
  db.prepare(`
    UPDATE trips
       SET title       = COALESCE(?, title),
           start_loc   = COALESCE(?, start_loc),
           end_loc     = COALESCE(?, end_loc),
           waypoints   = COALESCE(?, waypoints),
           distance_km = COALESCE(?, distance_km),
           trip_date   = COALESCE(?, trip_date),
           difficulty  = COALESCE(?, difficulty),
           notes       = COALESCE(?, notes),
           is_public   = COALESCE(?, is_public)
     WHERE id = ?
  `).run(
    title ?? null, start_loc ?? null, end_loc ?? null,
    waypoints ? JSON.stringify(waypoints) : null,
    distance_km ?? null, trip_date ?? null, difficulty ?? null, notes ?? null,
    typeof is_public === 'boolean' ? (is_public ? 1 : 0) : null,
    req.params.id
  )
  res.json({ ok: true })
})

r.delete('/:id', requireAuth, (req, res) => {
  const row = db.prepare('SELECT user_id FROM trips WHERE id = ?').get(req.params.id)
  if (!row) return res.status(404).json({ error: 'not_found' })
  if (row.user_id !== req.user.id) return res.status(403).json({ error: 'forbidden' })
  db.prepare('DELETE FROM trips WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

export default r
