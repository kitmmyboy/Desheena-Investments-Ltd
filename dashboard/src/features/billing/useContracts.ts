import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { computeEffectiveStatus, computeDurationMonths } from './contractCalculations'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ContractWithClient {
  id: string
  client_id: string
  client_name: string
  monthly_rate: number
  start_date: string
  end_date: string | null
  status: 'active' | 'suspended' | 'terminated'
  updated_at: string
  // computed
  effective_status: 'active' | 'suspended' | 'terminated' | 'ended'
  duration_months: number
}

export type ContractStatusFilter = 'all' | 'active' | 'inactive'

// ---------------------------------------------------------------------------
// useContracts — list with client-side filtering by effective status
// ---------------------------------------------------------------------------

export function useContracts({
  page = 0,
  pageSize = 25,
  filter = 'all',
  search = '',
}: {
  page?: number
  pageSize?: number
  filter?: ContractStatusFilter
  search?: string
} = {}): {
  data: ContractWithClient[]
  count: number
  isLoading: boolean
  error: Error | null
} {
  const { data: queryData, isLoading, error } = useQuery({
    queryKey: ['contracts', filter, page, pageSize, search],
    queryFn: async () => {
      let query = supabase
        .from('contracts')
        .select('id, client_id, monthly_rate, start_date, end_date, status, updated_at, clients!inner(name, phone)', { count: 'exact' })
        .order('start_date', { ascending: false })

      // Search (by client name or phone)
      if (search && search.trim() !== '') {
        const term = search.trim()
        query = query.or(`name.ilike.%${term}%,phone.ilike.%${term}%`, { foreignTable: 'clients' })
      }

      // Pagination
      const from = page * pageSize
      const to = from + pageSize - 1
      query = query.range(from, to)

      const { data: rows, error: queryError, count } = await query

      if (queryError) throw new Error(queryError.message)

      const today = new Date()

      const contracts: ContractWithClient[] = (rows ?? []).map((row) => {
        const clientData = (row.clients as unknown) as { name: string } | null
        const effective_status = computeEffectiveStatus(row.status, row.end_date, today)
        const duration_months = computeDurationMonths(row.start_date, row.end_date)

        return {
          id: row.id,
          client_id: row.client_id,
          client_name: clientData?.name ?? 'Unknown',
          monthly_rate: row.monthly_rate ?? 0,
          start_date: row.start_date,
          end_date: row.end_date,
          status: row.status as 'active' | 'suspended' | 'terminated',
          updated_at: row.updated_at,
          effective_status,
          duration_months,
        }
      })

      // Note: Client-side filtering by effective_status might not be perfect with pagination
      // but we keep it for now as a fallback. 
      // Ideally this filter would be on the server.
      let filtered = contracts
      if (filter === 'active') {
        filtered = contracts.filter((c) => c.effective_status === 'active')
      } else if (filter === 'inactive') {
        filtered = contracts.filter(
          (c) =>
            c.effective_status === 'suspended' ||
            c.effective_status === 'terminated' ||
            c.effective_status === 'ended'
        )
      }

      return { data: filtered, count: count ?? 0 }
    },
  })

  return {
    data: queryData?.data ?? [],
    count: queryData?.count ?? 0,
    isLoading,
    error: error as Error | null,
  }
}
