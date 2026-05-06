import { useState, type FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from './AuthContext'
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

export default function LoginPage() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const { data: branding } = useBranding()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await signIn(email, password)
      navigate('/dashboard')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Login failed. Please try again.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-md p-8">
        {/* Brand header */}
        <div className="mb-8 text-center flex flex-col items-center gap-3">
          {branding?.logoUrl ? (
            <img
              src={branding.logoUrl}
              alt="Logo"
              className="h-16 w-16 rounded-xl object-contain border border-gray-100 shadow-sm"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
          ) : (
            <div className="h-16 w-16 rounded-xl bg-green-700 flex items-center justify-center shadow-sm">
              <span className="text-white font-bold text-2xl">D</span>
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold text-green-700">{branding?.title || 'Desheena Investments Ltd'}</h1>
            <p className="text-gray-500 mt-1 text-sm">Admin Dashboard</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email address
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <Link
                to="/forgot-password"
                className="text-xs text-green-700 hover:text-green-800 hover:underline focus:outline-none"
              >
                Forgot password?
              </Link>
            </div>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div role="alert" className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-green-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-800 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}
