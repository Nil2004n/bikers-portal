// ── js/search.js ───────────────────────────────────────────
// Search across the three scopes of the portal:
//   • Riders   — profiles table
//   • Machines — bikes table (+ owner profile)
//   • Routes   — public trips  (+ owner profile)
//
// All three are server-side `.ilike` queries with a 24-row cap
// so they stay snappy even on a slow network. A small debounce
// helper is also exported for the search input on search.html.
import { supabase } from './supabase.js'

/* ── 1. Search ──────────────────────────────────────────── */

export async function searchRiders(query) {
  const q = (query || '').trim()
  if (!q) return []
  const safe = q.replace(/[%_]/g, (c) => '\\' + c)
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, full_name, avatar_url, bike_model, bio')
    .or(`username.ilike.%${safe}%,full_name.ilike.%${safe}%,bike_model.ilike.%${safe}%`)
    .limit(24)
  if (error) return []
  return data || []
}

export async function searchMachines(query) {
  const q = (query || '').trim()
  if (!q) return []
  const safe = q.replace(/[%_]/g, (c) => '\\' + c)
  const { data, error } = await supabase
    .from('bikes')
    .select('id, user_id, make, model, year, engine_cc, color, description, photo_url, created_at, profiles:user_id ( id, username, full_name, avatar_url )')
    .or(`make.ilike.%${safe}%,model.ilike.%${safe}%,color.ilike.%${safe}%`)
    .order('created_at', { ascending: false })
    .limit(24)
  if (error) return []
  return data || []
}

export async function searchTrips(query) {
  const q = (query || '').trim()
  if (!q) return []
  const safe = q.replace(/[%_]/g, (c) => '\\' + c)
  const { data, error } = await supabase
    .from('trips')
    .select('id, user_id, title, start_loc, end_loc, distance_km, trip_date, difficulty, created_at, profiles:user_id ( id, username, full_name, avatar_url )')
    .eq('is_public', true)
    .or(`title.ilike.%${safe}%,start_loc.ilike.%${safe}%,end_loc.ilike.%${safe}%`)
    .order('created_at', { ascending: false })
    .limit(24)
  if (error) return []
  return data || []
}

/* ── 2. Debounce ────────────────────────────────────────── */

export function debounce(fn, delay = 350) {
  let t
  return function (...args) {
    clearTimeout(t)
    t = setTimeout(() => fn.apply(this, args), delay)
  }
}
