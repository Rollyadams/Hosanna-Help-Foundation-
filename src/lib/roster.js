import { supabase } from './supabase'

// ── CONFIG ───────────────────────────────────────────────────
export const ESCALATION_MINUTES = 5 // time before an unclaimed/unanswered chat reassigns
export const AWAY_MESSAGE_MINUTES = 5 // time before visitor gets an away message if nobody has responded at all

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

function currentDayKey(date = new Date()) {
  return DAY_KEYS[date.getDay()]
}

function currentTimeStr(date = new Date()) {
  return date.toTimeString().slice(0, 5) // 'HH:MM'
}

function todayStr(date = new Date()) {
  return date.toISOString().split('T')[0]
}

function isWithinWorkingHours(availability, now = new Date()) {
  const hours = availability?.working_hours
  if (!hours) return true // no hours configured — treat as always available
  const day = hours[currentDayKey(now)]
  if (!day || !day.enabled) return false
  const t = currentTimeStr(now)
  return t >= day.start && t <= day.end
}

function isBlockedToday(availability, now = new Date()) {
  const blocked = availability?.blocked_dates || []
  return blocked.some(b => b.date === todayStr(now))
}

function isAwayNow(availability, now = new Date()) {
  if (!availability?.is_away) return false
  if (!availability.away_until) return true // away indefinitely
  return new Date(availability.away_until) >= now
}

/**
 * Returns the list of staff/admin profile ids who are genuinely available
 * right now: active account, online, not marked away, within working hours,
 * and not on a blocked date.
 */
export async function getAvailableStaffIds() {
  const now = new Date()

  const { data: profiles, error: profErr } = await supabase
    .from('hhf_profiles')
    .select('id')
    .in('role', ['admin', 'staff'])
    .eq('status', 'active')
    .eq('online_status', 'online')

  if (profErr || !profiles?.length) return []

  const ids = profiles.map(p => p.id)

  const { data: availRows } = await supabase
    .from('hhf_availability')
    .select('staff_id, is_away, away_until, working_hours, blocked_dates')
    .in('staff_id', ids)

  const availMap = new Map((availRows || []).map(a => [a.staff_id, a]))

  return ids.filter(id => {
    const avail = availMap.get(id)
    if (!avail) return true // no availability record yet — assume available
    if (isAwayNow(avail, now)) return false
    if (isBlockedToday(avail, now)) return false
    if (!isWithinWorkingHours(avail, now)) return false
    return true
  })
}

/**
 * Round-robin pick: among available staff, choose whoever has the fewest
 * currently open conversations, breaking ties by whoever was assigned
 * longest ago (or never).
 */
export async function pickNextStaff(availableIds) {
  if (!availableIds.length) return null
  if (availableIds.length === 1) return availableIds[0]

  const { data: openConvos } = await supabase
    .from('hhf_conversations')
    .select('assigned_staff_id, assigned_at')
    .in('assigned_staff_id', availableIds)
    .eq('status', 'active')

  const load = new Map(availableIds.map(id => [id, { count: 0, lastAssigned: null }]))
  ;(openConvos || []).forEach(c => {
    const entry = load.get(c.assigned_staff_id)
    if (!entry) return
    entry.count += 1
    if (!entry.lastAssigned || (c.assigned_at && c.assigned_at > entry.lastAssigned)) {
      entry.lastAssigned = c.assigned_at
    }
  })

  const ranked = availableIds
    .map(id => ({ id, ...load.get(id) }))
    .sort((a, b) => {
      if (a.count !== b.count) return a.count - b.count
      // fewer conversations wins; tie-break by whoever was assigned longest ago (nulls first)
      if (!a.lastAssigned && b.lastAssigned) return -1
      if (a.lastAssigned && !b.lastAssigned) return 1
      if (!a.lastAssigned && !b.lastAssigned) return 0
      return a.lastAssigned.localeCompare(b.lastAssigned)
    })

  return ranked[0].id
}

/**
 * Full assignment flow used when a new visitor conversation is created.
 * Returns { staffId, wasFallback } where wasFallback indicates no one was
 * truly "available" and we fell back to any active staff member.
 */
export async function assignStaffForNewConversation() {
  const availableIds = await getAvailableStaffIds()
  let wasFallback = false
  let staffId = await pickNextStaff(availableIds)

  if (!staffId) {
    wasFallback = true
    const { data: anyStaff } = await supabase
      .from('hhf_profiles')
      .select('id')
      .in('role', ['admin', 'staff'])
      .eq('status', 'active')
      .limit(20)
    staffId = await pickNextStaff((anyStaff || []).map(s => s.id))
  }

  return { staffId: staffId || null, wasFallback }
}

/**
 * Notify a staff member about a new conversation needing their attention.
 * Writes to the correct `recipient_id` column (this was previously broken
 * as `user_id`, which silently dropped every notification).
 */
export async function notifyStaffOfConversation({ staffId, title, body, convoId }) {
  return supabase.from('hhf_notifications').insert({
    recipient_id: staffId,
    type: 'new_message',
    title,
    body: body?.slice(0, 80) || null,
    link: `/${'staff'}/messages?convo=${convoId}`,
    read: false,
  })
}

/**
 * Reassigns a conversation to the next best available staff member,
 * excluding the staff member who failed to respond in time. Logs the
 * reassignment to hhf_audit_logs so admins can see who is slow to respond.
 */
export async function escalateConversation(convoId, previousStaffId) {
  const availableIds = (await getAvailableStaffIds()).filter(id => id !== previousStaffId)
  const nextStaffId = await pickNextStaff(availableIds)

  if (!nextStaffId) return { reassigned: false, staffId: null }

  const { data: convo } = await supabase
    .from('hhf_conversations')
    .select('id, category')
    .eq('id', convoId)
    .single()

  await supabase
    .from('hhf_conversations')
    .update({ assigned_staff_id: nextStaffId, assigned_at: new Date().toISOString() })
    .eq('id', convoId)

  await notifyStaffOfConversation({
    staffId: nextStaffId,
    title: `Reassigned chat${convo?.category ? ` — ${convo.category}` : ''}`,
    body: 'A conversation was reassigned to you after no response from the previous staff member.',
    convoId,
  })

  await supabase.from('hhf_audit_logs').insert({
    actor_id: previousStaffId,
    action: 'conversation_reassigned',
    target_type: 'conversation',
    target_id: convoId,
    details: {
      reason: 'no_response_timeout',
      from_staff_id: previousStaffId,
      to_staff_id: nextStaffId,
      escalation_minutes: ESCALATION_MINUTES,
    },
  }).catch(() => {})

  // Let an admin know a reassignment happened, for visibility on slow staff
  const { data: admins } = await supabase
    .from('hhf_profiles')
    .select('id')
    .eq('role', 'admin')
    .eq('status', 'active')

  if (admins?.length) {
    await supabase.from('hhf_notifications').insert(
      admins.map(a => ({
        recipient_id: a.id,
        type: 'system',
        title: 'Chat auto-reassigned',
        body: `A conversation was reassigned after ${ESCALATION_MINUTES} minutes of no response.`,
        link: `/admin/audit`,
        read: false,
      }))
    )
  }

  return { reassigned: true, staffId: nextStaffId }
}
