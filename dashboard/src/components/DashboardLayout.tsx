import { useState, useCallback } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import { NotificationBell } from '../features/notifications'
import { useAppBranding } from '../hooks'

export default function DashboardLayout() {
  useAppBranding()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const closeSidebar = useCallback(() => setSidebarOpen(false), [])

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar isOpen={sidebarOpen} onClose={closeSidebar} />

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Top header bar */}
        <header className="flex items-center justify-between px-4 py-3 bg-gray-900 border-b border-gray-700 shrink-0">
          {/* Hamburger — mobile only */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-1.5 rounded text-gray-400 hover:text-white hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500"
            aria-label="Open navigation"
            aria-expanded={sidebarOpen}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          {/* Brand name — mobile only (sidebar hidden) */}
          <span className="lg:hidden text-green-400 font-bold text-sm">Desheena</span>

          {/* Right side */}
          <div className="flex items-center gap-2 ml-auto">
            <NotificationBell />
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
