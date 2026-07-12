import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import AppShell from '../../components/layout/AppShell'

function fmtDate(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
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
  const [reports, setReports]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [staffFilter, setStaffFilter] = useState('all')
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('hhf_conversations')
        .select('id, status, category, staff_report, follow_up, closed_at, closed_by, participant_a, participant_b')
        .eq('status', 'closed')
        .order('closed_at', { ascending: false })

      if (!data) { setLoading(false); return }

      const ids = [...new Set(data.flatMap(c => [c.closed_by, c.participant_a, c.participant_b]).filter(Boolean))]
      const people = await buildPersonMap(ids)

      const enriched = data.map(c => ({
        ...c,
        closed_by_person: people[c.closed_by] || null,
        visitor: [people[c.participant_a], people[c.participant_b]].find(p => p?.role === 'visitor') || null,
      }))

      setReports(enriched)
      setLoading(false)
    }
    load()
  }, [])

  const staffOptions = [...new Map(
    reports.filter(r => r.closed_by_person).map(r => [r.closed_by, r.closed_by_person.full_name])
  ).entries()]

  const filtered = reports.filter(r => {
    const matchesStaff = staffFilter === 'all' || r.closed_by === staffFilter
    const q = search.toLowerCase()
    const matchesSearch = !q ||
      (r.staff_report || '').toLowerCase().includes(q) ||
      (r.follow_up || '').toLowerCase().includes(q) ||
      (r.category || '').toLowerCase().includes(q) ||
      (r.visitor?.full_name || '').toLowerCase().includes(q)
    return matchesStaff && matchesSearch
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
        <div className="flex flex-col sm:flex-row gap-3 mb-5">
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
            </div>
          </div>
        </div>
      )}
    </AppShell>
  )
}
