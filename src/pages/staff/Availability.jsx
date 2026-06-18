import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import AppShell from '../../components/layout/AppShell'

// ── CONSTANTS ──────────────────────────────────────────────
const DAYS = [
  { key: 'mon', label: 'Monday' },
  { key: 'tue', label: 'Tuesday' },
  { key: 'wed', label: 'Wednesday' },
  { key: 'thu', label: 'Thursday' },
  { key: 'fri', label: 'Friday' },
  { key: 'sat', label: 'Saturday' },
  { key: 'sun', label: 'Sunday' },
]

const DEFAULT_HOURS = {
  mon: { enabled: true,  start: '09:00', end: '17:00' },
  tue: { enabled: true,  start: '09:00', end: '17:00' },
  wed: { enabled: true,  start: '09:00', end: '17:00' },
  thu: { enabled: true,  start: '09:00', end: '17:00' },
  fri: { enabled: true,  start: '09:00', end: '17:00' },
  sat: { enabled: false, start: '09:00', end: '13:00' },
  sun: { enabled: false, start: '09:00', end: '13:00' },
}

function toLocalDate(dateStr) {
  // dateStr: 'YYYY-MM-DD'
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-NG', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
  })
}

function todayStr() {
  return new Date().toISOString().split('T')[0]
}

// ── ICONS ──────────────────────────────────────────────────
const Icon = {
  Save:    () => <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>,
  Plus:    () => <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  Trash:   () => <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>,
  Check:   () => <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>,
  Alert:   () => <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  Clock:   () => <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  Moon:    () => <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>,
  X:       () => <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
}

// ── TOGGLE ─────────────────────────────────────────────────
function Toggle({ checked, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${checked ? 'bg-blue-600' : 'bg-gray-200'}`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  )
}

// ── SECTION CARD ───────────────────────────────────────────
function SectionCard({ title, subtitle, icon, children }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-50 flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 flex-shrink-0">
          {icon}
        </div>
        <div>
          <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
          {subtitle && <p className="text-xs text-gray-400">{subtitle}</p>}
        </div>
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

// ── MAIN ───────────────────────────────────────────────────
export default function Availability() {
  const { profile } = useAuth()

  const [hours, setHours]           = useState(DEFAULT_HOURS)
  const [awayMessage, setAwayMessage] = useState('')
  const [isAway, setIsAway]         = useState(false)
  const [awayUntil, setAwayUntil]   = useState('')
  const [blockedDates, setBlockedDates] = useState([]) // [{ date, reason }]
  const [newBlock, setNewBlock]     = useState({ date: '', reason: '' })

  const [saving, setSaving]   = useState(false)
  const [saved, setSaved]     = useState(false)
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(true)

  // ── LOAD ────────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!profile) return
    setLoading(true)
    const { data } = await supabase
      .from('hhf_availability')
      .select('*')
      .eq('staff_id', profile.id)
      .single()

    if (data) {
      if (data.working_hours) setHours({ ...DEFAULT_HOURS, ...data.working_hours })
      setIsAway(data.is_away || false)
      setAwayMessage(data.away_message || '')
      setAwayUntil(data.away_until ? data.away_until.split('T')[0] : '')
      setBlockedDates(data.blocked_dates || [])
    }
    setLoading(false)
  }, [profile])

  useEffect(() => { load() }, [load])

  // ── SAVE ─────────────────────────────────────────────────
  async function save() {
    setSaving(true); setError(''); setSaved(false)
    const payload = {
      staff_id:      profile.id,
      working_hours: hours,
      is_away:       isAway,
      away_message:  awayMessage || null,
      away_until:    awayUntil ? new Date(awayUntil).toISOString() : null,
      blocked_dates: blockedDates,
      updated_at:    new Date().toISOString(),
    }
    const { error: err } = await supabase
      .from('hhf_availability')
      .upsert(payload, { onConflict: 'staff_id' })

    if (err) { setError(err.message); setSaving(false); return }

    // Audit
    await supabase.from('hhf_audit_logs').insert({
      actor_id: profile.id, action: 'availability_updated',
      target_type: 'availability', details: { is_away: isAway }
    }).catch(() => {})

    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  function setDayField(day, field, value) {
    setHours(h => ({ ...h, [day]: { ...h[day], [field]: value } }))
  }

  function addBlockedDate() {
    if (!newBlock.date) return
    if (blockedDates.find(b => b.date === newBlock.date)) return
    setBlockedDates(prev => [...prev, { date: newBlock.date, reason: newBlock.reason || 'Unavailable' }]
      .sort((a, b) => a.date.localeCompare(b.date)))
    setNewBlock({ date: '', reason: '' })
  }

  function removeBlockedDate(date) {
    setBlockedDates(prev => prev.filter(b => b.date !== date))
  }

  const activeCount = DAYS.filter(d => hours[d.key]?.enabled).length

  return (
    <AppShell>
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">My Availability</h1>
          <p className="text-sm text-gray-500 mt-0.5">Set your working hours and away status</p>
        </div>
        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors flex-shrink-0"
        >
          {saved ? <><Icon.Check /> Saved!</> : saving ? 'Saving…' : <><Icon.Save /> Save</>}
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4">
          <Icon.Alert />{error}
        </div>
      )}

      {saved && (
        <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-xl px-4 py-3 mb-4">
          <Icon.Check /> Availability saved successfully.
        </div>
      )}

      <div className="flex flex-col gap-5">

        {/* Away status */}
        <SectionCard title="Away Status" subtitle="Let clients know when you're unavailable" icon={<Icon.Moon />}>
          <div className="flex items-center justify-between gap-4 mb-4">
            <div>
              <p className="text-sm font-medium text-gray-900">Mark as Away</p>
              <p className="text-xs text-gray-400 mt-0.5">Clients will see your away message when booking</p>
            </div>
            <Toggle checked={isAway} onChange={setIsAway} />
          </div>

          {isAway && (
            <div className="space-y-3 pt-3 border-t border-gray-50">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Away message</label>
                <textarea
                  rows={2}
                  placeholder="e.g. I'm on leave until 1 July. For urgent matters, contact the main office."
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  value={awayMessage}
                  onChange={e => setAwayMessage(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Away until (optional)</label>
                <input
                  type="date"
                  min={todayStr()}
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={awayUntil}
                  onChange={e => setAwayUntil(e.target.value)}
                />
              </div>
            </div>
          )}
        </SectionCard>

        {/* Working hours */}
        <SectionCard
          title="Working Hours"
          subtitle={`${activeCount} of 7 days active`}
          icon={<Icon.Clock />}
        >
          {loading ? (
            <div className="space-y-3">
              {[1,2,3,4,5].map(i => <div key={i} className="h-12 bg-gray-50 rounded-xl animate-pulse" />)}
            </div>
          ) : (
            <div className="space-y-2">
              {DAYS.map(({ key, label }) => {
                const day = hours[key]
                return (
                  <div key={key} className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${day.enabled ? 'bg-gray-50' : 'opacity-50'}`}>
                    <Toggle checked={day.enabled} onChange={v => setDayField(key, 'enabled', v)} />
                    <span className="text-sm font-medium text-gray-700 w-20 flex-shrink-0">{label}</span>
                    {day.enabled ? (
                      <div className="flex items-center gap-2 flex-1">
                        <input
                          type="time"
                          className="flex-1 text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                          value={day.start}
                          onChange={e => setDayField(key, 'start', e.target.value)}
                        />
                        <span className="text-gray-400 text-xs">to</span>
                        <input
                          type="time"
                          className="flex-1 text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                          value={day.end}
                          onChange={e => setDayField(key, 'end', e.target.value)}
                        />
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400 ml-2">Day off</span>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </SectionCard>

        {/* Blocked dates */}
        <SectionCard
          title="Blocked Dates"
          subtitle="Specific dates you're unavailable (holidays, leave, etc.)"
          icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="9" y1="16" x2="15" y2="16"/></svg>}
        >
          {/* Add date */}
          <div className="flex gap-2 mb-4">
            <input
              type="date"
              min={todayStr()}
              className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={newBlock.date}
              onChange={e => setNewBlock(b => ({ ...b, date: e.target.value }))}
            />
            <input
              type="text"
              placeholder="Reason (optional)"
              className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={newBlock.reason}
              onChange={e => setNewBlock(b => ({ ...b, reason: e.target.value }))}
            />
            <button
              onClick={addBlockedDate}
              disabled={!newBlock.date}
              className="px-3 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-40 transition-colors flex-shrink-0"
            >
              <Icon.Plus />
            </button>
          </div>

          {/* List */}
          {blockedDates.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">No blocked dates added</p>
          ) : (
            <div className="space-y-2">
              {blockedDates
                .filter(b => b.date >= todayStr())
                .map(b => (
                  <div key={b.date} className="flex items-center justify-between gap-3 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{toLocalDate(b.date)}</p>
                      {b.reason && <p className="text-xs text-gray-500">{b.reason}</p>}
                    </div>
                    <button onClick={() => removeBlockedDate(b.date)}
                      className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-100 rounded-lg transition-colors">
                      <Icon.X />
                    </button>
                  </div>
                ))}
            </div>
          )}
        </SectionCard>

      </div>

      {/* Bottom save button (convenient on mobile) */}
      <div className="mt-6 pb-4">
        <button
          onClick={save}
          disabled={saving}
          className="w-full py-3 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {saved ? '✅ Saved!' : saving ? 'Saving…' : 'Save Availability'}
        </button>
      </div>
    </AppShell>
  )
}
