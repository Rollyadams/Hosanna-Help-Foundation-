import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import AppShell from '../../components/layout/AppShell'

function initials(name) {
  return name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?'
}

export default function StaffClients() {
  const { profile } = useAuth()
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    if (!profile) return
    setLoading(true)

    // hhf_staff_assignments is the real source of truth for "who is this
    // staff member's client" — separate from live chat visitors, which
    // Messaging.jsx already handles on its own. This page previously
    // didn't exist at all (routed to a placeholder); the Dashboard already
    // queried this same table for its capped preview, this is the full
    // version.
    const { data: assignments } = await supabase
      .from('hhf_staff_assignments')
      .select('client:client_id(id, full_name, phone, email, status, created_at)')
      .eq('staff_id', profile.id)

    const clientList = (assignments || [])
      .map(a => a.client)
      .filter(Boolean)

    if (!clientList.length) {
      setClients([])
      setLoading(false)
      return
    }

    const clientIds = clientList.map(c => c.id)

    // Enrich with each client's most recent appointment and open
    // conversation, so this page actually tells staff something useful at
    // a glance rather than just a bare name list.
    const [{ data: appts }, { data: convos }] = await Promise.all([
      supabase
        .from('hhf_appointments')
        .select('client_id, scheduled_at, status')
        .eq('staff_id', profile.id)
        .in('client_id', clientIds)
        .order('scheduled_at', { ascending: false }),
      supabase
        .from('hhf_conversations')
        .select('id, participant_a, participant_b, status, last_message_at')
        .eq('assigned_staff_id', profile.id)
        .or(clientIds.map(id => `participant_a.eq.${id},participant_b.eq.${id}`).join(',')),
    ])

    const lastApptMap = {}
    ;(appts || []).forEach(a => {
      if (!lastApptMap[a.client_id]) lastApptMap[a.client_id] = a // already ordered desc, first hit is most recent
    })

    const openConvoMap = {}
    ;(convos || []).forEach(c => {
      const clientId = clientIds.includes(c.participant_a) ? c.participant_a : c.participant_b
      if (c.status === 'active' && !openConvoMap[clientId]) openConvoMap[clientId] = c
    })

    const enriched = clientList.map(c => ({
      ...c,
      lastAppointment: lastApptMap[c.id] || null,
      openConversation: openConvoMap[c.id] || null,
    }))

    setClients(enriched)
    setLoading(false)
  }, [profile])

  // eslint-disable-next-line react-hooks/set-state-in-effect -- standard mount-load pattern, same as Dashboard.jsx and other pages in this codebase
  useEffect(() => { load() }, [load])

  const filtered = clients.filter(c =>
    !search.trim() || c.full_name?.toLowerCase().includes(search.trim().toLowerCase())
  )

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <h1 className="font-serif text-2xl font-semibold text-gray-900">My Clients</h1>
            <p className="text-gray-400 text-sm mt-0.5">Clients formally assigned to you</p>
          </div>
        </div>

        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name…"
          className="w-full mb-5 text-sm border border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-hhf-blue"
        />

        <div className="card">
          {loading ? (
            <p className="text-sm text-gray-400 py-6 text-center">Loading…</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-gray-400 py-6 text-center">
              {clients.length === 0 ? 'No clients assigned yet.' : 'No clients match that search.'}
            </p>
          ) : (
            filtered.map(c => (
              <div key={c.id} className="flex items-center gap-3 py-3 border-b border-gray-50 last:border-0">
                <div className="w-9 h-9 rounded-full bg-hhf-blue-pale flex items-center justify-center text-hhf-blue text-xs font-bold flex-shrink-0">
                  {initials(c.full_name)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm text-gray-900 truncate">{c.full_name}</div>
                  <div className="text-xs text-gray-400 truncate">
                    {c.lastAppointment
                      ? `Last appointment: ${new Date(c.lastAppointment.scheduled_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })} · ${c.lastAppointment.status}`
                      : 'No appointments yet'}
                  </div>
                </div>
                {c.openConversation && (
                  <span className="text-[10px] font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full flex-shrink-0">
                    Active chat
                  </span>
                )}
                <Link
                  to={c.openConversation ? `/staff/messages?convo=${c.openConversation.id}` : `/staff/messages?client=${c.id}`}
                  className="text-xs font-medium text-hhf-blue hover:underline flex-shrink-0">
                  Message
                </Link>
              </div>
            ))
          )}
        </div>
      </div>
    </AppShell>
  )
}
