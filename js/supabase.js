// ── Supabase Client — single source of truth ─────────────────
// Replace the two values below:
// Supabase Dashboard → Settings → API → Project URL & anon key
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL      = 'https://hdsuxbebxcjxrtczyrun.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_vwvP5JeS0z-XT-DkgYCvUA_nxH9IN37'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
