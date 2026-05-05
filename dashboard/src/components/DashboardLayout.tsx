import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import { NotificationBell } from '../features/notifications'
import { useAppBranding } from '../hooks'

export default function DashboardLayout() {
  useAppBranding()

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Top header bar — always visible */}
        <header className="flex items-center justify-end px-6 py-3 bg-gray-900 border-b border-gray-700 shrink-0">
          <NotificationBell />
        </header>
        {/* Main content — scrolls independently */}
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
