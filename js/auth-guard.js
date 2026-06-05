// ════════════════════════════════════════════════════════════════
// BIKERS PORTAL — Auth Guard + Shared Navbar
// Include as the FIRST module script on every protected page:
//   <script type="module" src="./js/auth-guard.js"></script>
// ════════════════════════════════════════════════════════════════
import { supabase } from './api.js'

// Top-level await without try/catch left pages blank if the server was
// unreachable. Catch the failure and route to sign-in instead.
let session = null
try {
  const res = await supabase.auth.getSession()
  session = res?.data?.session || null
} catch (err) {
  console.warn('[auth-guard] session check failed:', err)
}

if (!session) {
  window.location.replace('/index.html')
} else {
  // expose session globally for convenience
  window.__bp_session = session
  injectNavbar()
  attachAuthListener()
  setupInteractions()
  loadUserMeta()
}

// ── Inject shared navbar ──────────────────────────────────────
function injectNavbar() {
  const path = (window.location.pathname.split('/').pop() || 'feed.html').toLowerCase()
  const here = (file) => path === file.toLowerCase() ? 'active' : ''

  const html = `
  <header class="navbar" role="banner">
    <div class="navbar-inner">
      <a class="brand-link" href="/feed.html" aria-label="Bikers Portal home">
        <img src="/assets/logo.svg" alt="Bikers Portal" />
      </a>

      <nav class="nav-links" id="navLinks" aria-label="Primary">
        <a class="nav-link ${here('feed.html')}" href="/feed.html">Feed</a>
        <a class="nav-link ${here('bikes.html')}" href="/bikes.html">Bikes</a>
        <a class="nav-link ${here('trips.html')}" href="/trips.html">Trips</a>
        <a class="nav-link ${here('recommendations.html')}" href="/recommendations.html">Concierge</a>
      </nav>

      <div class="profile-menu" id="profileMenu">
        <button class="avatar-btn" id="avatarBtn" aria-label="Open profile menu" aria-haspopup="menu" aria-expanded="false">
          <span class="avatar-fallback avatar-xs" id="navAvatarFallback" aria-hidden="true">·</span>
          <img class="hidden" id="navAvatar" alt="" />
        </button>
        <div class="dropdown" id="profileDropdown" role="menu">
          <a href="/profile.html" role="menuitem">My Profile</a>
          <div class="divider"></div>
          <button id="logoutBtn" role="menuitem" type="button">Sign Out</button>
        </div>
      </div>

      <button class="mobile-toggle" id="mobileToggle" aria-label="Open menu" type="button">☰</button>
    </div>
  </header>
  `
  document.body.insertAdjacentHTML('afterbegin', html)
}

// ── Auth state listener ───────────────────────────────────────
function attachAuthListener() {
  supabase.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') {
      window.location.href = '/index.html'
    }
  })
}

// ── Navbar interactions ───────────────────────────────────────
function setupInteractions() {
  const btn         = document.getElementById('avatarBtn')
  const dropdown    = document.getElementById('profileDropdown')
  const logoutBtn   = document.getElementById('logoutBtn')
  const mobileBtn   = document.getElementById('mobileToggle')
  const navLinks    = document.getElementById('navLinks')

  if (btn && dropdown) {
    btn.addEventListener('click', (e) => {
      e.stopPropagation()
      const open = dropdown.classList.toggle('open')
      btn.setAttribute('aria-expanded', open ? 'true' : 'false')
    })
    document.addEventListener('click', (e) => {
      if (!btn.contains(e.target) && !dropdown.contains(e.target)) {
        dropdown.classList.remove('open')
        btn.setAttribute('aria-expanded', 'false')
      }
    })
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        dropdown.classList.remove('open')
        btn.setAttribute('aria-expanded', 'false')
      }
    })
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      logoutBtn.setAttribute('aria-busy', 'true')
      logoutBtn.innerHTML = '<span class="spinner"></span> Signing out…'
      try { await supabase.auth.signOut() } catch (err) { console.warn(err) }
      // signOut() fires the SIGNED_OUT event in this tab too, but in case the
      // network call failed we still want the user out of the protected page.
      window.location.replace('/index.html')
    })
  }

  if (mobileBtn && navLinks) {
    mobileBtn.addEventListener('click', () => {
      const open = navLinks.classList.toggle('open')
      mobileBtn.setAttribute('aria-expanded', open ? 'true' : 'false')
    })
  }
}

// ── Load avatar + name into navbar ────────────────────────────
async function loadUserMeta() {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    window.__bp_user = user

    const { data: profile } = await supabase
      .from('profiles')
      .select('username, full_name, avatar_url')
      .eq('id', user.id)
      .single()

    const name = profile?.full_name || user.email?.split('@')[0] || 'Rider'
    const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase()

    const fb  = document.getElementById('navAvatarFallback')
    const img = document.getElementById('navAvatar')
    if (fb)  fb.textContent = initials || '·'
    if (img && profile?.avatar_url) {
      img.src = profile.avatar_url
      img.alt = name
      img.classList.remove('hidden')
      if (fb) fb.classList.add('hidden')
      img.addEventListener('error', () => {
        img.classList.add('hidden')
        fb?.classList.remove('hidden')
      }, { once: true })
    }
  } catch (err) {
    // silent — avatar is decorative
  }
}

// ── Custom confirm modal (replaces native window.confirm) ─────
// Usage: const ok = await window.bpAsk('Remove this machine?', { confirmText: 'Remove', danger: true })
window.bpAsk = function bpAsk(message, opts = {}) {
  const {
    title    = 'Are you certain?',
    confirmText = 'Confirm',
    cancelText  = 'Cancel',
    danger      = false
  } = opts

  return new Promise((resolve) => {
    const backdrop = document.createElement('div')
    backdrop.className = 'bp-modal-backdrop'
    backdrop.setAttribute('role', 'presentation')
    backdrop.innerHTML = `
      <div class="bp-modal" role="alertdialog" aria-modal="true" aria-labelledby="bpAskTitle" aria-describedby="bpAskBody">
        <h3 class="bp-modal-title" id="bpAskTitle">${escapeHtml(title)}</h3>
        <p class="bp-modal-body" id="bpAskBody">${escapeHtml(message)}</p>
        <div class="bp-modal-actions">
          <button class="btn btn-ghost btn-sm" data-act="cancel" type="button">${escapeHtml(cancelText)}</button>
          <button class="btn ${danger ? 'btn-burgundy' : 'btn-primary'} btn-sm" data-act="confirm" type="button">${escapeHtml(confirmText)}</button>
        </div>
      </div>
    `
    document.body.appendChild(backdrop)

    const confirmBtn = backdrop.querySelector('[data-act="confirm"]')
    const cancelBtn  = backdrop.querySelector('[data-act="cancel"]')
    setTimeout(() => confirmBtn.focus(), 30)

    function done(result) {
      window.removeEventListener('keydown', onKey)
      backdrop.remove()
      resolve(result)
    }
    function onKey(e) {
      if (e.key === 'Escape') done(false)
      if (e.key === 'Enter')  done(true)
    }
    confirmBtn.addEventListener('click', () => done(true))
    cancelBtn.addEventListener('click',  () => done(false))
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) done(false) })
    window.addEventListener('keydown', onKey)
  })
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]))
}
