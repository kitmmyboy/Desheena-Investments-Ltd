import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useRoutes, useCreateRoute, useUpdateRoute, useDeleteRoute } from './useRoutes'
import type { Route } from './useRoutes'

// ---------------------------------------------------------------------------
// RoutesPage — full CRUD: list, create, edit, delete
// ---------------------------------------------------------------------------

interface RouteFormState {
  name: string
  zone: string
}

const EMPTY_FORM: RouteFormState = { name: '', zone: '' }

export default function RoutesPage() {
  const navigate = useNavigate()
  const { data: routes = [], isLoading, error } = useRoutes()

  // Create form
  const [showCreate, setShowCreate] = useState(false)
  const [createForm, setCreateForm] = useState<RouteFormState>(EMPTY_FORM)
  const [createError, setCreateError] = useState<string | null>(null)

  // Edit form — keyed by route id
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<RouteFormState>(EMPTY_FORM)
  const [editError, setEditError] = useState<string | null>(null)

  const createRoute = useCreateRoute()
  const updateRoute = useUpdateRoute()
  const deleteRoute = useDeleteRoute()

  // ---------------------------------------------------------------------------
  // Create handlers
  // ---------------------------------------------------------------------------

  function openCreate() {
    setCreateForm(EMPTY_FORM)
    setCreateError(null)
    setShowCreate(true)
  }

  function cancelCreate() {
    setShowCreate(false)
    setCreateError(null)
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreateError(null)
    if (!createForm.name.trim()) {
      setCreateError('Route name is required.')
      return
    }
    try {
      await createRoute.mutateAsync({ name: createForm.name.trim(), zone: createForm.zone.trim() || undefined })
      setShowCreate(false)
      setCreateForm(EMPTY_FORM)
    } catch (err) {
      setCreateError((err as Error).message)
    }
  }

  // ---------------------------------------------------------------------------
  // Edit handlers
  // ---------------------------------------------------------------------------

  function openEdit(route: Route) {
    setEditingId(route.id)
    setEditForm({ name: route.name, zone: route.zone ?? '' })
    setEditError(null)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditError(null)
  }

  async function handleUpdate(e: React.FormEvent, routeId: string) {
    e.preventDefault()
    setEditError(null)
    if (!editForm.name.trim()) {
      setEditError('Route name is required.')
      return
    }
    try {
      await updateRoute.mutateAsync({ id: routeId, name: editForm.name.trim(), zone: editForm.zone.trim() || undefined })
      setEditingId(null)
    } catch (err) {
      setEditError((err as Error).message)
    }
  }

  // ---------------------------------------------------------------------------
  // Delete handler
  // ---------------------------------------------------------------------------

  async function handleDelete(route: Route) {
    const clientCount = route.route_clients?.length ?? 0
    const msg = clientCount > 0
      ? `Delete "${route.name}"? This will also remove ${clientCount} client assignment${clientCount !== 1 ? 's' : ''}. This cannot be undone.`
      : `Delete "${route.name}"? This cannot be undone.`
    if (!confirm(msg)) return
    try {
      await deleteRoute.mutateAsync(route.id)
    } catch (err) {
      alert((err as Error).message)
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
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Create route
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-5">
          <h2 className="mb-4 text-base font-semibold text-gray-900">New route</h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="create-name" className="block text-sm font-medium text-gray-700">
                  Route name <span className="text-red-500">*</span>
                </label>
                <input
                  id="create-name"
                  type="text"
                  value={createForm.name}
                  onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Naalya Morning Run"
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label htmlFor="create-zone" className="block text-sm font-medium text-gray-700">
                  Zone
                </label>
                <input
                  id="create-zone"
                  type="text"
                  value={createForm.zone}
                  onChange={(e) => setCreateForm((f) => ({ ...f, zone: e.target.value }))}
                  placeholder="e.g. Naalya"
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
            {createError && <p className="text-sm text-red-600">{createError}</p>}
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
                onClick={cancelCreate}
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
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Route name</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Zone</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Assigned driver</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Clients</th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {routes.map((route) => {
                const driver = route.route_drivers?.[0]
                const driverEmail = driver?.users?.email ?? '—'
                const clientCount = route.route_clients?.length ?? 0
                const isEditing = editingId === route.id

                return (
                  <React.Fragment key={route.id}>
                    <tr className={isEditing ? 'bg-yellow-50' : 'hover:bg-gray-50'}>
                      {/* Name */}
                      <td className="whitespace-nowrap px-6 py-4">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editForm.name}
                            onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                            className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            autoFocus
                          />
                        ) : (
                          <button
                            onClick={() => navigate(`/dashboard/routes/${route.id}`)}
                            className="font-medium text-blue-600 hover:text-blue-800 hover:underline focus:outline-none"
                          >
                            {route.name}
                          </button>
                        )}
                      </td>

                      {/* Zone */}
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editForm.zone}
                            onChange={(e) => setEditForm((f) => ({ ...f, zone: e.target.value }))}
                            placeholder="Zone (optional)"
                            className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        ) : (
                          route.zone ?? <span className="text-gray-400">—</span>
                        )}
                      </td>

                      {/* Driver */}
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600">
                        {driverEmail}
                      </td>

                      {/* Client count */}
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600">
                        <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                          {clientCount}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="whitespace-nowrap px-6 py-4 text-right">
                        {isEditing ? (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={(e) => handleUpdate(e, route.id)}
                              disabled={updateRoute.isPending}
                              className="rounded-md bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              {updateRoute.isPending ? 'Saving…' : 'Save'}
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="rounded-md border border-gray-300 bg-white px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              Cancel
                            </button>
                            {editError && (
                              <span className="text-xs text-red-600">{editError}</span>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => navigate(`/dashboard/routes/${route.id}`)}
                              className="text-xs font-medium text-blue-600 hover:text-blue-800 px-2 py-1 rounded hover:bg-blue-50 transition-colors"
                            >
                              View
                            </button>
                            <button
                              onClick={() => openEdit(route)}
                              className="text-xs font-medium text-gray-600 hover:text-gray-900 px-2 py-1 rounded hover:bg-gray-100 transition-colors"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDelete(route)}
                              disabled={deleteRoute.isPending}
                              className="text-xs font-medium text-red-600 hover:text-red-800 px-2 py-1 rounded hover:bg-red-50 transition-colors disabled:opacity-40"
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
