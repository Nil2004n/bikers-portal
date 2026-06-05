/**
 * Netlify Serverless Function — AI Ride Recommendations
 * ──────────────────────────────────────────────────────
 * Route  : POST /api/ai-recommend
 * Env var: AI_API_KEY  (Netlify Dashboard → Environment Variables)
 *          This key NEVER reaches the browser.
 *
 * Request body (JSON):
 *   { riderLevel, terrains[], maxDistance, region }
 */
export default async (req) => {
  if (req.method !== 'POST')
    return new Response('Method Not Allowed', { status: 405 })

  const AI_API_KEY = process.env.AI_API_KEY
  if (!AI_API_KEY)
    return new Response(JSON.stringify({ error: 'AI key not configured' }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    })

  try {
    const { riderLevel, terrains, maxDistance, region } = await req.json()

    // TODO: swap for your AI provider (Gemini / Groq / Anthropic etc.)
    const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a motorcycle route expert for India. Return a JSON object with a "recommendations" array.' },
          { role: 'user',   content: `Rider: ${riderLevel}, Terrain: ${terrains?.join(', ')}, Max: ${maxDistance}km, Region: ${region}. Each item: { title, distance_km, difficulty, terrain, description }` }
        ],
        response_format: { type: 'json_object' }
      })
    })

    const data = await aiRes.json()
    return new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    })
  }
}

export const config = { path: '/api/ai-recommend' }
