import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import AppShell from '../../components/layout/AppShell'

export default function ClientDashboard() {
  const { profile } = useAuth()
  const [appts, setAppts]   = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile) return
    supabase.from('hhf_appointments')
      .select('*, staff:staff_id(full_name)')
      .eq('client_id', profile.id)
      .gte('starts_at', new Date().toISOString())
      .order('starts_at').limit(3)
      .then(({ data }) => { setAppts(data || []); setLoading(false) })
  }, [profile])

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="font-serif text-2xl font-semibold text-gray-900">
            Welcome, {profile?.full_name?.split(' ')[0]} 👋
          </h1>
          <p className="text-gray-400 text-sm mt-0.5">Your personal dashboard</p>
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
          {[
            { label: 'Book Appointment', icon: '📅', path: '/client/appointments/new', color: 'bg-hhf-blue-pale text-hhf-blue' },
            { label: 'Send Message',     icon: '💬', path: '/client/messages',          color: 'bg-hhf-green-pale text-hhf-green' },
            { label: 'My Documents',     icon: '📄', path: '/client/documents',          color: 'bg-amber-50 text-amber-600' },
          ].map(q => (
            <Link key={q.path} to={q.path} className={`card flex items-center gap-3 hover:shadow-md transition-shadow ${q.color}`}>
              <span className="text-2xl">{q.icon}</span>
              <span className="font-semibold text-sm">{q.label}</span>
            </Link>
          ))}
        </div>

        {/* Upcoming appointments */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Upcoming Appointments</h2>
            <Link to="/client/appointments" className="text-sm text-hhf-blue hover:underline">View all →</Link>
          </div>
          {loading ? <p className="text-sm text-gray-400">Loading...</p> :
           appts.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-400 text-sm mb-3">No upcoming appointments</p>
              <Link to="/client/appointments/new" className="btn-primary text-sm">Book Appointment</Link>
            </div>
          ) : appts.map(a => (
            <div key={a.id} className="flex items-center gap-3 py-3 border-b border-gray-50 last:border-0">
              <div className="w-10 h-10 rounded-lg bg-hhf-blue-pale flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-hhf-blue" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm">{a.staff?.full_name}</div>
                <div className="text-xs text-gray-400 capitalize">{a.type.replace('_',' ')} · {new Date(a.starts_at).toLocaleDateString('en-NG',{weekday:'short',month:'short',day:'numeric'})}</div>
              </div>
              <span className={`badge-${a.status}`}>{a.status}</span>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  )
}