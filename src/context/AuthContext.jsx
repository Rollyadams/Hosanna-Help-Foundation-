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
  }

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