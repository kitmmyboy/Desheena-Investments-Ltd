import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import MapboxMap from '../../components/MapboxMap'
import {
  useRouteDetail,
  useAssignClientToRoute,
  useAssignDriverToRoute,
  useRemoveClientFromRoute,
  useDriverLocations,
} from './useRoutes'

// ---------------------------------------------------------------------------
// Map constants
// ---------------------------------------------------------------------------

const KAMPALA_CENTER: [number, number] = [32.5825, 0.3476]
const DEFAULT_ZOOM = 12

// ---------------------------------------------------------------------------
// Client interface
// ---------------------------------------------------------------------------

interface ClientPin {
  id: string
  name: string
  location_text: string
  gps_lat: number
  gps_lng: number
  sequence: number
}

// ---------------------------------------------------------------------------
// Client search hook — for the assign-client form
// ---------------------------------------------------------------------------

interface ClientSearchResult {
  id: string
  name: string
  location_text: string
  zone: string | null
}

function useClientSearch(search: string) {
  return useQuery<ClientSearchResult[]>({
    queryKey: ['clients-search', search],
    queryFn: async () => {
      if (!search.trim()) return []
      const { data, error } = await supabase
        .from('clients')
        .select('id, name, location_text, zone')
        .ilike('name', `%${search.trim()}%`)
        .order('name', { ascending: true })
        .limit(20)

      if (error) throw new Error(error.message)
      return (data ?? []) as ClientSearchResult[]
    },
    enabled: search.trim().length >= 2,
    staleTime: 30 * 1000,
  })
}

// ---------------------------------------------------------------------------
// RouteDetailPage
// ---------------------------------------------------------------------------

export default function RouteDetailPage() {
  const { routeId } = useParams<{ routeId: string }>()
  const navigate = useNavigate()

  const { data: route, isLoading, error } = useRouteDetail(routeId)

  // Assign client form
  const [clientSearch, setClientSearch] = useState('')
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null)
  const [selectedClientName, setSelectedClientName] = useState('')
  const [sequenceOrder, setSequenceOrder] = useState('')
  const [assignClientError, setAssignClientError] = useState<string | null>(null)
  const [showClientDropdown, setShowClientDropdown] = useState(false)

  // Assign driver form
  const [driverInput, setDriverInput] = useState('')
  const [assignDriverError, setAssignDriverError] = useState<string | null>(null)

  const { data: clientSearchResults = [] } = useClientSearch(clientSearch)

  const assignClient = useAssignClientToRoute()
  const assignDriver = useAssignDriverToRoute()
  const removeClient = useRemoveClientFromRoute()

  // ---------------------------------------------------------------------------
  // Derive sorted client list and map pins
  // ---------------------------------------------------------------------------

  const sortedClients = [...(route?.route_clients ?? [])].sort((a, b) => {
    const seqA = a.sequence_order ?? 9999
    const seqB = b.sequence_order ?? 9999
    return seqA - seqB
  })

  const mapPins: ClientPin[] = sortedClients
    .filter((rc) => rc.clients && rc.clients.gps_lat && rc.clients.gps_lng)
    .map((rc, idx) => ({
      id: rc.id,
      name: rc.clients!.name,
      location_text: rc.clients!.location_text,
      gps_lat: rc.clients!.gps_lat,
      gps_lng: rc.clients!.gps_lng,
      sequence: rc.sequence_order ?? idx + 1,
    }))

  const { data: driverLocations } = useDriverLocations()
  const assignedDriverId = route?.route_drivers?.[0]?.driver_id
  const assignedDriverLocation = driverLocations?.find(loc => loc.driver_id === assignedDriverId)

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  function handleSelectClient(client: ClientSearchResult) {
    setSelectedClientId(client.id)
    setSelectedClientName(client.name)
    setClientSearch(client.name)
    setShowClientDropdown(false)
  }

  async function handleAssignClient(e: React.FormEvent) {
    e.preventDefault()
    setAssignClientError(null)

    if (!selectedClientId) {
      setAssignClientError('Please select a client from the search results.')
      return
    }

    // Check if already assigned
    const alreadyAssigned = route?.route_clients.some((rc) => rc.client_id === selectedClientId)
    if (alreadyAssigned) {
      setAssignClientError('This client is already assigned to this route.')
      return
    }

    try {
      await assignClient.mutateAsync({
        routeId: routeId!,
        clientId: selectedClientId,
        sequenceOrder: sequenceOrder ? parseInt(sequenceOrder, 10) : undefined,
      })
      setClientSearch('')
      setSelectedClientId(null)
      setSelectedClientName('')
      setSequenceOrder('')
    } catch (err) {
      setAssignClientError((err as Error).message)
    }
  }

  async function handleAssignDriver(e: React.FormEvent) {
    e.preventDefault()
    setAssignDriverError(null)

    if (!driverInput.trim()) {
      setAssignDriverError('Please enter a driver user ID or email.')
      return
    }

    // Resolve driver ID: if it looks like an email, look up the user
    let driverId = driverInput.trim()

    if (driverInput.includes('@')) {
      const { data: users, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('email', driverInput.trim())
        .limit(1)

      if (userError) {
        setAssignDriverError(userError.message)
        return
      }

      if (!users || users.length === 0) {
        setAssignDriverError('No user found with that email address.')
        return
      }

      driverId = users[0].id
    }

    try {
      await assignDriver.mutateAsync({ routeId: routeId!, driverId })
      setDriverInput('')
    } catch (err) {
      setAssignDriverError((err as Error).message)
    }
  }

  async function handleRemoveClient(routeClientId: string) {
    if (!confirm('Remove this client from the route?')) return
    try {
      await removeClient.mutateAsync({ routeClientId, routeId: routeId! })
    } catch {
      // error is surfaced via mutation state if needed
    }
  }

  // ---------------------------------------------------------------------------
  // Loading / error states
  // ---------------------------------------------------------------------------

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-500">
        <svg className="mr-2 h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
        Loading route…
      </div>
    )
  }

  if (error || !route) {
    return (
      <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">
        {error ? (error as Error).message : 'Route not found.'}
      </div>
    )
  }

  const assignedDriver = route.route_drivers?.[0]

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Back link + header */}
      <div>
        <button
          onClick={() => navigate('/dashboard/routes')}
          className="mb-3 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to routes
        </button>
        <h1 className="text-2xl font-semibold text-gray-900">{route.name}</h1>
        {route.zone && (
          <p className="mt-1 text-sm text-gray-500">
            Zone: <span className="font-medium text-gray-700">{route.zone}</span>
          </p>
        )}
      </div>

      {/* Assigned driver */}
      <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-base font-semibold text-gray-900">Assigned driver</h2>
        {assignedDriver ? (
          <p className="text-sm text-gray-700">
            <span className="font-medium">{assignedDriver.users?.email ?? assignedDriver.driver_id}</span>
          </p>
        ) : (
          <p className="text-sm text-gray-400 italic">No driver assigned yet.</p>
        )}

        {/* Assign driver form */}
        <form onSubmit={handleAssignDriver} className="mt-4 space-y-3">
          <h3 className="text-sm font-medium text-gray-700">Assign driver</h3>
          <div className="flex gap-3">
            <input
              type="text"
              value={driverInput}
              onChange={(e) => setDriverInput(e.target.value)}
              placeholder="Driver user ID or email"
              className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <button
              type="submit"
              disabled={assignDriver.isPending}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              {assignDriver.isPending ? 'Assigning…' : 'Assign'}
            </button>
          </div>
          {assignDriverError && (
            <p className="text-sm text-red-600">{assignDriverError}</p>
          )}
        </form>
      </div>

      {/* Client list */}
      <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">
            Clients{' '}
            <span className="ml-1 inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
              {sortedClients.length}
            </span>
          </h2>
        </div>

        {sortedClients.length === 0 ? (
          <p className="text-sm text-gray-400 italic">No clients assigned to this route yet.</p>
        ) : (
          <ol className="divide-y divide-gray-100">
            {sortedClients.map((rc, idx) => {
              const client = rc.clients
              return (
                <li key={rc.id} className="flex items-center justify-between py-3">
                  <div className="flex items-start gap-3">
                    <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700">
                      {rc.sequence_order ?? idx + 1}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {client?.name ?? <span className="text-gray-400">Unknown client</span>}
                      </p>
                      <p className="text-xs text-gray-500">
                        {client?.location_text}
                        {client?.zone ? ` · ${client.zone}` : ''}
                      </p>
                      {client?.service_frequency && (
                        <p className="text-xs text-gray-400">{client.service_frequency}</p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemoveClient(rc.id)}
                    disabled={removeClient.isPending}
                    className="ml-4 rounded-md border border-red-200 bg-red-50 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-100 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-1"
                  >
                    Remove
                  </button>
                </li>
              )
            })}
          </ol>
        )}

        {/* Assign client form */}
        <form onSubmit={handleAssignClient} className="mt-5 space-y-3 border-t border-gray-100 pt-5">
          <h3 className="text-sm font-medium text-gray-700">Assign client</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {/* Client search */}
            <div className="relative sm:col-span-2">
              <input
                type="text"
                value={clientSearch}
                onChange={(e) => {
                  setClientSearch(e.target.value)
                  setSelectedClientId(null)
                  setSelectedClientName('')
                  setShowClientDropdown(true)
                }}
                onFocus={() => setShowClientDropdown(true)}
                placeholder="Search client by name…"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              {showClientDropdown && clientSearchResults.length > 0 && (
                <ul className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-md border border-gray-200 bg-white shadow-lg">
                  {clientSearchResults.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => handleSelectClient(c)}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-blue-50 focus:bg-blue-50 focus:outline-none"
                      >
                        <span className="font-medium">{c.name}</span>
                        <span className="ml-2 text-gray-400 text-xs">{c.location_text}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Sequence order */}
            <div>
              <input
                type="number"
                value={sequenceOrder}
                onChange={(e) => setSequenceOrder(e.target.value)}
                placeholder="Order (optional)"
                min={1}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          {selectedClientId && (
            <p className="text-xs text-green-600">
              Selected: <span className="font-medium">{selectedClientName}</span>
            </p>
          )}

          {assignClientError && (
            <p className="text-sm text-red-600">{assignClientError}</p>
          )}

          <button
            type="submit"
            disabled={assignClient.isPending || !selectedClientId}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            {assignClient.isPending ? 'Assigning…' : 'Assign client'}
          </button>
        </form>
      </div>

      {/* Mapbox — client GPS pins */}
      <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-base font-semibold text-gray-900">Route map</h2>
        {mapPins.length === 0 ? (
          <div className="flex h-48 items-center justify-center rounded-lg bg-gray-50 text-sm text-gray-400">
            No clients with GPS coordinates on this route.
          </div>
        ) : (
          <div className="h-[480px] overflow-hidden rounded-lg border border-gray-200">
            <MapboxMap
              center={KAMPALA_CENTER}
              zoom={DEFAULT_ZOOM}
              markers={[
                ...mapPins.map(pin => ({
                  id: pin.id,
                  lng: pin.gps_lng,
                  lat: pin.gps_lat,
                  color: '#2563eb',
                  popup: `<div style="min-width: 150px; font-size: 13px; line-height: 1.6;">
                    <strong style="font-size: 14px;">#${pin.sequence} ${pin.name}</strong><br/>
                    <span style="color: #6b7280;">${pin.location_text}</span>
                  </div>`
                })),
                ...(assignedDriverLocation ? [{
                  id: `driver-${assignedDriverLocation.driver_id}`,
                  lng: assignedDriverLocation.lng,
                  lat: assignedDriverLocation.lat,
                  color: '#ef4444', // Red for driver
                  popup: `<div style="min-width: 150px; font-size: 13px; line-height: 1.6;">
                    <strong style="font-size: 14px;">Driver: ${assignedDriverLocation.users?.full_name || assignedDriverLocation.users?.email}</strong><br/>
                    <span style="color: #6b7280;">Last updated: ${new Date(assignedDriverLocation.updated_at).toLocaleTimeString()}</span>
                  </div>`
                }] : [])
              ]}
            />
          </div>
        )}
      </div>
    </div>
  )
}
