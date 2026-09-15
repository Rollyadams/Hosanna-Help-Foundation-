import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AppShell from '../../components/layout/AppShell'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'

export default function Profile() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()

  const [showConfirm, setShowConfirm] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [deleting, setDeleting]       = useState(false)
  const [error, setError]             = useState('')

  async function handleDelete() {
    if (confirmText.trim().toUpperCase() !== 'DELETE') {
      setError('Please type DELETE to confirm.')
      return
    }
    setDeleting(true)
    setError('')
    const { error: rpcError } = await supabase.rpc('hhf_delete_own_account')
    if (rpcError) {
      setDeleting(false)
      setError('Something went wrong. Please try again or contact info@hhfoundation.com.ng for help.')
      return
    }
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <AppShell>
      <div className="max-w-xl mx-auto space-y-6">
        <div>
          <h1 className="font-serif text-2xl font-semibold text-gray-900">My Profile</h1>
          <p className="text-gray-400 text-sm mt-1">Manage your HHF CareConnect account</p>
        </div>

        {/* Account details */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
          <div>
            <div className="text-xs font-semibold text-gray-400">Name</div>
            <div className="text-sm text-gray-800">{profile?.full_name || '—'}</div>
          </div>
          <div>
            <div className="text-xs font-semibold text-gray-400">Email</div>
            <div className="text-sm text-gray-800">{profile?.email || '—'}</div>
          </div>
          <div>
            <div className="text-xs font-semibold text-gray-400">Account type</div>
            <div className="text-sm text-gray-800 capitalize">{profile?.role || '—'}</div>
          </div>
        </div>

        {/* Danger zone */}
        <div className="bg-white rounded-2xl border border-red-100 p-5">
          <h2 className="text-sm font-semibold text-hhf-red mb-1">Delete Account</h2>
          <p className="text-xs text-gray-500 mb-4">
            This permanently removes your name, email, and phone number from HHF CareConnect and signs
            you out everywhere. You will not be able to log back in with this account. In line with our{' '}
            <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-hhf-blue underline">Privacy Policy</a>,
            your past conversation and appointment records are kept for HHF's case and safeguarding
            records, but will no longer show your name or contact details.
          </p>

          {!showConfirm ? (
            <button
              onClick={() => setShowConfirm(true)}
              className="text-sm font-semibold text-hhf-red border border-red-200 rounded-lg px-4 py-2 hover:bg-red-50 transition-colors"
            >
              Delete My Account
            </button>
          ) : (
            <div className="space-y-3 bg-red-50 border border-red-100 rounded-xl p-4">
              <p className="text-sm text-red-700 font-medium">This action cannot be undone.</p>
              {error && <p className="text-xs text-red-600">{error}</p>}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                  Type DELETE to confirm
                </label>
                <input
                  type="text"
                  value={confirmText}
                  onChange={e => setConfirmText(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-red-200 rounded-lg focus:outline-none focus:border-red-400 bg-white"
                  placeholder="DELETE"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex-1 py-2.5 text-sm font-semibold text-white bg-hhf-red rounded-lg disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {deleting && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  {deleting ? 'Deleting...' : 'Permanently Delete My Account'}
                </button>
                <button
                  onClick={() => { setShowConfirm(false); setConfirmText(''); setError('') }}
                  disabled={deleting}
                  className="px-4 py-2.5 text-sm font-medium text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  )
}
