-- ════════════════════════════════════════════════════════════════
-- Bikers Portal — Initial schema (SQLite)
-- ════════════════════════════════════════════════════════════════
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ── Profiles ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id            TEXT PRIMARY KEY,
  username      TEXT UNIQUE NOT NULL COLLATE NOCASE,
  full_name     TEXT NOT NULL,
  bio           TEXT NOT NULL DEFAULT '',
  bike_model    TEXT,
  avatar_url    TEXT,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username);
CREATE INDEX IF NOT EXISTS idx_profiles_created ON profiles(created_at DESC);

-- ── Posts ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS posts (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  content    TEXT,
  image_url  TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_user    ON posts(user_id, created_at DESC);

-- ── Bikes ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bikes (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  make        TEXT NOT NULL,
  model       TEXT NOT NULL,
  year        INTEGER,
  engine_cc   INTEGER,
  color       TEXT,
  description TEXT,
  photo_url   TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_bikes_created ON bikes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bikes_user    ON bikes(user_id, created_at DESC);

-- ── Trips ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS trips (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  title       TEXT NOT NULL,
  start_loc   TEXT NOT NULL,
  end_loc     TEXT NOT NULL,
  waypoints   TEXT,                      -- JSON array
  distance_km REAL,
  trip_date   TEXT,
  difficulty  TEXT,
  notes       TEXT,
  is_public   INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_trips_created ON trips(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trips_user    ON trips(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trips_public  ON trips(is_public, created_at DESC);

-- ── Likes ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS likes (
  id         TEXT PRIMARY KEY,
  post_id    TEXT NOT NULL,
  user_id    TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(post_id, user_id),
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_likes_post ON likes(post_id);
CREATE INDEX IF NOT EXISTS idx_likes_user ON likes(user_id);

-- ── Comments ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS comments (
  id         TEXT PRIMARY KEY,
  post_id    TEXT NOT NULL,
  user_id    TEXT NOT NULL,
  body       TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_comments_post    ON comments(post_id, created_at);
CREATE INDEX IF NOT EXISTS idx_comments_created ON comments(created_at DESC);

-- ── Sessions (token-based auth) ──────────────────────────────
CREATE TABLE IF NOT EXISTS sessions (
  token      TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_exp  ON sessions(expires_at);
