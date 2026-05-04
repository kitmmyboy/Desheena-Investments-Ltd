import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'

export interface CollectionRecord {
  id: string
  client_id: string
  driver_id: string
  waste_type: string
  weight_kg: number
  gps_lat: number | null
  gps_lng: number | null
  missing_gps: boolean
  collected_at: string
  sync_status: 'pending' | 'synced'
  route_id: string | null
  zone: string | null
  clients: { name: string } | null
  users: { email: string } | null
}

export interface CollectionsFiltersState {
  dateFrom?: string
  dateTo?: string
  driverId?: string
  routeId?: string
  zone?: string
  wasteType?: string
  syncStatus?: string
}

export interface UseCollectionsParams {
  filters?: CollectionsFiltersState
  page?: number
  pageSize?: number
  sortBy?: string
  sortDesc?: boolean
}

export interface UseCollectionsResult {
  data: CollectionRecord[]
  count: number
  isLoading: boolean
  error: Error | null
}

export function useCollections({
  filters = {},
  page = 0,
  pageSize = 50,
  sortBy = 'collected_at',
  sortDesc = true,
}: UseCollectionsParams = {}): UseCollectionsResult {
  const queryKey = ['collections', { filters, page, pageSize, sortBy, sortDesc }]

  const { data, isLoading, error } = useQuery({
    queryKey,
    queryFn: async () => {
      let query = supabase
        .from('collections')
        .select('*, clients(name), users(email)', { count: 'exact' })

      // Apply filters
      if (filters.dateFrom) {
        query = query.gte('collected_at', filters.dateFrom)
      }
      if (filters.dateTo) {
        // Include the full end day
        const endDate = new Date(filters.dateTo)
        endDate.setDate(endDate.getDate() + 1)
        query = query.lt('collected_at', endDate.toISOString().split('T')[0])
      }
      if (filters.driverId) {
        query = query.eq('driver_id', filters.driverId)
      }
      if (filters.routeId) {
        query = query.eq('route_id', filters.routeId)
      }
      if (filters.zone) {
        query = query.eq('zone', filters.zone)
      }
      if (filters.wasteType && filters.wasteType !== 'all') {
        query = query.eq('waste_type', filters.wasteType)
      }
      if (filters.syncStatus && filters.syncStatus !== 'all') {
        query = query.eq('sync_status', filters.syncStatus)
      }

      // Sorting
      query = query.order(sortBy, { ascending: !sortDesc })

      // Pagination
      const from = page * pageSize
      const to = from + pageSize - 1
      query = query.range(from, to)

      const { data: rows, count, error: queryError } = await query

      if (queryError) throw new Error(queryError.message)

      return { rows: (rows ?? []) as CollectionRecord[], count: count ?? 0 }
    },
  })

  return {
    data: data?.rows ?? [],
    count: data?.count ?? 0,
    isLoading,
    error: error as Error | null,
  }
}
