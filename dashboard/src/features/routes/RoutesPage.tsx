import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useRoutes, useCreateRoute } from './useRoutes'

// ---------------------------------------------------------------------------
// RoutesPage — route list + create form
// ---------------------------------------------------------------------------

export default function RoutesPage() {
  const navigate = useNavigate()
  const { data: routes = [], isLoading, error } = useRoutes()

  // Create form state
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [zone, setZone] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  const createRoute = useCreateRoute()

  function handleOpenForm() {
    setName('')
    setZone('')
    setFormError(null)
    setShowForm(true)
  }

  function handleCancel() {
    setShowForm(false)
    setFormError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)

    if (!name.trim()) {
      setFormError('Route name is required.')
      return
    }

    try {
      await createRoute.mutateAsync({ name: name.trim(), zone: zone.trim() || undefined })
      setShowForm(false)
      setName('')
      setZone('')
    } catch (err) {
      setFormError((err as Error).message)
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Routes</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage collection routes, assigned drivers, and client stops.
          </p>
        </div>
        <button
          onClick={handleOpenForm}
          className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Create route
        </button>
      </div>

      {/* Create route form */}
      {showForm && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-5">
          <h2 className="mb-4 text-base font-semibold text-gray-900">New route</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="route-name" className="block text-sm font-medium text-gray-700">
                  Route name <span className="text-red-500">*</span>
                </label>
                <input
                  id="route-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Naalya Morning Run"
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label htmlFor="route-zone" className="block text-sm font-medium text-gray-700">
                  Zone
                </label>
                <input
                  id="route-zone"
                  type="text"
                  value={zone}
                  onChange={(e) => setZone(e.target.value)}
                  placeholder="e.g. Naalya"
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            {formError && (
              <p className="text-sm text-red-600">{formError}</p>
            )}

            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={createRoute.isPending}
                className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                {createRoute.isPending ? 'Creating…' : 'Create route'}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Routes table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-gray-500">
          <svg className="mr-2 h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          Loading routes…
        </div>
      ) : error ? (
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">
          Failed to load routes: {(error as Error).message}
        </div>
      ) : routes.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-gray-200 py-16 text-center">
          <svg className="mx-auto h-10 w-10 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
          <p className="mt-3 text-sm text-gray-500">No routes yet. Create your first route above.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 shadow-sm">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Route name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Zone
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Assigned driver
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Clients
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {routes.map((route) => {
                const driver = route.route_drivers?.[0]
                const driverEmail = driver?.users?.email ?? '—'
                const clientCount = route.route_clients?.length ?? 0

                return (
                  <tr key={route.id} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-6 py-4">
                      <button
                        onClick={() => navigate(`/dashboard/routes/${route.id}`)}
                        className="font-medium text-blue-600 hover:text-blue-800 hover:underline focus:outline-none"
                      >
                        {route.name}
                      </button>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600">
                      {route.zone ?? <span className="text-gray-400">—</span>}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600">
                      {driverEmail}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600">
                      <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                        {clientCount}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
