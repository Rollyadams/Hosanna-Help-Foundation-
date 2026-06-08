import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

export default function ProtectedRoute({ allowedRoles }) {
  const { user, profile, loading } = useAuth()

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-hhf-blue border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (!user) return <Navigate to="/login" replace />

  if (!profile) return (
    <div className="min-h-screen flex items-center justify-center text-gray-500 text-sm">
      Account pending activation. Please contact the administrator.
    </div>
  )

  if (allowedRoles && !allowedRoles.includes(profile.role)) {
    const redirectMap = { admin: '/admin', staff: '/staff', client: '/client' }
    return <Navigate to={redirectMap[profile.role] || '/login'} replace />
  }

  return <Outlet />
}