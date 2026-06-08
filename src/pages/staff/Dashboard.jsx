import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import AppShell from '../../components/layout/AppShell'

export default function StaffDashboard() {
  const { profile } = useAuth()
  const [appts, setAppts]     = useState([])
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile) return
    async function load() {
      const today = new Date().toISOString().split('T')[0]
      const [{ data: a }, { data: c }] = await Promise.all([
        supabase.from('hhf_appointments').select('*, client:client_id(full_name)')
          .eq('staff_id', profile.id).gte('starts_at', today).order('starts_at').limit(5),
        supabase.from('hhf_staff_assignments').select('client:client_id(id, full_name, status)')
          .eq('staff_id', profile.id).limit(5),
      ])
      setAppts(a || []); setClients(c || []); setLoading(false)
    }
    load()
  }, [profile])

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="font-serif text-2xl font-semibold text-gray-900">
            Welcome, {profile?.full_name?.split(' ')[0]} 👋
          </h1>
          <p className="text-gray-400 text-sm mt-0.5">Here's your schedule for today</p>
        </div>

        <div className="grid md:grid-cols-2 gap-5">
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900">Today's Appointments</h2>
              <Link to="/staff/appointments" className="text-sm text-hhf-blue hover:underline">View all →</Link>
            </div>
            {loading ? <p className="text-sm text-gray-400">Loading...</p> :
             appts.length === 0 ? <p className="text-sm text-gray-400 py-4 text-center">No appointments today</p> :
             appts.map(a => (
              <div key={a.id} className="flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0">
                <div className="w-2 h-2 rounded-full bg-hhf-blue flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">{a.client?.full_name}</div>
                  <div className="text-xs text-gray-400 capitalize">{a.type.replace('_',' ')}</div>
                </div>
                <div className="text-xs text-gray-500">{new Date(a.starts_at).toLocaleTimeString('en-NG',{hour:'2-digit',minute:'2-digit'})}</div>
                <span className={`badge-${a.status}`}>{a.status}</span>
              </div>
            ))}
          </div>

          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900">My Clients</h2>
              <Link to="/staff/clients" className="text-sm text-hhf-blue hover:underline">View all →</Link>
            </div>
            {loading ? <p className="text-sm text-gray-400">Loading...</p> :
             clients.length === 0 ? <p className="text-sm text-gray-400 py-4 text-center">No clients assigned yet</p> :
             clients.map(c => (
              <div key={c.client?.id} className="flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0">
                <div className="w-8 h-8 rounded-full bg-hhf-blue-pale flex items-center justify-center text-hhf-blue text-xs font-bold">
                  {c.client?.full_name?.split(' ').map(n=>n[0]).join('').slice(0,2)}
                </div>
                <div className="flex-1">
                  <div className="font-medium text-sm">{c.client?.full_name}</div>
                </div>
                <Link to={`/staff/messages?client=${c.client?.id}`} className="text-xs text-hhf-blue hover:underline">Message</Link>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  )
}