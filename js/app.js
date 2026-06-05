// ── js/app.js ─────────────────────────────────────────────────
// Shared theme + helpers for every page.
//
// Load ORDER in <head>:
//   <script src="./js/app.js"></script>          ← this file
//   <script src="https://cdn.tailwindcss.com"></script>
//   <link rel="stylesheet" href="./assets/style.css">
//
// On protected pages also include, in <body>:
//   <script type="module" src="./js/auth-guard.js"></script>
//   <header id="bp-navbar" data-active="feed|bikes|..."></header>
//   ... page content ...
//
// Provides window.bp:
//   esc(s)              – HTML-escape a string
//   timeAgo(iso)        – "3 hours ago" / "2 days ago"
//   initialsOf(name)    – "Jane Doe" → "JD"
//   avatarHTML(...)     – <img> with initials fallback
//   toast(msg, type?)   – non-blocking status
//   confirm(msg, t?)    – custom modal, Promise<boolean>
//   loadCurrentProfile()- – fetches + caches the logged-in profile row
//   renderNavbar(active)– – paints the sticky navbar (called by bootstrap)
(function () {
  /* ── 1. Tailwind config (must precede CDN script) ───────── */
  window.tailwind = window.tailwind || {}
  window.tailwind.config = {
    darkMode: 'class',
    theme: {
      extend: {
        colors: {
          ink:      { 950:'#0c0b09', 900:'#0d0c0a', 850:'#131110', 800:'#141210', 750:'#181614', 700:'#1a1714', 600:'#201d19', 500:'#272320', 400:'#3a3129' },
          bone:     { DEFAULT:'#f0e8d8', soft:'#e8e0d2', muted:'#a89880', dim:'#6b5c4a' },
          brass:    { DEFAULT:'#c9a84c', light:'#e0c070', dark:'#9e7c2c', deep:'#6b5230' },
          burgundy: { DEFAULT:'#7a2d2d', deep:'#5a1f1f' },
          leather:  '#7a4b2a',
          bronze:   { DEFAULT:'rgba(255,235,195,0.14)', light:'rgba(255,235,195,0.08)' },
        },
        fontFamily: {
          sans:  ['"Cabinet Grotesk"','"Satoshi"','Inter','system-ui','sans-serif'],
          serif: ['"Cormorant Garamond"','"Fraunces"','Georgia','serif'],
        },
        boxShadow: {
          'inner-deep': 'inset 0 1px 0 rgba(255,235,195,0.04), inset 0 0 0 1px rgba(0,0,0,0.4)',
          'panel': '0 1px 0 rgba(255,235,195,0.03), 0 8px 24px rgba(0,0,0,0.35)',
          'brass-glow': '0 0 0 1px rgba(201,168,76,0.35), 0 0 14px rgba(201,168,76,0.18)',
        },
        borderRadius: { sm:'3px', DEFAULT:'6px', md:'6px', lg:'8px', xl:'12px' },
      },
    },
    safelist: [
      'bg-ink-700','bg-ink-800','bg-ink-600','bg-ink-500','bg-ink-850',
      'text-bone','text-bone-muted','text-bone-dim','text-bone-soft',
      'text-brass','text-brass-light','text-burgundy','text-burgundy-deep','text-leather',
      'bg-brass','bg-brass/10','bg-burgundy','bg-burgundy/15','bg-leather',
      'border-bronze','border-bronze-light','border-brass','border-brass/40','border-burgundy/40',
      'bg-bone-muted/10',
    ],
  }

  /* ── 2. Helpers ─────────────────────────────────────────── */
  const bp = {}

  bp.esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
    { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]
  ))

  bp.initialsOf = (name) => {
    if (!name) return 'R'
    return String(name).trim().split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || 'R'
  }

  bp.timeAgo = (iso) => {
    if (!iso) return ''
    const d = new Date(iso)
    const diff = Math.floor((Date.now() - d.getTime()) / 1000)
    if (diff < 0)         return 'just now'
    if (diff < 45)        return 'just now'
    if (diff < 90)        return 'a minute ago'
    const m = Math.floor(diff / 60)
    if (m < 60)           return m + ' minutes ago'
    const h = Math.floor(m / 60)
    if (h < 24)           return h + ' hours ago'
    const dys = Math.floor(h / 24)
    if (dys === 1)        return 'yesterday'
    if (dys < 7)          return dys + ' days ago'
    if (dys < 30)         return Math.floor(dys / 7) + ' weeks ago'
    return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
  }

  bp.fallbackAvatar = (initials, size) => {
    const px = size || 36
    const fs = Math.max(11, Math.round(px * 0.36))
    return `<span class="bp-avatar-fallback" style="width:${px}px;height:${px}px;font-size:${fs}px">${bp.esc(initials)}</span>`
  }

  bp.avatarHTML = (url, name, size) => {
    const px = size || 36
    const initials = bp.initialsOf(name)
    if (url) {
      return `<img src="${bp.esc(url)}" alt="" class="rounded-full object-cover bg-ink-700" style="width:${px}px;height:${px}px" onerror="this.outerHTML=window.bp.fallbackAvatar(window.bp.initialsOf('${bp.esc(name || '').replace(/'/g, "\\'")}'),${px})" />`
    }
    return bp.fallbackAvatar(initials, px)
  }

  bp.toast = (msg, type) => {
    const t = type || 'success'
    let host = document.getElementById('bp-toast-host')
    if (!host) {
      host = document.createElement('div')
      host.id = 'bp-toast-host'
      document.body.appendChild(host)
    }
    const el = document.createElement('div')
    el.className = t === 'error' ? 'toast-error' : ''
    el.textContent = msg
    el.style.opacity = '0'
    el.style.transform = 'translateY(-4px)'
    el.style.transition = 'opacity 200ms, transform 200ms'
    host.appendChild(el)
    requestAnimationFrame(() => { el.style.opacity = '1'; el.style.transform = 'translateY(0)' })
    setTimeout(() => {
      el.style.opacity = '0'
      el.style.transform = 'translateY(-4px)'
      setTimeout(() => el.remove(), 240)
    }, 2800)
  }

  bp.confirm = (message, title) => {
    return new Promise((resolve) => {
      const overlay = document.createElement('div')
      overlay.className = 'bp-modal-overlay'
      overlay.innerHTML = `
        <div class="bp-modal-card" role="dialog" aria-modal="true">
          <h3>${bp.esc(title || 'Are you sure?')}</h3>
          <p>${bp.esc(message)}</p>
          <div class="row row-end gap-3 mt-7">
            <button data-act="cancel" class="btn btn-ghost btn-sm">Cancel</button>
            <button data-act="ok" class="btn btn-danger btn-sm">Confirm</button>
          </div>
        </div>`
      document.body.appendChild(overlay)
      const close = (v) => { overlay.remove(); resolve(v) }
      overlay.addEventListener('click', (e) => { if (e.target === overlay) close(false) })
      overlay.querySelector('[data-act=cancel]').addEventListener('click', () => close(false))
      overlay.querySelector('[data-act=ok]').addEventListener('click', () => close(true))
      document.addEventListener('keydown', function esc(e) { if (e.key === 'Escape') { document.removeEventListener('keydown', esc); close(false) } })
    })
  }

  /* ── 3. Current profile (lazy + cached) ────────────────── */
  bp.currentProfile = null
  bp.loadCurrentProfile = async () => {
    if (bp.currentProfile) return bp.currentProfile
    const u = window.__bpUser
    if (!u) return null
    try {
      const mod = await import('./supabase.js')
      const supa = mod.supabase
      const { data, error } = await supa
        .from('profiles')
        .select('id, username, full_name, avatar_url, bike_model, bio, created_at')
        .eq('id', u.id)
        .maybeSingle()
      if (error) {
        // RLS or table missing — fall back to auth metadata so the navbar still renders
        bp.currentProfile = {
          id: u.id,
          username: u.user_metadata?.username || (u.email ? u.email.split('@')[0] : 'rider'),
          full_name: u.user_metadata?.full_name || u.email || 'Rider',
          avatar_url: null,
          bike_model: u.user_metadata?.bike_model || '',
          bio: '',
        }
      } else if (data) {
        bp.currentProfile = data
      } else {
        bp.currentProfile = {
          id: u.id,
          username: u.user_metadata?.username || (u.email ? u.email.split('@')[0] : 'rider'),
          full_name: u.user_metadata?.full_name || u.email || 'Rider',
          avatar_url: null,
          bike_model: '',
          bio: '',
        }
      }
    } catch (_) {
      bp.currentProfile = { id: u.id, username: 'rider', full_name: 'Rider', avatar_url: null, bike_model: '', bio: '' }
    }
    return bp.currentProfile
  }

  /* ── 3b. Pending profile completion ─────────────────────
     Used by register.html (autoconfirm path) and index.html
     (after email-confirmation sign-in) to upload the chosen
     avatar and create the profiles row. Reads bp_pending_profile
     from localStorage and clears it on success.            */
  bp.completePendingProfile = async () => {
    const u = window.__bpUser
    if (!u) return { ok: false, reason: 'no-user' }
    const raw = localStorage.getItem('bp_pending_profile')
    if (!raw) return { ok: true, skipped: true }
    let pending
    try { pending = JSON.parse(raw) } catch { localStorage.removeItem('bp_pending_profile'); return { ok: true, skipped: true } }
    try {
      const mod = await import('./supabase.js')
      const supa = mod.supabase
      let avatar_url = null
      if (pending.avatarDataUrl) {
        const blob = await (await fetch(pending.avatarDataUrl)).blob()
        const ext  = (blob.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg')
        const path = `${u.id}/avatar-${Date.now()}.${ext}`
        const { error: upErr } = await supa.storage.from('avatars').upload(path, blob, { upsert: true, contentType: blob.type })
        if (upErr) throw upErr
        const { data: pub } = supa.storage.from('avatars').getPublicUrl(path)
        avatar_url = pub.publicUrl
      }
      const { error: insErr } = await supa.from('profiles').upsert({
        id: u.id,
        username:    pending.username,
        full_name:   pending.full_name,
        bio:         pending.bio || '',
        bike_model:  pending.bike_model || '',
        avatar_url,
      })
      if (insErr) throw insErr
      localStorage.removeItem('bp_pending_profile')
      // refresh cached profile
      bp.currentProfile = null
      return { ok: true }
    } catch (e) {
      // keep pending data so the user can retry
      return { ok: false, reason: (e && e.message) || 'unknown' }
    }
  }

  /* ── 4. Navbar ──────────────────────────────────────────── */
  const NAV = [
    { key: 'feed',            label: 'Feed',        href: '/feed.html' },
    { key: 'bikes',           label: 'Machines',    href: '/bikes.html' },
    { key: 'trips',           label: 'Routes',      href: '/trips.html' },
    { key: 'recommendations', label: 'Concierge',   href: '/recommendations.html' },
  ]

  function navLinkHTML(item, active) {
    const on = item.key === active
    return `<a href="${item.href}" class="nav-link ${on ? 'is-active' : ''}">${item.label}</a>`
  }
  function mobileLinkHTML(item, active) {
    const on = item.key === active
    return `<a href="${item.href}" class="nav-link ${on ? 'is-active' : ''}">${item.label}</a>`
  }

  const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <circle cx="24" cy="24" r="22" stroke-width="1.6"/>
    <circle cx="24" cy="24" r="18.4" stroke-width="0.5" stroke-opacity="0.45"/>
    <g stroke-width="0.9" stroke-opacity="0.45">
      <line x1="24" y1="5.6" x2="24" y2="42.4"/>
      <line x1="5.6" y1="24" x2="42.4" y2="24"/>
      <line x1="10.6" y1="10.6" x2="37.4" y2="37.4"/>
      <line x1="37.4" y1="10.6" x2="10.6" y2="37.4"/>
    </g>
    <circle cx="24" cy="24" r="9" stroke-width="1.1"/>
    <text x="24" y="28.5" text-anchor="middle" font-family="Cormorant Garamond, Georgia, serif" font-size="12.5" font-weight="600" fill="currentColor" stroke="none" letter-spacing="0.4">BP</text>
  </svg>`

  function renderNavbarSkeleton(active) {
    const host = document.getElementById('bp-navbar')
    if (!host) return
    host.className = 'navbar'
    host.setAttribute('data-active', active || '')
    host.innerHTML = `
      <div class="page-wide">
        <div class="navbar-inner">
          <a href="/feed.html" class="navbar-brand" aria-label="Bikers Portal — home">
            <span class="brand-icon">${LOGO_SVG}</span>
            <span class="brand-word">
              <strong>Bikers Portal</strong>
              <em>Riding Society</em>
            </span>
          </a>
          <nav class="navbar-nav" aria-label="Primary">${NAV.map((i) => navLinkHTML(i, active)).join('')}</nav>
          <div class="navbar-actions">
            <div class="relative">
              <button id="bp-avatar-btn" class="nav-avatar" aria-haspopup="menu" aria-expanded="false" aria-label="Account menu">
                <span class="skeleton avatar" style="width:36px;height:36px"></span>
              </button>
              <div id="bp-avatar-menu" class="hidden user-menu">
                <div class="user-menu-header">
                  <div class="user-menu-name" id="bp-menu-name">Rider</div>
                  <div class="user-menu-handle" id="bp-menu-handle">@rider</div>
                </div>
                <a href="/profile.html" class="user-menu-item">View profile</a>
                <a href="/bikes.html" class="user-menu-item">My machines</a>
                <a href="/trips.html" class="user-menu-item">My routes</a>
                <div class="user-menu-divider"></div>
                <button id="bp-logout" class="user-menu-item" style="color:var(--c-error)">Sign out</button>
              </div>
            </div>
            <button id="bp-burger" class="nav-burger" aria-label="Toggle menu" aria-expanded="false">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M3 6h18M3 12h18M3 18h18"/></svg>
            </button>
          </div>
        </div>
      </div>
      <div id="bp-mobile-menu" class="navbar-mobile">
        <nav aria-label="Primary mobile">${NAV.map((i) => mobileLinkHTML(i, active)).join('')}</nav>
        <div class="mobile-actions" style="padding:0 var(--r-page-pad)">
          <a href="/profile.html" class="nav-link">Profile</a>
        </div>
      </div>`

    // burger
    const burger = document.getElementById('bp-burger')
    const mobile = document.getElementById('bp-mobile-menu')
    if (burger && mobile) burger.addEventListener('click', () => {
      const open = mobile.classList.toggle('is-open')
      burger.setAttribute('aria-expanded', String(open))
    })

    // scroll shadow
    const scroller = () => host.classList.toggle('is-scrolled', window.scrollY > 8)
    scroller()
    window.addEventListener('scroll', scroller, { passive: true })
  }

  function renderNavbarFill(profile) {
    const btn   = document.getElementById('bp-avatar-btn')
    const menu  = document.getElementById('bp-avatar-menu')
    if (!btn || !menu) return

    const name  = (profile && (profile.full_name || profile.username)) || 'Rider'
    const handle = profile && profile.username ? '@' + profile.username : '@rider'
    btn.innerHTML = bp.avatarHTML(profile && profile.avatar_url, name, 36)

    const nameEl = document.getElementById('bp-menu-name')
    const handleEl = document.getElementById('bp-menu-handle')
    if (nameEl) nameEl.textContent = name
    if (handleEl) handleEl.textContent = handle

    btn.addEventListener('click', (e) => {
      e.stopPropagation()
      const hidden = menu.classList.toggle('hidden')
      btn.setAttribute('aria-expanded', String(!hidden))
    })
    document.addEventListener('click', (e) => {
      if (!menu.contains(e.target) && e.target !== btn && !btn.contains(e.target)) {
        menu.classList.add('hidden')
        btn.setAttribute('aria-expanded', 'false')
      }
    })
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        menu.classList.add('hidden')
        btn.setAttribute('aria-expanded', 'false')
        const m = document.getElementById('bp-mobile-menu')
        if (m) { m.classList.remove('is-open'); document.getElementById('bp-burger')?.setAttribute('aria-expanded','false') }
      }
    })
    const logout = document.getElementById('bp-logout')
    if (logout) logout.addEventListener('click', async () => {
      logout.disabled = true
      try {
        const mod = await import('./supabase.js')
        await mod.supabase.auth.signOut()
      } catch (_) { window.location.href = '/index.html' }
    })
  }

  bp.renderNavbar = function (active) { renderNavbarSkeleton(active) }

  /* ── 5. Bootstrap navbar on protected pages ────────────── */
  document.addEventListener('DOMContentLoaded', async () => {
    const host = document.getElementById('bp-navbar')
    if (!host) return
    const active = host.getAttribute('data-active') || ''
    renderNavbarSkeleton(active)
    await bp.loadCurrentProfile()
    renderNavbarFill(bp.currentProfile)
  })

  window.bp = bp
})()
