import React, { useEffect, useRef } from 'react'
import L from 'leaflet'
import { MapContainer, TileLayer, useMap } from 'react-leaflet'
import 'leaflet.markercluster'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import type { Client } from './useClients'

// ---------------------------------------------------------------------------
// Fix Leaflet default icon issue in React (webpack/vite asset handling)
// ---------------------------------------------------------------------------
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
})

// ---------------------------------------------------------------------------
// Default map settings — centered on Kampala, Uganda
// ---------------------------------------------------------------------------

const KAMPALA_CENTER: [number, number] = [0.3476, 32.5825]
const DEFAULT_ZOOM = 12

// ---------------------------------------------------------------------------
// Marker icon
// ---------------------------------------------------------------------------

function createClientDivIcon(): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `<div style="
      width: 14px;
      height: 14px;
      border-radius: 50%;
      background-color: #3b82f6;
      border: 2px solid white;
      box-shadow: 0 1px 3px rgba(0,0,0,0.4);
    "></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
    popupAnchor: [0, -10],
  })
}

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
      // We do a single query to get the latest collected_at per client_id.
      const clientIds = rows.map((c) => c.id)
      let lastCollectionMap: Record<string, string> = {}

      if (clientIds.length > 0) {
        // Fetch the most recent collection per client using a group-by approach.
        // Supabase doesn't support GROUP BY directly, so we fetch the latest
        // collection for each client by ordering and using a subquery workaround:
        // We fetch all recent collections ordered by collected_at desc and build
        // the map client-side (efficient for up to 1000 clients).
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
// ClusterLayer — inner component that uses useMap()
// ---------------------------------------------------------------------------

interface ClusterLayerProps {
  clients: ClientMapRecord[]
}

function ClusterLayer({ clients }: ClusterLayerProps) {
  const map = useMap()
  const clusterGroupRef = useRef<L.MarkerClusterGroup | null>(null)

  useEffect(() => {
    // Remove previous cluster group if it exists
    if (clusterGroupRef.current) {
      map.removeLayer(clusterGroupRef.current)
    }

    const clusterGroup = L.markerClusterGroup({
      chunkedLoading: true,
      maxClusterRadius: 60,
    })
    clusterGroupRef.current = clusterGroup

    const icon = createClientDivIcon()

    for (const client of clients) {
      const marker = L.marker([client.gps_lat, client.gps_lng], { icon })

      const lastCollection = client.last_collection_date
        ? new Date(client.last_collection_date).toLocaleDateString()
        : 'N/A'

      marker.bindPopup(`
        <div style="min-width: 160px; font-size: 13px; line-height: 1.6;">
          <strong style="font-size: 14px;">${client.name}</strong><br/>
          <span style="color: #6b7280;">${client.location_text}</span><br/>
          Last collection: <strong>${lastCollection}</strong>
        </div>
      `)

      clusterGroup.addLayer(marker)
    }

    map.addLayer(clusterGroup)

    return () => {
      map.removeLayer(clusterGroup)
    }
  }, [map, clients])

  return null
}

// ---------------------------------------------------------------------------
// ClientMapView — public component
// ---------------------------------------------------------------------------

export default function ClientMapView() {
  const { data: clients = [], isLoading, error } = useAllClientsForMap()

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
        <MapContainer
          center={KAMPALA_CENTER}
          zoom={DEFAULT_ZOOM}
          className="h-full w-full"
          scrollWheelZoom={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {!isLoading && <ClusterLayer clients={clients} />}
        </MapContainer>
      </div>
    </div>
  )
}
