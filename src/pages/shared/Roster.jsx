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
  return date.toISOString().split('T')[0]
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

// ── STAFF ROSTER VIEW ─────────────────────────────────────
function StaffRoster({ staffId, weekStart, readOnly = false }) {
  const { profile } = useAuth()
  const [slots, setSlots]   = useState({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved]   = useState(false)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('hhf_roster')
      .select('*')
      .eq('staff_id', staffId)
      .eq('week_start', weekStart)
    const map = {}
    DAYS.forEach(d => { map[d.key] = { ...DEFAULT_SLOT } })
    ;(data || []).forEach(r => { map[r.day] = { start_time: r.start_time, end_time: r.end_time, is_available: r.is_available, note: r.note || '' } })
    setSlots(map)
    setLoading(false)
  }, [staffId, weekStart])

  useEffect(() => { load() }, [load])

  function updateSlot(day, field, value) {
    setSlots(s => ({ ...s, [day]: { ...s[day], [field]: value } }))
  }

  async function save() {
    setSaving(true)
    const rows = DAYS.map(d => ({
      staff_id:     staffId,
      week_start:   weekStart,
      day:          d.key,
      start_time:   slots[d.key]?.start_time || '09:00',
      end_time:     slots[d.key]?.end_time   || '17:00',
      is_available: slots[d.key]?.is_available ?? true,
      note:         slots[d.key]?.note || null,
      created_by:   profile.id,
      updated_at:   new Date().toISOString(),
    }))
    await supabase.from('hhf_roster').upsert(rows, { onConflict: 'staff_id,week_start,day' })
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  if (loading) return <div className="py-6 text-center text-sm text-gray-400 animate-pulse">Loading roster…</div>

  return (
    <div>
      <div className="space-y-2">
        {DAYS.map(({ key, label }) => {
          const slot = slots[key] || DEFAULT_SLOT
          return (
            <div key={key} className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${slot.is_available ? 'bg-gray-50' : 'bg-white opacity-50'}`}>
              <span className="text-xs font-semibold text-gray-500 w-8 flex-shrink-0">{label}</span>
              <Toggle
                checked={slot.is_available}
                onChange={v => !readOnly && updateSlot(key, 'is_available', v)}
              />
              {slot.is_available ? (
                <div className="flex items-center gap-2 flex-1">
                  <input type="text" value={slot.start_time} disabled={readOnly}
                    onChange={e => updateSlot(key, 'start_time', e.target.value)}
                    placeholder="09:00"
                    className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white disabled:bg-gray-50" />
                  <span className="text-gray-400 text-xs">–</span>
                  <input type="text" value={slot.end_time} disabled={readOnly}
                    onChange={e => updateSlot(key, 'end_time', e.target.value)}
                    placeholder="17:00"
                    className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white disabled:bg-gray-50" />
                </div>
              ) : (
                <span className="text-xs text-gray-400 flex-1">Day off</span>
              )}
            </div>
          )
        })}
      </div>

      {!readOnly && (
        <button onClick={save} disabled={saving}
          className="mt-4 w-full py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors">
          {saved ? '✅ Saved!' : saving ? 'Saving…' : 'Save Roster'}
        </button>
      )}
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
          <p className="text-sm text-gray-500 mt-0.5">Weekly schedule management</p>
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
          Admin view is read-only. Staff manage their own slots.
        </p>
      )}
    </AppShell>
  )
}
