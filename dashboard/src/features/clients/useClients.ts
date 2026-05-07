import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'

function generateUUID(): string {
  return crypto.randomUUID()
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Client {
  id: string
  name: string
  phone: string
  email: string | null
  location_text: string
  gps_lat: number
  gps_lng: number
  service_frequency: string
  monthly_rate: number
  zone: string | null
  division_office: string | null
  notes: string | null
  is_active: boolean
  created_at: string
  contracts?: { status: string }[] | null
}

export interface ClientWithContractStatus extends Client {
  contract_status: string | null
}

export interface ClientsFilters {
  page?: number
  pageSize?: number
  search?: string
  zone?: string
  serviceFrequency?: string
  contractStatus?: string
  paymentStatus?: string
  showInactive?: boolean
}

export interface UseClientsResult {
  data: ClientWithContractStatus[]
  count: number
  isLoading: boolean
  error: Error | null
}

export interface CreateClientInput {
  name: string
  phone: string
  email?: string
  location_text: string
  gps_lat: number
  gps_lng: number
  service_frequency: string
  monthly_rate: number
  zone?: string
  division_office?: string
  notes?: string
}

export interface UpdateClientInput extends CreateClientInput {
  id: string
}

// ---------------------------------------------------------------------------
// useClients — list with server-side pagination and filtering
// ---------------------------------------------------------------------------

export function useClients({
  page = 0,
  pageSize = 50,
  search,
  zone,
  serviceFrequency,
  contractStatus,
  showInactive = false,
}: ClientsFilters = {}): UseClientsResult {
  const queryKey = ['clients', { page, pageSize, search, zone, serviceFrequency, contractStatus, showInactive }]

  const { data, isLoading, error } = useQuery({
    queryKey,
    queryFn: async () => {
      // When filtering by contract status we need a different query strategy:
      // fetch all matching client IDs via the contracts table first, then
      // use that to filter the clients query — this keeps pagination accurate.

      let clientIds: string[] | null = null
      // Special case: empty string means "no contract"
      let filterNoContract = false

      if (contractStatus === '') {
        filterNoContract = true
      } else if (contractStatus && contractStatus !== 'all') {
        const { data: contractRows, error: contractError } = await supabase
          .from('contracts')
          .select('client_id, status, end_date')

        if (contractError) throw new Error(contractError.message)

        const today = new Date()
        today.setHours(0, 0, 0, 0)

        const matchingIds = new Set<string>()
        for (const row of contractRows ?? []) {
          let effectiveStatus = row.status
          if (row.end_date) {
            const end = new Date(row.end_date)
            end.setHours(0, 0, 0, 0)
            if (end < today) effectiveStatus = 'ended'
          }
          if (effectiveStatus === contractStatus) {
            matchingIds.add(row.client_id)
          }
        }

        clientIds = Array.from(matchingIds)

        if (clientIds.length === 0) {
          return { rows: [], count: 0 }
        }
      }

      let query = supabase
        .from('clients')
        .select('*, contracts(status, end_date, start_date)', { count: 'exact' })

      // By default only show active clients; showInactive shows all
      if (!showInactive) {
        query = query.eq('is_active', true)
      }

      // Apply contract status pre-filter
      if (clientIds !== null) {
        query = query.in('id', clientIds)
      }

      // "No contract" filter — exclude clients that have any contract
      if (filterNoContract) {
        const { data: allContractRows } = await supabase
          .from('contracts')
          .select('client_id')
        const clientsWithContracts = Array.from(new Set((allContractRows ?? []).map((r: { client_id: string }) => r.client_id)))
        if (clientsWithContracts.length > 0) {
          const quotedIds = clientsWithContracts.map((id) => `"${id}"`).join(',')
          query = query.not('id', 'in', `(${quotedIds})`)
        }
      }

      // Search by name or phone
      if (search && search.trim() !== '') {
        const term = search.trim()
        query = query.or(`name.ilike.%${term}%,phone.ilike.%${term}%`)
      }

      // Zone filter
      if (zone && zone !== 'all') {
        query = query.ilike('zone', zone)
      }

      // Service frequency filter — exact match (case-insensitive)
      if (serviceFrequency && serviceFrequency !== 'all') {
        query = query.ilike('service_frequency', serviceFrequency)
      }

      // Sorting
      query = query.order('name', { ascending: true })

      // Pagination
      const from = page * pageSize
      const to = from + pageSize - 1
      query = query.range(from, to)

      const { data: rows, count, error: queryError } = await query

      if (queryError) throw new Error(queryError.message)

      // Flatten contract status — pick the most relevant contract:
      // prefer active > suspended > terminated, then most recent by start_date
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      const clients: ClientWithContractStatus[] = (rows ?? []).map((row: Client & { contracts?: { status: string; end_date: string | null; start_date: string }[] | null }) => {
        const contracts = (row.contracts ?? []) as { status: string; end_date: string | null; start_date: string }[]

        // Compute effective status for each contract
        const withEffective = contracts.map((c) => {
          let effectiveStatus = c.status
          if (c.end_date) {
            const end = new Date(c.end_date)
            end.setHours(0, 0, 0, 0)
            if (end < today) effectiveStatus = 'ended'
          }
          return { ...c, effectiveStatus }
        })

        // Priority: active > suspended > ended > terminated
        const priority: Record<string, number> = { active: 0, suspended: 1, ended: 2, terminated: 3 }
        withEffective.sort((a, b) => {
          const pa = priority[a.effectiveStatus] ?? 99
          const pb = priority[b.effectiveStatus] ?? 99
          if (pa !== pb) return pa - pb
          // Same priority — most recent start_date wins
          return new Date(b.start_date).getTime() - new Date(a.start_date).getTime()
        })

        const best = withEffective[0] ?? null

        return {
          ...row,
          contract_status: best?.effectiveStatus ?? null,
        }
      })

      return { rows: clients, count: count ?? 0 }
    },
  })

  return {
    data: data?.rows ?? [],
    count: data?.count ?? 0,
    isLoading,
    error: error as Error | null,
  }
}

// ---------------------------------------------------------------------------
// useCreateClient
// ---------------------------------------------------------------------------

export function useCreateClient() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CreateClientInput) => {
      const { data, error } = await supabase
        .from('clients')
        .insert({
          id: generateUUID(),
          name: input.name,
          phone: input.phone,
          email: input.email ?? null,
          location_text: input.location_text,
          gps_lat: input.gps_lat,
          gps_lng: input.gps_lng,
          service_frequency: input.service_frequency,
          monthly_rate: input.monthly_rate,
          zone: input.zone ?? null,
          division_office: input.division_office ?? null,
          notes: input.notes ?? null,
          created_at: new Date().toISOString(),
        })
        .select()
        .single()

      if (error) throw new Error(error.message)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
    },
  })
}

// ---------------------------------------------------------------------------
// useUpdateClient
// ---------------------------------------------------------------------------

export function useUpdateClient() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      input,
      userId,
    }: {
      input: UpdateClientInput
      userId: string
    }) => {
      const updatedData = {
        name: input.name,
        phone: input.phone,
        email: input.email ?? null,
        location_text: input.location_text,
        gps_lat: input.gps_lat,
        gps_lng: input.gps_lng,
        service_frequency: input.service_frequency,
        monthly_rate: input.monthly_rate,
        zone: input.zone ?? null,
        division_office: input.division_office ?? null,
        notes: input.notes ?? null,
      }

      const { data, error } = await supabase
        .from('clients')
        .update(updatedData)
        .eq('id', input.id)
        .select()
        .single()

      if (error) throw new Error(error.message)

      // Log change to audit_log
      await supabase.from('audit_log').insert({
        id: generateUUID(),
        user_id: userId,
        event_type: 'client_updated',
        table_name: 'clients',
        record_id: input.id,
        new_data: updatedData,
        created_at: new Date().toISOString(),
      })

      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
    },
  })
}

// ---------------------------------------------------------------------------
// useMarkClientInactive — soft-delete: sets is_active = false
// ---------------------------------------------------------------------------

export function useMarkClientInactive() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (clientId: string) => {
      const { error } = await supabase
        .from('clients')
        .update({ is_active: false })
        .eq('id', clientId)

      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
    },
  })
}

// ---------------------------------------------------------------------------
// useMarkClientActive — restore: sets is_active = true
// ---------------------------------------------------------------------------

export function useMarkClientActive() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (clientId: string) => {
      const { error } = await supabase
        .from('clients')
        .update({ is_active: true })
        .eq('id', clientId)

      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
    },
  })
}
