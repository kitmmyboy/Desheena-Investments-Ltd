import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { computeEffectiveStatus } from '../billing/contractCalculations'
import type { ContractRow } from './types'

// ---------------------------------------------------------------------------
// useContractHistory — fetch all contracts for a client ordered by start_date DESC
// ---------------------------------------------------------------------------

export function useContractHistory(clientId: string): {
  data: ContractRow[]
  isLoading: boolean
  error: Error | null
} {
  const { data, isLoading, error } = useQuery({
    queryKey: ['contract-history', clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data: rows, error: queryError } = await supabase
        .from('contracts')
        .select('id, client_id, monthly_rate, start_date, end_date, status, updated_at, clients(name)')
        .eq('client_id', clientId)
        .order('start_date', { ascending: false })

      if (queryError) throw new Error(queryError.message)

      const today = new Date()

      const contracts: ContractRow[] = (rows ?? []).map((row) => {
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

      return contracts
    },
  })

  return {
    data: data ?? [],
    isLoading,
    error: error as Error | null,
  }
}
