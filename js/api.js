// ════════════════════════════════════════════════════════════════
// BIKERS PORTAL — API client (drop-in replacement for supabase-js)
// ════════════════════════════════════════════════════════════════
// Talks to the local Express server (`server/index.js`) over REST.
// The public surface mirrors the supabase shape used throughout
// the app, so most pages need only a single import change:
//
//   import { supabase } from './js/supabase.js'   →
//   import { api as supabase } from './js/api.js'
//
// Supported:
//   • supabase.auth.signInWithPassword({ email, password })
//   • supabase.auth.signUp({ email, password, options: { data } })
//   • supabase.auth.signOut()
//   • supabase.auth.getSession()
//   • supabase.auth.getUser()
//   • supabase.from('table').select(...).eq(...).order(...).limit(...).single()
//   • supabase.from('table').insert(row)
//   • supabase.from('table').update(patch).eq('id', x)
//   • supabase.from('table').delete().eq('id', x)
//   • supabase.storage.from(bucket).upload(path, file, { upsert })
//   • supabase.storage.from(bucket).getPublicUrl(path)
//   • Real-time: use supabase.realtime.on('new-post', handler)
// ════════════════════════════════════════════════════════════════

const API_BASE  = '/api'
const TOKEN_KEY = 'bp_token'
const USER_KEY  = 'bp_user'

// ── Token storage ───────────────────────────────────────────
function getToken()        { return localStorage.getItem(TOKEN_KEY) }
function setToken(t)       { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY) }
function setStoredUser(u)  { u ? localStorage.setItem(USER_KEY, JSON.stringify(u)) : localStorage.removeItem(USER_KEY) }
function getStoredUser() {
  try { return JSON.parse(localStorage.getItem(USER_KEY)) } catch { return null }
}

// ── Base fetch ──────────────────────────────────────────────
async function request(method, path, { body, headers = {}, isForm = false } = {}) {
  const token = getToken()
  const baseHeaders = { 'Accept': 'application/json', ...headers }
  if (!isForm && body !== undefined) baseHeaders['Content-Type'] = 'application/json'
  if (token) baseHeaders['Authorization'] = `Bearer ${token}`

  const opts = { method, headers: baseHeaders, credentials: 'same-origin' }
  if (body !== undefined) opts.body = isForm ? body : JSON.stringify(body)

  let res, data
  try {
    res = await fetch(`${API_BASE}${path}`, opts)
    const text = await res.text()
    data = text ? JSON.parse(text) : null
  } catch (e) {
    return { data: null, error: { message: 'Network error. Please try again.' } }
  }

  if (!res.ok) {
    const message = (data && (data.error || data.message)) || res.statusText || 'Request failed'
    return { data: null, error: { message, status: res.status, body: data } }
  }
  return { data, error: null }
}

const GET    = (path, opts) => request('GET', path, opts)
const POST   = (path, body) => request('POST', path, { body })
const PATCH  = (path, body) => request('PATCH', path, { body })
const DELETE = (path, body) => request('DELETE', path, { body })

// ════════════════════════════════════════════════════════════════
// AUTH
// ════════════════════════════════════════════════════════════════
const authSubscribers = new Set()
function notifyAuth(event) { for (const h of authSubscribers) { try { h(event) } catch {} } }

const auth = {
  async signInWithPassword({ email, password }) {
    const r = await POST('/auth/signin', { email, password })
    if (r.error) return { data: null, error: r.error }
    if (r.data?.session?.token) setToken(r.data.session.token)
    if (r.data?.user)           setStoredUser(r.data.user)
    notifyAuth('SIGNED_IN')
    return { data: { user: r.data.user, session: r.data.session }, error: null }
  },

  async signUp({ email, password, options }) {
    const r = await POST('/auth/signup', { email, password, data: options?.data || {} })
    if (r.error) return { data: null, error: r.error }
    if (r.data?.session?.token) setToken(r.data.session.token)
    if (r.data?.user)           setStoredUser(r.data.user)
    notifyAuth('SIGNED_IN')
    return { data: { user: r.data.user, session: r.data.session }, error: null }
  },

  async signOut() {
    const r = await POST('/auth/signout', {})
    setToken(null); setStoredUser(null)
    notifyAuth('SIGNED_OUT')
    return { error: r.error }
  },

  async getSession() {
    if (!getToken()) return { data: { session: null }, error: null }
    const r = await GET('/auth/session')
    if (r.error || !r.data?.session) {
      setToken(null); setStoredUser(null)
      return { data: { session: null }, error: null }
    }
    setStoredUser(r.data.user)
    return { data: { session: r.data.session, user: r.data.user }, error: null }
  },

  async getUser() {
    if (!getToken()) return { data: { user: null }, error: null }
    const r = await GET('/auth/me')
    if (r.error || !r.data?.user) {
      setToken(null); setStoredUser(null)
      return { data: { user: null }, error: null }
    }
    setStoredUser(r.data.user)
    return { data: { user: r.data.user }, error: null }
  },

  onAuthStateChange(handler) {
    authSubscribers.add(handler)
    // Also listen for cross-tab signouts via localStorage events
    const onStorage = (e) => { if (e.key === TOKEN_KEY && !getToken()) handler('SIGNED_OUT') }
    window.addEventListener('storage', onStorage)
    return {
      data: {
        subscription: {
          unsubscribe() {
            authSubscribers.delete(handler)
            window.removeEventListener('storage', onStorage)
          }
        }
      }
    }
  }
}

// ════════════════════════════════════════════════════════════════
// QUERY BUILDER — replaces supabase.from(...).select/eq/...
// ════════════════════════════════════════════════════════════════
// Tables whose writes go to non-collection endpoints.
const TABLE_ALIASES = {
  // `from('posts').delete().eq('id', x)`  → DELETE /api/posts/:id
  // `from('bikes').update(p).eq('id', x)` → PATCH  /api/bikes/:id
  // (handled generically by detecting the `id` filter below)
  // `from('profiles').upsert(row)`        → POST   /api/profiles  (server-side upsert by current user)
  profiles: { upsert: '/profiles' }
}

class QueryBuilder {
  constructor(table) {
    this.table     = table
    this._select   = '*'
    this._countOpt = null   // { count, head } from supabase-style select
    this._filters  = []
    this._order    = null
    this._limit    = null
    this._offset   = null
    this._single   = false
    this._method   = 'GET'
    this._body     = null
    this._upsert   = false
  }

  // supabase: .select(fields, { count: 'exact', head: true })
  select(fields, opts) {
    this._select = fields || '*'
    this._method = 'GET'
    if (opts && typeof opts === 'object') this._countOpt = opts
    return this
  }
  eq(col, val)   { this._filters.push([col, 'eq', val]); return this }
  neq(col, val)  { this._filters.push([col, 'neq', val]); return this }
  in(col, vals)  { this._filters.push([col, 'in', Array.isArray(vals) ? vals.join(',') : String(vals)]); return this }
  order(col, { ascending = true } = {}) {
    this._order = `${col}.${ascending ? 'asc' : 'desc'}`
    return this
  }
  limit(n)        { this._limit = n; return this }
  range(from, to) { this._offset = from; this._limit = to - from + 1; return this }
  single()        { this._single = true; return this }
  maybeSingle()   { this._single = true; return this }

  insert(rows) {
    this._method = 'POST'
    this._body   = rows   // single object or array — server accepts both
    return this
  }
  update(patch) {
    this._method = 'PATCH'
    this._body   = patch
    return this
  }
  upsert(rows, opts = {}) {
    this._method = 'POST'
    this._body   = rows
    this._upsert = true
    if (opts.onConflict) this._upsertOn = opts.onConflict
    return this
  }
  delete() { this._method = 'DELETE'; return this }

  // Make awaitable: `await supabase.from('x').select()`
  async then(resolve, reject) {
    try {
      // Find an `id` filter — when present on a write, target `/:id` not the collection.
      const idFilter = this._method !== 'GET' && this._method !== 'POST'
        ? this._filters.find(([c, op]) => op === 'eq' && c === 'id')
        : null

      const params = new URLSearchParams()
      if (this._method === 'GET' && this._select) params.set('select', this._select)
      if (this._single && this._method === 'GET')  params.set('single', '1')
      if (this._countOpt?.count)                   params.set('count', this._countOpt.count)

      for (const [col, op, val] of this._filters) {
        if (idFilter && [col, op, val].every((v, i) => v === idFilter[i])) continue
        if (op === 'eq')  params.set(col, val)
        else if (op === 'neq')  params.set(`${col}__neq`, val)
        else if (op === 'in')   params.set(`${col}__in`, val)
      }
      if (this._order && this._method === 'GET')  params.set('order', this._order)
      if (this._limit  != null && this._method === 'GET') params.set('limit',  String(this._limit))
      if (this._offset != null && this._method === 'GET') params.set('offset', String(this._offset))

      const qs = params.toString()

      // Build the path.
      let path
      if (idFilter) {
        path = `/${this.table}/${idFilter[2]}${qs ? '?' + qs : ''}`
      } else if (this._upsert && TABLE_ALIASES[this.table]?.upsert) {
        path = TABLE_ALIASES[this.table].upsert + (qs ? '?' + qs : '')
      } else {
        path = `/${this.table}${qs ? '?' + qs : ''}`
      }

      // GET/DELETE on collection: no body. PATCH/POST: body.
      const sendBody = (this._method === 'POST' || this._method === 'PATCH') ? this._body : undefined
      const r = await request(this._method, path, { body: sendBody })

      // GET response shaping.
      if (this._method === 'GET') {
        let data = r.data
        let count = null
        if (this._countOpt && Array.isArray(data)) {
          count = data.length
          if (this._countOpt.head) data = null
        }
        if (this._single) {
          const row = Array.isArray(r.data) ? r.data[0] || null : r.data
          const out = { data: row, count, error: r.error }
          resolve?.(out); return out
        }
        const out = { data: data || [], count, error: r.error }
        resolve?.(out); return out
      }

      // Write response — return the inserted/updated/deleted row(s).
      const out = { data: r.data, error: r.error }
      resolve?.(out); return out
    } catch (e) {
      const out = { data: null, error: { message: e.message } }
      reject?.(out)
      if (!reject) throw e
      return out
    }
  }
}

function from(table) { return new QueryBuilder(table) }

// ════════════════════════════════════════════════════════════════
// STORAGE — replaces supabase.storage.from(bucket)
// ════════════════════════════════════════════════════════════════
const storage = {
  from(bucket) {
    return {
      async upload(path, file, { upsert = false } = {}) {
        const form = new FormData()
        form.append('file', file, file.name || 'upload')
        const qs = upsert ? '?upsert=1' : ''
        const r = await request('POST', `/storage/${bucket}${qs}`, { body: form, isForm: true })
        if (r.error) return { data: null, error: r.error }
        return { data: { path: r.data.path, publicUrl: r.data.url }, error: null }
      },

      getPublicUrl(path) {
        return { data: { publicUrl: `/uploads/${bucket}/${path}` } }
      },

      async remove(paths) {
        return request('DELETE', `/storage/${bucket}`, { body: { paths: Array.isArray(paths) ? paths : [paths] } })
      }
    }
  }
}

// ════════════════════════════════════════════════════════════════
// REALTIME — Server-Sent Events (singleton connection per page)
// ════════════════════════════════════════════════════════════════
const realtime = (() => {
  let es = null
  const subs = { 'new-post': new Set(), 'delete-post': new Set() }

  function ensure() {
    if (es) return
    es = new EventSource('/api/posts/stream')
    es.addEventListener('new-post',    (e) => { for (const h of subs['new-post'])    { try { h(JSON.parse(e.data)) } catch {} } })
    es.addEventListener('delete-post', (e) => { for (const h of subs['delete-post']) { try { h(JSON.parse(e.data)) } catch {} } })
    // Reconnect on transient errors; close cleanly on permanent ones.
    es.addEventListener('error', () => { /* browser handles auto-reconnect */ })
  }

  return {
    on(event, handler) {
      if (!subs[event]) return () => {}
      subs[event].add(handler)
      ensure()
      return () => {
        subs[event].delete(handler)
        if (subs['new-post'].size === 0 && subs['delete-post'].size === 0 && es) {
          es.close()
          es = null
        }
      }
    }
  }
})()

// ════════════════════════════════════════════════════════════════
// EXPORTS
// ════════════════════════════════════════════════════════════════
export const api = { auth, from, storage, realtime }

// Drop-in named export for the supabase import pattern used everywhere
export const supabase = api

// Expose for debugging in the browser console
window.__api = api
window.__bp_token = getToken
window.__bp_clear = () => { setToken(null); setStoredUser(null) }
