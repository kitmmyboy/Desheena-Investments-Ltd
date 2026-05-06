import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'

function useBranding() {
  return useQuery({
    queryKey: ['login_branding'],
    queryFn: async () => {
      const { data } = await supabase
        .from('system_settings')
        .select('key, value')
        .in('key', ['app_title', 'app_logo_url'])
      const map: Record<string, string> = {}
      ;(data ?? []).forEach((row: { key: string; value: string }) => { map[row.key] = row.value })
      return { title: map['app_title'] || 'Desheena Investments Ltd', logoUrl: map['app_logo_url'] || '' }
    },
    staleTime: 5 * 60 * 1000,
  })
}

export default function DriverRedirectPage() {
  const { data: branding } = useBranding()
  const [signingOut, setSigningOut] = useState(false)

  // Sign the driver out automatically on mount
  useEffect(() => {
    setSigningOut(true)
    supabase.auth.signOut().finally(() => setSigningOut(false))
  }, [])

  const logoUrl = branding?.logoUrl ?? ''
  const title = branding?.title ?? 'Desheena Investments Ltd'

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-md p-8 text-center flex flex-col items-center gap-5">
        {/* Logo */}
        {logoUrl ? (
          <img
            src={logoUrl}
            alt="Logo"
            className="h-20 w-20 rounded-xl object-contain border border-gray-100 shadow-sm"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
        ) : (
          <div className="h-20 w-20 rounded-xl bg-green-700 flex items-center justify-center shadow-sm">
            <span className="text-white font-bold text-3xl">D</span>
          </div>
        )}

        <h1 className="text-xl font-bold text-green-700">{title}</h1>

        {/* Phone icon */}
        <div className="bg-green-50 rounded-full p-5">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-12 w-12 text-green-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
            />
          </svg>
        </div>

        <div className="space-y-2">
          <h2 className="text-lg font-semibold text-gray-900">Please use our mobile app</h2>
          <p className="text-sm text-gray-500 leading-relaxed">
            The web dashboard is for administrators only.
            <br />
            As a driver, please download and use the{' '}
            <span className="font-medium text-green-700">Desheena Driver App</span> on your phone.
          </p>
        </div>

        {signingOut && (
          <p className="text-xs text-gray-400">Signing you out…</p>
        )}
      </div>
    </div>
  )
}
