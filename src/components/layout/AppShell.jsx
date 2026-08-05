import { useState, useEffect, useRef, useCallback } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
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

// A persistent AudioContext, created once and reused. Browsers block audio
// from playing until the page has seen at least one user gesture (a click,
// tap, or keypress) — before that, creating oscillators produces no sound
// at all, with no error thrown, which is why the alert could go completely
// silent even with the tab open and staff present. We create the context
// eagerly and "resume" it on the very first interaction anywhere on the
// page, so it's already unlocked by the time a real alert needs to fire.
let sharedAudioCtx = null
function getAudioCtx() {
  if (sharedAudioCtx) return sharedAudioCtx
  const Ctx = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext)
  if (!Ctx) return null
  sharedAudioCtx = new Ctx()
  return sharedAudioCtx
}

function unlockAudio() {
  const ctx = getAudioCtx()
  if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {})
}

// A short, generated "ring" tone — no external audio file needed.
function playAlertTone() {
  try {
    const ctx = getAudioCtx()
    if (!ctx) return
    // If the context is still suspended (no interaction has unlocked it
    // yet), try to resume it right now as a last-ditch effort — this can
    // still fail silently per browser policy, but costs nothing to try.
    if (ctx.state === 'suspended') ctx.resume().catch(() => {})
    const beep = (freq, start, duration) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + start)
      gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + start + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + duration)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(ctx.currentTime + start)
      osc.stop(ctx.currentTime + start + duration)
    }
    beep(880, 0, 0.15)
    beep(660, 0.18, 0.15)
  } catch {
    /* audio not available — fail silently */
  }
}

export default function AppShell({ children }) {
  const { profile, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const notifPermissionAsked = useRef(false)
  const originalTitleRef = useRef(typeof document !== 'undefined' ? document.title : 'HHF Connect')
  const titleFlashRef = useRef(null)
  const repeatAlertRef = useRef(null)

  const items = navItems[profile?.role] || []
  const initials = profile?.full_name?.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase() || '??'

  // ── SESSION INACTIVITY TIMEOUT ────────────────────────────────────────
  // Staff/admin sessions previously never expired — Supabase's
  // autoRefreshToken keeps a session alive indefinitely regardless of
  // activity, so someone could stay logged in on a shared/borrowed device
  // for days. After INACTIVITY_TIMEOUT_MS of no interaction, sign out
  // automatically, with a warning shown WARNING_BEFORE_MS before it happens
  // so nobody is kicked out without notice mid-task.
  const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000  // 15 minutes — tightened from 30 to match a stricter security posture appropriate for an NGO handling visitor help-seeking data
  const WARNING_BEFORE_MS     = 60 * 1000        // warn 60s before logout
  const [showTimeoutWarning, setShowTimeoutWarning] = useState(false)
  const [warningSecondsLeft, setWarningSecondsLeft] = useState(60)
  const inactivityTimerRef = useRef(null)
  const warningTimerRef    = useRef(null)
  const countdownIntervalRef = useRef(null)

  // Unlock audio on the very first interaction anywhere in the app, so the
  // alert tone actually has a chance to play by the time a real
  // notification arrives — without this, a staff member who never clicks
  // anything (just watches the tab) could get zero sound with no warning.
  useEffect(() => {
    function unlock() {
      unlockAudio()
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
    window.addEventListener('pointerdown', unlock)
    window.addEventListener('keydown', unlock)
    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
  }, [])

  // Reset the inactivity clock whenever the person actually does something.
  // Only runs for logged-in staff/admin/client — no point tracking
  // inactivity on public pages with no session to protect. Previously,
  // Supabase's autoRefreshToken kept sessions alive indefinitely regardless
  // of activity, so someone could stay logged in on a shared/borrowed
  // device for days (confirmed: a session left overnight was still active
  // the next night).
  useEffect(() => {
    if (!profile) return

    function clearTimers() {
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current)
      if (warningTimerRef.current) clearTimeout(warningTimerRef.current)
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current)
    }

    function startWarningCountdown() {
      setShowTimeoutWarning(true)
      setWarningSecondsLeft(Math.round(WARNING_BEFORE_MS / 1000))
      countdownIntervalRef.current = setInterval(() => {
        setWarningSecondsLeft(s => (s <= 1 ? 0 : s - 1))
      }, 1000)
    }

    function resetTimer() {
      clearTimers()
      setShowTimeoutWarning(false)
      warningTimerRef.current = setTimeout(startWarningCountdown, INACTIVITY_TIMEOUT_MS - WARNING_BEFORE_MS)
      inactivityTimerRef.current = setTimeout(() => {
        handleSignOut()
      }, INACTIVITY_TIMEOUT_MS)
    }

    const activityEvents = ['pointerdown', 'keydown', 'touchstart', 'scroll']
    activityEvents.forEach(evt => window.addEventListener(evt, resetTimer))
    resetTimer() // start the clock as soon as this mounts

    return () => {
      clearTimers()
      activityEvents.forEach(evt => window.removeEventListener(evt, resetTimer))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- INACTIVITY_TIMEOUT_MS/WARNING_BEFORE_MS are constants that never change, and handleSignOut is stable in practice; including them would only cause needless effect re-runs
  }, [profile])

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  const loadUnreadCount = useCallback(async () => {
    if (!profile?.id) return
    const { count } = await supabase
      .from('hhf_notifications')
      .select('id', { count: 'exact', head: true })
      .eq('recipient_id', profile.id)
      .eq('read', false)
    setUnreadCount(count || 0)
  }, [profile])

  // Flash the browser tab title back and forth with an urgent message while
  // the tab is hidden/backgrounded — the best we can do to catch someone's
  // eye without native push notifications, if they glance at their open
  // tabs (e.g. phone screen on, browser just not focused).
  function startTitleFlash(message) {
    if (titleFlashRef.current) return // already flashing
    let showAlert = true
    titleFlashRef.current = setInterval(() => {
      document.title = showAlert ? message : originalTitleRef.current
      showAlert = !showAlert
    }, 1200)
  }

  function stopTitleFlash() {
    if (titleFlashRef.current) {
      clearInterval(titleFlashRef.current)
      titleFlashRef.current = null
      document.title = originalTitleRef.current
    }
  }

  // Repeat the alert tone every 20s until the person actually looks at the
  // tab or the notifications page — a single beep is easy to miss if the
  // phone isn't in hand.
  function startRepeatingAlert() {
    if (repeatAlertRef.current) return
    repeatAlertRef.current = setInterval(() => {
      if (document.visibilityState === 'hidden') playAlertTone()
    }, 20 * 1000)
  }

  function stopRepeatingAlert() {
    if (repeatAlertRef.current) {
      clearInterval(repeatAlertRef.current)
      repeatAlertRef.current = null
    }
  }

  // The moment the tab is back in focus, treat it as "seen" — stop
  // flashing the title and stop repeating the alert tone.
  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState === 'visible') {
        stopTitleFlash()
        stopRepeatingAlert()
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      stopTitleFlash()
      stopRepeatingAlert()
    }
  }, [])

  // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch-on-mount, same pattern used elsewhere in this codebase (e.g. Notifications.jsx)
  useEffect(() => { loadUnreadCount() }, [loadUnreadCount])

  // Notifications.jsx dispatches this after marking read/deleting, so the
  // header badge count doesn't go stale while that page is open.
  useEffect(() => {
    const handler = () => loadUnreadCount()
    window.addEventListener('hhf:notifications-changed', handler)
    return () => window.removeEventListener('hhf:notifications-changed', handler)
  }, [loadUnreadCount])

  // Ask for browser notification permission once, only for staff/admin roles
  // who actually need to be alerted about incoming chats.
  useEffect(() => {
    if (!profile) return
    if (profile.role !== 'admin' && profile.role !== 'staff') return
    if (notifPermissionAsked.current) return
    notifPermissionAsked.current = true
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {})
    }
  }, [profile])

  // Realtime: ring + badge + browser notification the moment a new
  // notification lands for this staff member, app-wide (not just on
  // the Notifications page).
  useEffect(() => {
    if (!profile?.id) return

    const channel = supabase
      .channel(`appshell_notifications_${profile.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'hhf_notifications',
        filter: `recipient_id=eq.${profile.id}`,
      }, payload => {
        setUnreadCount(prev => prev + 1)
        playAlertTone()

        // If they're not even looking at this tab, escalate: flash the
        // title and keep re-playing the tone until they come back.
        if (document.visibilityState === 'hidden') {
          startTitleFlash(`🔴 New message — ${originalTitleRef.current}`)
          startRepeatingAlert()
        }

        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          try {
            new Notification(payload.new.title || 'HHF Connect', {
              body: payload.new.body || 'You have a new notification.',
              icon: '/favicon.svg',
            })
          } catch {
            /* ignore */
          }
        }
      })
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [profile?.id])

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
            {unreadCount > 0 && (
              <span className="absolute top-0.5 right-0.5 min-w-[16px] h-4 px-1 flex items-center justify-center bg-hhf-red text-white text-[10px] font-bold rounded-full leading-none">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </Link>
        </header>
        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </main>
      </div>

      {/* Session inactivity warning — appears WARNING_BEFORE_MS before
          auto-logout. Any click/tap/keypress anywhere (including "Stay
          logged in" below) resets the timer via the global listener. */}
      {showTimeoutWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-amber-50 flex items-center justify-center">
              <svg className="w-6 h-6 text-amber-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
              </svg>
            </div>
            <h3 className="text-base font-semibold text-gray-900 mb-1">Still there?</h3>
            <p className="text-sm text-gray-500 mb-5">
              You've been inactive for a while. For security, you'll be signed out in <span className="font-semibold text-gray-700">{warningSecondsLeft}s</span> unless you tap below.
            </p>
            <button
              onClick={() => setShowTimeoutWarning(false)}
              className="w-full py-2.5 text-sm font-semibold text-white bg-hhf-blue rounded-xl hover:opacity-90">
              Stay logged in
            </button>
          </div>
        </div>
      )}
    </div>
  )
}