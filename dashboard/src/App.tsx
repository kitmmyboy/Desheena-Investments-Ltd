import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './features/auth/AuthContext'
import LoginPage from './features/auth/LoginPage'
import ProtectedRoute from './features/auth/ProtectedRoute'
import DashboardLayout from './components/DashboardLayout'
import { CollectionsPage, KpiPanel } from './features/collections'
import { ClientsPage, CsvImportPage } from './features/clients'

function RoutesPage() {
  return <div className="text-gray-700"><h2 className="text-xl font-semibold">Routes</h2></div>
}

function BillingPage() {
  return <div className="text-gray-700"><h2 className="text-xl font-semibold">Billing</h2></div>
}

function ReportsPage() {
  return <div className="text-gray-700"><h2 className="text-xl font-semibold">Reports</h2></div>
}

function ComplaintsPage() {
  return <div className="text-gray-700"><h2 className="text-xl font-semibold">Complaints</h2></div>
}

function SmsLogPage() {
  return <div className="text-gray-700"><h2 className="text-xl font-semibold">SMS Log</h2></div>
}

function UsersPage() {
  return <div className="text-gray-700"><h2 className="text-xl font-semibold">Users</h2></div>
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
            <Route index element={<KpiPanel />} />

            {/* Operations routes */}
            <Route
              path="collections"
              element={
                <ProtectedRoute allowedRoles={[ADMIN, OPS]}>
                  <CollectionsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="clients"
              element={
                <ProtectedRoute allowedRoles={[ADMIN, OPS]}>
                  <ClientsPage />
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
                  <RoutesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="complaints"
              element={
                <ProtectedRoute allowedRoles={[ADMIN, OPS]}>
                  <ComplaintsPage />
                </ProtectedRoute>
              }
            />

            {/* Finance routes */}
            <Route
              path="billing"
              element={
                <ProtectedRoute allowedRoles={[ADMIN, FINANCE]}>
                  <BillingPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="reports"
              element={
                <ProtectedRoute allowedRoles={[ADMIN, FINANCE]}>
                  <ReportsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="sms-log"
              element={
                <ProtectedRoute allowedRoles={[ADMIN, FINANCE]}>
                  <SmsLogPage />
                </ProtectedRoute>
              }
            />

            {/* Admin-only */}
            <Route
              path="users"
              element={
                <ProtectedRoute allowedRoles={[ADMIN]}>
                  <UsersPage />
                </ProtectedRoute>
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
