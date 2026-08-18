import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import AppShell from '../../components/layout/AppShell'

// ── HELPERS ───────────────────────────────────────────────
const DAYS = [
  { key: 'mon', label: 'Mon' },
  { key: 'tue', label: 'Tue' },
  { key: 'wed', label: 'Wed' },
  { key: 'thu', label: 'Thu' },
  { key: 'fri', label: 'Fri' },
  { key: 'sat', label: 'Sat' },
  { key: 'sun', label: 'Sun' },
]

function getMonday(date = new Date()) {
  const d = new Date(date)
  const day = d.getDay()
  const diff = (day === 0 ? -6 : 1 - day)
  d.setDate(d.getDate() + diff)
  d.setHours(0,0,0,0)
  return d
}

function toDateStr(date) {
  // IMPORTANT: do NOT use date.toISOString() here — it converts to UTC
  // first, which silently shifts the date backward by one day for anyone
  // in a timezone ahead of UTC (e.g. Nigeria, WAT = UTC+1) when the local
  // time is late enough that the UTC equivalent has already rolled over to
  // the previous day. This was the actual root cause of week_start being
  // saved as a Sunday instead of the intended Monday. Format using local
  // date components instead, so "Monday" always genuinely means Monday in
  // the browser's own timezone.
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function weekLabel(monday) {
  const sunday = new Date(monday)
  sunday.setDate(sunday.getDate() + 6)
  const fmt = d => d.toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })
  return `${fmt(monday)} – ${fmt(sunday)}`
}

const DEFAULT_SLOT = { start_time: '09:00', end_time: '17:00', is_available: true, note: '' }

function Toggle({ checked, onChange }) {
  return (
    <button type="button" onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0 ${checked ? 'bg-blue-600' : 'bg-gray-200'}`}>
      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
    </button>
  )
}

// Masked HH:MM text input — deliberately avoids the native <input type="time">
// picker, whose OS-rendered dialog clips its own "Set"/"OK" button off-screen
// on some Android/Chrome combinations. This gives the same guarantee (only
// ever produces a valid 24-hour HH:MM value) using a plain text field with
// input masking instead, so there's no OS dialog that can misrender.
function TimeInput({ value, onChange, disabled }) {
  const [text, setText] = useState(value || '')

  // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing local text with the external `value` prop when it changes (e.g. after save/normalize), same pattern used elsewhere in this codebase
  useEffect(() => { setText(value || '') }, [value])

  function handleChange(e) {
    let raw = e.target.value.replace(/[^\d]/g, '') // digits only
    if (raw.length > 4) raw = raw.slice(0, 4)

    let hh = raw.slice(0, 2)
    let mm = raw.slice(2, 4)

    // Clamp as the person types so it's never possible to type an invalid hour/minute
    if (hh.length === 2 && parseInt(hh, 10) > 23) hh = '23'
    if (mm.length === 2 && parseInt(mm, 10) > 59) mm = '59'

    const formatted = mm.length ? `${hh}:${mm}` : hh
    setText(formatted)
  }

  function handleBlur() {
    const digits = text.replace(/[^\d]/g, '')
    if (digits.length < 3) {
      // Incomplete entry — fall back to the last valid value instead of saving junk
      setText(value || '')
      return
    }
    const hh = digits.slice(0, 2).padStart(2, '0')
    const mm = digits.slice(2, 4).padEnd(2, '0')
    const clean = `${Math.min(parseInt(hh, 10), 23).toString().padStart(2, '0')}:${Math.min(parseInt(mm, 10), 59).toString().padStart(2, '0')}`
    setText(clean)
    onChange(clean)
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      value={text}
      disabled={disabled}
      onChange={handleChange}
      onBlur={handleBlur}
      placeholder="09:00"
      maxLength={5}
      className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white disabled:bg-gray-50"
    />
  )
}

// ── STAFF ROSTER VIEW ─────────────────────────────────────
function StaffRoster({ staffId, weekStart, readOnly = false }) {
  const { profile } = useAuth()
  const [slots, setSlots]   = useState({})
  const [loading, setLoading] = useState(true)
  // Per-day save status, keyed by day: 'saving' | 'saved' | undefined.
  // Replaces the old single page-level Save button — each toggle/time
  // change now commits immediately on its own, so staff see one row
  // confirm at a time instead of having to remember to hit Save.
  const [rowStatus, setRowStatus] = useState({})

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('hhf_roster')
      .select('day, start_time, end_time, is_available, note')
      .eq('staff_id', staffId)
      .eq('week_start', weekStart)
    const map = {}
    DAYS.forEach(d => { map[d.key] = { ...DEFAULT_SLOT } })
    ;(data || []).forEach(r => {
      map[r.day] = { start_time: r.start_time, end_time: r.end_time, is_available: r.is_available, note: r.note || '' }
    })
    setSlots(map)
    setLoading(false)
  }, [staffId, weekStart])

  useEffect(() => { load() }, [load])

  const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/

  function normalizeTime(value, fallback) {
    return TIME_RE.test(value) ? value : fallback
  }

  function flashRowStatus(day, status) {
    setRowStatus(s => ({ ...s, [day]: status }))
    if (status === 'saved') {
      setTimeout(() => {
        setRowStatus(s => (s[day] === 'saved' ? { ...s, [day]: undefined } : s))
      }, 1500)
    }
  }

  // Commits exactly one day's slot to hhf_roster. Called immediately on
  // toggle flip (no separate Save step) and on time-field blur — this
  // replaces the old pattern of editing everything locally and only
  // persisting once a page-level Save button was pressed, which staff
  // could forget to tap.
  async function saveSlot(day, patch) {
    const merged = { ...(slots[day] || DEFAULT_SLOT), ...patch }
    setSlots(s => ({ ...s, [day]: merged }))
    if (readOnly) return

    flashRowStatus(day, 'saving')
    const row = {
      staff_id:     staffId,
      week_start:   weekStart,
      day,
      start_time:   normalizeTime(merged.start_time, '09:00'),
      end_time:     normalizeTime(merged.end_time, '17:00'),
      is_available: merged.is_available ?? true,
      note:         merged.note || null,
      created_by:   profile.id,
      updated_at:   new Date().toISOString(),
    }
    const { error } = await supabase.from('hhf_roster').upsert(row, { onConflict: 'staff_id,week_start,day' })
    flashRowStatus(day, error ? undefined : 'saved')
  }

  if (loading) return <div className="py-6 text-center text-sm text-gray-400 animate-pulse">Loading roster…</div>

  return (
    <div>
      <div className="space-y-2">
        {DAYS.map(({ key, label }) => {
          const slot = slots[key] || DEFAULT_SLOT
          const status = rowStatus[key]
          return (
            <div key={key} className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${slot.is_available ? 'bg-gray-50' : 'bg-white opacity-50'}`}>
              <span className="text-xs font-semibold text-gray-500 w-8 flex-shrink-0">{label}</span>
              <Toggle
                checked={slot.is_available}
                onChange={v => !readOnly && saveSlot(key, { is_available: v })}
              />
              {slot.is_available ? (
                <div className="flex items-center gap-2 flex-1">
                <div className="flex flex-col gap-1 flex-1">
                  <TimeInput value={slot.start_time} disabled={readOnly}
                    onChange={v => saveSlot(key, { start_time: v })} />
                  <TimeInput value={slot.end_time} disabled={readOnly}
                    onChange={v => saveSlot(key, { end_time: v })} />
                </div>
                </div>
              ) : (
                <span className="text-xs text-gray-400 flex-1">Day off</span>
              )}
              {/* Per-row save feedback — replaces the old page-level Save
                  button/toast. Reserved-width so rows don't shift as the
                  status appears/disappears. */}
              <span className="w-12 flex-shrink-0 text-right text-[10px] font-medium">
                {status === 'saving' && <span className="text-gray-400">Saving…</span>}
                {status === 'saved' && <span className="text-green-600">Saved ✓</span>}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── MAIN ─────────────────────────────────────────────────
export default function Roster() {
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'admin'

  const [weekStart, setWeekStart] = useState(toDateStr(getMonday()))
  const [staffList, setStaffList] = useState([])
  const [selectedStaff, setSelectedStaff] = useState(null)

  useEffect(() => {
    if (!isAdmin) return
    supabase.from('hhf_profiles').select('id, full_name').eq('role', 'staff').eq('status', 'active').order('full_name')
      .then(({ data }) => {
        setStaffList(data || [])
        if (data?.length) setSelectedStaff(data[0].id)
      })
  }, [isAdmin])

  function changeWeek(dir) {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + dir * 7)
    setWeekStart(toDateStr(d))
  }

  async function generateNextWeek() {
    // Copy this week's roster to next week for all staff
    const nextWeek = new Date(weekStart)
    nextWeek.setDate(nextWeek.getDate() + 7)
    const nextStr = toDateStr(nextWeek)

    const { data: thisWeek } = await supabase
      .from('hhf_roster').select('*').eq('week_start', weekStart)

    if (!thisWeek?.length) return

    const nextRows = thisWeek.map(r => ({
      ...r, id: undefined, week_start: nextStr, updated_at: new Date().toISOString()
    }))
    await supabase.from('hhf_roster').upsert(nextRows, { onConflict: 'staff_id,week_start,day' })
    setWeekStart(nextStr)
  }

  const staffId = isAdmin ? (selectedStaff || profile?.id) : profile?.id

  return (
    <AppShell>
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            {isAdmin ? 'Staff Roster' : 'My Availability Roster'}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {isAdmin ? 'Edit any staff member\'s weekly schedule' : 'Weekly schedule management'}
          </p>
        </div>
        {isAdmin && (
          <button onClick={generateNextWeek}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-blue-600 border border-blue-200 bg-blue-50 rounded-xl hover:bg-blue-100 transition-colors flex-shrink-0">
            ↻ Copy to Next Week
          </button>
        )}
      </div>

      {/* Week navigator */}
      <div className="flex items-center justify-between bg-white rounded-xl border border-gray-100 px-4 py-3 mb-5">
        <button onClick={() => changeWeek(-1)}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
          ←
        </button>
        <div className="text-center">
          <p className="text-sm font-semibold text-gray-900">{weekLabel(new Date(weekStart))}</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {weekStart === toDateStr(getMonday()) ? 'This week' : ''}
          </p>
        </div>
        <button onClick={() => changeWeek(1)}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
          →
        </button>
      </div>

      {/* Admin: staff selector */}
      {isAdmin && staffList.length > 0 && (
        <div className="flex gap-2 flex-wrap mb-5">
          {staffList.map(s => (
            <button key={s.id} onClick={() => setSelectedStaff(s.id)}
              className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-colors ${selectedStaff === s.id ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-blue-300'}`}>
              {s.full_name}
            </button>
          ))}
        </div>
      )}

      {/* Roster grid */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        {staffId && (
          <StaffRoster
            staffId={staffId}
            weekStart={weekStart}
            readOnly={false}
          />
        )}
      </div>

      {isAdmin && (
        <p className="text-xs text-gray-400 text-center mt-3">
          Editing {staffList.find(s => s.id === selectedStaff)?.full_name || 'staff'}'s schedule. Changes save directly to their roster.
        </p>
      )}
    </AppShell>
  )
}
