import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const fetchProfileRequestId = useRef(0)

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

    // Mark staff/admin online the moment their profile loads (i.e. right
    // after login or app open) — nothing else in the codebase was doing
    // this, which meant `online_status` never actually reflected reality.
    if (!error && (data?.role === 'staff' || data?.role === 'admin')) {
      supabase.from('hhf_profiles').update({ online_status: 'online' }).eq('id', userId).then(() => {})
    }
  }

  // Best-effort: mark offline when the tab/app is closed or backgrounded for
  // good. This can't be 100% reliable (a crashed browser won't fire this),
  // so roster.js's availability check should be treated as "likely online",
  // not an absolute guarantee — but this covers the common close/logout case.
  useEffect(() => {
    if (!user || (profile?.role !== 'staff' && profile?.role !== 'admin')) return

    function markOffline() {
      // navigator.sendBeacon-style fire-and-forget update; supabase-js doesn't
      // expose sendBeacon directly, so we just fire the request without
      // awaiting it, since the page may unload before it resolves.
      supabase.from('hhf_profiles').update({ online_status: 'offline' }).eq('id', user.id).then(() => {})
    }

    function handleVisibility() {
      if (document.visibilityState === 'hidden') markOffline()
      else supabase.from('hhf_profiles').update({ online_status: 'online' }).eq('id', user.id).then(() => {})
    }

    window.addEventListener('pagehide', markOffline)
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
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