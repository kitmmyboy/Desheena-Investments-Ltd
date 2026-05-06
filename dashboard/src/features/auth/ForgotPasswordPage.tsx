import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      if (resetError) throw resetError
      setSent(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to send reset email.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-md p-8">
        <div className="mb-6 text-center">
          <div className="h-12 w-12 rounded-xl bg-green-700 flex items-center justify-center mx-auto mb-3">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900">Reset your password</h1>
          <p className="text-gray-500 mt-1 text-sm">
            Enter your email and we'll send you a reset link.
          </p>
        </div>

        {sent ? (
          <div className="text-center space-y-4">
            <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-4 text-sm text-green-700">
              <p className="font-medium">Check your email</p>
              <p className="mt-1">A password reset link has been sent to <strong>{email}</strong>. Check your inbox and spam folder.</p>
            </div>
            <Link to="/login" className="block text-sm text-green-700 hover:underline">
              ← Back to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="reset-email" className="block text-sm font-medium text-gray-700 mb-1">
                Email address
              </label>
              <input
                id="reset-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="you@example.com"
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
              {loading ? 'Sending…' : 'Send reset link'}
            </button>

            <div className="text-center">
              <Link to="/login" className="text-sm text-gray-500 hover:text-gray-700 hover:underline">
                ← Back to sign in
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
