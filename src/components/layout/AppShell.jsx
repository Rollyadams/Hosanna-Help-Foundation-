import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import HHFLogo from '../ui/HHFLogo'

const navItems = {
  admin: [
    { label: 'Dashboard',    icon: 'grid',     path: '/admin' },
    { label: 'Users',        icon: 'users',    path: '/admin/users' },
    { label: 'Appointments', icon: 'calendar', path: '/admin/appointments' },
    { label: 'Messages',     icon: 'message',  path: '/admin/messages' },
    { label: 'Documents',    icon: 'file',     path: '/admin/documents' },
    { label: 'Reports',      icon: 'chart',    path: '/admin/reports' },
    { label: 'Audit Log',    icon: 'log',      path: '/admin/audit' },
    { label: 'Staff Invites', icon: 'users',   path: '/admin/staff-invites' },
    { label: 'Roster',       icon: 'clock',    path: '/admin/roster' },
    { label: 'Settings',     icon: 'settings', path: '/admin/settings' },
  ],
  staff: [
    { label: 'Dashboard',    icon: 'grid',     path: '/staff' },
    { label: 'My Clients',   icon: 'users',    path: '/staff/clients' },
    { label: 'Appointments', icon: 'calendar', path: '/staff/appointments' },
    { label: 'Messages',     icon: 'message',  path: '/staff/messages' },
    { label: 'Documents',    icon: 'file',     path: '/staff/documents' },
    { label: 'Availability', icon: 'clock',    path: '/staff/availability' },
  ],
  client: [
    { label: 'Dashboard',    icon: 'grid',     path: '/client' },
    { label: 'Appointments', icon: 'calendar', path: '/client/appointments' },
    { label: 'Messages',     icon: 'message',  path: '/client/messages' },
    { label: 'Documents',    icon: 'file',     path: '/client/documents' },
  ],
}

const icons = {
  grid:     <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
  users:    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>,
  calendar: <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  message:  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>,
  file:     <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
  chart:    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  log:      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>,
  settings: <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>,
  clock:    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
}

export default function AppShell({ children }) {
  const { profile, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const items = navItems[profile?.role] || []
  const initials = profile?.full_name?.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase() || '??'

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-56 bg-white border-r border-gray-100 flex flex-col transform transition-transform md:relative md:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        {/* Logo */}
        <div className="p-4 border-b border-gray-100">
          <HHFLogo className="h-10 w-auto" />
        </div>
        {/* Nav */}
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {items.map(item => {
            const active = location.pathname === item.path
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${active ? 'bg-hhf-blue text-white' : 'text-gray-600 hover:bg-hhf-blue-pale hover:text-hhf-blue'}`}
              >
                {icons[item.icon]}
                {item.label}
              </Link>
            )
          })}
        </nav>
        {/* Profile footer */}
        <div className="p-3 border-t border-gray-100">
          <Link to={`/${profile?.role}/profile`} className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-gray-50 transition-colors">
            <div className="w-8 h-8 rounded-full bg-hhf-blue flex items-center justify-center text-white text-xs font-bold flex-shrink-0">{initials}</div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-gray-900 truncate">{profile?.full_name}</div>
              <div className="text-xs text-gray-400 capitalize">{profile?.role}</div>
            </div>
          </Link>
          <button onClick={handleSignOut} className="w-full mt-1 text-left px-3 py-1.5 text-xs text-gray-400 hover:text-hhf-red rounded transition-colors">
            Sign out
          </button>
        </div>
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && <div className="fixed inset-0 z-30 bg-black/40 md:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="bg-white border-b border-gray-100 px-4 md:px-6 h-14 flex items-center justify-between flex-shrink-0">
          <button className="md:hidden p-1 rounded" onClick={() => setSidebarOpen(true)}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          </button>
          <div className="flex-1" />
          <Link to={`/${profile?.role}/notifications`} className="relative p-2 text-gray-500 hover:text-hhf-blue">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"/></svg>
            <span className="absolute top-1 right-1 w-2 h-2 bg-hhf-red rounded-full" />
          </Link>
        </header>
        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}