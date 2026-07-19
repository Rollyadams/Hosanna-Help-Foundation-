import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

// A staff member is only ever considered "online" if their last_seen_at
// heartbeat is more recent than this window. This means a crashed browser,
// force-closed app, or dead connection naturally "goes offline" on its own
// within this window — no reliance on pagehide/visibilitychange actually
// firing, which they don't always do.
export const HEARTBEAT_INTERVAL_MS = 45 * 1000       // how often we write a heartbeat
export const ONLINE_STALE_AFTER_MS  = 90 * 1000       // how old a heartbeat can be before we treat them as offline

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const fetchProfileRequestId = useRef(0)
  const heartbeatRef = useRef(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      else setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setProfile(null)
      if (session?.user) {
        setLoading(true)
        fetchProfile(session.user.id)
      } else {
        setLoading(false)
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  async function fetchProfile(userId) {
    const requestId = ++fetchProfileRequestId.current
    const { data, error } = await supabase
      .from('hhf_profiles')
      .select('*')
      .eq('id', userId)
      .eq('app', 'hhf')
      .single()
    if (requestId !== fetchProfileRequestId.current) return // a newer request superseded this one
    if (!error) setProfile(data)
    setLoading(false)

    // Mark staff/admin online and stamp a fresh heartbeat the moment their
    // profile loads (i.e. right after login or app open).
    if (!error && (data?.role === 'staff' || data?.role === 'admin')) {
      supabase.from('hhf_profiles')
        .update({ online_status: 'online', last_seen_at: new Date().toISOString() })
        .eq('id', userId).then(() => {})
    }
  }

  // Heartbeat: while a staff/admin has this tab open, refresh last_seen_at
  // on an interval. Availability is judged elsewhere (see roster.js) by how
  // recent this timestamp is, not by a boolean flag alone — so if the
  // heartbeat simply stops (crash, force-close, dead network), that staff
  // member is automatically treated as offline within ONLINE_STALE_AFTER_MS,
  // with no dependency on a close/unload event ever firing.
  useEffect(() => {
    if (!user || (profile?.role !== 'staff' && profile?.role !== 'admin')) return

    function sendHeartbeat() {
      if (document.visibilityState === 'hidden') return // don't renew while backgrounded
      supabase.from('hhf_profiles')
        .update({ online_status: 'online', last_seen_at: new Date().toISOString() })
        .eq('id', user.id).then(() => {})
    }

    function markOffline() {
      supabase.from('hhf_profiles').update({ online_status: 'offline' }).eq('id', user.id).then(() => {})
    }

    sendHeartbeat() // immediate heartbeat on mount, then on the interval below
    heartbeatRef.current = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS)

    function handleVisibility() {
      if (document.visibilityState === 'visible') sendHeartbeat()
    }

    window.addEventListener('pagehide', markOffline)
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      clearInterval(heartbeatRef.current)
      window.removeEventListener('pagehide', markOffline)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [user, profile?.role])

  async function signUp(email, password, fullName, role = 'client') {
    return supabase.auth.signUp({
      email, password,
      options: { data: { app: 'hhf', full_name: fullName, role } },
    })
  }

  async function signIn(email, password) {
    return supabase.auth.signInWithPassword({ email, password })
  }

  async function signInWithGoogle() {
    return supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        queryParams: { prompt: 'select_account' },
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
  }

  async function signOut() {
    if (heartbeatRef.current) clearInterval(heartbeatRef.current)
    if (user && (profile?.role === 'staff' || profile?.role === 'admin')) {
      await supabase.from('hhf_profiles').update({ online_status: 'offline' }).eq('id', user.id)
    }
    setUser(null); setProfile(null); setLoading(false)
    await supabase.auth.signOut()
  }

  async function resetPassword(email) {
    return supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    })
  }

  const value = {
    user, profile, loading,
    role: profile?.role ?? null,
    isAdmin:  profile?.role === 'admin',
    isStaff:  profile?.role === 'staff',
    isClient: profile?.role === 'client',
    signUp, signIn, signInWithGoogle, signOut, resetPassword,
    refreshProfile: () => user && fetchProfile(user.id),
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}