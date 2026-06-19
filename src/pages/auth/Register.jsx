import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

export default function Register() {
  const { signUp } = useAuth()
  const navigate   = useNavigate()
  const [form, setForm]       = useState({ fullName: '', email: '', password: '', confirm: '', role: 'client' })
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [done, setDone]       = useState(false)

  function update(e) { setForm(f => ({ ...f, [e.target.name]: e.target.value })) }

  async function handleSubmit(e) {
    e.preventDefault()
    if (form.password !== form.confirm) { setError('Passwords do not match'); return }
    setLoading(true); setError('')
    const { error } = await signUp(form.email, form.password, form.fullName)
    setLoading(false)
    if (error) { setError(error.message); return }

    // Notify all admins of new registration
    try {
      const { data: admins } = await import('../../lib/supabase').then(m =>
        m.supabase.from('hhf_profiles').select('id').eq('role', 'admin').eq('status', 'active')
      )
      if (admins?.length) {
        const { supabase } = await import('../../lib/supabase')
        await supabase.from('hhf_notifications').insert(
          admins.map(a => ({
            recipient_id: a.id,
            type:         'new_user_registered',
            title:        'New User Registration',
            body:         `${form.fullName} (${form.email}) has registered as ${form.role} and is awaiting activation.`,
            link:         '/admin/users',
          }))
        )
      }
    } catch (_) { /* non-blocking */ }

    setDone(true)
  }

  if (done) return (
    <div className="min-h-screen flex items-center justify-center p-4"
         style={{background: 'linear-gradient(135deg, #0d2e5e 0%, #1a5fa8 60%, #1565a0 100%)'}}>
      <div className="bg-white rounded-2xl p-8 w-full max-w-md text-center shadow-2xl">
        <div className="w-16 h-16 bg-hhf-green-pale rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-hhf-green" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
        </div>
        <h2 className="font-serif text-2xl font-semibold mb-2">Registration submitted</h2>
        <p className="text-gray-500 text-sm mb-2">Please check your email to verify your account.</p>
        <p className="text-gray-400 text-xs mb-6">Your account will be activated by an administrator before you can log in.</p>
        <Link to="/login" className="btn-primary inline-block px-8">Back to Login</Link>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen flex items-center justify-center p-4"
         style={{background: 'linear-gradient(135deg, #0d2e5e 0%, #1a5fa8 60%, #1565a0 100%)'}}>
      <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-3"
               style={{background: 'linear-gradient(135deg, #1a5fa8, #2e7d32)'}}>
            <span className="text-white font-bold text-lg">HHF</span>
          </div>
          <h1 className="font-serif text-2xl font-semibold">Create account</h1>
          <p className="text-gray-400 text-sm mt-1">Register for platform access</p>
        </div>

        {error && <div className="bg-red-50 border border-red-100 text-hhf-red text-sm px-3 py-2 rounded-lg mb-4">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Full name</label>
            <input name="fullName" value={form.fullName} onChange={update} className="input-field" placeholder="Jane Doe" required />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Email address</label>
            <input name="email" type="email" value={form.email} onChange={update} className="input-field" placeholder="jane@example.com" required />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">I am registering as</label>
            <select name="role" value={form.role} onChange={update} className="input-field">
              <option value="client">Client</option>
              <option value="staff">Staff (requires admin approval)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Password</label>
            <input name="password" type="password" value={form.password} onChange={update} className="input-field" placeholder="Min. 8 characters" required />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Confirm password</label>
            <input name="confirm" type="password" value={form.confirm} onChange={update} className="input-field" placeholder="Repeat password" required />
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full py-2.5 flex items-center justify-center gap-2">
            {loading && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-5">
          Already have an account? <Link to="/login" className="text-hhf-blue font-semibold hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  )
}