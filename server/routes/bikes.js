// ════════════════════════════════════════════════════════════════
// Bikers Portal — Bikes
// ════════════════════════════════════════════════════════════════
import { Router } from 'express'
import { db, uid, now } from '../db.js'
import { requireAuth } from '../auth.js'

const r = Router()

r.get('/', (req, res) => {
  const { user_id, make, year_min, year_max, engine_min, engine_max, limit = 200 } = req.query
  let sql = `
    SELECT b.*, pr.username, pr.full_name, pr.avatar_url
    FROM bikes b
    JOIN profiles pr ON pr.id = b.user_id
    WHERE 1 = 1
  `
  const params = []
  if (user_id)    { sql += ' AND b.user_id = ?';    params.push(user_id) }
  if (make)       { sql += ' AND LOWER(b.make) = ?'; params.push(String(make).toLowerCase()) }
  if (year_min)   { sql += ' AND b.year >= ?';     params.push(Number(year_min)) }
  if (year_max)   { sql += ' AND b.year <= ?';     params.push(Number(year_max)) }
  if (engine_min) { sql += ' AND b.engine_cc >= ?'; params.push(Number(engine_min)) }
  if (engine_max) { sql += ' AND b.engine_cc <= ?'; params.push(Number(engine_max)) }
  sql += ' ORDER BY b.created_at DESC LIMIT ?'
  params.push(Number(limit))

  res.json(db.prepare(sql).all(...params).map(b => ({
    ...b,
    profiles: { username: b.username, full_name: b.full_name, avatar_url: b.avatar_url }
  })))
})

r.post('/', requireAuth, (req, res) => {
  const { make, model, year, engine_cc, color, description, photo_url } = req.body || {}
  if (!make || !model) return res.status(400).json({ error: 'Make and model are required.' })
  const id = uid()
  db.prepare(`
    INSERT INTO bikes (id, user_id, make, model, year, engine_cc, color, description, photo_url, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, req.user.id, make, model, year || null, engine_cc || null, color || null, description || null, photo_url || null, now())
  const row = db.prepare(`
    SELECT b.*, pr.username, pr.full_name, pr.avatar_url
    FROM bikes b
    JOIN profiles pr ON pr.id = b.user_id
    WHERE b.id = ?
  `).get(id)
  res.json({ ...row, profiles: { username: row.username, full_name: row.full_name, avatar_url: row.avatar_url } })
})

r.patch('/:id', requireAuth, (req, res) => {
  const row = db.prepare('SELECT user_id FROM bikes WHERE id = ?').get(req.params.id)
  if (!row) return res.status(404).json({ error: 'not_found' })
  if (row.user_id !== req.user.id) return res.status(403).json({ error: 'forbidden' })
  const { make, model, year, engine_cc, color, description, photo_url } = req.body || {}
  db.prepare(`
    UPDATE bikes
       SET make        = COALESCE(?, make),
           model       = COALESCE(?, model),
           year        = COALESCE(?, year),
           engine_cc   = COALESCE(?, engine_cc),
           color       = COALESCE(?, color),
           description = COALESCE(?, description),
           photo_url   = COALESCE(?, photo_url)
     WHERE id = ?
  `).run(make ?? null, model ?? null, year ?? null, engine_cc ?? null, color ?? null, description ?? null, photo_url ?? null, req.params.id)
  res.json({ ok: true })
})

r.delete('/:id', requireAuth, (req, res) => {
  const row = db.prepare('SELECT user_id FROM bikes WHERE id = ?').get(req.params.id)
  if (!row) return res.status(404).json({ error: 'not_found' })
  if (row.user_id !== req.user.id) return res.status(403).json({ error: 'forbidden' })
  db.prepare('DELETE FROM bikes WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

export default r
