import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../features/auth/AuthContext'

interface NavItem {
  label: string
  to: string
}

const NAV_ITEMS_BY_ROLE: Record<string, NavItem[]> = {
  Admin: [
    { label: 'Dashboard', to: '/dashboard' },
    { label: 'Collections', to: '/dashboard/collections' },
    { label: 'Clients', to: '/dashboard/clients' },
    { label: 'Routes', to: '/dashboard/routes' },
    { label: 'Billing', to: '/dashboard/billing' },
    { label: 'Reports', to: '/dashboard/reports' },
    { label: 'Complaints', to: '/dashboard/complaints' },
    { label: 'SMS Log', to: '/dashboard/sms-log' },
    { label: 'Users', to: '/dashboard/users' },
    { label: 'Settings', to: '/dashboard/settings' },
  ],
  Operations_Manager: [
    { label: 'Dashboard', to: '/dashboard' },
    { label: 'Collections', to: '/dashboard/collections' },
    { label: 'Clients', to: '/dashboard/clients' },
    { label: 'Routes', to: '/dashboard/routes' },
    { label: 'Complaints', to: '/dashboard/complaints' },
  ],
  Finance: [
    { label: 'Dashboard', to: '/dashboard' },
    { label: 'Billing', to: '/dashboard/billing' },
    { label: 'Reports', to: '/dashboard/reports' },
    { label: 'SMS Log', to: '/dashboard/sms-log' },
  ],
}

export default function Sidebar() {
  const { user, role, signOut } = useAuth()
  const navigate = useNavigate()

  const navItems: NavItem[] = (role ? NAV_ITEMS_BY_ROLE[role] : null) ?? []

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <aside className="flex flex-col w-64 min-h-screen bg-gray-900 text-white">
      {/* Logo / brand */}
      <div className="px-6 py-5 border-b border-gray-700">
        <span className="text-green-400 font-bold text-lg leading-tight">
          Desheena
        </span>
        <span className="block text-gray-400 text-xs mt-0.5">Waste Management</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto" aria-label="Main navigation">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/dashboard'}
            className={({ isActive }) =>
              [
                'flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-green-700 text-white'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white',
              ].join(' ')
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* User info + sign out */}
      <div className="px-4 py-4 border-t border-gray-700 space-y-3">
        <NavLink
          to="/dashboard/profile"
          className={({ isActive }) =>
            [
              'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
              isActive
                ? 'bg-green-700 text-white'
                : 'text-gray-300 hover:bg-gray-800 hover:text-white',
            ].join(' ')
          }
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
          </svg>
          My Profile
        </NavLink>
        <div className="text-xs text-gray-400 truncate px-1">
          <div className="font-medium text-gray-200 truncate">{user?.email}</div>
          <div className="mt-0.5">{role ?? 'Unknown role'}</div>
        </div>
        <button
          onClick={handleSignOut}
          className="w-full rounded-lg bg-gray-700 px-3 py-2 text-sm font-medium text-gray-200 hover:bg-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-green-500"
        >
          Sign out
        </button>
      </div>
    </aside>
  )
}
