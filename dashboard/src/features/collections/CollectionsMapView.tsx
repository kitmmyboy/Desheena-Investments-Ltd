import { useCollections, type CollectionRecord } from './useCollections'
import MapboxMap from '../../components/MapboxMap'

// ---------------------------------------------------------------------------
// Color-coded marker helpers
// ---------------------------------------------------------------------------

/**
 * Returns a CSS color string for a given collection record.
 *
 * - Green  (#22c55e): sync_status = 'synced'
 * - Yellow (#eab308): sync_status = 'pending'
 * - Red    (#ef4444): missing GPS (placeholder for missed scheduled collections)
 */
function markerColor(record: CollectionRecord): string {
  if (record.missing_gps) return '#ef4444'
  if (record.sync_status === 'synced') return '#22c55e'
  return '#eab308'
}

// ---------------------------------------------------------------------------
// Legend component
// ---------------------------------------------------------------------------

function MapLegend() {
  return (
    <div
      className="absolute bottom-6 right-3 z-[10] bg-white rounded-lg shadow-md border border-gray-200 px-3 py-2 text-xs text-gray-700"
      aria-label="Map legend"
    >
      <p className="font-semibold mb-1.5 text-gray-800">Legend</p>
      <div className="flex items-center gap-2 mb-1">
        <span
          className="inline-block w-3 h-3 rounded-full border-2 border-white shadow"
          style={{ backgroundColor: '#22c55e' }}
          aria-hidden="true"
        />
        <span>Synced</span>
      </div>
      <div className="flex items-center gap-2 mb-1">
        <span
          className="inline-block w-3 h-3 rounded-full border-2 border-white shadow"
          style={{ backgroundColor: '#eab308' }}
          aria-hidden="true"
        />
        <span>Pending sync</span>
      </div>
      <div className="flex items-center gap-2">
        <span
          className="inline-block w-3 h-3 rounded-full border-2 border-white shadow"
          style={{ backgroundColor: '#ef4444' }}
          aria-hidden="true"
        />
        <span>Missing GPS</span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// CollectionsMapView — public component
// ---------------------------------------------------------------------------

// Default center: Kampala, Uganda
const KAMPALA_CENTER: [number, number] = [32.5825, 0.3476]
const DEFAULT_ZOOM = 12

export default function CollectionsMapView() {
  // Fetch a large batch of collections for the map.
  // We use a high pageSize to get as many records as possible in one request.
  const { data: records, isLoading, error } = useCollections({
    pageSize: 500,
    sortBy: 'collected_at',
    sortDesc: true,
  })

  // Filter to records that have GPS coordinates (for the map)
  const mappableRecords = records.filter(
    (r) => r.gps_lat != null && r.gps_lng != null
  )

  const markers = mappableRecords.map((record) => {
    const color = markerColor(record)
    const clientName = record.clients?.name ?? 'Unknown client'
    const driverEmail = record.users?.email ?? 'Unknown driver'
    const collectedAt = record.collected_at
      ? new Date(record.collected_at).toLocaleString()
      : '—'
    const weight =
      record.weight_kg != null ? `${record.weight_kg.toFixed(1)} kg` : '—'
    const syncLabel =
      record.sync_status === 'synced' ? 'Synced' : 'Pending sync'

    return {
      id: record.id,
      lng: record.gps_lng!,
      lat: record.gps_lat!,
      color: color,
      popup: `
        <div style="min-width: 160px; font-size: 13px; line-height: 1.5;">
          <strong>${clientName}</strong><br/>
          Driver: ${driverEmail}<br/>
          Waste type: ${record.waste_type ?? '—'}<br/>
          Weight: ${weight}<br/>
          Collected: ${collectedAt}<br/>
          Status: <span style="color:${color}; font-weight:600;">${syncLabel}</span>
        </div>
      `,
      properties: {
        color: color
      }
    }
  })

  return (
    <div className="flex flex-col gap-3">
      {/* Status bar */}
      <div className="flex items-center justify-between text-sm text-gray-500">
        {isLoading ? (
          <span>Loading collection pins…</span>
        ) : error ? (
          <span className="text-red-600">Failed to load collections: {error.message}</span>
        ) : (
          <span>
            Showing {mappableRecords.length.toLocaleString()} collection
            {mappableRecords.length !== 1 ? 's' : ''} with GPS coordinates
            {records.length > mappableRecords.length && (
              <> ({records.length - mappableRecords.length} without GPS hidden) <br/>
              <b>Total Records:</b> {records.length}
              </>
            )}
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

        {/* Legend — positioned inside the map container */}
        <MapLegend />
      </div>
    </div>
  )
}
