import { supabase } from './supabase'

// ── PRESENCE ─────────────────────────────────────────────────
// One shared primitive — "is user X currently looking at conversation Y,
// right now" — that powers three related chat features:
//   1. Notification suppression (don't alert someone already looking)
//   2. Typing indicators
//   3. Read receipts
//
// Built on Supabase Realtime Presence, scoped one channel per conversation.
// Presence is automatically cleaned up by Supabase when a client disconnects
// or the channel is unsubscribed (tab closed, navigated away) — no manual
// "I left" write needed, unlike the online/offline heartbeat we built for
// staff availability.

function channelName(conversationId) {
  return `presence:convo:${conversationId}`
}

/**
 * Join the presence channel for a conversation. Call this when a
 * conversation is opened on screen (visitor's ChatWindow mounts, or staff
 * opens a conversation in Messaging.jsx). Returns the channel — hold onto
 * it and call leaveConversationPresence(channel) when the conversation is
 * closed or the component unmounts.
 *
 * `viewer` should be a small identifying object, e.g.
 *   { id: profile.id, role: 'staff' }  or  { id: visitor.id, role: 'visitor' }
 *
 * `onPresenceChange(viewers)` is called whenever the set of present viewers
 * changes, with an array of viewer objects currently present (including
 * yourself).
 *
 * `onTyping({ id, role, typing })` is called when someone broadcasts a
 * typing event on this channel.
 */
export function joinConversationPresence(conversationId, viewer, { onPresenceChange, onTyping } = {}) {
  const channel = supabase.channel(channelName(conversationId), {
    config: { presence: { key: viewer.id } },
  })

  if (onPresenceChange) {
    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState()
      const viewers = Object.values(state).flat()
      onPresenceChange(viewers)
    })
  }

  if (onTyping) {
    channel.on('broadcast', { event: 'typing' }, ({ payload }) => {
      // Ignore our own typing echoes
      if (payload?.id === viewer.id) return
      onTyping(payload)
    })
  }

  channel.subscribe(async status => {
    if (status === 'SUBSCRIBED') {
      await channel.track({ id: viewer.id, role: viewer.role, joined_at: new Date().toISOString() })
    }
  })

  return channel
}

export function leaveConversationPresence(channel) {
  if (!channel) return
  supabase.removeChannel(channel)
}

/**
 * Returns true if the given viewerId is currently present in the given
 * conversation's presence state (already-joined channel object).
 */
export function isViewerPresent(channel, viewerId) {
  if (!channel) return false
  const state = channel.presenceState()
  return Object.prototype.hasOwnProperty.call(state, viewerId)
}

/**
 * Broadcast a typing event on an already-joined conversation channel.
 * Call this on every keystroke in the message input (it's cheap — broadcast
 * events don't hit the database). The receiving side is responsible for
 * expiring the indicator after a short delay if no further events arrive
 * (see useTypingIndicator-style expiry pattern in the consuming component).
 */
export function broadcastTyping(channel, viewer, typing) {
  if (!channel) return
  channel.send({
    type: 'broadcast',
    event: 'typing',
    payload: { id: viewer.id, role: viewer.role, typing },
  })
}

/**
 * Given a joined presence channel, check whether anyone with the given
 * role (e.g. 'staff' or 'visitor') is currently present — used to decide
 * whether to suppress a notification because the recipient is already
 * looking at this exact conversation.
 */
export function isRolePresent(channel, role, excludeId = null) {
  if (!channel) return false
  const state = channel.presenceState()
  return Object.values(state).flat().some(v => v.role === role && v.id !== excludeId)
}
