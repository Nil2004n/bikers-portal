// ════════════════════════════════════════════════════════════════
// Bikers Portal — Auth routes
// ════════════════════════════════════════════════════════════════
import { Router } from 'express'
import { db, uid, now } from '../db.js'
import { hashPassword, verifyPassword, createSession, destroySession, requireAuth } from '../auth.js'

const r = Router()

// ── Sign up ──────────────────────────────────────────────────
r.post('/signup', (req, res) => {
  const { password, data = {} } = req.body || {}
  // The client collects a "username" field; the login identifier is the username
  // (matching the seed accounts and the rest of the app). Email is optional metadata.
  const username = (data.username || req.body?.email || '').toString().trim()
  const email    = (req.body?.email && data.username) ? String(req.body.email).trim().toLowerCase() : null

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' })
  }
  if (String(password).length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' })
  }
  if (!/^[a-z0-9_]{3,20}$/i.test(username)) {
    return res.status(400).json({ error: 'Username must be 3–20 characters (letters, numbers, underscore).' })
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Enter a valid email address.' })
  }
  if (!data.full_name) {
    return res.status(400).json({ error: 'Full name is required.' })
  }

  // Username uniqueness (case-insensitive)
  const existing = db.prepare('SELECT id FROM profiles WHERE username = ? COLLATE NOCASE').get(username)
  if (existing) {
    return res.status(409).json({ error: 'That username is already taken.' })
  }

  const { hash, salt } = hashPassword(password)
  const id = uid()
  try {
    db.prepare(`
      INSERT INTO profiles (id, username, full_name, bio, bike_model, avatar_url, password_hash, password_salt, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      username.toLowerCase(),
      data.full_name,
      '',
      data.bike_model || null,
      null,
      hash,
      salt,
      now()
    )
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }

  const { token, expires_at } = createSession(id)
  const profile = db.prepare('SELECT id, username, full_name, bio, bike_model, avatar_url, created_at FROM profiles WHERE id = ?').get(id)
  res.json({ user: profile, session: { token, expires_at } })
})

// ── Sign in ──────────────────────────────────────────────────
r.post('/signin', (req, res) => {
  const { email, password } = req.body || {}
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' })
  }
  const row = db.prepare('SELECT * FROM profiles WHERE username = ? COLLATE NOCASE').get(String(email).toLowerCase())
  if (!row) {
    return res.status(401).json({ error: 'Those credentials do not open the road.' })
  }
  if (!verifyPassword(password, row.password_hash, row.password_salt)) {
    return res.status(401).json({ error: 'Those credentials do not open the road.' })
  }
  const { token, expires_at } = createSession(row.id)
  const { password_hash, password_salt, ...profile } = row
  res.json({ user: profile, session: { token, expires_at } })
})

// ── Sign out ─────────────────────────────────────────────────
r.post('/signout', requireAuth, (req, res) => {
  destroySession(req.token)
  res.json({ ok: true })
})

// ── Current session ──────────────────────────────────────────
r.get('/session', (req, res) => {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim()
  const row = db.prepare(`
    SELECT s.token, s.expires_at, p.id, p.username, p.full_name, p.bio, p.bike_model, p.avatar_url, p.created_at
    FROM sessions s
    JOIN profiles p ON p.id = s.user_id
    WHERE s.token = ?
  `).get(token)
  if (!row) return res.json({ session: null, user: null })
  if (new Date(row.expires_at).getTime() < Date.now()) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token)
    return res.json({ session: null, user: null })
  }
  res.json({
    session: { token: row.token, expires_at: row.expires_at },
    user:    { id: row.id, username: row.username, full_name: row.full_name, bio: row.bio, bike_model: row.bike_model, avatar_url: row.avatar_url, created_at: row.created_at }
  })
})

// ── Current user ─────────────────────────────────────────────
r.get('/me', requireAuth, (req, res) => {
  const { password_hash, password_salt, ...user } = db.prepare('SELECT * FROM profiles WHERE id = ?').get(req.user.id)
  res.json({ user })
})

export default r
