// ════════════════════════════════════════════════════════════════
// Bikers Portal — Server entry (Express)
// ════════════════════════════════════════════════════════════════
import express from 'express'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { initSchema, db } from './db.js'

import authRoutes     from './routes/auth.js'
import profileRoutes  from './routes/profiles.js'
import postRoutes     from './routes/posts.js'
import bikeRoutes     from './routes/bikes.js'
import tripRoutes     from './routes/trips.js'
import likeRoutes     from './routes/likes.js'
import commentRoutes  from './routes/comments.js'
import storageRoutes  from './routes/storage.js'
import aiRoutes       from './routes/ai.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT      = dirname(__dirname)
const PORT      = Number(process.env.PORT) || 3000

// ── Initialise DB on first run ───────────────────────────────
initSchema()
const userCount = db.prepare('SELECT COUNT(*) AS n FROM profiles').get().n
if (userCount === 0) {
  console.log('• profiles table is empty — run `npm run seed` to populate sample data')
}

const app = express()

// ── Middleware ──────────────────────────────────────────────
app.use(express.json({ limit: '2mb' }))
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  next()
})

// ── Health ──────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  const profiles = db.prepare('SELECT COUNT(*) AS n FROM profiles').get().n
  const posts    = db.prepare('SELECT COUNT(*) AS n FROM posts').get().n
  const bikes    = db.prepare('SELECT COUNT(*) AS n FROM bikes').get().n
  const trips    = db.prepare('SELECT COUNT(*) AS n FROM trips').get().n
  res.json({
    ok: true,
    db: 'sqlite',
    counts: { profiles, posts, bikes, trips },
    ts: new Date().toISOString()
  })
})

// ── API routes ──────────────────────────────────────────────
app.use('/api/auth',     authRoutes)
app.use('/api/profiles', profileRoutes)
app.use('/api/posts',    postRoutes)
app.use('/api/bikes',    bikeRoutes)
app.use('/api/trips',    tripRoutes)
app.use('/api/likes',    likeRoutes)
app.use('/api/comments', commentRoutes)
app.use('/api/storage',  storageRoutes)
app.use('/api/ai',       aiRoutes)

// ── Static uploads (avatars, post-images, bike-images) ──────
app.use('/uploads', express.static(join(ROOT, 'data', 'uploads'), {
  fallthrough: true,
  maxAge: '7d',
  setHeaders(res) {
    res.setHeader('Cache-Control', 'public, max-age=604800, immutable')
  }
}))

// ── Static frontend (everything else from project root) ────
app.use(express.static(ROOT, {
  extensions: ['html'],
  setHeaders(res, path) {
    if (path.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache')
    }
  }
}))

// SPA-style fallback for client-side refresh on protected pages
// (express.static with extensions: ['html'] already serves /foo.html from
//  /foo and /foo.html, so this is only a safety net for explicit deep links.)
app.get(/^\/(feed|bikes|trips|recommendations|profile)\.html$/, (req, res, next) => {
  res.sendFile(join(ROOT, req.path), (err) => err && next(err))
})

// ── 404 / error handler ─────────────────────────────────────
app.use((err, req, res, next) => {
  // Log the full error server-side for debugging; return a sanitized message.
  console.error('[err]', err.stack || err.message || err)
  const status = err.status || err.statusCode || 500
  res.status(status).json({ error: status >= 500 ? 'Server error' : (err.message || 'Request failed') })
})

// ── 404 for unknown API routes ─────────────────────────────
app.use('/api', (req, res) => res.status(404).json({ error: 'not_found' }))

app.listen(PORT, () => {
  console.log('')
  console.log('  ╔═══════════════════════════════════════════╗')
  console.log('  ║   BIKERS PORTAL — Road Society            ║')
  console.log('  ╚═══════════════════════════════════════════╝')
  console.log('')
  console.log(`  ✓  Listening on   http://localhost:${PORT}`)
  console.log(`  ✓  Static root    ${ROOT}`)
  console.log(`  ✓  SQLite at      ${join(ROOT, 'data', 'bikers.db')}`)
  console.log('')
})
