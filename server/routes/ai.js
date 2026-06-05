// ════════════════════════════════════════════════════════════════
// Bikers Portal — AI Road Concierge (OpenAI + curated fallback)
// ════════════════════════════════════════════════════════════════
import { Router } from 'express'

const r = Router()

r.post('/recommend', async (req, res) => {
  const { riderLevel = 'Intermediate', terrains = [], maxDistance = 500, region = 'India', mood = '' } = req.body || {}
  const AI_KEY = process.env.AI_API_KEY

  if (!AI_KEY) {
    return res.json({
      ...fallback({ riderLevel, terrains, maxDistance, region, mood }),
      notice: 'Concierge service is temporarily unavailable. Showing house recommendations.'
    })
  }

  try {
    const sys = `You are a refined route concierge for an Indian premium biker club.
You suggest motorcycle journeys in a quiet, mature, editorial voice. No marketing fluff.
Return STRICT JSON: { "recommendations": [ { "title": string, "distance_km": number, "difficulty": "Easy"|"Medium"|"Hard", "terrain": string, "description": string } ] }
Always return exactly 3 items. Do not include any prose outside the JSON.`

    const user = `Suggest 3 motorcycle routes with these constraints:
- Rider level: ${riderLevel}
- Preferred terrain: ${terrains.join(', ') || 'Mixed'}
- Maximum distance: ${maxDistance} km
- Region: ${region}
- Mood: ${mood || 'balanced'}

Routes should feel curated and real, with concrete place names, terrain honesty, and an editorial description.`

    const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AI_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: process.env.AI_MODEL || 'gpt-4o-mini',
        temperature: 0.7,
        messages: [
          { role: 'system', content: sys },
          { role: 'user',   content: user }
        ],
        response_format: { type: 'json_object' }
      })
    })

    if (!aiRes.ok) throw new Error(`Provider responded ${aiRes.status}`)

    const data = await aiRes.json()
    let parsed
    try {
      const content = data?.choices?.[0]?.message?.content
      parsed = typeof content === 'string' ? JSON.parse(content) : content
    } catch {
      throw new Error('Malformed provider response')
    }

    const recs = normalise(parsed?.recommendations)
    if (recs.length === 0) throw new Error('No usable recommendations returned')

    return res.json({ recommendations: recs })
  } catch (e) {
    return res.json({
      ...fallback({ riderLevel, terrains, maxDistance, region, mood }),
      notice: 'Concierge service is temporarily unavailable. Showing house recommendations.'
    })
  }
})

function normalise(list) {
  if (!Array.isArray(list)) return []
  const out = []
  for (const r of list) {
    if (!r || typeof r !== 'object') continue
    const title = String(r.title || '').trim()
    if (!title) continue
    out.push({
      title,
      distance_km: Number(r.distance_km) || 0,
      difficulty: ['Easy', 'Medium', 'Hard'].includes(r.difficulty) ? r.difficulty : 'Medium',
      terrain:    String(r.terrain || 'Mixed').slice(0, 40),
      description: String(r.description || '').trim().slice(0, 600)
    })
    if (out.length >= 3) break
  }
  return out
}

function fallback({ riderLevel = 'Intermediate', terrains = [], maxDistance = 500, region = 'India', mood = '' } = {}) {
  const all = [
    { title: 'Manali to Spiti — The High Pass Run',                  distance_km: 220, difficulty: 'Hard',   terrain: 'Mountain', description: 'A two-day climb through Rohtang and Kunzum, with cold desert light, thin air, and roads that demand patience. Carry layers; carry water.', regions: ['himachal','spiti','manali','ladakh','leh','north'] },
    { title: 'Mumbai to Mahabaleshwar — Western Ghats Dawn Run',     distance_km: 250, difficulty: 'Medium', terrain: 'Mountain', description: 'An early-morning sweep through mist and switchbacks, finished in a colonial hill station with excellent chai and a slow afternoon.',         regions: ['mumbai','pune','maharashtra','western ghats'] },
    { title: 'Bangalore to Coorg — The Plantation Bends',            distance_km: 260, difficulty: 'Medium', terrain: 'Mixed',    description: 'Coffee country roads with flowing corners, sudden rain, and the smell of wet earth on warm tarmac.',                                          regions: ['bangalore','karnataka','coorg','mysore','chikmagalur'] },
    { title: 'Delhi to Jaipur — The Heritage Express',                distance_km: 280, difficulty: 'Easy',   terrain: 'Highway',  description: 'A composed six-hour ride on good tarmac, ending at the gates of the Pink City for a long lunch and longer stories.',                       regions: ['delhi','jaipur','rajasthan','gurgaon'] },
    { title: 'Leh — Khardung La Disposition',                         distance_km: 120, difficulty: 'Hard',   terrain: 'Mountain', description: 'A short, sharp climb to one of the highest motorable passes in the world. Acclimatise first. Carry water. Carry patience.',                 regions: ['leh','ladakh','kashmir','srinagar','manali'] },
    { title: 'Pondicherry Coast — Slow Salt Run',                     distance_km: 160, difficulty: 'Easy',   terrain: 'Highway',  description: 'A relaxed coastal traverse past Auroville, with the Bay of Bengal to your right and unhurried French quarter dinners to your left.',        regions: ['pondicherry','chennai','tamil','auroville','mahabalipuram'] },
    { title: 'Rann of Kutch — The White Salt Pilgrimage',             distance_km: 380, difficulty: 'Medium', terrain: 'Dirt',     description: 'Long flat horizons, white earth, and a quiet that asks you to ride slowly. Best in winter, on a machine you trust.',                     regions: ['kutch','gujarat','bhuj','ahmedabad'] },
    { title: 'Kerala Spice Trail — The Western Ghat Garden Run',      distance_km: 320, difficulty: 'Medium', terrain: 'Mixed',    description: 'Curves through tea and cardamom country, monsoon-green and perfumed. The road bends like a polite question.',                            regions: ['kerala','munnar','cochin','kochi','wayanad'] },
    { title: 'Shillong to Tawang — The Eastern Cordillera',           distance_km: 480, difficulty: 'Hard',   terrain: 'Mountain', description: 'A long, honest ride through the eastern Himalayas. Three days well planned, weather permitting. Do not rush the road.',                regions: ['shillong','meghalaya','tawang','arunachal','northeast','assam'] },
    { title: 'Udaipur to Mount Abu — The Aravalli Quiet',              distance_km: 180, difficulty: 'Medium', terrain: 'Mountain', description: 'A measured ride through the oldest fold mountains in India, with reflective lake stops and a cool pine-scented summit at the end.',       regions: ['udaipur','rajasthan','mount abu','sirohi'] }
  ]

  const wantTerrain = new Set(terrains.map(t => String(t).toLowerCase()))
  const regionKey = String(region).toLowerCase()

  let pool = all
  if (wantTerrain.size > 0) {
    const m = all.filter(r => wantTerrain.has(r.terrain.toLowerCase()))
    if (m.length >= 3) pool = m
  }
  const rMatch = pool.filter(r => r.regions.some(x => regionKey.includes(x)))
  if (rMatch.length >= 3) pool = rMatch
  const dMatch = pool.filter(r => r.distance_km <= Number(maxDistance) + 50)
  if (dMatch.length >= 3) pool = dMatch

  if (mood) {
    const m = mood.toLowerCase()
    const mMatch = pool.filter(r => r.description.toLowerCase().includes(m) || r.title.toLowerCase().includes(m))
    if (mMatch.length >= 1) pool = mMatch.concat(pool).slice(0, 3)
  }

  const seen = new Set()
  const out = []
  for (const r of pool) {
    if (seen.has(r.title)) continue
    seen.add(r.title)
    const { regions, ...clean } = r
    out.push(clean)
    if (out.length >= 3) break
  }
  if (out.length < 3) {
    for (const r of all) {
      if (seen.has(r.title)) continue
      seen.add(r.title)
      const { regions, ...clean } = r
      out.push(clean)
      if (out.length >= 3) break
    }
  }
  return { recommendations: out }
}

export default r
