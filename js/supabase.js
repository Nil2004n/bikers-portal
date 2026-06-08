// ── Supabase Client — single source of truth ─────────────────
// Replace the two values below:
// Supabase Dashboard → Settings → API → Project URL & anon key
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL      = 'https://hdsuxbebxcjxrtczyrun.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_vwvP5JeS0z-XT-DkgYCvUA_nxH9IN37'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// ─── CONVERSATIONS ────────────────────────────────────────────

/**
 * Get or create a DM conversation between current user and another user.
 * Enforces canonical ordering (smaller UUID is participant_1).
 */
async function getOrCreateConversation(otherUserId) {
  const currentUser = (await supabase.auth.getUser()).data.user;
  if (!currentUser) return { data: null, error: 'Not authenticated' };

  const uid = currentUser.id;
  const [p1, p2] = uid < otherUserId ? [uid, otherUserId] : [otherUserId, uid];

  let { data, error } = await supabase
    .from('conversations')
    .select('id')
    .eq('participant_1', p1)
    .eq('participant_2', p2)
    .single();

  if (error && error.code === 'PGRST116') {
    ({ data, error } = await supabase
      .from('conversations')
      .insert({ participant_1: p1, participant_2: p2 })
      .select('id')
      .single());
  }

  return { data, error };
}

/**
 * Fetch all conversations for current user with last message preview.
 */
async function getConversations() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('conversations')
    .select(`
      id,
      created_at,
      participant_1:profiles!conversations_participant_1_fkey(id, username, avatar_url, full_name),
      participant_2:profiles!conversations_participant_2_fkey(id, username, avatar_url, full_name),
      messages(content, created_at, sender_id, read_at)
    `)
    .or(`participant_1.eq.${user.id},participant_2.eq.${user.id}`)
    .order('created_at', { referencedTable: 'messages', ascending: false })
    .limit(1, { referencedTable: 'messages' });

  if (error) { console.error('getConversations:', error); return []; }
  return data || [];
}

/**
 * Fetch messages for a conversation (paginated).
 */
async function getMessages(conversationId, page = 0, limit = 50) {
  const { data, error } = await supabase
    .from('messages')
    .select(`
      id, content, created_at, read_at, sender_id,
      sender:profiles!messages_sender_id_fkey(id, username, avatar_url)
    `)
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .range(page * limit, (page + 1) * limit - 1);

  if (error) { console.error('getMessages:', error); return []; }
  return data || [];
}

/**
 * Send a message.
 */
async function sendMessage(conversationId, content) {
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('messages')
    .insert({ conversation_id: conversationId, sender_id: user.id, content: content.trim() })
    .select()
    .single();
  return { data, error };
}

/**
 * Mark all unread messages in a conversation as read.
 */
async function markMessagesRead(conversationId) {
  const { data: { user } } = await supabase.auth.getUser();
  await supabase
    .from('messages')
    .update({ read_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .neq('sender_id', user.id)
    .is('read_at', null);
}

// ─── NOTIFICATIONS ────────────────────────────────────────────

/**
 * Fetch notifications for current user.
 */
async function getNotifications(limit = 30) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('notifications')
    .select(`
      id, type, entity_type, entity_id, message, read_at, created_at,
      actor:profiles!notifications_actor_id_fkey(id, username, avatar_url, full_name)
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) { console.error('getNotifications:', error); return []; }
  return data || [];
}

/**
 * Get unread notification count.
 */
async function getUnreadNotificationCount() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 0;

  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .is('read_at', null);

  return error ? 0 : (count || 0);
}

/**
 * Mark a single notification as read.
 */
async function markNotificationRead(notificationId) {
  await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', notificationId);
}

/**
 * Mark ALL notifications as read.
 */
async function markAllNotificationsRead() {
  const { data: { user } } = await supabase.auth.getUser();
  await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .is('read_at', null);
}

/**
 * Subscribe to realtime notifications for current user.
 * Returns the channel so caller can unsubscribe on page exit.
 */
function subscribeToNotifications(userId, onNewNotification) {
  return supabase
    .channel(`notifications:${userId}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'notifications',
      filter: `user_id=eq.${userId}`
    }, payload => onNewNotification(payload.new))
    .subscribe();
}

/**
 * Subscribe to realtime messages in a conversation.
 * Returns the channel so caller can unsubscribe on page exit.
 */
function subscribeToMessages(conversationId, onNewMessage) {
  return supabase
    .channel(`messages:${conversationId}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'messages',
      filter: `conversation_id=eq.${conversationId}`
    }, payload => onNewMessage(payload.new))
    .subscribe();
}

export {
  getOrCreateConversation,
  getConversations,
  getMessages,
  sendMessage,
  markMessagesRead,
  getNotifications,
  getUnreadNotificationCount,
  markNotificationRead,
  markAllNotificationsRead,
  subscribeToNotifications,
  subscribeToMessages
}
