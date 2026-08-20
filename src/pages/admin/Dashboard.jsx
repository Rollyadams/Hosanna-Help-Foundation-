import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import AppShell from '../../components/layout/AppShell'
import { localDateStr } from '../../lib/date'

export default function AdminDashboard() {
  const { profile } = useAuth()
  const [stats, setStats] = useState({ clients: 0, todayAppts: 0, todayPending: 0, pendingAppts: 0, openCases: 0 })
  const [recentAppts, setRecentAppts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const today = localDateStr()
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      const tomorrowStr = localDateStr(tomorrow)

      // Previously these three counts were all derived by filtering inside
      // a SINGLE query that fetched only 5 upcoming appointments (meant for
      // the preview table below, not for counting). That silently
      // undercounted "Today's Appointments" and "Pending Approval" the
      // moment there were more than 5 appointments on the books total, and
      // "Open Cases" was never wired up at all — just hardcoded to 0.
      //
      // Now: four independent exact counts (head: true — no rows actually
      // transferred, just the count) plus one small separate fetch for the
      // preview list. "Open Cases" = closed conversations where staff left
      // a follow_up note when closing — the closest real definition that
      // exists in the data today. There's no separate "resolved" flag on a
      // follow_up yet, so this counts every case ever flagged, not just
      // ones still outstanding — worth knowing if this number looks higher
      // than expected.
      const [
        { count: clients },
        { count: todayApptsCount },
        { count: todayPendingCount },
        { count: pendingApptsCount },
        { count: openCasesCount },
        { data: recentList },
      ] = await Promise.all([
        supabase.from('hhf_profiles').select('*', { count: 'exact', head: true })
          .eq('role', 'client').eq('status', 'active'),
        supabase.from('hhf_appointments').select('*', { count: 'exact', head: true })
          .gte('scheduled_at', today).lt('scheduled_at', tomorrowStr),
        // Scoped specifically to today, for the "Today's Appointments" card
        // subtitle — distinct from pendingApptsCount below, which is the
        // all-time total shown on the separate "Pending Approval" card.
        // Reusing the same number for both would now be misleading, since
        // pendingApptsCount is no longer accidentally scoped to a 5-row
        // preview batch that happened to only contain near-term dates.
        supabase.from('hhf_appointments').select('*', { count: 'exact', head: true })
          .gte('scheduled_at', today).lt('scheduled_at', tomorrowStr).eq('status', 'pending'),
        supabase.from('hhf_appointments').select('*', { count: 'exact', head: true })
          .eq('status', 'pending'),
        supabase.from('hhf_conversations').select('*', { count: 'exact', head: true })
          .eq('status', 'closed').not('follow_up', 'is', null).neq('follow_up', ''),
        supabase.from('hhf_appointments')
          .select('*, client:client_id(full_name), staff:staff_id(full_name)')
          .gte('scheduled_at', today).lt('scheduled_at', tomorrowStr)
          .order('scheduled_at').limit(5),
      ])

      setStats({
        clients: clients || 0,
        todayAppts: todayApptsCount || 0,
        todayPending: todayPendingCount || 0,
        pendingAppts: pendingApptsCount || 0,
        openCases: openCasesCount || 0,
      })
      setRecentAppts(recentList || [])
      setLoading(false)
    }
    load()
  }, [])

  const firstName = profile?.full_name?.split(' ')[0] || 'Admin'
  const today = new Date().toLocaleDateString('en-NG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="font-serif text-2xl font-semibold text-gray-900">Good morning, {firstName} 👋</h1>
            <p className="text-gray-400 text-sm mt-0.5">{today}</p>
          </div>
          <Link to="/admin/appointments" className="btn-primary flex items-center gap-1.5">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            New Appointment
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Total Clients',        value: stats.clients,      color: 'hhf-blue',  sub: 'Active clients' },
            { label: "Today's Appointments", value: stats.todayAppts, color: "hhf-gold", sub: stats.todayPending + " pending" },
            { label: 'Pending Approval',      value: stats.pendingAppts, color: 'hhf-green', sub: 'Appointments' },
            { label: 'Open Cases',            value: stats.openCases,    color: 'hhf-red',   sub: 'Require action' },
          ].map(s => (
            <div key={s.label} className="card border-t-4" style={{ borderTopColor: `var(--tw-${s.color}, #1a5fa8)` }}>
              <div className="text-xs text-gray-400 font-medium mb-1">{s.label}</div>
              <div className="font-serif text-3xl font-semibold text-gray-900">{loading ? '—' : s.value}</div>
              <div className="text-xs text-gray-400 mt-0.5">{s.sub}</div>
            </div>
          ))}
        </div>

        {/* Recent appointments */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Today's Appointments</h2>
            <Link to="/admin/appointments" className="text-sm text-hhf-blue hover:underline">View all →</Link>
          </div>
          {loading ? (
            <div className="text-center py-8 text-gray-400 text-sm">Loading...</div>
          ) : recentAppts.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">No appointments today</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    {['Client','Staff','Time','Type','Status'].map(h => (
                      <th key={h} className="text-left pb-3 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recentAppts.map(a => (
                    <tr key={a.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                      <td className="py-3 px-3 font-medium">{a.client?.full_name}</td>
                      <td className="py-3 px-3 text-gray-500">{a.staff?.full_name}</td>
                      <td className="py-3 px-3 text-gray-500">{new Date(a.scheduled_at).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' })}</td>
                      <td className="py-3 px-3 text-gray-500 capitalize">{(a.service_type || 'General').replace('_', ' ')}</td>
                      <td className="py-3 px-3">
                        <span className={`badge-${a.status === 'confirmed' ? 'confirmed' : a.status === 'pending' ? 'pending' : 'cancelled'}`}>
                          {a.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  )
}