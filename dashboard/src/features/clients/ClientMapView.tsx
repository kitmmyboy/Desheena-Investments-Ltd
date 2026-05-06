import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import type { Client } from './useClients'
import MapboxMap from '../../components/MapboxMap'

// ---------------------------------------------------------------------------
// Default map settings — centered on Kampala, Uganda
// ---------------------------------------------------------------------------

const KAMPALA_CENTER: [number, number] = [32.5825, 0.3476]
const DEFAULT_ZOOM = 12

// ---------------------------------------------------------------------------
// Fetch all clients for the map (no pagination — up to 1000 records)
// ---------------------------------------------------------------------------

interface ClientMapRecord {
  id: string
  name: string
  location_text: string
  gps_lat: number
  gps_lng: number
  last_collection_date: string | null
}

function useAllClientsForMap() {
  return useQuery<ClientMapRecord[]>({
    queryKey: ['clients-map'],
    queryFn: async () => {
      // Fetch all clients with GPS coordinates
      const { data: clients, error } = await supabase
        .from('clients')
        .select('id, name, location_text, gps_lat, gps_lng')
        .not('gps_lat', 'is', null)
        .not('gps_lng', 'is', null)
        .order('name', { ascending: true })
        .limit(1000)

      if (error) throw new Error(error.message)

      const rows = (clients ?? []) as Pick<Client, 'id' | 'name' | 'location_text' | 'gps_lat' | 'gps_lng'>[]

      // For each client, fetch the most recent collection date.
      const clientIds = rows.map((c) => c.id)
      let lastCollectionMap: Record<string, string> = {}

      if (clientIds.length > 0) {
        const { data: collections } = await supabase
          .from('collections')
          .select('client_id, collected_at')
          .in('client_id', clientIds)
          .order('collected_at', { ascending: false })
          .limit(5000)

        if (collections) {
          for (const col of collections) {
            if (col.client_id && !lastCollectionMap[col.client_id]) {
              lastCollectionMap[col.client_id] = col.collected_at
            }
          }
        }
      }

      return rows.map((c) => ({
        id: c.id,
        name: c.name,
        location_text: c.location_text,
        gps_lat: c.gps_lat,
        gps_lng: c.gps_lng,
        last_collection_date: lastCollectionMap[c.id] ?? null,
      }))
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

// ---------------------------------------------------------------------------
// ClientMapView — public component
// ---------------------------------------------------------------------------

export default function ClientMapView() {
  const { data: clients = [], isLoading, error } = useAllClientsForMap()

  const markers = clients.map((client) => {
    const lastCollection = client.last_collection_date
      ? new Date(client.last_collection_date).toLocaleDateString()
      : 'N/A'

    return {
      id: client.id,
      lng: client.gps_lng,
      lat: client.gps_lat,
      color: '#3b82f6',
      popup: `
        <div style="min-width: 160px; font-size: 13px; line-height: 1.6;">
          <strong style="font-size: 14px;">${client.name}</strong><br/>
          <span style="color: #6b7280;">${client.location_text}</span><br/>
          Last collection: <strong>${lastCollection}</strong>
        </div>
      `
    }
  })

  return (
    <div className="flex flex-col gap-3">
      {/* Status bar */}
      <div className="flex items-center justify-between text-sm text-gray-500">
        {isLoading ? (
          <span>Loading client pins…</span>
        ) : error ? (
          <span className="text-red-600">
            Failed to load clients: {(error as Error).message}
          </span>
        ) : (
          <span>
            Showing {clients.length.toLocaleString()} client
            {clients.length !== 1 ? 's' : ''} with GPS coordinates
          </span>
        )}
      </div>

      {/* Map container */}
      <div className="relative h-[600px] rounded-lg overflow-hidden border border-gray-200 shadow-sm">
        {!isLoading && (
          <MapboxMap
            center={KAMPALA_CENTER}
            zoom={DEFAULT_ZOOM}
            markers={markers}
            cluster={true}
          />
        )}
      </div>
    </div>
  )
}
