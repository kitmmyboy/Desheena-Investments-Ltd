import { useMutation, useQueryClient, UseMutationResult } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import type {
  ContractRow,
  CreateContractInput,
  UpdateContractInput,
  UpdateStatusInput,
  TerminateInput,
} from './types'
import { computeEffectiveStatus } from '../billing/contractCalculations'

// ---------------------------------------------------------------------------
// Helper: map a raw Supabase contracts row to ContractRow
// ---------------------------------------------------------------------------

function mapToContractRow(row: {
  id: string
  client_id: string
  monthly_rate: number | null
  start_date: string
  end_date: string | null
  status: string
  updated_at: string
  clients?: unknown
}): ContractRow {
  const clientData = row.clients as { name: string } | null
  const effective_status = computeEffectiveStatus(row.status, row.end_date, new Date())

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
}

// ---------------------------------------------------------------------------
// Cache invalidation keys
// ---------------------------------------------------------------------------

const INVALIDATE_KEYS = [['contracts-page'], ['contracts'], ['clients']] as const

// ---------------------------------------------------------------------------
// useContractMutations
// ---------------------------------------------------------------------------

export function useContractMutations(): {
  createContract: UseMutationResult<ContractRow, Error, CreateContractInput>
  updateContract: UseMutationResult<ContractRow, Error, UpdateContractInput>
  updateStatus: UseMutationResult<ContractRow, Error, UpdateStatusInput>
  terminateContract: UseMutationResult<ContractRow, Error, TerminateInput>
} {
  const queryClient = useQueryClient()

  const invalidateAll = async () => {
    await Promise.all(
      INVALIDATE_KEYS.map((key) => queryClient.invalidateQueries({ queryKey: key }))
    )
  }

  // -------------------------------------------------------------------------
  // createContract
  // -------------------------------------------------------------------------

  const createContract = useMutation<ContractRow, Error, CreateContractInput>({
    mutationFn: async (input) => {
      // Pre-flight: check for existing active contract for this client
      const { data: existing, error: checkError } = await supabase
        .from('contracts')
        .select('id')
        .eq('client_id', input.client_id)
        .eq('status', 'active')
        .maybeSingle()

      if (checkError) {
        throw new Error(checkError.message)
      }

      if (existing) {
        throw new Error(
          'This client already has an active contract. Suspend or terminate the existing contract before creating a new one.'
        )
      }

      // Insert new contract
      const { data, error } = await supabase
        .from('contracts')
        .insert({
          client_id: input.client_id,
          start_date: input.start_date,
          end_date: input.end_date ?? null,
          monthly_rate: input.monthly_rate,
          registration_fee: input.registration_fee ?? 0,
          notes: input.notes ?? null,
          status: 'active',
        })
        .select('id, client_id, monthly_rate, start_date, end_date, status, updated_at, clients(name)')
        .single()

      if (error) throw new Error(error.message)

      return mapToContractRow(data)
    },
    onSuccess: invalidateAll,
  })

  // -------------------------------------------------------------------------
  // updateContract
  // -------------------------------------------------------------------------

  const updateContract = useMutation<ContractRow, Error, UpdateContractInput>({
    mutationFn: async (input) => {
      const { data, error } = await supabase
        .from('contracts')
        .update({
          start_date: input.start_date,
          end_date: input.end_date ?? null,
          monthly_rate: input.monthly_rate,
          registration_fee: input.registration_fee ?? 0,
          notes: input.notes ?? null,
        })
        .eq('id', input.id)
        .select('id, client_id, monthly_rate, start_date, end_date, status, updated_at, clients(name)')
        .single()

      if (error) throw new Error(error.message)

      return mapToContractRow(data)
    },
    onSuccess: invalidateAll,
  })

  // -------------------------------------------------------------------------
  // updateStatus
  // -------------------------------------------------------------------------

  const updateStatus = useMutation<ContractRow, Error, UpdateStatusInput>({
    mutationFn: async (input) => {
      const { data, error } = await supabase
        .from('contracts')
        .update({ status: input.status })
        .eq('id', input.id)
        .select('id, client_id, monthly_rate, start_date, end_date, status, updated_at, clients(name)')
        .single()

      if (error) throw new Error(error.message)

      return mapToContractRow(data)
    },
    onSuccess: invalidateAll,
  })

  // -------------------------------------------------------------------------
  // terminateContract
  // -------------------------------------------------------------------------

  const terminateContract = useMutation<ContractRow, Error, TerminateInput>({
    mutationFn: async (input) => {
      const { data, error } = await supabase
        .from('contracts')
        .update({
          status: 'terminated',
          end_date: input.effective_date,
          ...(input.reason ? { notes: input.reason } : {}),
        })
        .eq('id', input.id)
        .select('id, client_id, monthly_rate, start_date, end_date, status, updated_at, clients(name)')
        .single()

      if (error) throw new Error(error.message)

      return mapToContractRow(data)
    },
    onSuccess: invalidateAll,
  })

  return {
    createContract,
    updateContract,
    updateStatus,
    terminateContract,
  }
}
