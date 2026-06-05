# 🏍️ Bikers Portal

A community platform for motorcycle enthusiasts.

## Stack
| Layer     | Tech                                               |
|-----------|----------------------------------------------------|
| Frontend  | HTML · Tailwind CSS (CDN) · Vanilla JS (ESM)       |
| Auth + DB | Supabase                                           |
| Storage   | Supabase Buckets: avatars · post-images · bike-images |
| AI        | Netlify Function → OpenAI / Gemini / Groq          |
| Deploy    | Netlify                                            |

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
# 1. Fill in credentials
#    Edit js/supabase.js → SUPABASE_URL + SUPABASE_ANON_KEY

# 2. Run schema
#    Paste supabase-schema.sql → Supabase Dashboard → SQL Editor

# 3. Preview locally
npx serve .

# 4. Deploy
#    Push to GitHub → connect Netlify → add env vars
```
