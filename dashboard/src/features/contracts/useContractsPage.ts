import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { computeEffectiveStatus } from '../billing/contractCalculations'
import type { ContractRow, ContractsPageFilters } from './types'

// ---------------------------------------------------------------------------
// useContractsPage — server-side pagination + filters
// ---------------------------------------------------------------------------

export function useContractsPage(filters: ContractsPageFilters): {
  data: ContractRow[]
  count: number
  isLoading: boolean
  error: Error | null
} {
  const { data, isLoading, error } = useQuery({
    queryKey: ['contracts-page', filters],
    queryFn: async () => {
      const { page, pageSize, search, status, clientId } = filters

      // Build the base query with client name join and exact count
      let query = supabase
        .from('contracts')
        .select('id, client_id, monthly_rate, start_date, end_date, status, updated_at, clients(name)', {
          count: 'exact',
        })

      // Apply client name search via ilike on the joined clients table
      if (search && search.trim() !== '') {
        query = query.ilike('clients.name', `%${search.trim()}%`)
      }

      // Apply status filter — 'ended' is computed client-side, so skip server filter for it
      if (status && status !== 'all' && status !== 'ended') {
        query = query.eq('status', status)
      }

      // Apply clientId filter
      if (clientId) {
        query = query.eq('client_id', clientId)
      }

      // Server-side pagination
      const from = page * pageSize
      const to = from + pageSize - 1
      query = query.range(from, to).order('start_date', { ascending: false })

      const { data: rows, error: queryError, count } = await query

      if (queryError) throw new Error(queryError.message)

      const today = new Date()

      // Map raw rows to ContractRow, computing effective_status
      let contracts: ContractRow[] = (rows ?? []).map((row) => {
        const clientData = (row.clients as unknown) as { name: string } | null
        const effective_status = computeEffectiveStatus(row.status, row.end_date, today)

        return {
          id: row.id,
          client_id: row.client_id,
          client_name: clientData?.name ?? 'Unknown',
          monthly_rate: row.monthly_rate ?? 0,
          start_date: row.start_date,
          end_date: row.end_date,
          status: row.status as 'active' | 'suspended' | 'terminated',
          effective_status,
          updated_at: row.updated_at,
        }
      })

      // For 'ended' filter: apply client-side filtering after fetch
      if (status === 'ended') {
        contracts = contracts.filter((c) => c.effective_status === 'ended')
      }

      return {
        data: contracts,
        count: count ?? 0,
      }
    },
  })

  return {
    data: data?.data ?? [],
    count: data?.count ?? 0,
    isLoading,
    error: error as Error | null,
  }
}
