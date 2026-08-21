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

// Shared with AppShell.jsx's inactivity checkpoint system. Defined here
// (not duplicated in AppShell) so both places always agree on the same key.
export const LAST_ACTIVE_KEY = 'hhf_last_active_at'

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const fetchProfileRequestId = useRef(0)
  const heartbeatRef = useRef(null)
  const signingOutRef = useRef(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      else setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // Reset the inactivity checkpoint the moment a real, fresh sign-in
      // happens — otherwise a leftover timestamp from a much earlier
      // session (e.g. from testing an overnight-idle scenario) could still
      // be sitting in localStorage, making AppShell's checkpoint check
      // immediately conclude "this has been idle for hours" and sign the
      // person straight back out, seconds after they just logged in. This
      // was confirmed happening specifically in the browser where that
      // earlier stale-session testing took place.
      if (event === 'SIGNED_IN') {
        localStorage.setItem(LAST_ACTIVE_KEY, String(Date.now()))
        // Audit log: nothing anywhere in the app previously wrote a login
        // event, which is why the Audit Log's "Login" tab always showed
        // empty regardless of how many times someone signed in — the
        // filter and label config existed, but no write ever happened.
        // Piggybacking on this same SIGNED_IN branch as the inactivity
        // checkpoint reset above, since that logic already treats this
        // event as "a real, fresh sign-in" specifically (not a token
        // refresh or session restore).
        if (session?.user) {
          supabase.from('hhf_audit_logs').insert({
            actor_id: session.user.id,
            action: 'login',
            target_type: 'auth',
          }).then(({ error }) => { if (error) console.error('Login audit log failed:', error) })
        }
      }
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
      if (signingOutRef.current) return // sign-out is in progress or just completed — never write 'online' after this point
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
    signingOutRef.current = true // block any heartbeat — in-flight or interval-triggered — from writing 'online' from this point on
    if (heartbeatRef.current) clearInterval(heartbeatRef.current)
    const signingOutUserId = user?.id
    const wasStaffOrAdmin = profile?.role === 'staff' || profile?.role === 'admin'

    if (signingOutUserId && wasStaffOrAdmin) {
      await supabase.from('hhf_profiles').update({ online_status: 'offline' }).eq('id', signingOutUserId)
    }

    // Audit log — fire-and-forget, not awaited. This previously used
    // `await ... .catch(...)`, which meant if this single insert ever
    // stalled (slow connection, RLS check taking a moment, anything),
    // the ENTIRE sign-out flow blocked right here — auth.signOut() and
    // the redirect to /login never ran, so tapping "Sign out" did
    // nothing at all. Letting the person actually leave the app must
    // never depend on an audit write succeeding in time. It's still
    // fired before auth.signOut() revokes the session below (same RLS
    // timing reason as before), just not blocking on its response.
    if (signingOutUserId) {
      supabase.from('hhf_audit_logs').insert({
        actor_id: signingOutUserId,
        action: 'logout',
        target_type: 'auth',
      }).then(({ error }) => { if (error) console.error('Logout audit log failed:', error) })
    }

    // Update local state immediately so the person isn't stuck waiting —
    // the safety-net re-assertion below runs in the background instead of
    // blocking the sign-out experience.
    setUser(null); setProfile(null); setLoading(false)
    await supabase.auth.signOut()

    // A heartbeat request that was already in-flight before signingOutRef
    // was set could still land after our offline write above and silently
    // flip it back to 'online' — this was the actual root cause of staff
    // appearing online again after a deliberate, confirmed sign-out.
    // Re-assert offline once more shortly after, in the background, to win
    // that race.
    //
    // CAVEAT: by the time this fires, supabase.auth.signOut() has already
    // revoked the session above. If hhf_profiles' RLS policy requires an
    // authenticated session to UPDATE a row, this call will be rejected and
    // silently do nothing — in which case the real fix is a policy that
    // allows this specific write, or moving this logic server-side. Check
    // this in practice: if staff still occasionally reappears online after
    // sign-out despite this fix, RLS rejecting this background call is the
    // next thing to check.
    if (signingOutUserId && wasStaffOrAdmin) {
      setTimeout(() => {
        supabase.from('hhf_profiles').update({ online_status: 'offline' }).eq('id', signingOutUserId).then(() => {})
      }, 1200)
    }
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