import { useEffect } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../features/auth/AuthContext'
import { supabase } from '../lib/supabase'

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
    { label: 'Staff', to: '/dashboard/staff' },
    { label: 'Billing', to: '/dashboard/billing' },
    { label: 'Contracts', to: '/dashboard/contracts' },
    { label: 'Reports', to: '/dashboard/reports' },
    { label: 'Complaints', to: '/dashboard/complaints' },
    { label: 'SMS Log', to: '/dashboard/sms-log' },
    { label: 'Users', to: '/dashboard/users' },
    { label: 'Settings', to: '/dashboard/settings/general' },
  ],
  Operations_Manager: [
    { label: 'Dashboard', to: '/dashboard' },
    { label: 'Collections', to: '/dashboard/collections' },
    { label: 'Clients', to: '/dashboard/clients' },
    { label: 'Routes', to: '/dashboard/routes' },
    { label: 'Staff', to: '/dashboard/staff' },
    { label: 'Complaints', to: '/dashboard/complaints' },
  ],
  Finance: [
    { label: 'Dashboard', to: '/dashboard' },
    { label: 'Billing', to: '/dashboard/billing' },
    { label: 'Contracts', to: '/dashboard/contracts' },
    { label: 'Reports', to: '/dashboard/reports' },
    { label: 'SMS Log', to: '/dashboard/sms-log' },
  ],
}

function useBrandingSettings() {
  return useQuery({
    queryKey: ['app_branding_full'],
    queryFn: async () => {
      const { data } = await supabase
        .from('system_settings')
        .select('key, value')
        .in('key', ['app_title', 'app_logo_url'])
      const map: Record<string, string> = {}
      ;(data ?? []).forEach((row: { key: string; value: string }) => { map[row.key] = row.value })
      return { title: map['app_title'] || 'Desheena', logoUrl: map['app_logo_url'] || '' }
    },
    staleTime: 5 * 60 * 1000,
  })
}

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { user, role, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { data: branding } = useBrandingSettings()

  const navItems: NavItem[] = (role ? NAV_ITEMS_BY_ROLE[role] : null) ?? []

  // Close sidebar on route change (mobile)
  useEffect(() => {
    onClose()
  }, [location.pathname, onClose])

  // Close on Escape key
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/50 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={[
          'fixed inset-y-0 left-0 z-30 flex flex-col w-64 bg-gray-900 text-white',
          'transform transition-transform duration-200 ease-in-out',
          'lg:relative lg:translate-x-0 lg:z-auto',
          isOpen ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
        aria-label="Sidebar navigation"
      >
        {/* Logo / brand */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-gray-700 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {branding?.logoUrl ? (
              <img
                src={branding.logoUrl}
                alt="Logo"
                className="h-9 w-9 rounded-lg object-contain bg-white p-0.5 shrink-0"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
              />
            ) : (
              <div className="h-9 w-9 rounded-lg bg-green-700 flex items-center justify-center shrink-0">
                <span className="text-white font-bold text-base">D</span>
              </div>
            )}
            <div className="min-w-0">
              <span className="text-green-400 font-bold text-base leading-tight block truncate">
                {branding?.title || 'Desheena'}
              </span>
              <span className="block text-gray-400 text-xs mt-0.5">Waste Management</span>
            </div>
          </div>
          {/* Close button — mobile only */}
          <button
            onClick={onClose}
            className="lg:hidden p-1 rounded text-gray-400 hover:text-white hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500 shrink-0"
            aria-label="Close navigation"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
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
        <div className="px-4 py-4 border-t border-gray-700 space-y-3 shrink-0">
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
    </>
  )
}
