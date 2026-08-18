import { supabase } from './supabase'

// ── CONFIG ───────────────────────────────────────────────────
export const ESCALATION_MINUTES = 5 // time before an unclaimed/unanswered chat reassigns
export const AWAY_MESSAGE_MINUTES = 5 // time before visitor gets an away message if nobody has responded at all

// A staff member's `online_status` flag is only trusted if their last
// heartbeat (last_seen_at, written every ~45s by AuthContext while their tab
// is open) is more recent than this window. This means a crashed browser or
// force-closed app naturally drops out of "available" here without needing
// any close/unload event to have fired — the flag alone is not enough, since
// nothing guarantees it gets flipped back to 'offline' on an ungraceful exit.
const ONLINE_STALE_AFTER_MS = 90 * 1000

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

export function currentDayKey(date = new Date()) {
  return DAY_KEYS[date.getDay()]
}

export function currentTimeStr(date = new Date()) {
  return date.toTimeString().slice(0, 5) // 'HH:MM' — deliberately uses the
  // browser/server's local time, same as the rest of this file. If staff
  // enter roster hours assuming West Africa Time but the environment
  // evaluating this runs in a different timezone, comparisons here will be
  // wrong. Worth confirming explicitly rather than assuming — flagged here
  // since it's an easy thing to get silently wrong.
}

// Monday of the current week, formatted the same way Roster.jsx does when
// saving (YYYY-MM-DD, local Monday 00:00), so we look up the correct row.
export function currentWeekStart(date = new Date()) {
  const d = new Date(date)
  const day = d.getDay()
  const diff = (day === 0 ? -6 : 1 - day)
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d.toISOString().split('T')[0]
}

/**
 * Returns the list of staff/admin profile ids who are genuinely available
 * right now: active account, online with a fresh heartbeat, and — per the
 * real weekly roster in hhf_roster — scheduled to be working at this exact
 * day/time, with is_available not explicitly turned off.
 *
 * NOTE: previously this checked a table called hhf_availability, which
 * nothing in the app ever wrote to — every roster entry staff actually
 * saved (via Roster.jsx, into hhf_roster) was silently ignored for routing
 * purposes. This was a real bug: "available" only ever meant "app open
 * right now," with the deliberately-set weekly schedule having zero effect.
 */
export async function getAvailableStaffIds() {
  const now = new Date()
  const staleCutoff = new Date(now.getTime() - ONLINE_STALE_AFTER_MS).toISOString()

  const { data: profiles, error: profErr } = await supabase
    .from('hhf_profiles')
    .select('id')
    .in('role', ['admin', 'staff'])
    .eq('status', 'active')
    .eq('online_status', 'online')
    .gte('last_seen_at', staleCutoff)

  if (profErr || !profiles?.length) return []

  const ids = profiles.map(p => p.id)
  const weekStart = currentWeekStart(now)
  const today = currentDayKey(now)
  const nowTime = currentTimeStr(now)

  const { data: rosterRows } = await supabase
    .from('hhf_roster')
    .select('staff_id, day, start_time, end_time, is_available')
    .in('staff_id', ids)
    .eq('week_start', weekStart)
    .eq('day', today)

  const rosterMap = new Map((rosterRows || []).map(r => [r.staff_id, r]))

  return ids.filter(id => {
    const shift = rosterMap.get(id)
    // No roster entry at all for this staff member this week — rather than
    // silently assume they're available (the old, wrong behavior), treat
    // them as NOT available. A missing schedule should not be interpreted
    // as "on call 24/7" — that's how the roster ended up being bypassed
    // for everyone in the first place.
    if (!shift) return false
    if (shift.is_available === false) return false
    // start_time/end_time are stored as 'HH:MM:SS' — compare against the
    // same 'HH:MM' precision used elsewhere in this file.
    const start = shift.start_time?.slice(0, 5)
    const end = shift.end_time?.slice(0, 5)
    if (!start || !end) return false
    return nowTime >= start && nowTime <= end
  })
}

/**
 * Checks whether a single staff/admin member is within their scheduled
 * working hours right now, per today's row in hhf_roster for the current
 * week. This is the same "is this person on shift" comparison used inside
 * getAvailableStaffIds, pulled out standalone so UI (e.g. an on-duty badge)
 * can call it for just one person without also requiring online_status /
 * last_seen_at — those are about live app presence, not the schedule.
 *
 * Returns false (not on duty) if there's no roster row for today, or the
 * day is explicitly marked unavailable, or the current time falls outside
 * the saved start/end window. A missing schedule is treated the same way
 * as getAvailableStaffIds treats it — NOT as "on call 24/7."
 */
export async function isStaffOnDuty(staffId) {
  if (!staffId) return false
  const now = new Date()
  const weekStart = currentWeekStart(now)
  const today = currentDayKey(now)
  const nowTime = currentTimeStr(now)

  const { data: shift } = await supabase
    .from('hhf_roster')
    .select('start_time, end_time, is_available')
    .eq('staff_id', staffId)
    .eq('week_start', weekStart)
    .eq('day', today)
    .maybeSingle()

  if (!shift) return false
  if (shift.is_available === false) return false
  const start = shift.start_time?.slice(0, 5)
  const end = shift.end_time?.slice(0, 5)
  if (!start || !end) return false
  return nowTime >= start && nowTime <= end
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

// The designated fallback account when no staff/admin is genuinely
// available — kept in sync with the same account used by the server-side
// cron job (hhf_check_stale_conversations / fix_stale_conversation_v2_...
// .sql). This is a deliberate choice, not an arbitrary pick: it's the
// organization's main account, not "whoever happens to still be active."
const FALLBACK_ADMIN_EMAIL = 'info@hhfoundation.com.ng'

async function getFallbackAdminId() {
  const { data } = await supabase
    .from('hhf_profiles')
    .select('id')
    .eq('email', FALLBACK_ADMIN_EMAIL)
    .maybeSingle()
  return data?.id || null
}

/**
 * Full assignment flow used when a new visitor conversation is created.
 * Returns { staffId, wasFallback } where wasFallback indicates no one was
 * truly "available" (per the real roster + online status) and we routed to
 * the designated fallback admin instead — never to "any active staff
 * regardless of whether they're actually on shift," which defeats the
 * whole point of respecting the roster.
 */
export async function assignStaffForNewConversation() {
  const availableIds = await getAvailableStaffIds()
  let wasFallback = false
  let staffId = await pickNextStaff(availableIds)

  if (!staffId) {
    wasFallback = true
    staffId = await getFallbackAdminId()
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
