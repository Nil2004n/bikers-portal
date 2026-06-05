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
          ink:      { 950:'#0c0b09', 900:'#11100e', 850:'#15130f', 800:'#181512', 750:'#1c1915', 700:'#1e1a15', 600:'#211c18', 500:'#2a241e', 400:'#3a3129' },
          bone:     { DEFAULT:'#f3ede3', soft:'#e8e0d2', muted:'#c7b9a2', dim:'#8a7e6a' },
          brass:    { DEFAULT:'#b08d57', light:'#c9a875', dark:'#8a6d40', deep:'#6b5230' },
          burgundy: { DEFAULT:'#6e2f2f', deep:'#542424' },
          leather:  '#7a4b2a',
          bronze:   { DEFAULT:'#3a3129', light:'#4a3f34' },
        },
        fontFamily: {
          sans:  ['"Satoshi"','Inter','system-ui','sans-serif'],
          serif: ['"Fraunces"','Georgia','serif'],
        },
        boxShadow: {
          'inner-deep': 'inset 0 1px 0 rgba(255,237,210,0.04), inset 0 0 0 1px rgba(0,0,0,0.4)',
          'panel': '0 1px 0 rgba(255,237,210,0.03), 0 8px 24px rgba(0,0,0,0.35)',
          'brass-glow': '0 0 0 1px rgba(176,141,87,0.4), 0 0 14px rgba(176,141,87,0.18)',
        },
        borderRadius: { sm:'4px', DEFAULT:'6px', md:'8px', lg:'10px', xl:'14px' },
      },
    },
    safelist: [
      'bg-ink-700','bg-ink-800','bg-ink-600','bg-ink-500',
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
      host.className = 'fixed top-16 right-4 z-[80] flex flex-col gap-2 pointer-events-none'
      document.body.appendChild(host)
    }
    const el = document.createElement('div')
    el.className = `pointer-events-auto px-4 py-2.5 rounded-md border text-[13px] font-sans shadow-panel backdrop-blur-sm ${t === 'error' ? 'bg-burgundy-deep/95 border-burgundy text-bone' : 'bg-ink-700/95 border-brass/40 text-bone'}`
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
    }, 2600)
  }

  bp.confirm = (message, title) => {
    return new Promise((resolve) => {
      const overlay = document.createElement('div')
      overlay.className = 'fixed inset-0 z-[90] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4'
      overlay.innerHTML = `
        <div class="bp-card max-w-sm w-full p-6 shadow-panel">
          <h3 class="font-serif text-[17px] text-bone">${bp.esc(title || 'Are you sure?')}</h3>
          <p class="text-bone-muted text-[13px] mt-2 leading-relaxed">${bp.esc(message)}</p>
          <div class="flex justify-end gap-2 mt-5">
            <button data-act="cancel" class="bp-btn bp-btn-ghost">Cancel</button>
            <button data-act="ok" class="bp-btn bp-btn-danger">Confirm</button>
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
    { key: 'bikes',           label: 'Bikes',       href: '/bikes.html' },
    { key: 'trips',           label: 'Trips',       href: '/trips.html' },
    { key: 'recommendations', label: 'Concierge',   href: '/recommendations.html' },
  ]

  function navLinkHTML(item, active) {
    const on = item.key === active
    return `<a href="${item.href}" class="relative inline-flex items-center px-1 h-14 text-[13px] tracking-[0.06em] transition-colors ${on ? 'text-bone' : 'text-bone-muted hover:text-bone'}">
      <span>${item.label}</span>
      <span class="absolute left-0 right-0 bottom-0 h-px ${on ? 'bg-brass' : 'bg-transparent'}"></span>
    </a>`
  }
  function mobileLinkHTML(item, active) {
    const on = item.key === active
    return `<a href="${item.href}" class="block px-3 py-2.5 rounded text-[13.5px] ${on ? 'text-bone bg-ink-700 border-l-2 border-brass' : 'text-bone-muted hover:text-bone hover:bg-ink-800'}">${item.label}</a>`
  }

  function renderNavbarSkeleton(active) {
    const host = document.getElementById('bp-navbar')
    if (!host) return
    host.className = 'sticky top-0 z-50 bg-ink-900/85 backdrop-blur-sm border-b border-bronze'
    host.setAttribute('data-active', active || '')
    host.innerHTML = `
      <div class="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <a href="/feed.html" class="flex items-center gap-2.5 group" aria-label="Bikers Portal — home">
          <img src="/assets/logo.svg" alt="Bikers Portal" class="h-7 w-auto opacity-95 group-hover:opacity-100" />
        </a>
        <nav class="hidden md:flex items-center gap-7">${NAV.map((i) => navLinkHTML(i, active)).join('')}</nav>
        <div class="flex items-center gap-2">
          <a href="/profile.html" class="hidden md:inline text-[12.5px] text-bone-muted hover:text-bone"></a>
          <div class="relative">
            <button id="bp-avatar-btn" class="rounded-full focus:outline-none focus-visible:shadow-brass-glow" aria-haspopup="menu" aria-expanded="false" aria-label="Account menu">
              <span class="skeleton rounded-full inline-block" style="width:36px;height:36px"></span>
            </button>
            <div id="bp-avatar-menu" class="hidden absolute right-0 mt-2 w-48 bp-card p-1.5 shadow-panel">
              <a href="/profile.html" class="block px-3 py-2 rounded text-[13px] text-bone-muted hover:text-bone hover:bg-ink-700">Profile</a>
              <button id="bp-logout" class="w-full text-left px-3 py-2 rounded text-[13px] text-bone-muted hover:text-bone hover:bg-ink-700">Sign out</button>
            </div>
          </div>
          <button id="bp-burger" class="md:hidden p-2 -mr-2 text-bone-muted hover:text-bone" aria-label="Toggle menu">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M3 6h18M3 12h18M3 18h18"/></svg>
          </button>
        </div>
      </div>
      <div id="bp-mobile-menu" class="md:hidden hidden border-t border-bronze bg-ink-900/95">
        <nav class="px-3 py-3 flex flex-col gap-1">${NAV.map((i) => mobileLinkHTML(i, active)).join('')}</nav>
      </div>`

    // burger
    const burger = document.getElementById('bp-burger')
    const mobile = document.getElementById('bp-mobile-menu')
    if (burger && mobile) burger.addEventListener('click', () => mobile.classList.toggle('hidden'))
  }

  function renderNavbarFill(profile) {
    const btn   = document.getElementById('bp-avatar-btn')
    const menu  = document.getElementById('bp-avatar-menu')
    const nameA = document.querySelector('#bp-navbar a[href="/profile.html"]')
    if (!btn || !menu) return

    const name  = (profile && (profile.full_name || profile.username)) || 'Rider'
    btn.innerHTML = bp.avatarHTML(profile && profile.avatar_url, name, 36)
    if (nameA) nameA.textContent = name

    btn.addEventListener('click', (e) => {
      e.stopPropagation()
      const open = menu.classList.toggle('hidden')
      btn.setAttribute('aria-expanded', String(!open))
    })
    document.addEventListener('click', (e) => {
      if (!menu.contains(e.target) && e.target !== btn && !btn.contains(e.target)) {
        menu.classList.add('hidden')
        btn.setAttribute('aria-expanded', 'false')
      }
    })
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { menu.classList.add('hidden'); btn.setAttribute('aria-expanded', 'false') }
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
