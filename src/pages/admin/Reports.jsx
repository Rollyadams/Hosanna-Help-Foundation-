import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import AppShell from '../../components/layout/AppShell'

function fmtDate(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// A case only has a real "needs attention / resolved" state if staff
// actually left a follow_up note describing an action — a report with no
// note isn't tracked as open or resolved, it's just a record with nothing
// pending.
//
// The follow-up field's label/placeholder describes WHAT action is
// needed, but staff sometimes read it as a yes/no question and type "No"
// (or "None", "N/A", "Nil") instead of leaving it blank — which then
// falsely counts as "needs attention" forever. Treating these common
// negative answers the same as empty fixes existing mislabeled reports
// without needing a database cleanup; the close-conversation form (see
// Messaging.jsx) was also updated to make blank-if-none clearer so this
// shouldn't keep happening for new reports.
const NO_ACTION_PHRASES = new Set(['no', 'none', 'n/a', 'na', 'nil', 'nothing'])
function hasFollowUp(r) {
  const text = (r.follow_up || '').trim()
  if (!text) return false
  return !NO_ACTION_PHRASES.has(text.toLowerCase())
}

async function buildPersonMap(ids) {
  if (!ids.length) return {}
  const [{ data: reg }, { data: guests }] = await Promise.all([
    supabase.from('hhf_profiles').select('id, full_name, role').in('id', ids),
    supabase.from('hhf_guest_profiles').select('id, full_name').in('id', ids)
  ])
  const map = {}
  ;(reg    || []).forEach(p => { map[p.id] = p })
  ;(guests || []).forEach(p => { map[p.id] = { ...p, role: 'visitor' } })
  return map
}

export default function Reports() {
  const { profile } = useAuth()
  const [reports, setReports]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [staffFilter, setStaffFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all') // all | needs_attention | resolved
  const [selected, setSelected] = useState(null)
  const [resolving, setResolving] = useState(false)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('hhf_conversations')
        .select('id, status, category, staff_report, follow_up, closed_at, closed_by, participant_a, participant_b, follow_up_resolved, follow_up_resolved_at, follow_up_resolved_by')
        .eq('status', 'closed')
        .order('closed_at', { ascending: false })

      if (!data) { setLoading(false); return }

      const ids = [...new Set(data.flatMap(c => [c.closed_by, c.participant_a, c.participant_b, c.follow_up_resolved_by]).filter(Boolean))]
      const people = await buildPersonMap(ids)

      const enriched = data.map(c => ({
        ...c,
        closed_by_person: people[c.closed_by] || null,
        resolved_by_person: people[c.follow_up_resolved_by] || null,
        visitor: [people[c.participant_a], people[c.participant_b]].find(p => p?.role === 'visitor') || null,
      }))

      setReports(enriched)
      setLoading(false)
    }
    load()
  }, [])

  // Toggles follow_up_resolved on the currently selected case. Kept as a
  // toggle (not a one-way action) so a case marked resolved by mistake, or
  // one where the issue resurfaced, can be reopened without editing the
  // database directly.
  async function toggleResolved(report) {
    setResolving(true)
    const nowResolved = !report.follow_up_resolved
    const patch = nowResolved
      ? { follow_up_resolved: true, follow_up_resolved_at: new Date().toISOString(), follow_up_resolved_by: profile.id }
      : { follow_up_resolved: false, follow_up_resolved_at: null, follow_up_resolved_by: null }

    const { error } = await supabase.from('hhf_conversations').update(patch).eq('id', report.id)
    if (!error) {
      const resolved_by_person = nowResolved ? { id: profile.id, full_name: profile.full_name } : null
      const updated = { ...report, ...patch, resolved_by_person }
      setReports(prev => prev.map(r => r.id === report.id ? updated : r))
      setSelected(updated)
    }
    setResolving(false)
  }

  const staffOptions = [...new Map(
    reports.filter(r => r.closed_by_person).map(r => [r.closed_by, r.closed_by_person.full_name])
  ).entries()]

  const filtered = reports.filter(r => {
    const matchesStaff = staffFilter === 'all' || r.closed_by === staffFilter
    const matchesStatus =
      statusFilter === 'all' ? true :
      statusFilter === 'needs_attention' ? (hasFollowUp(r) && !r.follow_up_resolved) :
      statusFilter === 'resolved' ? (hasFollowUp(r) && r.follow_up_resolved) : true
    const q = search.toLowerCase()
    const matchesSearch = !q ||
      (r.staff_report || '').toLowerCase().includes(q) ||
      (r.follow_up || '').toLowerCase().includes(q) ||
      (r.category || '').toLowerCase().includes(q) ||
      (r.visitor?.full_name || '').toLowerCase().includes(q)
    return matchesStaff && matchesStatus && matchesSearch
  })

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="font-serif text-2xl font-semibold text-gray-900">Case Reports</h1>
            <p className="text-gray-400 text-sm mt-0.5">Reports submitted when staff close a conversation</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-3">
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search reports, follow-ups, category..."
            className="flex-1 px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500"
          />
          <select value={staffFilter} onChange={e => setStaffFilter(e.target.value)}
            className="px-3 py-2.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-blue-500">
            <option value="all">All staff</option>
            {staffOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-5 w-fit">
          {[
            { key: 'all', label: 'All' },
            { key: 'needs_attention', label: 'Needs Attention' },
            { key: 'resolved', label: 'Resolved' },
          ].map(t => (
            <button key={t.key} onClick={() => setStatusFilter(t.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${statusFilter === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center text-gray-400 py-16">Loading reports...</div>
        ) : filtered.length === 0 ? (
          <div className="card text-center py-16 text-gray-400">No case reports found.</div>
        ) : (
          <div className="space-y-3">
            {filtered.map(r => (
              <button key={r.id} onClick={() => setSelected(r)}
                className="card w-full text-left hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {r.category && (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
                          {r.category}
                        </span>
                      )}
                      {hasFollowUp(r) && (
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${r.follow_up_resolved ? 'bg-green-50 text-green-700' : 'bg-orange-50 text-orange-700'}`}>
                          {r.follow_up_resolved ? '✓ Resolved' : '● Needs Attention'}
                        </span>
                      )}
                      <span className="text-sm font-medium text-gray-700">{r.visitor?.full_name || 'Unknown visitor'}</span>
                      <span className="text-xs text-gray-400">· Closed {fmtDate(r.closed_at)}</span>
                    </div>
                    <p className="text-sm text-gray-700 mt-2 line-clamp-2">
                      {r.staff_report || <span className="text-gray-400 italic">No report notes provided</span>}
                    </p>
                  </div>
                  <div className="text-xs text-gray-400 whitespace-nowrap text-right">
                    {r.closed_by_person?.full_name || 'Unknown staff'}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Detail modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
          onClick={e => e.target === e.currentTarget && setSelected(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto">
            <div className="p-5 border-b border-gray-100 flex items-start justify-between">
              <div>
                <h2 className="font-serif text-lg font-semibold text-gray-900">{selected.visitor?.full_name || 'Unknown Visitor'}</h2>
                <p className="text-xs text-gray-400 mt-0.5">Closed {fmtDate(selected.closed_at)} by {selected.closed_by_person?.full_name || 'Unknown'}</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 p-1">✕</button>
            </div>
            <div className="p-5 space-y-4">
              {selected.category && (
                <div>
                  <div className="text-xs font-semibold text-gray-500 mb-1">Category</div>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">{selected.category}</span>
                </div>
              )}
              <div>
                <div className="text-xs font-semibold text-gray-500 mb-1">Staff Report</div>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{selected.staff_report || '—'}</p>
              </div>
              <div>
                <div className="text-xs font-semibold text-gray-500 mb-1">Follow-up</div>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{selected.follow_up || '—'}</p>
              </div>
              {hasFollowUp(selected) && (
                <div className="pt-2 border-t border-gray-100">
                  {selected.follow_up_resolved ? (
                    <p className="text-xs text-green-700 mb-2">
                      ✓ Resolved {fmtDate(selected.follow_up_resolved_at)} by {selected.resolved_by_person?.full_name || 'Unknown'}
                    </p>
                  ) : (
                    <p className="text-xs text-orange-700 mb-2">● Still needs attention</p>
                  )}
                  <button
                    onClick={() => toggleResolved(selected)}
                    disabled={resolving}
                    className={`w-full py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 ${
                      selected.follow_up_resolved
                        ? 'border border-gray-200 text-gray-600 hover:bg-gray-50'
                        : 'bg-green-600 text-white hover:bg-green-700'
                    }`}
                  >
                    {resolving ? 'Saving…' : selected.follow_up_resolved ? 'Reopen this case' : 'Mark as resolved'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </AppShell>
  )
}
