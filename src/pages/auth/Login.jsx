import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

export default function Login() {
  const { signIn, signInWithGoogle } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true); setError('')
    const { data, error } = await signIn(email, password)
    setLoading(false)
    if (error) { setError(error.message); return }
    const role = data.user?.user_metadata?.role
    navigate(role === 'admin' ? '/admin' : role === 'staff' ? '/staff' : '/client')
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4"
         style={{background: 'linear-gradient(135deg, #0d2e5e 0%, #1a5fa8 60%, #1565a0 100%)'}}>
      <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-3"
               style={{background: 'linear-gradient(135deg, #1a5fa8, #2e7d32)'}}>
            <span className="text-white font-bold text-xl">HHF</span>
          </div>
          <div className="font-serif font-semibold text-hhf-blue text-lg">Hossanah Help Foundation</div>
          <div className="text-gray-400 text-xs mt-0.5">Changing One Story at a Time</div>
        </div>

        <h1 className="font-serif text-2xl font-semibold text-center mb-1">Welcome back</h1>
        <p className="text-gray-500 text-sm text-center mb-6">Sign in to your secure workspace</p>

        {error && <div className="bg-red-50 border border-red-100 text-hhf-red text-sm px-3 py-2 rounded-lg mb-4">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Email address</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              className="input-field" placeholder="you@organisation.org" required />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              className="input-field" placeholder="••••••••" required />
          </div>
          <div className="flex justify-end">
            <Link to="/forgot-password" className="text-xs text-hhf-blue hover:underline">Forgot password?</Link>
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full py-2.5 flex items-center justify-center gap-2">
            {loading ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : null}
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="relative my-5">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-100" /></div>
          <div className="relative flex justify-center"><span className="bg-white px-3 text-xs text-gray-400">or continue with</span></div>
        </div>

        <button onClick={signInWithGoogle} className="w-full border border-gray-200 rounded-lg py-2.5 flex items-center justify-center gap-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
          <svg className="w-4 h-4" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
          Continue with Google
        </button>

        <p className="text-center text-sm text-gray-500 mt-5">
          Need access? <Link to="/register" className="text-hhf-blue font-semibold hover:underline">Request account</Link>
        </p>
      </div>
    </div>
  )
}