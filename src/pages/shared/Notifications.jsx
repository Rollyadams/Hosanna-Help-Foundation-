import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import AppShell from '../../components/layout/AppShell'

// ── HELPERS ────────────────────────────────────────────────
function timeAgo(ts) {
  if (!ts) return ''
  const diff = Date.now() - new Date(ts).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7)  return `${d}d ago`
  return new Date(ts).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })
}

const TYPE_CONFIG = {
  appointment_confirmed: { icon: '✅', color: 'bg-green-50',  label: 'Appointment Confirmed' },
  appointment_cancelled: { icon: '❌', color: 'bg-gray-50',   label: 'Appointment Cancelled' },
  appointment_reminder:  { icon: '⏰', color: 'bg-blue-50',   label: 'Appointment Reminder'  },
  new_message:           { icon: '💬', color: 'bg-purple-50', label: 'New Message'            },
  document_shared:       { icon: '📄', color: 'bg-indigo-50', label: 'Document Shared'        },
  account_activated:     { icon: '🎉', color: 'bg-amber-50',  label: 'Account Activated'      },
  system:                { icon: '📣', color: 'bg-gray-50',   label: 'System'                 },
}

function getCfg(type) {
  return TYPE_CONFIG[type] || { icon: '🔔', color: 'bg-gray-50', label: type?.replace(/_/g, ' ') || 'Notification' }
}

// ── ICONS ──────────────────────────────────────────────────
const Icon = {
  CheckAll: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/><polyline points="27 6 16 17 11 12" transform="translate(-7 0)"/></svg>,
  Trash:    () => <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>,
  Bell:     () => <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"/></svg>,
  X:        () => <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  Alert:    () => <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
}

// ── NOTIFICATION ITEM ──────────────────────────────────────
function NotifItem({ notif, onRead, onDelete }) {
  const cfg = getCfg(notif.type)
  const navigate = useNavigate()

  function handleClick() {
    if (!notif.read) onRead(notif.id)
    if (notif.link) navigate(notif.link)
  }

  return (
    <div
      onClick={handleClick}
      className={`relative flex items-start gap-3 px-4 py-3.5 rounded-xl border transition-all cursor-pointer hover:shadow-sm ${
        notif.read ? 'bg-white border-gray-100' : `${cfg.color} border-transparent shadow-sm`
      }`}
    >
      {/* Unread dot */}
      {!notif.read && (
        <span className="absolute top-3 right-3 w-2 h-2 bg-blue-500 rounded-full" />
      )}

      <div className="text-xl flex-shrink-0 mt-0.5">{cfg.icon}</div>

      <div className="flex-1 min-w-0 pr-4">
        <p className="text-sm font-medium text-gray-900">{notif.title || cfg.label}</p>
        {notif.body && (
          <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{notif.body}</p>
        )}
        <p className="text-xs text-gray-400 mt-1">{timeAgo(notif.created_at)}</p>
      </div>

      <button
        onClick={e => { e.stopPropagation(); onDelete(notif.id) }}
        className="p-1 text-gray-300 hover:text-gray-500 hover:bg-white rounded-lg transition-colors flex-shrink-0 mt-0.5"
      >
        <Icon.X />
      </button>
    </div>
  )
}

// ── MAIN ───────────────────────────────────────────────────
export default function Notifications() {
  const { profile } = useAuth()
  const [notifs, setNotifs]   = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')
  const [filter, setFilter]   = useState('all') // all | unread

  const load = useCallback(async () => {
    if (!profile) return
    setLoading(true)
    const { data, error: err } = await supabase
      .from('hhf_notifications')
      .select('*')
      .eq('recipient_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(100)
    if (err) setError(err.message)
    else setNotifs(data || [])
    setLoading(false)
  }, [profile])

  useEffect(() => { load() }, [load])

  // Realtime subscription
  useEffect(() => {
    if (!profile) return
    const channel = supabase
      .channel('notifications')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'hhf_notifications',
        filter: `recipient_id=eq.${profile.id}`,
      }, payload => {
        setNotifs(prev => [payload.new, ...prev])
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [profile])

  // Let AppShell's header badge know the unread count changed, without
  // needing a shared state library — a plain DOM event is enough here.
  function notifyBadgeRefresh() {
    window.dispatchEvent(new CustomEvent('hhf:notifications-changed'))
  }

  async function markRead(id) {
    await supabase.from('hhf_notifications').update({ read: true }).eq('id', id)
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
    notifyBadgeRefresh()
  }

  async function markAllRead() {
    await supabase.from('hhf_notifications')
      .update({ read: true })
      .eq('recipient_id', profile.id)
      .eq('read', false)
    setNotifs(prev => prev.map(n => ({ ...n, read: true })))
    notifyBadgeRefresh()
  }

  async function deleteNotif(id) {
    await supabase.from('hhf_notifications').delete().eq('id', id)
    setNotifs(prev => prev.filter(n => n.id !== id))
    notifyBadgeRefresh()
  }

  async function clearAll() {
    await supabase.from('hhf_notifications').delete().eq('recipient_id', profile.id)
    setNotifs([])
    notifyBadgeRefresh()
  }

  const unreadCount = notifs.filter(n => !n.read).length
  const filtered    = filter === 'unread' ? notifs.filter(n => !n.read) : notifs

  return (
    <AppShell>
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Notifications</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
          </p>
        </div>
        {notifs.length > 0 && (
          <div className="flex gap-2">
            {unreadCount > 0 && (
              <button onClick={markAllRead}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-blue-600 border border-blue-200 bg-blue-50 rounded-xl hover:bg-blue-100 transition-colors">
                <Icon.CheckAll /> Mark all read
              </button>
            )}
            <button onClick={clearAll}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
              <Icon.Trash /> Clear all
            </button>
          </div>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-4 w-fit">
        {[['all', 'All'], ['unread', `Unread${unreadCount > 0 ? ` (${unreadCount})` : ''}`]].map(([v, l]) => (
          <button key={v} onClick={() => setFilter(v)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${filter === v ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {l}
          </button>
        ))}
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4">
          <Icon.Alert />{error}
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="flex flex-col gap-2">
          {[1,2,3,4].map(i => (
            <div key={i} className="bg-white rounded-xl border border-gray-100 px-4 py-3.5 animate-pulse">
              <div className="flex gap-3">
                <div className="w-7 h-7 rounded bg-gray-100 flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 bg-gray-100 rounded w-2/3" />
                  <div className="h-3 bg-gray-100 rounded w-1/2" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mb-4 text-gray-300">
            <Icon.Bell />
          </div>
          <p className="text-gray-900 font-medium">
            {filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
          </p>
          <p className="text-sm text-gray-400 mt-1">
            {filter === 'unread' ? "You're all caught up!" : "Activity on your account will appear here."}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map(n => (
            <NotifItem key={n.id} notif={n} onRead={markRead} onDelete={deleteNotif} />
          ))}
        </div>
      )}
    </AppShell>
  )
}
