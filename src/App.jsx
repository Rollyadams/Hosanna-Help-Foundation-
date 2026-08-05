import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/layout/ProtectedRoute'

import Login            from './pages/auth/Login'
import Register         from './pages/auth/Register'
import ForgotPassword   from './pages/auth/ForgotPassword'
import AuthCallback     from './pages/auth/AuthCallback'
import PendingActivation from './pages/auth/PendingActivation'

import AdminDashboard   from './pages/admin/Dashboard'
import StaffDashboard   from './pages/staff/Dashboard'
import ClientDashboard  from './pages/client/Dashboard'
import ComingSoon       from './pages/shared/ComingSoon'
import Messaging        from './pages/shared/Messaging'
import PublicChat       from './pages/public/PublicChat'
import StaffApply       from './pages/public/StaffApply'
import StaffInvites     from './pages/admin/StaffInvites'
import Roster           from './pages/shared/Roster'
import Reports          from './pages/admin/Reports'
import UserManagement   from './pages/admin/UserManagement'
import Appointments      from './pages/shared/Appointments'
import Documents         from './pages/shared/Documents'
import AuditLog          from './pages/admin/AuditLog'
import Settings          from './pages/admin/Settings'
import Notifications     from './pages/shared/Notifications'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public */}
          <Route path="/login"            element={<Login />} />
          <Route path="/register"         element={<Register />} />
          <Route path="/forgot-password"  element={<ForgotPassword />} />
          <Route path="/auth/callback"    element={<AuthCallback />} />
          <Route path="/pending"          element={<PendingActivation />} />

          {/* Admin routes */}
          <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
            <Route path="/admin"                  element={<AdminDashboard />} />
            <Route path="/admin/users"            element={<UserManagement />} />
            <Route path="/admin/staff-invites"    element={<StaffInvites />} />
            <Route path="/admin/roster"           element={<Roster />} />
            <Route path="/admin/appointments"     element={<Appointments />} />
            <Route path="/admin/messages"         element={<Messaging />} />
            <Route path="/admin/documents"        element={<Documents />} />
            <Route path="/admin/reports"          element={<Reports />} />
            <Route path="/admin/audit"            element={<AuditLog />} />
            <Route path="/admin/settings"         element={<Settings />} />
            <Route path="/admin/notifications"    element={<Notifications />} />
            <Route path="/admin/profile"          element={<ComingSoon title="My Profile" />} />
          </Route>

          {/* Staff routes */}
          <Route element={<ProtectedRoute allowedRoles={['staff', 'admin']} />}>
            <Route path="/staff"                  element={<StaffDashboard />} />
            <Route path="/staff/clients"          element={<ComingSoon title="My Clients" />} />
            <Route path="/staff/appointments"     element={<Appointments />} />
            <Route path="/staff/messages"         element={<Messaging />} />
            <Route path="/staff/documents"        element={<Documents />} />
            <Route path="/staff/availability"     element={<Roster />} />
            <Route path="/staff/notifications"    element={<Notifications />} />
            <Route path="/staff/profile"          element={<ComingSoon title="My Profile" />} />
          </Route>

          {/* Client routes */}
          <Route element={<ProtectedRoute allowedRoles={['client']} />}>
            <Route path="/client"                     element={<ClientDashboard />} />
            <Route path="/client/appointments"        element={<Appointments />} />
            <Route path="/client/appointments/new"    element={<Appointments />} />
            <Route path="/client/messages"            element={<Messaging />} />
            <Route path="/client/documents"           element={<Documents />} />
            <Route path="/client/notifications"       element={<Notifications />} />
            <Route path="/client/profile"             element={<ComingSoon title="My Profile" />} />
          </Route>

          {/* Public chat — no auth required */}
          <Route path="/chat"        element={<PublicChat />} />
          <Route path="/staff-apply" element={<StaffApply />} />

          {/* Default */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
