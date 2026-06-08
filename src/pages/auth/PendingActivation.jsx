import { useAuth } from '../../context/AuthContext'

export default function PendingActivation() {
  const { signOut } = useAuth()
  return (
    <div className="min-h-screen flex items-center justify-center p-4"
         style={{background: 'linear-gradient(135deg, #0d2e5e 0%, #1a5fa8 60%, #1565a0 100%)'}}>
      <div className="bg-white rounded-2xl p-8 w-full max-w-md text-center shadow-2xl">
        <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-amber-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
          </svg>
        </div>
        <h2 className="font-serif text-2xl font-semibold mb-2">Account pending</h2>
        <p className="text-gray-500 text-sm mb-6">Your account is awaiting activation by an administrator. You will receive an email once your account is approved.</p>
        <button onClick={signOut} className="btn-ghost px-8">Sign out</button>
      </div>
    </div>
  )
}