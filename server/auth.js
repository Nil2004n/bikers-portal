// ════════════════════════════════════════════════════════════════
// Bikers Portal — Auth helpers (scrypt password hashing + tokens)
// ════════════════════════════════════════════════════════════════
import crypto from 'node:crypto'
import { db, now, uid } from './db.js'

const SCRYPT_KEYLEN = 64
const SESSION_TTL_HOURS = 24 * 30     // 30 days

// ── Passwords ────────────────────────────────────────────────
export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(password, salt, SCRYPT_KEYLEN).toString('hex')
  return { hash, salt }
}

export function verifyPassword(password, hash, salt) {
  if (!hash || !salt) return false
  const computed = crypto.scryptSync(password, salt, SCRYPT_KEYLEN)
  const stored   = Buffer.from(hash, 'hex')
  if (computed.length !== stored.length) return false
  return crypto.timingSafeEqual(computed, stored)
}

// ── Sessions ─────────────────────────────────────────────────
export function createSession(userId) {
  const token     = crypto.randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + SESSION_TTL_HOURS * 3600 * 1000).toISOString()
  db.prepare(
    'INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)'
  ).run(token, userId, expiresAt)
  return { token, expires_at: expiresAt }
}

export function getSessionUser(token) {
  if (!token) return null
  const row = db.prepare(`
    SELECT s.token, s.expires_at, p.id, p.username, p.full_name, p.avatar_url
    FROM sessions s
    JOIN profiles p ON p.id = s.user_id
    WHERE s.token = ?
  `).get(token)
  if (!row) return null
  if (new Date(row.expires_at).getTime() < Date.now()) {
    destroySession(token)
    return null
  }
  return row
}

export function destroySession(token) {
  if (!token) return
  db.prepare('DELETE FROM sessions WHERE token = ?').run(token)
}

// ── Request helper: extract bearer token from headers ───────
export function extractToken(req) {
  const auth = req.headers.authorization || ''
  if (auth.startsWith('Bearer ')) return auth.slice(7).trim()
  // Also accept raw token in case the client sends it bare
  if (auth && !auth.includes(' ')) return auth.trim()
  return null
}

// ── Middleware: require auth (populates req.user) ────────────
export function requireAuth(req, res, next) {
  const token = extractToken(req)
  const user  = getSessionUser(token)
  if (!user) return res.status(401).json({ error: 'unauthorized' })
  req.user = user
  req.token = token
  next()
}

// ── Middleware: optional auth (populates req.user if present)
export function optionalAuth(req, res, next) {
  const token = extractToken(req)
  const user  = getSessionUser(token)
  if (user) {
    req.user = user
    req.token = token
  }
  next()
}
