import {
  supabase,
  getNotifications,
  getUnreadNotificationCount,
  markNotificationRead,
  markAllNotificationsRead,
  subscribeToNotifications
} from './supabase.js'

const $ = (id) => document.getElementById(id)
const esc = window.bp?.esc || ((s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])))
const timeAgo = window.bp?.timeAgo || ((iso) => { if (!iso) return ''; const d = (Date.now() - new Date(iso).getTime()) / 1000; if (d < 60) return 'just now'; if (d < 3600) return Math.floor(d / 60) + 'm ago'; if (d < 86400) return Math.floor(d / 3600) + 'h ago'; if (d < 604800) return Math.floor(d / 86400) + 'd ago'; return new Date(iso).toLocaleDateString() })
const initialsOf = window.bp?.initialsOf || ((n) => (n || '?').split(/\s+/).map(s => s[0]).join('').slice(0, 2).toUpperCase())

const TYPE_ICONS = {
  like: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>',
  comment: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
  follow: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>',
  follow_request: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/></svg>',
  mention: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94"/></svg>',
  message: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
  trip_invite: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 18l6-9 4 6 4-4 4 7"/><path d="M3 21h18"/></svg>'
}

const TYPE_ACTIONS = {
  like: 'liked your post',
  comment: 'commented on your post',
  follow: 'started following you',
  follow_request: 'wants to follow you',
  mention: 'mentioned you',
  message: 'sent you a message',
  trip_invite: 'invited you to a trip'
}

function entityLink(n) {
  if (!n || !n.entity_type || !n.entity_id) return null
  switch (n.entity_type) {
    case 'post': return `/feed.html`
    case 'profile': return `/profile.html`
    case 'conversation': return `/messages.html`
    case 'trip': return `/trips.html`
    case 'bike': return `/bikes.html`
    default: return null
  }
}

const NotificationsModule = {
  realtimeChannel: null,
  _notifications: [],

  async init() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { window.location.replace('/index.html'); return }
    await this.render()
    this._wireMarkAll()
    this._subscribe(user.id)
  },

  async render() {
    const list = $('notifications-list')
    const label = $('notif-count-label')
    if (!list) return

    list.innerHTML = '<div style="padding:40px;text-align:center;color:var(--color-text-faint);font-family:var(--font-heritage);font-style:italic">Loading activity…</div>'

    const notifs = await getNotifications(50)
    this._notifications = notifs

    const unread = notifs.filter(n => !n.read_at).length
    if (label) label.textContent = `${unread} unread`

    if (!notifs || !notifs.length) {
      list.innerHTML = '<div style="padding:60px 24px;text-align:center"><p style="font-family:var(--font-heritage);font-style:italic;font-size:16px;color:var(--color-text-3)">All quiet. No new activity yet.</p></div>'
      return
    }

    const groups = this._groupByTime(notifs)

    list.innerHTML = ''
    for (const [groupLabel, items] of Object.entries(groups)) {
      const section = document.createElement('div')
      section.className = 'notif-section'
      section.innerHTML = `<div class="notif-group-header">${esc(groupLabel)}</div>`
      items.forEach(n => {
        const actor = n.actor || {}
        const name = actor.full_name || actor.username || 'Someone'
        const actorAvatar = actor.avatar_url
          ? `<img src="${esc(actor.avatar_url)}" alt="${esc(name)}" class="avatar-img" style="width:100%;height:100%;object-fit:cover"/>`
          : `<span class="bp-avatar-fallback" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center">${esc(initialsOf(name))}</span>`
        const text = this.generateText(n, name)
        const icon = TYPE_ICONS[n.type] || ''
        const link = entityLink(n)
        const unreadClass = n.read_at ? '' : ' unread'
        section.innerHTML += `<div class="notif-row${unreadClass}" data-id="${esc(n.id)}"${link ? ` data-href="${esc(link)}"` : ''}>
          <div class="notif-avatar avatar avatar-md">${actorAvatar}</div>
          <div class="notif-icon">${icon}</div>
          <div class="notif-body">
            <div class="notif-text">${text}</div>
            <div class="notif-time">${esc(timeAgo(n.created_at))}</div>
          </div>
          ${n.read_at ? '' : '<span class="notif-unread-indicator"></span>'}
        </div>`
      })
      list.appendChild(section)
    }

    list.querySelectorAll('.notif-row').forEach(row => {
      row.addEventListener('click', async () => {
        const id = row.dataset.id
        if (id) {
          await markNotificationRead(id)
          row.classList.remove('unread')
          const indicator = row.querySelector('.notif-unread-indicator')
          if (indicator) {
            indicator.style.transition = 'opacity 300ms ease'
            indicator.style.opacity = '0'
            setTimeout(() => indicator.remove(), 300)
          }
          row.style.transition = 'background var(--t-med) var(--ease-out)'
          row.style.background = 'var(--color-surface-offset, var(--color-ink-2))'
        }
        const href = row.dataset.href
        if (href) window.location.href = href
      })
    })
  },

  generateText(notification, actorName) {
    const name = esc(actorName || 'Someone')
    const boldName = `<strong>${name}</strong>`
    const action = TYPE_ACTIONS[notification.type] || notification.message || 'interacted with you'
    return `${boldName} ${esc(action)}`
  },

  async markAllRead() {
    await markAllNotificationsRead()
    document.querySelectorAll('.notif-row.unread').forEach(row => {
      row.classList.remove('unread')
      const indicator = row.querySelector('.notif-unread-indicator')
      if (indicator) indicator.remove()
    })
    const label = $('notif-count-label')
    if (label) label.textContent = '0 unread'
    const badge = document.getElementById('notif-unread-badge')
    if (badge) { badge.textContent = '0'; badge.style.display = 'none' }
  },

  _groupByTime(notifs) {
    const groups = {}
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const weekAgo = new Date(today.getTime() - 7 * 86400000)

    for (const n of notifs) {
      const d = new Date(n.created_at)
      let label
      if (d >= today) label = 'TODAY'
      else if (d >= weekAgo) label = 'THIS WEEK'
      else label = 'EARLIER'
      if (!groups[label]) groups[label] = []
      groups[label].push(n)
    }
    return { TODAY: groups.TODAY || [], 'THIS WEEK': groups['THIS WEEK'] || [], EARLIER: groups.EARLIER || [] }
  },

  _subscribe(userId) {
    this.realtimeChannel = subscribeToNotifications(userId, (newNotif) => {
      const list = $('notifications-list')
      if (!list) return
      const actor = newNotif.actor || {}
      const name = actor.full_name || actor.username || 'Someone'
      const actorAvatar = actor.avatar_url
        ? `<img src="${esc(actor.avatar_url)}" alt="${esc(name)}" class="avatar-img" style="width:100%;height:100%;object-fit:cover"/>`
        : `<span class="bp-avatar-fallback" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center">${esc(initialsOf(name))}</span>`
      const text = this.generateText(newNotif, name)
      const icon = TYPE_ICONS[newNotif.type] || ''
      const link = entityLink(newNotif)

      const row = document.createElement('div')
      row.className = 'notif-row unread'
      row.dataset.id = newNotif.id
      if (link) row.dataset.href = link
      row.style.transform = 'translateX(16px)'
      row.style.opacity = '0'
      row.innerHTML = `<div class="notif-avatar avatar avatar-md">${actorAvatar}</div>
        <div class="notif-icon">${icon}</div>
        <div class="notif-body">
          <div class="notif-text">${text}</div>
          <div class="notif-time">${esc(timeAgo(newNotif.created_at))}</div>
        </div>
        <span class="notif-unread-indicator"></span>`

      const firstSection = list.querySelector('.notif-section')
      if (firstSection) {
        firstSection.insertBefore(row, firstSection.querySelector('.notif-row'))
      } else {
        const section = document.createElement('div')
        section.className = 'notif-section'
        section.innerHTML = '<div class="notif-group-header">TODAY</div>'
        section.appendChild(row)
        list.insertBefore(section, list.firstChild)
      }

      requestAnimationFrame(() => {
        row.style.transition = 'transform 250ms ease, opacity 250ms ease'
        row.style.transform = 'translateX(0)'
        row.style.opacity = '1'
      })

      row.addEventListener('click', async function() {
        await markNotificationRead(newNotif.id)
        this.classList.remove('unread')
        const indicator = this.querySelector('.notif-unread-indicator')
        if (indicator) indicator.remove()
        const href = this.dataset.href
        if (href) window.location.href = href
      })

      const label = $('notif-count-label')
      if (label) {
        const current = parseInt(label.textContent) || 0
        label.textContent = `${current + 1} unread`
      }
    })
  },

  _wireMarkAll() {
    const btn = $('mark-all-read-btn')
    if (btn) btn.addEventListener('click', () => this.markAllRead())
  },

  destroy() {
    if (this.realtimeChannel) {
      this.realtimeChannel.unsubscribe()
      this.realtimeChannel = null
    }
  }
}

export default NotificationsModule
