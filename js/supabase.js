// ── Supabase Client — single source of truth ─────────────────
// Replace the two values below:
// Supabase Dashboard → Settings → API → Project URL & anon key
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL      = 'https://YOUR_PROJECT_ID.supabase.co'
const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY_HERE'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
