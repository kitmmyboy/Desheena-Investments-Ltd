import { Navigate } from 'react-router-dom'
import { useAuth } from './AuthContext'
import UnauthorizedPage from './UnauthorizedPage'

interface ProtectedRouteProps {
  children: React.ReactNode
  /** If provided, only these roles may access the route. */
  allowedRoles?: string[]
}

export default function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, role, loading } = useAuth()

  // While the auth state is being resolved, render nothing (avoids flash)
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <span className="text-gray-400 text-sm">Loading…</span>
      </div>
    )
  }

  // Not authenticated — send to login
  if (!user) {
    return <Navigate to="/login" replace />
  }

  // Role check: if allowedRoles is specified and non-empty, enforce it
  if (allowedRoles && allowedRoles.length > 0) {
    if (!role || !allowedRoles.includes(role)) {
      return <UnauthorizedPage />
    }
  }

  return <>{children}</>
}
