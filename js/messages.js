import {
  supabase,
  getConversations,
  getMessages,
  sendMessage as sendMsg,
  markMessagesRead,
  subscribeToMessages,
  getOrCreateConversation
} from './supabase.js'

const $ = (id) => document.getElementById(id)
const esc = window.bp?.esc || ((s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])))
const timeAgo = window.bp?.timeAgo || ((iso) => { if (!iso) return ''; const d = (Date.now() - new Date(iso).getTime()) / 1000; if (d < 60) return 'just now'; if (d < 3600) return Math.floor(d / 60) + 'm ago'; if (d < 86400) return Math.floor(d / 3600) + 'h ago'; if (d < 604800) return Math.floor(d / 86400) + 'd ago'; return new Date(iso).toLocaleDateString() })
const initialsOf = window.bp?.initialsOf || ((n) => (n || '?').split(/\s+/).map(s => s[0]).join('').slice(0, 2).toUpperCase())

const MessagesModule = {
  activeConversationId: null,
  realtimeChannel: null,
  _currentUser: null,
  _conversations: [],

  async init() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { window.location.replace('/index.html'); return }
    this._currentUser = user
    await this.renderConversationList()
    this._wireCompose()
    this._wireSearch()
    this._wireNewDm()
  },

  async renderConversationList() {
    const list = $('conversations-list')
    if (!list) return
    list.innerHTML = '<div style="padding:24px;text-align:center;color:var(--color-text-faint);font-family:var(--font-heritage);font-style:italic">Loading conversations…</div>'

    const convs = await getConversations()
    this._conversations = convs

    if (!convs || !convs.length) {
      list.innerHTML = '<div style="padding:32px 16px;text-align:center;color:var(--color-text-3);font-family:var(--font-heritage);font-style:italic;font-size:14px">No conversations yet. Start a new one.</div>'
      return
    }

    list.innerHTML = convs.map(c => {
      const other = this._otherParticipant(c)
      const lastMsg = c.messages?.[0]
      const unread = lastMsg && !lastMsg.read_at && lastMsg.sender_id !== this._currentUser?.id
      const name = other?.full_name || other?.username || 'Rider'
      const avatar = other?.avatar_url
        ? `<img src="${esc(other.avatar_url)}" alt="${esc(name)}" class="avatar-img" style="width:100%;height:100%;object-fit:cover"/>`
        : `<span class="bp-avatar-fallback" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center">${esc(initialsOf(name))}</span>`
      const time = lastMsg ? this.formatTime(lastMsg.created_at) : ''

      return `<div class="conv-row${unread ? ' unread' : ''}" data-conv="${esc(c.id)}">
        ${unread ? '<span class="unread-dot"></span>' : ''}
        <div class="conv-avatar avatar avatar-md">${avatar}</div>
        <div class="conv-info">
          <div class="conv-name${unread ? ' bold' : ''}">${esc(name)}</div>
          <div class="conv-preview">${lastMsg ? esc(lastMsg.content?.slice(0, 60)) : 'No messages yet'}</div>
        </div>
        <div class="conv-time">${esc(time)}</div>
      </div>`
    }).join('')

    list.querySelectorAll('.conv-row').forEach(row => {
      row.addEventListener('click', () => {
        const convId = row.dataset.conv
        this.loadConversation(convId)
        list.querySelectorAll('.conv-row').forEach(r => r.classList.remove('active'))
        row.classList.add('active')
        if (window.innerWidth < 768) {
          $('conversations-panel')?.classList.add('hidden-mobile')
          $('chat-panel')?.classList.remove('hidden-mobile')
        }
      })
    })
  },

  async loadConversation(conversationId) {
    this.activeConversationId = conversationId

    if (this.realtimeChannel) {
      this.realtimeChannel.unsubscribe()
      this.realtimeChannel = null
    }

    const msgs = await getMessages(conversationId)
    await markMessagesRead(conversationId)

    const conv = this._conversations.find(c => c.id === conversationId)
    const other = conv ? this._otherParticipant(conv) : null
    const name = other?.full_name || other?.username || 'Rider'

    const headerName = $('chat-header-name')
    const headerAvatar = $('chat-header-avatar')
    const messagesContainer = $('chat-messages')

    if (headerName) headerName.textContent = name
    if (headerAvatar) {
      const avatar = other?.avatar_url
        ? `<img src="${esc(other.avatar_url)}" alt="${esc(name)}" class="avatar-img" style="width:100%;height:100%;object-fit:cover"/>`
        : `<span class="bp-avatar-fallback" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center">${esc(initialsOf(name))}</span>`
      headerAvatar.innerHTML = avatar
    }

    $('chat-empty')?.classList.add('hidden')
    $('chat-thread')?.classList.remove('hidden')

    if (messagesContainer) {
      messagesContainer.innerHTML = msgs.map(m => this._renderBubble(m)).join('')
      messagesContainer.scrollTop = messagesContainer.scrollHeight
    }

    this.realtimeChannel = subscribeToMessages(conversationId, (newMsg) => {
      const container = $('chat-messages')
      if (!container) return
      const div = document.createElement('div')
      div.innerHTML = this._renderBubble(newMsg)
      const bubble = div.firstElementChild
      if (bubble) {
        bubble.style.opacity = '0'
        bubble.style.transform = 'translateY(8px)'
        container.appendChild(bubble)
        requestAnimationFrame(() => {
          bubble.style.transition = 'opacity 200ms ease, transform 200ms ease'
          bubble.style.opacity = '1'
          bubble.style.transform = 'translateY(0)'
        })
        container.scrollTop = container.scrollHeight
      }
    })
  },

  _renderBubble(m) {
    const isOwn = m.sender_id === this._currentUser?.id
    const time = this.formatTime(m.created_at)
    return `<div class="msg-bubble ${isOwn ? 'own' : 'other'}">
      <div class="msg-content">${esc(m.content)}</div>
      <div class="msg-time">${esc(time)}${m.read_at ? ' · Read' : ''}</div>
    </div>`
  },

  async sendMessage() {
    const input = $('message-input')
    const btn = $('send-btn')
    if (!input || !this.activeConversationId) return
    const text = input.value.trim()
    if (!text) return

    btn.disabled = true
    input.value = ''
    input.style.height = 'auto'

    const container = $('chat-messages')
    const optimisticId = 'msg-' + Date.now()
    const optimistic = `<div class="msg-bubble own" id="${optimisticId}" style="opacity:0;transform:translateY(8px)">
      <div class="msg-content">${esc(text)}</div>
      <div class="msg-time">${this.formatTime(new Date().toISOString())}</div>
    </div>`
    if (container) {
      container.insertAdjacentHTML('beforeend', optimistic)
      const el = document.getElementById(optimisticId)
      if (el) {
        requestAnimationFrame(() => {
          el.style.transition = 'opacity 200ms ease, transform 200ms ease'
          el.style.opacity = '1'
          el.style.transform = 'translateY(0)'
        })
      }
      container.scrollTop = container.scrollHeight
    }

    const { error } = await sendMsg(this.activeConversationId, text)
    if (error) {
      const el = document.getElementById(optimisticId)
      if (el) el.remove()
      window.bp?.toast?.('Could not send message', 'error')
    }
    btn.disabled = false
  },

  formatTime(ts) {
    if (!ts) return ''
    const d = new Date(ts)
    const now = new Date()
    const diff = now - d
    const days = Math.floor(diff / 86400000)

    if (days === 0) {
      return 'Today ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    } else if (days === 1) {
      return 'Yesterday'
    } else if (days < 7) {
      return d.toLocaleDateString([], { weekday: 'short' })
    } else {
      return d.toLocaleDateString([], { day: 'numeric', month: 'short' })
    }
  },

  _otherParticipant(conv) {
    if (!conv || !this._currentUser) return null
    const uid = this._currentUser.id
    const p1 = conv.participant_1
    const p2 = conv.participant_2
    if (p1?.id === uid) return p2
    if (p2?.id === uid) return p1
    if (p1?.id === uid) return p2
    if (p2?.id === uid) return p1
    return p1
  },

  _wireCompose() {
    const input = $('message-input')
    const btn = $('send-btn')
    if (!input || !btn) return

    const updateBtn = () => {
      btn.disabled = !input.value.trim()
    }

    input.addEventListener('input', function() {
      this.style.height = 'auto'
      this.style.height = Math.min(this.scrollHeight, 120) + 'px'
      updateBtn()
    })

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        this.sendMessage()
      }
    })

    btn.addEventListener('click', () => this.sendMessage())
    updateBtn()
  },

  _wireSearch() {
    const searchInput = $('conv-search')
    if (!searchInput) return
    searchInput.addEventListener('input', () => {
      const q = searchInput.value.toLowerCase().trim()
      document.querySelectorAll('.conv-row').forEach(row => {
        const name = row.querySelector('.conv-name')?.textContent?.toLowerCase() || ''
        row.style.display = !q || name.includes(q) ? '' : 'none'
      })
    })
  },

  _wireNewDm() {
    const btn = $('new-dm-btn')
    const modal = $('new-dm-modal')
    const close = $('new-dm-close')
    const search = $('dm-user-search')
    const results = $('dm-user-results')
    if (!btn || !modal) return

    btn.addEventListener('click', () => modal.classList.add('is-open'))

    if (close) close.addEventListener('click', () => modal.classList.remove('is-open'))
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.remove('is-open')
    })

    if (search) {
      let debounceTimer
      search.addEventListener('input', () => {
        clearTimeout(debounceTimer)
        debounceTimer = setTimeout(async () => {
          const q = search.value.trim()
          if (!q || q.length < 2) { if (results) results.innerHTML = ''; return }
          const { data } = await supabase
            .from('profiles')
            .select('id, username, full_name, avatar_url')
            .or(`username.ilike.%${q}%,full_name.ilike.%${q}%`)
            .neq('id', this._currentUser?.id)
            .limit(10)
          if (results) {
            results.innerHTML = (data || []).map(p => {
              const av = p.avatar_url
                ? `<img src="${esc(p.avatar_url)}" alt="${esc(p.full_name || p.username)}" class="avatar-img" style="width:100%;height:100%;object-fit:cover"/>`
                : `<span class="bp-avatar-fallback" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center">${esc(initialsOf(p.full_name || p.username))}</span>`
              return `<div class="dm-user-row" data-id="${esc(p.id)}">
                <div class="avatar avatar-sm">${av}</div>
                <div class="info">
                  <div class="n">${esc(p.full_name || p.username)}</div>
                  <div class="h">@${esc(p.username || 'rider')}</div>
                </div>
              </div>`
            }).join('')
            results.querySelectorAll('.dm-user-row').forEach(row => {
              row.addEventListener('click', async () => {
                const { data } = await getOrCreateConversation(row.dataset.id)
                if (data) {
                  modal.classList.remove('is-open')
                  search.value = ''
                  results.innerHTML = ''
                  await this.renderConversationList()
                  this.loadConversation(data.id)
                  if (window.innerWidth < 768) {
                    $('conversations-panel')?.classList.add('hidden-mobile')
                    $('chat-panel')?.classList.remove('hidden-mobile')
                  }
                }
              })
            })
          }
        }, 300)
      })
    }
  },

  destroy() {
    if (this.realtimeChannel) {
      this.realtimeChannel.unsubscribe()
      this.realtimeChannel = null
    }
    this.activeConversationId = null
  }
}

export default MessagesModule
