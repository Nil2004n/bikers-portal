/**
 * Netlify Serverless Function — AI Ride Recommendations
 * ──────────────────────────────────────────────────────
 * Route  : POST /api/ai-recommend
 * Env    : AI_API_KEY     (server-side only, never reaches the browser)
 *          AI_MODEL       (optional, default: gpt-4o-mini)
 *          AI_BASE_URL    (optional, default: https://api.openai.com/v1)
 *
 * Request body (JSON):
 *   { riderLevel, terrains[], maxDistance, region, mood }
 *
 * Response (JSON):
 *   { recommendations: [{ title, distance_km, difficulty, terrain, description }, ...], fallback?: boolean }
 *
 * If the AI provider is missing, rate-limited, or returns an unusable answer,
 * the function returns a structured fallback so the frontend never breaks.
 */
export default async (req) => {
  const json = (data, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
    })

  if (req.method === 'OPTIONS') {
    return new Response('', { status: 204, headers: corsHeaders() })
  }
  if (req.method !== 'POST') return json({ error: 'Method Not Allowed' }, 405)

  const API_KEY   = process.env.AI_API_KEY
  const MODEL     = process.env.AI_MODEL     || 'gpt-4o-mini'
  const BASE_URL  = (process.env.AI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '')

  let body = {}
  try { body = await req.json() } catch (_) { return json({ error: 'Invalid JSON' }, 400) }

  const riderLevel  = (body.riderLevel  || 'Intermediate').toString()
  const terrains    = Array.isArray(body.terrains) && body.terrains.length
                       ? body.terrains.slice(0, 6).map(String)
                       : ['Mixed']
  const maxDistance = Number.isFinite(+body.maxDistance) ? +body.maxDistance : 300
  const region      = (body.region || 'India').toString().slice(0, 80)
  const mood        = (body.mood   || '').toString().slice(0, 200)

  // If no key, skip the network call entirely and serve the fallback
  if (!API_KEY) return json(fallback(region, terrains, maxDistance, mood), 200)

  const system = `You are a quiet, well-travelled motorcycle concierge for the Bikers Portal — a premium riding society.
You propose refined, real-world road trips. Speak with taste and restraint; never use startup slang, emojis, or hype.
Respect the rider's level, the chosen terrain, the distance ceiling, and the region.
If a region is given, suggest routes within or near it; if it is vague ("India"), pick from across the country.`

  const user = `Rider level: ${riderLevel}
Terrain preference(s): ${terrains.join(', ')}
Maximum distance (km): ${maxDistance}
Region: ${region}
${mood ? `Mood: ${mood}` : ''}

Return a JSON object with a single key "recommendations" — an array of exactly 3 items.
Each item must have:
  title         (string, evocative and short, ≤ 60 chars)
  distance_km   (integer, ≤ maxDistance)
  difficulty    (one of: "Easy" | "Medium" | "Hard")
  terrain       (one of: "Highway" | "Mountain" | "City" | "Dirt" | "Touring" | "Mixed")
  description   (string, 2–3 sentences, cinematic but grounded, ≤ 220 chars)`

  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 12000)
    const r = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      signal: ctrl.signal,
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.7,
        messages: [
          { role: 'system', content: system },
          { role: 'user',   content: user },
        ],
        response_format: { type: 'json_object' },
      }),
    })
    clearTimeout(t)

    if (!r.ok) return json(fallback(region, terrains, maxDistance, mood), 200)
    const data = await r.json().catch(() => null)
    const text = data?.choices?.[0]?.message?.content
    if (!text) return json(fallback(region, terrains, maxDistance, mood), 200)

    let parsed
    try { parsed = JSON.parse(text) } catch { return json(fallback(region, terrains, maxDistance, mood), 200) }
    const recs = sanitize(parsed.recommendations, maxDistance)
    if (recs.length < 3) {
      // pad with fallback to always return 3
      const fb = fallback(region, terrains, maxDistance, mood).recommendations
      for (const item of fb) {
        if (recs.length >= 3) break
        if (!recs.some((r) => r.title === item.title)) recs.push(item)
      }
      return json({ recommendations: recs.slice(0, 3), fallback: true }, 200)
    }
    return json({ recommendations: recs.slice(0, 3) }, 200)
  } catch (_) {
    return json(fallback(region, terrains, maxDistance, mood), 200)
  }
}

export const config = { path: '/api/ai-recommend' }

/* ── Helpers ───────────────────────────────────────────── */
function corsHeaders() {
  return {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }
}

function sanitize(list, max) {
  if (!Array.isArray(list)) return []
  const allowed = new Set(['Easy', 'Medium', 'Hard'])
  const terrains = new Set(['Highway', 'Mountain', 'City', 'Dirt', 'Touring', 'Mixed'])
  return list
    .map((r) => ({
      title:        String(r?.title || '').slice(0, 80).trim(),
      distance_km:  Math.min(Math.max(parseInt(r?.distance_km, 10) || 0, 1), max || 9999),
      difficulty:   allowed.has(r?.difficulty) ? r.difficulty : 'Medium',
      terrain:      terrains.has(r?.terrain)   ? r.terrain    : 'Mixed',
      description:  String(r?.description || '').slice(0, 280).trim(),
    }))
    .filter((r) => r.title && r.description)
}

function fallback(region, terrains, maxDistance, mood) {
  const all = [
    { title: 'Western Ghats Dawn Run',  distance_km: 180, difficulty: 'Medium', terrain: 'Mountain', description: 'A refined early-morning climb through mist, bends, and old hillside roads.' },
    { title: 'Konkan Coastal Crawl',    distance_km: 240, difficulty: 'Easy',   terrain: 'Highway',  description: 'A measured ride along the western coast, salt air, and unhurried towns.' },
    { title: 'Spiti Cold Ascent',       distance_km: 420, difficulty: 'Hard',   terrain: 'Mountain', description: 'A serious high-altitude push through stark valleys and moonlike passes.' },
    { title: 'Deccan Plateau Circuit',  distance_km: 300, difficulty: 'Medium', terrain: 'Touring',  description: 'A long, considered loop through open plateau country, with quiet stops for chai.' },
    { title: 'Nilgiri Hairpin Run',     distance_km: 130, difficulty: 'Medium', terrain: 'Mountain', description: 'Forty-plus well-mannered bends climbing into cool, forested high country.' },
    { title: 'Coastal Stretch Sundowner', distance_km: 200, difficulty: 'Easy',  terrain: 'Mixed',    description: 'An unhurried day ride that ends where the sun meets the sea.' },
  ]
  // honour terrain preference if present
  const t = (terrains || [])[0]
  const filtered = t && t !== 'Mixed' ? all.filter((x) => x.terrain === t).concat(all) : all
  const cap = (Number.isFinite(maxDistance) && maxDistance > 0) ? maxDistance : 300
  const list = []
  const seen = new Set()
  for (const r of filtered) {
    if (list.length >= 3) break
    if (r.distance_km > cap) continue
    if (seen.has(r.title)) continue
    seen.add(r.title); list.push(r)
  }
  // if nothing fit the cap, relax distance
  if (list.length < 3) {
    for (const r of filtered) {
      if (list.length >= 3) break
      if (seen.has(r.title)) continue
      seen.add(r.title); list.push(r)
    }
  }
  return { recommendations: list.slice(0, 3), fallback: true }
}
