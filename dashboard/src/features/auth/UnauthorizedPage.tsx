import { Link } from 'react-router-dom'

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="text-center max-w-sm">
        <div className="text-6xl font-bold text-red-400 mb-4">403</div>
        <h1 className="text-2xl font-semibold text-gray-800 mb-2">Access Denied</h1>
        <p className="text-gray-500 text-sm mb-6">
          You don't have permission to view this page.
        </p>
        <Link
          to="/dashboard"
          className="inline-block rounded-lg bg-green-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-green-800 transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
        >
          Go to Dashboard
        </Link>
      </div>
    </div>
  )
}
