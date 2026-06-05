// ── Auth Guard ────────────────────────────────────────────────
// Include as FIRST module script on every protected page:
// <script type="module" src="./js/auth-guard.js"></script>
import { supabase } from './supabase.js'
const { data: { session } } = await supabase.auth.getSession()
if (!session) window.location.replace('/index.html')
