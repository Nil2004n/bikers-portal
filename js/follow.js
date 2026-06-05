// ── js/follow.js ────────────────────────────────────────────
// All follow / unfollow / accept / reject logic for the social
// graph. ES module — import { ... } from './follow.js'.
//
// Tables touched: public.follows
// RLS enforces follower_id / following_id ownership, so even
// direct client writes are safe; the helpers below wrap each
// operation with consistent { success, error } envelopes so
// callers can render inline UI without try/catch noise.
import { supabase } from './supabase.js'

/* ── 1. Helpers ─────────────────────────────────────────── */

export async function getCurrentUserId() {
  const { data, error } = await supabase.auth.getUser()
  if (error) return null
  return (data && data.user && data.user.id) || null
}

/* ── 2. Mutations ───────────────────────────────────────── */

export async function sendFollowRequest(targetId) {
  if (!targetId) return { success: false, error: 'No target user.' }
  const myId = await getCurrentUserId()
  if (!myId) return { success: false, error: 'Not signed in.' }
  if (myId === targetId) return { success: false, error: 'You cannot follow yourself.' }

  const { error } = await supabase
    .from('follows')
    .insert({ follower_id: myId, following_id: targetId, status: 'pending' })
  if (error) {
    if (/duplicate|unique/i.test(error.message)) return { success: true }
    return { success: false, error: error.message }
  }
  return { success: true }
}

export async function cancelFollowRequest(targetId) {
  const myId = await getCurrentUserId()
  if (!myId) return { success: false, error: 'Not signed in.' }
  const { error } = await supabase
    .from('follows')
    .delete()
    .eq('follower_id', myId)
    .eq('following_id', targetId)
  if (error) return { success: false, error: error.message }
  return { success: true }
}

export async function acceptFollowRequest(followerId) {
  const myId = await getCurrentUserId()
  if (!myId) return { success: false, error: 'Not signed in.' }
  const { error } = await supabase
    .from('follows')
    .update({ status: 'accepted' })
    .eq('follower_id', followerId)
    .eq('following_id', myId)
  if (error) return { success: false, error: error.message }
  return { success: true }
}

export async function rejectFollowRequest(followerId) {
  const myId = await getCurrentUserId()
  if (!myId) return { success: false, error: 'Not signed in.' }
  const { error } = await supabase
    .from('follows')
    .delete()
    .eq('follower_id', followerId)
    .eq('following_id', myId)
  if (error) return { success: false, error: error.message }
  return { success: true }
}

export async function unfollowUser(targetId) {
  return cancelFollowRequest(targetId)
}

/* ── 3. Status lookup ───────────────────────────────────── */

export async function getFollowStatus(targetId) {
  const myId = await getCurrentUserId()
  if (!myId || !targetId) return 'none'
  if (myId === targetId) return 'none'

  const { data, error } = await supabase
    .from('follows')
    .select('follower_id, following_id, status')
    .or(`and(follower_id.eq.${myId},following_id.eq.${targetId}),and(follower_id.eq.${targetId},following_id.eq.${myId})`)
    .limit(1)
  if (error) return 'none'
  const row = (data || [])[0]
  if (!row) return 'none'
  if (row.status === 'accepted') return 'accepted'
  // pending — direction matters
  if (row.follower_id === myId) return 'pending_sent'
  return 'pending_received'
}

/* ── 4. Counts ──────────────────────────────────────────── */

export async function getFollowerCount(userId) {
  if (!userId) return 0
  const { count, error } = await supabase
    .from('follows')
    .select('id', { count: 'exact', head: true })
    .eq('following_id', userId)
    .eq('status', 'accepted')
  if (error) return 0
  return count || 0
}

export async function getFollowingCount(userId) {
  if (!userId) return 0
  const { count, error } = await supabase
    .from('follows')
    .select('id', { count: 'exact', head: true })
    .eq('follower_id', userId)
    .eq('status', 'accepted')
  if (error) return 0
  return count || 0
}

/* ── 5. Lists ───────────────────────────────────────────── */

export async function getFollowersList(userId) {
  if (!userId) return []
  const { data, error } = await supabase
    .from('follows')
    .select('follower_id, status, created_at, profiles:follower_id ( id, username, full_name, avatar_url, bike_model, bio )')
    .eq('following_id', userId)
    .eq('status', 'accepted')
    .order('created_at', { ascending: false })
  if (error) return []
  return (data || []).map((r) => r.profiles).filter(Boolean)
}

export async function getFollowingList(userId) {
  if (!userId) return []
  const { data, error } = await supabase
    .from('follows')
    .select('following_id, status, created_at, profiles:following_id ( id, username, full_name, avatar_url, bike_model, bio )')
    .eq('follower_id', userId)
    .eq('status', 'accepted')
    .order('created_at', { ascending: false })
  if (error) return []
  return (data || []).map((r) => r.profiles).filter(Boolean)
}

export async function getPendingRequests() {
  const myId = await getCurrentUserId()
  if (!myId) return []
  const { data, error } = await supabase
    .from('follows')
    .select('id, follower_id, status, created_at, profiles:follower_id ( id, username, full_name, avatar_url, bike_model, bio )')
    .eq('following_id', myId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
  if (error) return []
  return (data || []).map((r) => ({
    id: r.id,
    follower_id: r.follower_id,
    created_at: r.created_at,
    profile: r.profiles,
  })).filter((r) => r.profile)
}
