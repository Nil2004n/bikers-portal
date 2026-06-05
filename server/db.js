// ════════════════════════════════════════════════════════════════
// Bikers Portal — SQLite layer
// ════════════════════════════════════════════════════════════════
import Database from 'better-sqlite3'
import { readFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT     = dirname(__dirname)
const DATA_DIR = join(ROOT, 'data')
const DB_PATH  = join(DATA_DIR, 'bikers.db')
const UPLOADS  = join(DATA_DIR, 'uploads')

if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true })
if (!existsSync(UPLOADS))  mkdirSync(UPLOADS, { recursive: true })
for (const b of ['avatars', 'post-images', 'bike-images']) {
  const d = join(UPLOADS, b)
  if (!existsSync(d)) mkdirSync(d, { recursive: true })
}

export const db = new Database(DB_PATH)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

// ── Initialise schema ───────────────────────────────────────
export function initSchema() {
  const sql = readFileSync(join(__dirname, 'migrations', '001_init.sql'), 'utf8')
  db.exec(sql)
  console.log('✓ schema applied →', DB_PATH)
}

// ── Helpers ─────────────────────────────────────────────────
export const uid  = () => randomUUID()
export const now  = () => new Date().toISOString()

export function getProfileById(id) {
  return db.prepare('SELECT id, username, full_name, bio, bike_model, avatar_url, created_at FROM profiles WHERE id = ?').get(id)
}

export function getProfileByUsername(username) {
  return db.prepare('SELECT * FROM profiles WHERE username = ? COLLATE NOCASE').get(username)
}

export function getProfileByEmail(email) {
  // Email is stored as `username@<domain>` only if we explicitly support it.
  // For this project we use username as the login identifier.
  return db.prepare('SELECT * FROM profiles WHERE username = ? COLLATE NOCASE').get(email)
}

// CLI: `node server/db.js --init`
if (process.argv.includes('--init')) {
  initSchema()
  process.exit(0)
}
