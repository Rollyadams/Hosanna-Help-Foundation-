import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import AppShell from '../../components/layout/AppShell'

// ── HELPERS ────────────────────────────────────────────────
function fmtDateTime(ts) {
  if (!ts) return ''
  return new Date(ts).toLocaleString('en-NG', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}
function timeAgo(ts) {
  if (!ts) return ''
  const diff = Date.now() - new Date(ts).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

const ACTION_CONFIG = {
  // Appointments
  appointment_created:   { label: 'Appointment booked',    color: 'bg-blue-50 text-blue-700',   dot: 'bg-blue-500',   icon: '📅' },
  appointment_confirmd:  { label: 'Appointment confirmed', color: 'bg-green-50 text-green-700', dot: 'bg-green-500',  icon: '✅' },
  appointment_cancelled: { label: 'Appointment cancelled', color: 'bg-gray-100 text-gray-600',  dot: 'bg-gray-400',   icon: '❌' },
  appointment_completed: { label: 'Appointment completed', color: 'bg-teal-50 text-teal-700',   dot: 'bg-teal-500',   icon: '🏁' },
  appointment_no_showed: { label: 'No show recorded',      color: 'bg-red-50 text-red-600',     dot: 'bg-red-500',    icon: '🚫' },
  // Messages
  message_sent:          { label: 'Message sent',          color: 'bg-purple-50 text-purple-700', dot: 'bg-purple-500', icon: '💬' },
  // Users
  user_updated:          { label: 'User updated',          color: 'bg-amber-50 text-amber-700', dot: 'bg-amber-500',  icon: '👤' },
  user_activated:        { label: 'User activated',        color: 'bg-green-50 text-green-700', dot: 'bg-green-500',  icon: '✅' },
  user_deactivated:      { label: 'User deactivated',      color: 'bg-gray-100 text-gray-600',  dot: 'bg-gray-400',   icon: '🔒' },
  // Documents
  document_uploaded:     { label: 'Document uploaded',     color: 'bg-indigo-50 text-indigo-700', dot: 'bg-indigo-500', icon: '📄' },
  document_deleted:      { label: 'Document deleted',      color: 'bg-red-50 text-red-600',     dot: 'bg-red-400',    icon: '🗑️' },
  // Auth
  login:                 { label: 'User logged in',        color: 'bg-gray-50 text-gray-600',   dot: 'bg-gray-400',   icon: '🔑' },
  logout:                { label: 'User logged out',       color: 'bg-gray-50 text-gray-600',   dot: 'bg-gray-300',   icon: '👋' },
}

function getConfig(action = '') {
  if (ACTION_CONFIG[action]) return ACTION_CONFIG[action]
  // Fuzzy match
  const key = Object.keys(ACTION_CONFIG).find(k => action.includes(k.split('_')[0]))
  return key ? ACTION_CONFIG[key] : { label: action.replace(/_/g, ' '), color: 'bg-gray-50 text-gray-600', dot: 'bg-gray-400', icon: '📋' }
}

// ── ICONS ──────────────────────────────────────────────────
const Icon = {
  Search:  () => <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  Refresh: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>,
  X:       () => <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  Alert:   () => <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  ChevronD:() => <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>,
}

// ── LOG ITEM ───────────────────────────────────────────────
function LogItem({ log }) {
  const [expanded, setExpanded] = useState(false)
  const cfg = getConfig(log.action)
  const hasDetails = log.details && Object.keys(log.details).length > 0

  return (
    <div className="bg-white rounded-xl border border-gray-100 px-4 py-3 hover:shadow-sm transition-shadow">
      <div className="flex items-start gap-3">
        {/* Dot */}
        <div className="flex flex-col items-center flex-shrink-0 pt-1">
          <div className={`w-2.5 h-2.5 rounded-full ${cfg.dot}`} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-base leading-none">{cfg.icon}</span>
                <span className="text-sm font-medium text-gray-900">{cfg.label}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.color}`}>
                  {log.action}
                </span>
              </div>
              {log.actor_name && (
                <p className="text-xs text-gray-500 mt-1">by <span className="font-medium">{log.actor_name}</span></p>
              )}
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-xs text-gray-400">{timeAgo(log.created_at)}</p>
              <p className="text-xs text-gray-300 mt-0.5 hidden sm:block">{fmtDateTime(log.created_at)}</p>
            </div>
          </div>

          {/* Details toggle */}
          {hasDetails && (
            <button
              onClick={() => setExpanded(e => !e)}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 mt-1.5 transition-colors"
            >
              <span className={`transition-transform ${expanded ? 'rotate-180' : ''}`}><Icon.ChevronD /></span>
              {expanded ? 'Hide' : 'Details'}
            </button>
          )}

          {expanded && hasDetails && (
            <pre className="mt-2 text-xs bg-gray-50 rounded-lg p-3 overflow-x-auto text-gray-600 border border-gray-100 whitespace-pre-wrap break-all">
              {JSON.stringify(log.details, null, 2)}
            </pre>
          )}
        </div>
      </div>
    </div>
  )
}

// ── MAIN ───────────────────────────────────────────────────
const PAGE_SIZE = 25

export default function AuditLog() {
  const { profile } = useAuth()

  const [logs, setLogs]         = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')
  const [search, setSearch]     = useState('')
  const [actionFilter, setActionFilter] = useState('all')
  const [page, setPage]         = useState(0)
  const [total, setTotal]       = useState(0)

  const ACTION_GROUPS = ['all', 'appointment', 'message', 'user', 'document', 'login']

  const load = useCallback(async () => {
    setLoading(true); setError('')

    let q = supabase
      .from('hhf_audit_logs')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

    if (actionFilter !== 'all') q = q.ilike('action', `${actionFilter}%`)
    if (search) q = q.or(`action.ilike.%${search}%,actor_id.eq.${search.length === 36 ? search : '00000000-0000-0000-0000-000000000000'}`)

    const { data, error: err, count } = await q
    if (err) { setError(err.message); setLoading(false); return }

    // Enrich actor names
    const actorIds = [...new Set((data||[]).map(l => l.actor_id).filter(Boolean))]
    let nameMap = {}
    if (actorIds.length) {
      const { data: profiles } = await supabase.from('hhf_profiles').select('id, full_name').in('id', actorIds)
      ;(profiles||[]).forEach(p => { nameMap[p.id] = p.full_name })
    }

    setLogs((data||[]).map(l => ({ ...l, actor_name: nameMap[l.actor_id] })))
    setTotal(count || 0)
    setLoading(false)
  }, [page, actionFilter, search])

  useEffect(() => { load() }, [load])
  // Reset page when filters change
  useEffect(() => { setPage(0) }, [actionFilter, search])

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <AppShell>
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Audit Log</h1>
          <p className="text-sm text-gray-500 mt-0.5">Complete record of all platform activity</p>
        </div>
        <button onClick={load}
          className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
          <Icon.Refresh />
        </button>
      </div>

      {/* Stats */}
      <div className="bg-white rounded-xl border border-gray-100 px-4 py-3 mb-5 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 flex-shrink-0">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-900">{loading ? '…' : total.toLocaleString()} total events</p>
          <p className="text-xs text-gray-400">All activity on HHF Connect</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><Icon.Search /></span>
          <input type="text" placeholder="Search actions…"
            className="w-full text-sm border border-gray-200 rounded-xl pl-9 pr-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 flex-shrink-0 flex-wrap">
          {ACTION_GROUPS.map(g => (
            <button key={g} onClick={() => setActionFilter(g)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${actionFilter === g ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              {g}
            </button>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4">
          <Icon.Alert />{error}
          <button onClick={() => setError('')} className="ml-auto"><Icon.X /></button>
        </div>
      )}

      {/* Log list */}
      {loading ? (
        <div className="flex flex-col gap-2">
          {[1,2,3,4,5].map(i => (
            <div key={i} className="bg-white rounded-xl border border-gray-100 px-4 py-3 animate-pulse">
              <div className="flex gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-gray-100 mt-1 flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-gray-100 rounded w-1/3" />
                  <div className="h-3 bg-gray-100 rounded w-1/4" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : logs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="text-5xl mb-4">📋</div>
          <p className="text-gray-900 font-medium">No activity yet</p>
          <p className="text-sm text-gray-400 mt-1">Events will appear here as users interact with the platform.</p>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-2">
            {logs.map(log => <LogItem key={log.id} log={log} />)}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
              <p className="text-xs text-gray-400">
                Page {page + 1} of {totalPages} · {total} events
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  ← Prev
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </AppShell>
  )
}
