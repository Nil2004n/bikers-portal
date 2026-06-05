# 🏍️ Bikers Portal

A community platform for motorcycle enthusiasts.

## Stack
| Layer     | Tech                                               |
|-----------|----------------------------------------------------|
| Frontend  | HTML · Tailwind CSS (CDN) · Vanilla JS (ESM)       |
| Backend   | Node.js · Express · better-sqlite3                 |
| Realtime  | Server-Sent Events                                 |
| Storage   | Local filesystem (`data/uploads/{avatars,post-images,bike-images}`) |
| AI        | OpenAI (optional) · curated fallback set           |
| Deploy    | Any Node host                                     |

## Pages
| File                 | Auth  |
|----------------------|-------|
| index.html           | ❌    |
| register.html        | ❌    |
| feed.html            | ✅    |
| bikes.html           | ✅    |
| trips.html           | ✅    |
| recommendations.html | ✅    |
| profile.html         | ✅    |

## Quick Start
```bash
# 1. Install
npm install

# 2. Seed sample data (6 riders, 6 posts, 7 bikes, 7 trips)
npm run seed

# 3. Run
npm start          # → http://localhost:3000
```

Optional environment variables:
- `PORT` — default 3000
- `AI_API_KEY` — enables OpenAI-powered `/api/ai/recommend`
- `AI_MODEL`   — default `gpt-4o-mini`

## Sample Logins
| Email       | Password   | Bio                                                   |
|-------------|------------|-------------------------------------------------------|
| arjun       | siliguri   | Long-distance rider. Royal Enfield at heart.          |
| mira        | darjeeling | Bonneville, chai stops, slow roads.                   |
| rohan       | coorg      | Twenty years of riding, GS currently.                 |
| ishita      | spiti      | Himalayan 450 · cold deserts & high passes.           |
| vikram      | jaisalmer  | Thar dunes, solo, golden hour.                        |
| anika       | chikmagalur| Coffee, cardamom, monsoons.                           |

## Project Layout
```
server/
  index.js          ← Express app, mounts /api/* + static + /uploads
  db.js             ← better-sqlite3 connection
  auth.js           ← scrypt hash + bearer token sessions
  realtime.js       ← EventEmitter for SSE
  migrations/
    001_init.sql    ← schema
  routes/
    auth.js  profiles.js  posts.js  bikes.js
    trips.js likes.js  comments.js  storage.js  ai.js
  seed.js           ← npm run seed
data/
  bikers.db         ← SQLite database (gitignored)
  uploads/          ← user-uploaded files (gitignored)
js/
  api.js            ← frontend client (auth, from(), storage, realtime)
  auth-guard.js     ← session check, navbar, confirm modal
assets/
  style.css  logo.svg
```

## API Quick Reference
| Method | Path                          | Auth |
|--------|-------------------------------|------|
| POST   | /api/auth/signup              |      |
| POST   | /api/auth/signin              |      |
| POST   | /api/auth/signout             | ✅   |
| GET    | /api/auth/me                  | ✅   |
| GET    | /api/profiles                 |      |
| PATCH  | /api/profiles/me              | ✅   |
| GET    | /api/posts                    |      |
| POST   | /api/posts                    | ✅   |
| DELETE | /api/posts/:id                | ✅ (author) |
| POST   | /api/likes/toggle             | ✅   |
| GET    | /api/comments?post_id=…       |      |
| POST   | /api/comments                 | ✅   |
| DELETE | /api/comments/:id             | ✅ (author) |
| GET    | /api/bikes                    |      |
| POST   | /api/bikes                    | ✅   |
| PATCH  | /api/bikes/:id                | ✅ (owner) |
| DELETE | /api/bikes/:id                | ✅ (owner) |
| GET    | /api/trips?is_public=true     |      |
| POST   | /api/trips                    | ✅   |
| POST   | /api/storage/:bucket          | ✅ (multipart) |
| POST   | /api/ai/recommend             |      |
| GET    | /api/posts/stream             |      (SSE) |
