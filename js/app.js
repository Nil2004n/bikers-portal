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
    theme: {
      extend: {
        colors: {
          // Light broadsheet — token names preserved for backwards compat
          ink:      { 950:'#0c0b09', 900:'#f5f0e8', 850:'#ede8db', 800:'#ede8db', 750:'#e6e0d0', 700:'#e6e0d0', 600:'#ddd7c5', 500:'#d4cdb8', 400:'#3a3129' },
          bone:     { DEFAULT:'#1a1409', soft:'#1a1409', muted:'#5a4e3c', dim:'#9a8c78' },
          brass:    { DEFAULT:'#c9a84c', light:'#d8bb5e', dark:'#9e7c2c', deep:'#6b5230' },
          burgundy: { DEFAULT:'#7a2d2d', deep:'#5a1f1f' },
          leather:  '#1a1409',
          bronze:   { DEFAULT:'rgba(26,20,9,0.20)', light:'rgba(26,20,9,0.10)' },
        },
        fontFamily: {
          sans:  ['"DM Sans"','Inter','system-ui','sans-serif'],
          serif: ['"Playfair Display"','"Cormorant Garamond"','Georgia','serif'],
        },
        boxShadow: {
          'inner-deep': 'inset 0 1px 0 rgba(26,20,9,0.04), inset 0 0 0 1px rgba(26,20,9,0.10)',
          'panel':      '0 1px 0 rgba(26,20,9,0.04), 0 8px 24px rgba(26,20,9,0.10)',
          'brass-glow': '0 0 0 1px rgba(201,168,76,0.40), 0 0 14px rgba(201,168,76,0.18)',
        },
        borderRadius: { sm:'3px', DEFAULT:'5px', md:'5px', lg:'8px', xl:'12px' },
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
      return `<img src="${bp.esc(url)}" alt="" class="avatar-img" style="width:${px}px;height:${px}px" onerror="this.outerHTML=window.bp.fallbackAvatar(window.bp.initialsOf('${bp.esc(name || '').replace(/'/g, "\\'")}'),${px})" />`
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
      bp.currentProfile = null
      return { ok: true }
    } catch (e) {
      return { ok: false, reason: (e && e.message) || 'unknown' }
    }
  }

  /* ── 4. Navbar ──────────────────────────────────────────── */
  const NAV = [
    { key: 'feed',            label: 'Journal',   href: '/feed.html' },
    { key: 'bikes',           label: 'Machines',  href: '/bikes.html' },
    { key: 'trips',           label: 'Routes',    href: '/trips.html' },
    { key: 'recommendations', label: 'Concierge', href: '/recommendations.html' },
  ]

  function navLinkHTML(item, active) {
    const on = item.key === active
    return `<a href="${item.href}" class="nav-link ${on ? 'is-active' : ''}">${item.label}</a>`
  }

  const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="11" stroke-width="1.5"/>
    <circle cx="12" cy="12" r="9.4" stroke-width="0.4" stroke-opacity="0.45"/>
    <g stroke-width="0.45" stroke-opacity="0.45">
      <line x1="12" y1="3" x2="12" y2="21"/>
      <line x1="3"  y1="12" x2="21" y2="12"/>
    </g>
    <g stroke-width="0.35" stroke-opacity="0.30">
      <line x1="6.4"  y1="6.4"  x2="17.6" y2="17.6"/>
      <line x1="17.6" y1="6.4"  x2="6.4"  y2="17.6"/>
    </g>
    <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/>
    <g stroke-width="0.8" stroke-opacity="0.65">
      <line x1="12" y1="0.6" x2="12" y2="2.2"/>
      <line x1="12" y1="21.8" x2="12" y2="23.4"/>
      <line x1="0.6" y1="12" x2="2.2" y2="12"/>
      <line x1="21.8" y1="12" x2="23.4" y2="12"/>
    </g>
  </svg>`

  function renderNavbarSkeleton(active) {
    const host = document.getElementById('bp-navbar')
    if (!host) return
    host.className = 'site-nav'
    host.setAttribute('data-active', active || '')
    const onSearch = /\/search\.html?(\?|$)/.test(window.location.pathname + window.location.search)
    const searchLink = `<a href="/search.html" class="nav-search ${onSearch ? 'is-on' : ''}" id="bp-search-link" aria-label="Search the portal" aria-current="${onSearch ? 'page' : 'false'}">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
    </a>`
    host.innerHTML = `
      <div class="page-wide">
        <div class="nav-inner">
          <a href="/feed.html" class="nav-brand" aria-label="Bikers Portal — home">
            <span class="brand-icon">${LOGO_SVG}</span>
            <span class="brand-word">Bikers Portal</span>
          </a>
          <nav class="nav-links" aria-label="Primary">${NAV.map((i) => navLinkHTML(i, active)).join('')}</nav>
          <div class="nav-actions">
            ${searchLink}
            <div style="position:relative">
              <button id="bp-avatar-btn" class="nav-avatar" aria-haspopup="menu" aria-expanded="false" aria-label="Account menu">
                <span class="nav-avatar-inner"><span class="skeleton" style="width:36px;height:36px;border-radius:9999px;display:inline-block"></span></span>
                <span id="bp-pending-dot" class="bp-pending-dot" hidden aria-label="Pending follow requests"></span>
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
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M3 6h18M3 12h18M3 18h18"/></svg>
            </button>
          </div>
        </div>
      </div>
      <div id="bp-mobile-menu" class="nav-mobile">
        <nav aria-label="Primary mobile">${NAV.map((i) => navLinkHTML(i, active)).join('')}</nav>
        <div class="mobile-actions">
          <a href="/search.html" class="nav-link">Search</a>
          <a href="/profile.html" class="nav-link">Profile</a>
        </div>
      </div>`

    const burger = document.getElementById('bp-burger')
    const mobile = document.getElementById('bp-mobile-menu')
    if (burger && mobile) burger.addEventListener('click', () => {
      const open = mobile.classList.toggle('is-open')
      burger.setAttribute('aria-expanded', String(open))
    })

    const scroller = () => host.classList.toggle('nav-scrolled', window.scrollY > 8)
    scroller()
    window.addEventListener('scroll', scroller, { passive: true })
  }

  function renderNavbarFill(profile) {
    const btn   = document.getElementById('bp-avatar-btn')
    const menu  = document.getElementById('bp-avatar-menu')
    if (!btn || !menu) return

    const name  = (profile && (profile.full_name || profile.username)) || 'Rider'
    const handle = profile && profile.username ? '@' + profile.username : '@rider'
    btn.innerHTML = `<span class="nav-avatar-inner">${bp.avatarHTML(profile && profile.avatar_url, name, 36)}</span><span id="bp-pending-dot" class="bp-pending-dot" hidden aria-label="Pending follow requests"></span>`

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

    paintPendingDot()
  }

  async function paintPendingDot() {
    const dot = document.getElementById('bp-pending-dot')
    if (!dot) return
    try {
      const mod = await import('./follow.js')
      const list = await mod.getPendingRequests()
      if (Array.isArray(list) && list.length > 0) {
        dot.hidden = false
        dot.setAttribute('aria-label', `${list.length} pending follow request${list.length === 1 ? '' : 's'}`)
        dot.title = `${list.length} pending follow request${list.length === 1 ? '' : 's'}`
      } else {
        dot.hidden = true
      }
    } catch (_) {
      dot.hidden = true
    }
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
