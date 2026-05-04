import { NavLink, Outlet, Navigate } from 'react-router-dom'

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
  return (
    <div className="flex flex-col gap-0 max-w-7xl mx-auto">
      {/* Page header */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900">System Settings</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Configure integrations, appearance, and system defaults
        </p>
      </div>

      <div className="flex gap-6 items-start">
        {/* Left sidebar nav */}
        <nav
          className="w-56 shrink-0 bg-white border border-gray-200 rounded-xl overflow-hidden"
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

        {/* Right content area */}
        <div className="flex-1 min-w-0">
          <Outlet />
        </div>
      </div>
    </div>
  )
}

// Re-export Navigate for the index redirect
export { Navigate }
