/**
 * Unit tests for RBAC routing (Task 14.1)
 * Validates: Requirements 2.4, 2.8
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import ProtectedRoute from './ProtectedRoute'
import * as AuthContextModule from './AuthContext'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface MockAuthState {
  user: { email: string } | null
  role: string | null
  loading: boolean
  signIn: () => Promise<void>
  signOut: () => Promise<void>
}

function mockUseAuth(state: MockAuthState) {
  vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue(state as ReturnType<typeof AuthContextModule.useAuth>)
}

const baseAuth: MockAuthState = {
  user: { email: 'test@example.com' },
  role: null,
  loading: false,
  signIn: vi.fn(),
  signOut: vi.fn(),
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ProtectedRoute', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('redirects unauthenticated users to /login', () => {
    mockUseAuth({ ...baseAuth, user: null, role: null })

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route path="/login" element={<div>Login Page</div>} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <div>Protected Content</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    )

    expect(screen.getByText('Login Page')).toBeInTheDocument()
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
  })

  it('renders children for authenticated user with no role restriction', () => {
    mockUseAuth({ ...baseAuth, role: 'Finance' })

    render(
      <MemoryRouter>
        <ProtectedRoute>
          <div>Protected Content</div>
        </ProtectedRoute>
      </MemoryRouter>
    )

    expect(screen.getByText('Protected Content')).toBeInTheDocument()
  })

  it('renders children when user role is in allowedRoles', () => {
    mockUseAuth({ ...baseAuth, role: 'Admin' })

    render(
      <MemoryRouter>
        <ProtectedRoute allowedRoles={['Admin', 'Operations_Manager']}>
          <div>Admin Content</div>
        </ProtectedRoute>
      </MemoryRouter>
    )

    expect(screen.getByText('Admin Content')).toBeInTheDocument()
  })

  // Validates: Requirement 2.4 — Finance role cannot access route management pages
  it('shows UnauthorizedPage when Finance role tries to access Operations_Manager-only route', () => {
    mockUseAuth({ ...baseAuth, role: 'Finance' })

    render(
      <MemoryRouter>
        <ProtectedRoute allowedRoles={['Admin', 'Operations_Manager']}>
          <div>Routes Management</div>
        </ProtectedRoute>
      </MemoryRouter>
    )

    expect(screen.getByText('Access Denied')).toBeInTheDocument()
    expect(screen.queryByText('Routes Management')).not.toBeInTheDocument()
  })

  // Validates: Requirement 2.4 — Operations_Manager cannot access Finance-only pages
  it('shows UnauthorizedPage when Operations_Manager tries to access Finance-only billing page', () => {
    mockUseAuth({ ...baseAuth, role: 'Operations_Manager' })

    render(
      <MemoryRouter>
        <ProtectedRoute allowedRoles={['Admin', 'Finance']}>
          <div>Billing Page</div>
        </ProtectedRoute>
      </MemoryRouter>
    )

    expect(screen.getByText('Access Denied')).toBeInTheDocument()
    expect(screen.queryByText('Billing Page')).not.toBeInTheDocument()
  })

  // Validates: Requirement 2.8 — unauthorized access returns error page without exposing data
  it('does not expose any data on the UnauthorizedPage', () => {
    mockUseAuth({ ...baseAuth, role: 'Driver' })

    render(
      <MemoryRouter>
        <ProtectedRoute allowedRoles={['Admin', 'Finance']}>
          <div>Sensitive Financial Data: $1,000,000</div>
        </ProtectedRoute>
      </MemoryRouter>
    )

    expect(screen.getByText('Access Denied')).toBeInTheDocument()
    expect(screen.queryByText(/Sensitive Financial Data/)).not.toBeInTheDocument()
  })

  // Validates: Requirement 2.8 — Driver role (mobile-only) cannot access dashboard
  it('shows UnauthorizedPage for Driver role on any dashboard route', () => {
    mockUseAuth({ ...baseAuth, role: 'Driver' })

    render(
      <MemoryRouter>
        <ProtectedRoute allowedRoles={['Admin', 'Operations_Manager', 'Finance']}>
          <div>Dashboard Content</div>
        </ProtectedRoute>
      </MemoryRouter>
    )

    expect(screen.getByText('Access Denied')).toBeInTheDocument()
    expect(screen.queryByText('Dashboard Content')).not.toBeInTheDocument()
  })

  // Validates: Requirement 2.8 — Customer role (mobile-only) cannot access dashboard
  it('shows UnauthorizedPage for Customer role on any dashboard route', () => {
    mockUseAuth({ ...baseAuth, role: 'Customer' })

    render(
      <MemoryRouter>
        <ProtectedRoute allowedRoles={['Admin', 'Operations_Manager', 'Finance']}>
          <div>Dashboard Content</div>
        </ProtectedRoute>
      </MemoryRouter>
    )

    expect(screen.getByText('Access Denied')).toBeInTheDocument()
    expect(screen.queryByText('Dashboard Content')).not.toBeInTheDocument()
  })

  it('Admin role can access all routes', () => {
    mockUseAuth({ ...baseAuth, role: 'Admin' })

    const routes = [
      { allowedRoles: ['Admin', 'Operations_Manager'], content: 'Collections' },
      { allowedRoles: ['Admin', 'Finance'], content: 'Billing' },
      { allowedRoles: ['Admin'], content: 'Users' },
    ]

    for (const { allowedRoles, content } of routes) {
      const { unmount } = render(
        <MemoryRouter>
          <ProtectedRoute allowedRoles={allowedRoles}>
            <div>{content}</div>
          </ProtectedRoute>
        </MemoryRouter>
      )
      expect(screen.getByText(content)).toBeInTheDocument()
      unmount()
    }
  })

  it('shows loading state while auth is resolving', () => {
    mockUseAuth({ ...baseAuth, user: null, role: null, loading: true })

    render(
      <MemoryRouter>
        <ProtectedRoute>
          <div>Protected Content</div>
        </ProtectedRoute>
      </MemoryRouter>
    )

    expect(screen.getByText('Loading…')).toBeInTheDocument()
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
  })
})
