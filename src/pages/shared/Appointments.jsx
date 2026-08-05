import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import AppShell from '../../components/layout/AppShell'

// ── HELPERS ────────────────────────────────────────────────
function fmtDate(ts) {
  if (!ts) return ''
  return new Date(ts).toLocaleDateString('en-NG', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}
function fmtTime(ts) {
  if (!ts) return ''
  return new Date(ts).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' })
}
function fmtDateTime(ts) { return ts ? `${fmtDate(ts)}, ${fmtTime(ts)}` : '' }

function toLocalInputValue(dateObj) {
  // Convert Date to "YYYY-MM-DDTHH:mm" for datetime-local input
  if (!dateObj) return ''
  const pad = n => String(n).padStart(2, '0')
  return `${dateObj.getFullYear()}-${pad(dateObj.getMonth()+1)}-${pad(dateObj.getDate())}T${pad(dateObj.getHours())}:${pad(dateObj.getMinutes())}`
}

const STATUS_STYLES = {
  pending:   'bg-amber-50 text-amber-700 border border-amber-200',
  confirmed: 'bg-green-50 text-green-700 border border-green-200',
  cancelled: 'bg-gray-100 text-gray-500 border border-gray-200',
  completed: 'bg-blue-50 text-blue-700 border border-blue-200',
  no_show:   'bg-red-50 text-red-600 border border-red-200',
}

const STATUS_LABELS = {
  pending:   'Pending',
  confirmed: 'Confirmed',
  cancelled: 'Cancelled',
  completed: 'Completed',
  no_show:   'No Show',
}

// Duration options in minutes
const DURATIONS = [30, 45, 60, 90, 120]

// ── ICONS ─────────────────────────────────────────────────
const Icon = {
  Calendar: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  Clock:    () => <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  User:     () => <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  Plus:     () => <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  X:        () => <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  Check:    () => <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>,
  Filter:   () => <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>,
  Alert:    () => <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  Refresh:  () => <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>,
}

// ── AVATAR ─────────────────────────────────────────────────
const COLORS = ['bg-blue-100 text-blue-700','bg-green-100 text-green-700','bg-purple-100 text-purple-700','bg-amber-100 text-amber-700','bg-rose-100 text-rose-700']
function initials(name = '') { return name.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase() }
function avatarColor(id = '') { return COLORS[id.charCodeAt(0) % COLORS.length] }

function Avatar({ name, id }) {
  return (
    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${avatarColor(id)}`}>
      {initials(name)}
    </div>
  )
}

// ── MODAL ─────────────────────────────────────────────────
function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">{title}</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
            <Icon.X />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}

// ── APPOINTMENT CARD ───────────────────────────────────────
function AppointmentCard({ appt, role, onAction }) {
  const isUpcoming = ['pending','confirmed'].includes(appt.status)
  const counterpart = role === 'client' ? appt.staff_name : appt.client_name

  // 12hr confirmation deadline for pending appointments
  const deadline12h = appt.status === 'pending' && appt.created_at
    ? new Date(new Date(appt.created_at).getTime() + 12 * 3600000)
    : null
  const now = new Date()
  const hoursLeft = deadline12h ? Math.max(0, (deadline12h - now) / 3600000) : null
  const isUrgent  = hoursLeft !== null && hoursLeft < 3
  const isExpired = hoursLeft !== null && hoursLeft === 0

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 hover:shadow-sm transition-shadow">
      <div className="flex items-start gap-3">
        <Avatar name={counterpart || '?'} id={role === 'client' ? (appt.staff_id||'') : (appt.client_id || appt.guest_client_id || '')} />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-gray-900 truncate">{counterpart || 'Unassigned'}</p>
              <p className="text-xs text-gray-500 mt-0.5">{appt.service_type || 'General Consultation'}</p>
            </div>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${STATUS_STYLES[appt.status]}`}>
              {STATUS_LABELS[appt.status]}
            </span>
          </div>

          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
            <span className="flex items-center gap-1 text-xs text-gray-500">
              <Icon.Calendar />{fmtDate(appt.scheduled_at)}
            </span>
            <span className="flex items-center gap-1 text-xs text-gray-500">
              <Icon.Clock />{fmtTime(appt.scheduled_at)} · {appt.duration_minutes || 60} min
            </span>
          </div>

          {appt.notes && (
            <p className="mt-2 text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2 line-clamp-2">{appt.notes}</p>
          )}

          {/* 12hr deadline warning */}
          {deadline12h && (role === 'admin' || role === 'staff') && (
            <div className={`mt-2 flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg ${isUrgent ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
              <span>⏱</span>
              {isExpired
                ? 'Confirmation deadline passed — please action now'
                : `Confirm within ${hoursLeft < 1 ? `${Math.ceil(hoursLeft * 60)}min` : `${hoursLeft.toFixed(1)}h`} (by ${deadline12h.toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' })})`
              }
            </div>
          )}

          {/* Actions */}
          {isUpcoming && (
            <div className="mt-3 flex gap-2 flex-wrap">
              {/* Admin/Staff: approve pending */}
              {(role === 'admin' || role === 'staff') && appt.status === 'pending' && (
                <button
                  onClick={() => onAction(appt, 'confirm')}
                  className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700 transition-colors"
                >
                  <Icon.Check /> Confirm
                </button>
              )}
              {/* Admin/Staff: mark complete */}
              {(role === 'admin' || role === 'staff') && appt.status === 'confirmed' && (
                <button
                  onClick={() => onAction(appt, 'complete')}
                  className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Icon.Check /> Mark Complete
                </button>
              )}
              {/* Admin/Staff: no-show */}
              {(role === 'admin' || role === 'staff') && appt.status === 'confirmed' && (
                <button
                  onClick={() => onAction(appt, 'no_show')}
                  className="flex items-center gap-1 px-3 py-1.5 bg-red-50 text-red-600 text-xs font-medium rounded-lg hover:bg-red-100 border border-red-200 transition-colors"
                >
                  No Show
                </button>
              )}
              {/* Anyone can cancel */}
              <button
                onClick={() => onAction(appt, 'cancel')}
                className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 text-gray-600 text-xs font-medium rounded-lg hover:bg-gray-200 transition-colors"
              >
                <Icon.X /> Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── BOOK FORM ──────────────────────────────────────────────
function BookForm({ profile, staffList, onBook, onClose }) {
  const isClientRole = profile?.role === 'client'
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate()+1); tomorrow.setHours(9,0,0,0)

  const [form, setForm] = useState({
    staff_id:         isClientRole ? '' : '',
    client_id:        isClientRole ? profile.id : '',
    scheduled_at:     toLocalInputValue(tomorrow),
    duration_minutes: 60,
    service_type:     '',
    notes:            '',
  })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  function set(k, v) { setForm(f => ({...f, [k]: v})); setError('') }

  async function handleSubmit() {
    if (!form.scheduled_at) return setError('Please pick a date and time.')
    if (isClientRole && !form.staff_id) return setError('Please select a staff member.')
    if (!isClientRole && !form.client_id) return setError('Please select a client.')

    const start = new Date(form.scheduled_at)
    if (start < new Date()) return setError('Appointment must be in the future.')

    setSaving(true)
    setError('')
    const err = await onBook(form)
    setSaving(false)
    if (err) setError(err)
    else onClose()
  }

  return (
    <div className="space-y-4">
      {/* Staff selector (client view) */}
      {isClientRole && (
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Staff Member *</label>
          <select
            className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={form.staff_id}
            onChange={e => set('staff_id', e.target.value)}
          >
            <option value="">Select staff…</option>
            {staffList.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
          </select>
        </div>
      )}

      {/* Client selector (staff/admin view) */}
      {!isClientRole && (
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Client *</label>
          <select
            className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={form.client_id}
            onChange={e => {
              const selected = staffList.find(c => c.id === e.target.value)
              set('client_id', e.target.value)
              set('clientKind', selected?.kind || 'client')
            }}
          >
            <option value="">Select client…</option>
            {staffList.map(c => <option key={c.id} value={c.id}>{c.label || c.full_name}</option>)}
          </select>
          <p className="text-xs text-gray-400 mt-1">Includes registered clients and public chat visitors.</p>
        </div>
      )}

      {/* Date & Time */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Date & Time *</label>
        <input
          type="datetime-local"
          className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={form.scheduled_at}
          onChange={e => set('scheduled_at', e.target.value)}
        />
      </div>

      {/* Duration */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Duration</label>
        <div className="flex gap-2 flex-wrap">
          {DURATIONS.map(d => (
            <button
              key={d}
              type="button"
              onClick={() => set('duration_minutes', d)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${form.duration_minutes === d ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'}`}
            >
              {d} min
            </button>
          ))}
        </div>
      </div>

      {/* Service type */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Service Type</label>
        <input
          type="text"
          placeholder="e.g. Counselling, Follow-up, Assessment…"
          className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={form.service_type}
          onChange={e => set('service_type', e.target.value)}
        />
      </div>

      {/* Notes */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
        <textarea
          rows={3}
          placeholder="Any details or context…"
          className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          value={form.notes}
          onChange={e => set('notes', e.target.value)}
        />
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
          <Icon.Alert />{error}
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <button
          onClick={onClose}
          className="flex-1 py-2.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={saving}
          className="flex-1 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Booking…' : 'Book Appointment'}
        </button>
      </div>
    </div>
  )
}

// ── MAIN ───────────────────────────────────────────────────
export default function Appointments() {
  const { profile } = useAuth()
  const role = profile?.role

  const [appointments, setAppointments] = useState([])
  const [loading, setLoading]           = useState(true)
  const [error, setError]               = useState('')
  const [filter, setFilter]             = useState('upcoming') // upcoming | past | all
  const [showBook, setShowBook]         = useState(false)
  const [counterparts, setCounterparts] = useState([]) // staff list (for client) or client list (for staff/admin)

  // ── LOAD ────────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!profile) return
    setLoading(true)
    setError('')

    try {
      let q = supabase
        .from('hhf_appointments')
        .select('*')
        .order('scheduled_at', { ascending: false })

      if (role === 'client') q = q.eq('client_id', profile.id)
      else if (role === 'staff') q = q.eq('staff_id', profile.id)
      // admin sees all

      const { data, error: err } = await q
      if (err) throw err

      // Fetch names for all unique user IDs — client_id resolves against
      // hhf_profiles (registered accounts), guest_client_id resolves
      // against hhf_guest_profiles (anonymous public-chat visitors). A
      // booking will only ever have one of the two set.
      const staffAndClientIds = [...new Set([
        ...(data||[]).map(a => a.staff_id).filter(Boolean),
        ...(data||[]).map(a => a.client_id).filter(Boolean),
      ])]
      const guestIds = [...new Set((data||[]).map(a => a.guest_client_id).filter(Boolean))]

      let nameMap = {}
      if (staffAndClientIds.length) {
        const { data: profiles } = await supabase
          .from('hhf_profiles')
          .select('id, full_name')
          .in('id', staffAndClientIds)
        ;(profiles||[]).forEach(p => { nameMap[p.id] = p.full_name })
      }
      if (guestIds.length) {
        const { data: guests } = await supabase
          .from('hhf_guest_profiles')
          .select('id, full_name')
          .in('id', guestIds)
        ;(guests||[]).forEach(g => { nameMap[g.id] = g.full_name })
      }

      const enriched = (data||[]).map(a => ({
        ...a,
        staff_name:  nameMap[a.staff_id]  || 'Staff',
        client_name: nameMap[a.client_id] || nameMap[a.guest_client_id] || 'Client',
      }))

      setAppointments(enriched)
    } catch (e) {
      setError(e.message || 'Failed to load appointments.')
    } finally {
      setLoading(false)
    }
  }, [profile, role])

  // Load counterparts for booking form. For staff/admin booking on behalf
  // of someone, this includes both registered clients (hhf_profiles) and
  // anonymous public-chat visitors (hhf_guest_profiles) — previously only
  // registered clients were selectable here, so staff had no way to book
  // an appointment for a guest visitor directly.
  const loadCounterparts = useCallback(async () => {
    if (!profile) return
    if (role === 'client') {
      const { data } = await supabase
        .from('hhf_profiles')
        .select('id, full_name')
        .eq('role', 'staff')
        .eq('status', 'active')
        .order('full_name')
      setCounterparts((data || []).map(c => ({ ...c, kind: 'client' })))
      return
    }
    const [{ data: clients }, { data: guests }] = await Promise.all([
      supabase.from('hhf_profiles').select('id, full_name').eq('role', 'client').eq('status', 'active').order('full_name'),
      supabase.from('hhf_guest_profiles').select('id, full_name').eq('app', 'hhf').order('full_name'),
    ])
    const combined = [
      ...(clients || []).map(c => ({ ...c, kind: 'client', label: c.full_name })),
      ...(guests  || []).map(g => ({ ...g, kind: 'guest',  label: `${g.full_name || 'Anonymous'} (Guest)` })),
    ]
    setCounterparts(combined)
  }, [profile, role])

  useEffect(() => { load(); loadCounterparts() }, [load, loadCounterparts])

  // ── FILTER ────────────────────────────────────────────────
  const now = new Date()
  const filtered = appointments.filter(a => {
    const dt = new Date(a.scheduled_at)
    if (filter === 'upcoming') return dt >= now && ['pending','confirmed'].includes(a.status)
    if (filter === 'past')     return dt < now || ['completed','cancelled','no_show'].includes(a.status)
    return true
  })

  // ── STATS ────────────────────────────────────────────────
  const stats = {
    pending:   appointments.filter(a => a.status === 'pending').length,
    confirmed: appointments.filter(a => a.status === 'confirmed').length,
    today:     appointments.filter(a => new Date(a.scheduled_at).toDateString() === now.toDateString()).length,
  }

  // ── BOOK ──────────────────────────────────────────────────
  async function handleBook(form) {
    const start = new Date(form.scheduled_at)
    const end   = new Date(start.getTime() + form.duration_minutes * 60000)

    // Check for conflicts: same staff, overlapping time
    const { data: conflicts } = await supabase
      .from('hhf_appointments')
      .select('id, scheduled_at, duration_minutes')
      .eq('staff_id', role === 'client' ? form.staff_id : profile.id)
      .in('status', ['pending', 'confirmed'])

    const hasConflict = (conflicts || []).some(c => {
      const cStart = new Date(c.scheduled_at)
      const cEnd   = new Date(cStart.getTime() + (c.duration_minutes||60) * 60000)
      return start < cEnd && end > cStart
    })

    if (hasConflict) {
      return 'That time slot conflicts with an existing appointment. Please choose a different time.'
    }

    // form.client_id may refer to either a registered client (hhf_profiles)
    // or a guest visitor (hhf_guest_profiles) — form.clientKind tells us
    // which. client_id is foreign-keyed to hhf_profiles only, so a guest's
    // id must go in guest_client_id instead, same fix already applied to
    // the public chat's own booking flow.
    const isGuestBooking = role !== 'client' && form.clientKind === 'guest'

    const payload = {
      staff_id:         role === 'client' ? form.staff_id : profile.id,
      client_id:        role === 'client' ? profile.id : (isGuestBooking ? null : form.client_id),
      guest_client_id:  isGuestBooking ? form.client_id : null,
      scheduled_at:     start.toISOString(),
      duration_minutes: form.duration_minutes,
      service_type:     form.service_type || null,
      notes:            form.notes || null,
      status:           role === 'client' ? 'pending' : 'confirmed', // staff/admin booking auto-confirms
      booked_by:        profile.id,
    }

    const { error: err } = await supabase.from('hhf_appointments').insert(payload)
    if (err) {
      if (err.code === '23P01' || err.message?.includes('hhf_appointments_no_overlap')) {
        return 'That time slot was just booked by someone else. Please choose a different time.'
      }
      return err.message
    }

    // Audit log
    await supabase.from('hhf_audit_logs').insert({
      actor_id:    profile.id,
      action:      'appointment_created',
      target_type: 'appointment',
      details:     { scheduled_at: start.toISOString(), staff_id: payload.staff_id, client_id: payload.client_id }
    }).catch(e => console.error('Audit log insert failed:', e))

    load()
    return null
  }

  // ── ACTION ────────────────────────────────────────────────
  async function handleAction(appt, action) {
    const statusMap = { confirm: 'confirmed', cancel: 'cancelled', complete: 'completed', no_show: 'no_show' }
    const newStatus = statusMap[action]
    if (!newStatus) return

    const { error: err } = await supabase
      .from('hhf_appointments')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', appt.id)

    if (err) { setError(err.message); return }

    // Audit log
    await supabase.from('hhf_audit_logs').insert({
      actor_id:    profile.id,
      action:      `appointment_${action}ed`,
      target_type: 'appointment',
      target_id:   appt.id,
      details:     { previous_status: appt.status, new_status: newStatus }
    }).catch(e => console.error('Audit log insert failed:', e))

    load()
  }

  // ── RENDER ────────────────────────────────────────────────
  const titleMap = { client: 'My Appointments', staff: 'Appointments', admin: 'All Appointments' }

  return (
    <AppShell>
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{titleMap[role] || 'Appointments'}</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {role === 'client' ? 'Book and manage your sessions' : 'Manage client appointments'}
          </p>
        </div>
        <button
          onClick={() => setShowBook(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors flex-shrink-0"
        >
          <Icon.Plus /> Book
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: 'Pending',   value: stats.pending,   color: 'text-amber-600 bg-amber-50',  border: 'border-amber-100' },
          { label: 'Confirmed', value: stats.confirmed, color: 'text-green-600 bg-green-50',  border: 'border-green-100' },
          { label: 'Today',     value: stats.today,     color: 'text-blue-600 bg-blue-50',    border: 'border-blue-100' },
        ].map(s => (
          <div key={s.label} className={`rounded-xl border p-3 ${s.border}`}>
            <div className={`text-xl font-bold ${s.color.split(' ')[0]}`}>{s.value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-4 w-fit">
        {[['upcoming','Upcoming'],['past','Past'],['all','All']].map(([v,l]) => (
          <button
            key={v}
            onClick={() => setFilter(v)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${filter === v ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {l}
          </button>
        ))}
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4">
          <Icon.Alert />{error}
          <button onClick={() => setError('')} className="ml-auto"><Icon.X /></button>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="flex flex-col gap-3">
          {[1,2,3].map(i => (
            <div key={i} className="bg-white rounded-xl border border-gray-100 p-4 animate-pulse">
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-gray-100" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-100 rounded w-1/3" />
                  <div className="h-3 bg-gray-100 rounded w-1/2" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center mb-4 text-blue-400">
            <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <rect x="3" y="4" width="18" height="18" rx="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
          </div>
          <p className="text-gray-900 font-medium">
            {filter === 'upcoming' ? 'No upcoming appointments' : `No ${filter} appointments`}
          </p>
          <p className="text-sm text-gray-400 mt-1 mb-4">
            {filter === 'upcoming' ? 'Book a session to get started.' : 'Nothing to show here yet.'}
          </p>
          {filter === 'upcoming' && (
            <button
              onClick={() => setShowBook(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors"
            >
              <Icon.Plus /> Book Appointment
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map(appt => (
            <AppointmentCard
              key={appt.id}
              appt={appt}
              role={role}
              onAction={handleAction}
            />
          ))}
          <button
            onClick={load}
            className="flex items-center justify-center gap-2 text-xs text-gray-400 hover:text-gray-600 py-2 transition-colors"
          >
            <Icon.Refresh /> Refresh
          </button>
        </div>
      )}

      {/* Book modal */}
      {showBook && (
        <Modal title="Book Appointment" onClose={() => setShowBook(false)}>
          <BookForm
            profile={profile}
            staffList={counterparts}
            onBook={handleBook}
            onClose={() => setShowBook(false)}
          />
        </Modal>
      )}
    </AppShell>
  )
}
