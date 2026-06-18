import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import AppShell from '../../components/layout/AppShell'

function fmtDate(ts) {
  if (!ts) return ''
  return new Date(ts).toLocaleDateString('en-NG', { weekday: 'short', month: 'short', day: 'numeric' })
}
function fmtTime(ts) {
  if (!ts) return ''
  return new Date(ts).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' })
}

const STATUS_STYLES = {
  pending:   'bg-amber-50 text-amber-700 border border-amber-200',
  confirmed: 'bg-green-50 text-green-700 border border-green-200',
  cancelled: 'bg-gray-100 text-gray-500 border border-gray-200',
  completed: 'bg-blue-50 text-blue-700 border border-blue-200',
}

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

export default function ClientDashboard() {
  const { profile } = useAuth()
  const [appts, setAppts]       = useState([])
  const [unread, setUnread]     = useState(0)
  const [docs, setDocs]         = useState(0)
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    if (!profile) return
    const today = new Date().toISOString()

    Promise.all([
      supabase.from('hhf_appointments')
        .select('id, scheduled_at, duration_minutes, service_type, status, staff:staff_id(full_name)')
        .eq('client_id', profile.id)
        .gte('scheduled_at', today)
        .in('status', ['pending', 'confirmed'])
        .order('scheduled_at')
        .limit(3),

      supabase.from('hhf_messages')
        .select('id', { count: 'exact' })
        .eq('recipient_id', profile.id)
        .eq('read', false),

      supabase.from('hhf_documents')
        .select('id', { count: 'exact' })
        .eq('owner_id', profile.id),
    ]).then(([apptRes, msgRes, docRes]) => {
      setAppts(apptRes.data || [])
      setUnread(msgRes.count || 0)
      setDocs(docRes.count || 0)
      setLoading(false)
    })
  }, [profile])

  const firstName = profile?.full_name?.split(' ')[0] || 'there'
  const today = new Date().toLocaleDateString('en-NG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              {greeting()}, {firstName} 👋
            </h1>
            <p className="text-sm text-gray-400 mt-0.5">{today}</p>
          </div>
          <Link
            to="/client/appointments/new"
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors flex-shrink-0"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            New Appointment
          </Link>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { label: 'Upcoming',  value: loading ? '—' : appts.length, color: 'text-blue-600',  bg: 'bg-blue-50 border-blue-100' },
            { label: 'Unread',    value: loading ? '—' : unread,       color: 'text-amber-600', bg: 'bg-amber-50 border-amber-100' },
            { label: 'Documents', value: loading ? '—' : docs,         color: 'text-green-600', bg: 'bg-green-50 border-green-100' },
          ].map(s => (
            <div key={s.label} className={`rounded-xl border p-3 ${s.bg}`}>
              <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { label: 'Appointments', icon: '📅', path: '/client/appointments' },
            { label: 'Messages',     icon: '💬', path: '/client/messages' },
            { label: 'Documents',    icon: '📄', path: '/client/documents' },
          ].map(q => (
            <Link
              key={q.path}
              to={q.path}
              className="flex flex-col items-center gap-2 p-3 bg-white rounded-xl border border-gray-100 hover:shadow-sm hover:border-blue-200 transition-all text-center"
            >
              <span className="text-2xl">{q.icon}</span>
              <span className="text-xs font-medium text-gray-600">{q.label}</span>
            </Link>
          ))}
        </div>

        {/* Upcoming appointments */}
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900 text-sm">Upcoming Appointments</h2>
            <Link to="/client/appointments" className="text-xs text-blue-600 hover:underline">View all →</Link>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1,2].map(i => (
                <div key={i} className="flex gap-3 animate-pulse">
                  <div className="w-10 h-10 rounded-lg bg-gray-100 flex-shrink-0" />
                  <div className="flex-1 space-y-2 py-1">
                    <div className="h-3 bg-gray-100 rounded w-1/3" />
                    <div className="h-3 bg-gray-100 rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : appts.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-400 text-sm mb-3">No upcoming appointments</p>
              <Link to="/client/appointments/new" className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors">
                Book Appointment
              </Link>
            </div>
          ) : (
            <div className="space-y-0">
              {appts.map((a, idx) => (
                <div key={a.id} className={`flex items-center gap-3 py-3 ${idx < appts.length - 1 ? 'border-b border-gray-50' : ''}`}>
                  <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0 text-blue-600">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{a.staff?.full_name || 'Staff'}</p>
                    <p className="text-xs text-gray-400">
                      {a.service_type || 'Consultation'} · {fmtDate(a.scheduled_at)}, {fmtTime(a.scheduled_at)}
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize flex-shrink-0 ${STATUS_STYLES[a.status] || ''}`}>
                    {a.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  )
}
