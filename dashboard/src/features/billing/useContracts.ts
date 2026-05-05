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

export function useContracts(filter: ContractStatusFilter): {
  data: ContractWithClient[]
  isLoading: boolean
  error: Error | null
} {
  const { data, isLoading, error } = useQuery({
    queryKey: ['contracts', filter],
    queryFn: async () => {
      const { data: rows, error: queryError } = await supabase
        .from('contracts')
        .select('id, client_id, monthly_rate, start_date, end_date, status, updated_at, clients(name)')
        .order('start_date', { ascending: false })

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

      // Client-side filtering based on effective_status
      if (filter === 'active') {
        return contracts.filter((c) => c.effective_status === 'active')
      }

      if (filter === 'inactive') {
        return contracts.filter(
          (c) =>
            c.effective_status === 'suspended' ||
            c.effective_status === 'terminated' ||
            c.effective_status === 'ended'
        )
      }

      // 'all' — no filtering
      return contracts
    },
  })

  return {
    data: data ?? [],
    isLoading,
    error: error as Error | null,
  }
}
