import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

export default function ForgotPassword() {
  const { resetPassword } = useAuth()
  const [email, setEmail] = useState('')
  const [sent, setSent]   = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    await resetPassword(email)
    setLoading(false)
    setSent(true)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4"
         style={{background: 'linear-gradient(135deg, #0d2e5e 0%, #1a5fa8 60%, #1565a0 100%)'}}>
      <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl text-center">
        <h1 className="font-serif text-2xl font-semibold mb-2">Reset password</h1>
        {sent ? (
          <>
            <p className="text-gray-500 text-sm mb-4">Check your email for a reset link.</p>
            <Link to="/login" className="btn-primary inline-block px-8">Back to Login</Link>
          </>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 mt-4 text-left">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Email address</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                className="input-field" placeholder="you@example.com" required />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full py-2.5">
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>
            <div className="text-center"><Link to="/login" className="text-sm text-gray-400 hover:text-hhf-blue">Back to login</Link></div>
          </form>
        )}
      </div>
    </div>
  )
}