// ── Auth Guard ────────────────────────────────────────────────
// Include as the FIRST module script on every protected page,
// BEFORE any other module that depends on window.__bpUser.
//
//   <script type="module" src="./js/auth-guard.js"></script>
//
// Behaviour:
//   • If no session → redirect to /index.html
//   • Else → expose window.__bpUser and listen for SIGNED_OUT
import { supabase } from './supabase.js'

const { data: { session } } = await supabase.auth.getSession()

if (!session) {
  window.location.replace('/index.html')
} else {
  window.__bpUser = session.user
  supabase.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') window.location.href = '/index.html'
  })
}
