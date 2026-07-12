import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import AppShell from '../../components/layout/AppShell'

function fmtDate(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })
}

const STATUS_STYLES = {
  pending:   'bg-amber-50 text-amber-700',
  active:    'bg-emerald-50 text-emerald-700',
  suspended: 'bg-red-50 text-red-700',
}

export default function Users() {
  const [users, setUsers]     = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab]         = useState('pending')
  const [busyId, setBusyId]   = useState(null)
  const [error, setError]     = useState('')

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('hhf_profiles')
      .select('id, email, full_name, role, status, created_at')
      .eq('app', 'hhf')
      .order('created_at', { ascending: false })
    setUsers(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function setStatus(id, status) {
    setBusyId(id)
    setError('')
    const { error } = await supabase.from('hhf_profiles').update({ status }).eq('id', id)
    if (error) setError(error.message)
    else setUsers(prev => prev.map(u => u.id === id ? { ...u, status } : u))
    setBusyId(null)
  }

  const filtered = users.filter(u => tab === 'all' || u.status === tab)
  const counts = {
    pending: users.filter(u => u.status === 'pending').length,
    active: users.filter(u => u.status === 'active').length,
    suspended: users.filter(u => u.status === 'suspended').length,
  }

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <h1 className="font-serif text-2xl font-semibold text-gray-900">User Management</h1>
          <p className="text-gray-400 text-sm mt-0.5">Approve, activate, or suspend accounts</p>
        </div>

        <div className="flex gap-2 mb-5">
          {['pending', 'active', 'suspended', 'all'].map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                tab === t ? 'bg-hhf-blue text-white' : 'bg-gray-100 text-gray-600'
              }`}>
              {t[0].toUpperCase() + t.slice(1)}
              {t !== 'all' && counts[t] > 0 && <span className="ml-1.5 opacity-80">({counts[t]})</span>}
            </button>
          ))}
        </div>

        {error && <div className="mb-4 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</div>}

        {loading ? (
          <div className="text-center text-gray-400 py-16">Loading users...</div>
        ) : filtered.length === 0 ? (
          <div className="card text-center py-16 text-gray-400">No {tab === 'all' ? '' : tab} users.</div>
        ) : (
          <div className="space-y-3">
            {filtered.map(u => (
              <div key={u.id} className="card flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-gray-900 truncate">{u.full_name}</span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${STATUS_STYLES[u.status] || 'bg-gray-100 text-gray-600'}`}>
                      {u.status}
                    </span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 capitalize">
                      {u.role}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1 truncate">{u.email} · Joined {fmtDate(u.created_at)}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  {u.status !== 'active' && (
                    <button disabled={busyId === u.id} onClick={() => setStatus(u.id, 'active')}
                      className="btn-primary text-xs px-3 py-1.5 disabled:opacity-50">
                      {busyId === u.id ? '...' : 'Activate'}
                    </button>
                  )}
                  {u.status !== 'suspended' && (
                    <button disabled={busyId === u.id} onClick={() => setStatus(u.id, 'suspended')}
                      className="btn-ghost text-xs px-3 py-1.5 disabled:opacity-50">
                      {busyId === u.id ? '...' : 'Suspend'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  )
}
