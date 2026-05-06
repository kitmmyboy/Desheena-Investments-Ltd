import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './features/auth/AuthContext'
import LoginPage from './features/auth/LoginPage'
import ForgotPasswordPage from './features/auth/ForgotPasswordPage'
import ResetPasswordPage from './features/auth/ResetPasswordPage'
import ProtectedRoute from './features/auth/ProtectedRoute'
import DashboardLayout from './components/DashboardLayout'
import { CsvImportPage } from './features/clients'

// ---------------------------------------------------------------------------
// Lazy-loaded heavy components (maps + charts)
// ---------------------------------------------------------------------------

const CollectionsPage = lazy(() =>
  import('./features/collections').then((m) => ({ default: m.CollectionsPage }))
)
const KpiPanel = lazy(() =>
  import('./features/collections').then((m) => ({ default: m.KpiPanel }))
)
const ClientsPage = lazy(() =>
  import('./features/clients').then((m) => ({ default: m.ClientsPage }))
)
const RoutesPage = lazy(() =>
  import('./features/routes').then((m) => ({ default: m.RoutesPage }))
)
const RouteDetailPage = lazy(() =>
  import('./features/routes').then((m) => ({ default: m.RouteDetailPage }))
)
const BillingPage = lazy(() =>
  import('./features/billing').then((m) => ({ default: m.BillingPage }))
)
const ContractsPage = lazy(() =>
  import('./features/contracts').then((m) => ({ default: m.ContractsPage }))
)
const SmsLogPage = lazy(() =>
  import('./features/sms').then((m) => ({ default: m.SmsLogPage }))
)
const ReportsPage = lazy(() =>
  import('./features/reports').then((m) => ({ default: m.ReportsPage }))
)
const ComplaintsPage = lazy(() =>
  import('./features/complaints').then((m) => ({ default: m.ComplaintsPage }))
)
const UsersPage = lazy(() =>
  import('./features/users').then((m) => ({ default: m.UsersPage }))
)
const ProfilePage = lazy(() =>
  import('./features/profile/ProfilePage').then((m) => ({ default: m.default }))
)

// Staff module
const StaffListPage = lazy(() =>
  import('./features/staff').then((m) => ({ default: m.StaffListPage }))
)
const StaffDetailPage = lazy(() =>
  import('./features/staff').then((m) => ({ default: m.StaffDetailPage }))
)

// Settings module
const SettingsLayout = lazy(() =>
  import('./features/settings').then((m) => ({ default: m.SettingsLayout }))
)
const GeneralSettings = lazy(() =>
  import('./features/settings').then((m) => ({ default: m.GeneralSettings }))
)
const CompanySettings = lazy(() =>
  import('./features/settings').then((m) => ({ default: m.CompanySettings }))
)
const RolesSettings = lazy(() =>
  import('./features/settings').then((m) => ({ default: m.RolesSettings }))
)
const BillingSettings = lazy(() =>
  import('./features/settings').then((m) => ({ default: m.BillingSettings }))
)
const IntegrationsSettings = lazy(() =>
  import('./features/settings').then((m) => ({ default: m.IntegrationsSettings }))
)
const SyncSettings = lazy(() =>
  import('./features/settings').then((m) => ({ default: m.SyncSettings }))
)
const DevicesSettings = lazy(() =>
  import('./features/settings').then((m) => ({ default: m.DevicesSettings }))
)
const AlertsSettings = lazy(() =>
  import('./features/settings').then((m) => ({ default: m.AlertsSettings }))
)
const TemplatesSettings = lazy(() =>
  import('./features/settings').then((m) => ({ default: m.TemplatesSettings }))
)
const SecuritySettings = lazy(() =>
  import('./features/settings').then((m) => ({ default: m.SecuritySettings }))
)
const DataLogsSettings = lazy(() =>
  import('./features/settings').then((m) => ({ default: m.DataLogsSettings }))
)
const BackupSettings = lazy(() =>
  import('./features/settings').then((m) => ({ default: m.BackupSettings }))
)

// ---------------------------------------------------------------------------
// Loading fallback
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
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
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
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />

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
            {/* Home */}
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

            {/* Staff Management */}
            <Route
              path="staff"
              element={
                <ProtectedRoute allowedRoles={[ADMIN, OPS]}>
                  <Suspense fallback={<PageLoader />}>
                    <StaffListPage />
                  </Suspense>
                </ProtectedRoute>
              }
            />
            <Route
              path="staff/:staffId"
              element={
                <ProtectedRoute allowedRoles={[ADMIN, OPS]}>
                  <Suspense fallback={<PageLoader />}>
                    <StaffDetailPage />
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
              path="contracts"
              element={
                <ProtectedRoute allowedRoles={[ADMIN, FINANCE]}>
                  <Suspense fallback={<PageLoader />}>
                    <ContractsPage />
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

            {/* Settings — sidebar layout with sub-routes */}
            <Route
              path="settings"
              element={
                <ProtectedRoute allowedRoles={[ADMIN]}>
                  <Suspense fallback={<PageLoader />}>
                    <SettingsLayout />
                  </Suspense>
                </ProtectedRoute>
              }
            >
              {/* Index redirect to general */}
              <Route index element={<Navigate to="general" replace />} />
              <Route path="general" element={<Suspense fallback={<PageLoader />}><GeneralSettings /></Suspense>} />
              <Route path="company" element={<Suspense fallback={<PageLoader />}><CompanySettings /></Suspense>} />
              <Route path="roles" element={<Suspense fallback={<PageLoader />}><RolesSettings /></Suspense>} />
              <Route path="billing" element={<Suspense fallback={<PageLoader />}><BillingSettings /></Suspense>} />
              <Route path="integrations" element={<Suspense fallback={<PageLoader />}><IntegrationsSettings /></Suspense>} />
              <Route path="sync" element={<Suspense fallback={<PageLoader />}><SyncSettings /></Suspense>} />
              <Route path="devices" element={<Suspense fallback={<PageLoader />}><DevicesSettings /></Suspense>} />
              <Route path="alerts" element={<Suspense fallback={<PageLoader />}><AlertsSettings /></Suspense>} />
              <Route path="templates" element={<Suspense fallback={<PageLoader />}><TemplatesSettings /></Suspense>} />
              <Route path="security" element={<Suspense fallback={<PageLoader />}><SecuritySettings /></Suspense>} />
              <Route path="data-logs" element={<Suspense fallback={<PageLoader />}><DataLogsSettings /></Suspense>} />
              <Route path="backup" element={<Suspense fallback={<PageLoader />}><BackupSettings /></Suspense>} />
            </Route>

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
