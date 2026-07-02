import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import AppShell from '../../components/layout/AppShell'

function timeLeft(expiresAt) {
  const diff = new Date(expiresAt) - new Date()
  if (diff <= 0) return 'Expired'
  const h = Math.floor(diff / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  return h > 0 ? `${h}h ${m}m left` : `${m}m left`
}

export default function StaffInvites() {
  const { profile }       = useAuth()
  const [invites, setInvites] = useState([])
  const [loading, setLoading] = useState(true)
  const [email, setEmail]     = useState('')
  const [creating, setCreating] = useState(false)
  const [copied, setCopied]   = useState(null)
  const [error, setError]     = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('hhf_staff_invites')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20)
    setInvites(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function createInvite() {
    setCreating(true); setError('')
    const { data, error: err } = await supabase
      .from('hhf_staff_invites')
      .insert({ email: email.trim() || null, created_by: profile.id })
      .select().single()

    if (err) { setError(err.message); setCreating(false); return }
    setInvites(prev => [data, ...prev])
    setEmail('')
    setCreating(false)
  }

  function inviteUrl(token) {
    return `${window.location.origin}/staff-apply?token=${token}`
  }

  async function copyLink(token) {
    await navigator.clipboard.writeText(inviteUrl(token))
    setCopied(token)
    setTimeout(() => setCopied(null), 2500)
  }

  async function revokeInvite(id) {
    await supabase.from('hhf_staff_invites').delete().eq('id', id)
    setInvites(prev => prev.filter(i => i.id !== id))
  }

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Staff Invite Links</h1>
        <p className="text-sm text-gray-500 mt-0.5">Generate single-use links for staff applications</p>
      </div>

      {/* Generate */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-5">
        <p className="text-sm font-semibold text-gray-900 mb-3">Generate New Invite</p>
        <div className="flex gap-2">
          <input
            type="email"
            placeholder="Pre-fill email (optional)"
            className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={email}
            onChange={e => setEmail(e.target.value)}
          />
          <button
            onClick={createInvite}
            disabled={creating}
            className="px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 disabled:opacity-50 flex-shrink-0"
          >
            {creating ? '…' : '+ Generate'}
          </button>
        </div>
        {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
        <p className="text-xs text-gray-400 mt-2">Each link is single-use and expires after 48 hours.</p>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      ) : invites.length === 0 ? (
        <div className="text-center py-12 text-gray-400 text-sm">No invites generated yet.</div>
      ) : (
        <div className="flex flex-col gap-3">
          {invites.map(inv => {
            const expired = new Date(inv.expires_at) < new Date()
            return (
              <div key={inv.id} className={`bg-white rounded-xl border p-4 ${inv.used ? 'border-green-100 bg-green-50' : expired ? 'border-gray-100 opacity-60' : 'border-gray-100'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        inv.used ? 'bg-green-100 text-green-700' :
                        expired  ? 'bg-gray-100 text-gray-500' :
                                   'bg-blue-50 text-blue-600'
                      }`}>
                        {inv.used ? 'Used' : expired ? 'Expired' : 'Active'}
                      </span>
                      {inv.email && <span className="text-xs text-gray-500">{inv.email}</span>}
                      {!inv.used && !expired && (
                        <span className="text-xs text-amber-600">{timeLeft(inv.expires_at)}</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-1 font-mono truncate max-w-xs">
                      …/staff-apply?token={inv.token.slice(0, 16)}…
                    </p>
                  </div>

                  <div className="flex gap-1.5 flex-shrink-0">
                    {!inv.used && !expired && (
                      <button
                        onClick={() => copyLink(inv.token)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                          copied === inv.token
                            ? 'bg-green-100 text-green-700'
                            : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                        }`}
                      >
                        {copied === inv.token ? '✓ Copied' : 'Copy Link'}
                      </button>
                    )}
                    {!inv.used && (
                      <button
                        onClick={() => revokeInvite(inv.id)}
                        className="px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-100 text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors"
                      >
                        Revoke
                      </button>
                    )}
                  </div>
                </div>
                {inv.used && inv.used_at && (
                  <p className="text-xs text-green-600 mt-1">
                    Application submitted {new Date(inv.used_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </AppShell>
  )
}