import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

export default function AuthCallback() {
  const { profile, loading } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (loading) return
    if (!profile) { navigate('/login'); return }
    const map = { admin: '/admin', staff: '/staff', client: '/client' }
    navigate(map[profile.role] || '/login')
  }, [profile, loading])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-hhf-blue border-t-transparent rounded-full animate-spin" />
    </div>
  )
}