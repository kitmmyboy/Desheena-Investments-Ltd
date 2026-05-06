/**
 * Shared TypeScript types for the contracts feature.
 */

// ---------------------------------------------------------------------------
// ContractsPageFilters
// ---------------------------------------------------------------------------

export interface ContractsPageFilters {
  page: number                                                  // 0-indexed
  pageSize: 25 | 50 | 100
  search?: string                                               // client name ilike search
  status?: 'all' | 'active' | 'suspended' | 'terminated' | 'ended'
  clientId?: string                                             // filter by client_id
}

// ---------------------------------------------------------------------------
// ContractRow
// ---------------------------------------------------------------------------

export interface ContractRow {
  id: string
  client_id: string
  client_name: string
  monthly_rate: number
  start_date: string                                           // YYYY-MM-DD
  end_date: string | null                                      // YYYY-MM-DD or null
  status: 'active' | 'suspended' | 'terminated'               // stored value
  effective_status: 'active' | 'suspended' | 'terminated' | 'ended'  // computed
  updated_at: string
}

// ---------------------------------------------------------------------------
// Mutation input types
// ---------------------------------------------------------------------------

export interface CreateContractInput {
  client_id: string
  start_date: string
  end_date?: string | null
  monthly_rate: number
}

export interface UpdateContractInput {
  id: string
  start_date: string
  end_date?: string | null
  monthly_rate: number
}

export interface UpdateStatusInput {
  id: string
  status: 'active' | 'suspended'   // terminated goes through TerminateInput
}

export interface TerminateInput {
  id: string
  effective_date: string   // YYYY-MM-DD
  reason?: string          // termination reason saved to notes
}
