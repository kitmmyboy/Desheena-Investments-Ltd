import { useState } from 'react'
import { NavLink, Outlet, Navigate, useLocation } from 'react-router-dom'

// ---------------------------------------------------------------------------
// Nav items
// ---------------------------------------------------------------------------

interface NavItem {
  label: string
  to: string
  icon: string
}

const NAV_ITEMS: NavItem[] = [
  { label: 'General', to: '/dashboard/settings/general', icon: '⚙️' },
  { label: 'Company', to: '/dashboard/settings/company', icon: '🏢' },
  { label: 'Roles & Permissions', to: '/dashboard/settings/roles', icon: '🔐' },
  { label: 'Billing & Finance', to: '/dashboard/settings/billing', icon: '💰' },
  { label: 'Integrations', to: '/dashboard/settings/integrations', icon: '🔌' },
  { label: 'Sync & Offline', to: '/dashboard/settings/sync', icon: '🔄' },
  { label: 'Devices & Drivers', to: '/dashboard/settings/devices', icon: '📱' },
  { label: 'Alerts & Automation', to: '/dashboard/settings/alerts', icon: '🔔' },
  { label: 'Templates', to: '/dashboard/settings/templates', icon: '📄' },
  { label: 'Security', to: '/dashboard/settings/security', icon: '🛡️' },
  { label: 'Data & Logs', to: '/dashboard/settings/data-logs', icon: '📊' },
  { label: 'Backup & Restore', to: '/dashboard/settings/backup', icon: '💾' },
]

// ---------------------------------------------------------------------------
// SettingsLayout
// ---------------------------------------------------------------------------

export default function SettingsLayout() {
  const location = useLocation()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  // Find the active nav item label for the mobile header
  const activeItem = NAV_ITEMS.find((item) => location.pathname.startsWith(item.to))

  return (
    <div className="flex flex-col gap-0 max-w-7xl mx-auto">
      {/* Page header */}
      <div className="mb-4 sm:mb-6">
        <h2 className="text-xl font-semibold text-gray-900">System Settings</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Configure integrations, appearance, and system defaults
        </p>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Mobile: collapsible section picker                                  */}
      {/* ------------------------------------------------------------------ */}
      <div className="lg:hidden mb-3">
        <button
          onClick={() => setMobileNavOpen((o) => !o)}
          className="w-full flex items-center justify-between px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-expanded={mobileNavOpen}
        >
          <span className="flex items-center gap-2">
            <span aria-hidden="true">{activeItem?.icon ?? '⚙️'}</span>
            {activeItem?.label ?? 'Settings'}
          </span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className={`h-4 w-4 text-gray-400 transition-transform ${mobileNavOpen ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {mobileNavOpen && (
          <nav
            className="mt-1 bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm"
            aria-label="Settings sections"
          >
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setMobileNavOpen(false)}
                className={({ isActive }) =>
                  [
                    'flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium transition-colors border-b border-gray-100 last:border-0',
                    isActive
                      ? 'bg-blue-50 text-blue-700 border-l-2 border-l-blue-600'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
                  ].join(' ')
                }
              >
                <span aria-hidden="true" className="text-base">{item.icon}</span>
                {item.label}
              </NavLink>
            ))}
          </nav>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Desktop: side-by-side layout                                        */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex gap-6 items-start">
        {/* Left sidebar nav — desktop only */}
        <nav
          className="hidden lg:block w-56 shrink-0 bg-white border border-gray-200 rounded-xl overflow-hidden"
          aria-label="Settings sections"
        >
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                [
                  'flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium transition-colors border-b border-gray-100 last:border-0',
                  isActive
                    ? 'bg-blue-50 text-blue-700 border-l-2 border-l-blue-600'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
                ].join(' ')
              }
            >
              <span aria-hidden="true" className="text-base">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Right content area — full width on mobile */}
        <div className="flex-1 min-w-0">
          <Outlet />
        </div>
      </div>
    </div>
  )
}

// Re-export Navigate for the index redirect
export { Navigate }
