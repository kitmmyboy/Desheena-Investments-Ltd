import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './features/auth/AuthContext'
import LoginPage from './features/auth/LoginPage'
import ProtectedRoute from './features/auth/ProtectedRoute'
import DashboardLayout from './components/DashboardLayout'
import { CsvImportPage } from './features/clients'

// ---------------------------------------------------------------------------
// Lazy-loaded heavy components (maps + charts)
// ---------------------------------------------------------------------------

// CollectionsPage contains a Leaflet map and a large TanStack Table
const CollectionsPage = lazy(() =>
  import('./features/collections').then((m) => ({ default: m.CollectionsPage }))
)

// KpiPanel contains Recharts visualisations
const KpiPanel = lazy(() =>
  import('./features/collections').then((m) => ({ default: m.KpiPanel }))
)

// ClientsPage contains a Leaflet map and a large TanStack Table
const ClientsPage = lazy(() =>
  import('./features/clients').then((m) => ({ default: m.ClientsPage }))
)

// RoutesPage and RouteDetailPage contain Leaflet maps
const RoutesPage = lazy(() =>
  import('./features/routes').then((m) => ({ default: m.RoutesPage }))
)
const RouteDetailPage = lazy(() =>
  import('./features/routes').then((m) => ({ default: m.RouteDetailPage }))
)

// BillingPage contains invoice management and defaulters report
const BillingPage = lazy(() =>
  import('./features/billing').then((m) => ({ default: m.BillingPage }))
)

// SmsLogPage contains the SMS log table with filters
const SmsLogPage = lazy(() =>
  import('./features/sms').then((m) => ({ default: m.SmsLogPage }))
)

// ReportsPage contains financial charts, driver performance, and collections report
const ReportsPage = lazy(() =>
  import('./features/reports').then((m) => ({ default: m.ReportsPage }))
)

// ComplaintsPage contains the complaints list with TanStack Table and detail panel
const ComplaintsPage = lazy(() =>
  import('./features/complaints').then((m) => ({ default: m.ComplaintsPage }))
)

// UsersPage — Admin-only user management with full CRUD
const UsersPage = lazy(() =>
  import('./features/users').then((m) => ({ default: m.UsersPage }))
)

// ProfilePage — available to all authenticated users
const ProfilePage = lazy(() =>
  import('./features/profile/ProfilePage').then((m) => ({ default: m.default }))
)

// SettingsPage — Admin-only system configuration
const SettingsPage = lazy(() =>
  import('./features/settings/SettingsPage').then((m) => ({ default: m.default }))
)

// ---------------------------------------------------------------------------
// Loading fallback shown while lazy chunks are fetched
// ---------------------------------------------------------------------------

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
      <svg
        className="animate-spin h-5 w-5 mr-2 text-blue-500"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8v8H4z"
        />
      </svg>
      Loading…
    </div>
  )
}

// ---------------------------------------------------------------------------
// Role constants
// ---------------------------------------------------------------------------

const ADMIN = 'Admin'
const OPS = 'Operations_Manager'
const FINANCE = 'Finance'

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<LoginPage />} />

          {/* Root redirect */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />

          {/* Protected dashboard routes */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            {/* Home — any authenticated dashboard role */}
            <Route
              index
              element={
                <Suspense fallback={<PageLoader />}>
                  <KpiPanel />
                </Suspense>
              }
            />

            {/* Operations routes */}
            <Route
              path="collections"
              element={
                <ProtectedRoute allowedRoles={[ADMIN, OPS]}>
                  <Suspense fallback={<PageLoader />}>
                    <CollectionsPage />
                  </Suspense>
                </ProtectedRoute>
              }
            />
            <Route
              path="clients"
              element={
                <ProtectedRoute allowedRoles={[ADMIN, OPS]}>
                  <Suspense fallback={<PageLoader />}>
                    <ClientsPage />
                  </Suspense>
                </ProtectedRoute>
              }
            />
            <Route
              path="clients/import"
              element={
                <ProtectedRoute allowedRoles={[ADMIN, OPS]}>
                  <CsvImportPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="routes"
              element={
                <ProtectedRoute allowedRoles={[ADMIN, OPS]}>
                  <Suspense fallback={<PageLoader />}>
                    <RoutesPage />
                  </Suspense>
                </ProtectedRoute>
              }
            />
            <Route
              path="routes/:routeId"
              element={
                <ProtectedRoute allowedRoles={[ADMIN, OPS]}>
                  <Suspense fallback={<PageLoader />}>
                    <RouteDetailPage />
                  </Suspense>
                </ProtectedRoute>
              }
            />
            <Route
              path="complaints"
              element={
                <ProtectedRoute allowedRoles={[ADMIN, OPS]}>
                  <Suspense fallback={<PageLoader />}>
                    <ComplaintsPage />
                  </Suspense>
                </ProtectedRoute>
              }
            />

            {/* Finance routes */}
            <Route
              path="billing"
              element={
                <ProtectedRoute allowedRoles={[ADMIN, FINANCE]}>
                  <Suspense fallback={<PageLoader />}>
                    <BillingPage />
                  </Suspense>
                </ProtectedRoute>
              }
            />
            <Route
              path="reports"
              element={
                <ProtectedRoute allowedRoles={[ADMIN, FINANCE]}>
                  <Suspense fallback={<PageLoader />}>
                    <ReportsPage />
                  </Suspense>
                </ProtectedRoute>
              }
            />
            <Route
              path="sms-log"
              element={
                <ProtectedRoute allowedRoles={[ADMIN, FINANCE]}>
                  <Suspense fallback={<PageLoader />}>
                    <SmsLogPage />
                  </Suspense>
                </ProtectedRoute>
              }
            />

            {/* Admin-only */}
            <Route
              path="users"
              element={
                <ProtectedRoute allowedRoles={[ADMIN]}>
                  <Suspense fallback={<PageLoader />}>
                    <UsersPage />
                  </Suspense>
                </ProtectedRoute>
              }
            />
            <Route
              path="settings"
              element={
                <ProtectedRoute allowedRoles={[ADMIN]}>
                  <Suspense fallback={<PageLoader />}>
                    <SettingsPage />
                  </Suspense>
                </ProtectedRoute>
              }
            />

            {/* All authenticated users */}
            <Route
              path="profile"
              element={
                <Suspense fallback={<PageLoader />}>
                  <ProfilePage />
                </Suspense>
              }
            />
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
