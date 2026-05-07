import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'

// ---------------------------------------------------------------------------
// Service frequency helpers — DB stores numeric values
// ---------------------------------------------------------------------------

export const SERVICE_FREQUENCY_OPTIONS: { value: string; label: string }[] = [
  { value: '1', label: 'Weekly' },
  { value: '2', label: 'Twice per week' },
  { value: '3', label: 'Three times per week' },
  { value: '4', label: 'Monthly' },
  { value: '7', label: 'Daily' },
]

export function serviceFrequencyLabel(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  const match = SERVICE_FREQUENCY_OPTIONS.find((o) => o.value === String(value))
  return match ? match.label : String(value)
}

// ---------------------------------------------------------------------------
// useZones — distinct zone values from the DB
// ---------------------------------------------------------------------------

export function useZones() {
  return useQuery({
    queryKey: ['clients-zones'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('zone')
        .not('zone', 'is', null)
        .order('zone', { ascending: true })

      if (error) throw new Error(error.message)

      const unique = Array.from(new Set((data ?? []).map((r: { zone: string }) => r.zone as string).filter(Boolean)))
      unique.sort((a, b) => a.localeCompare(b))
      return unique
    },
    staleTime: 5 * 60 * 1000, // cache for 5 min
  })
}

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
  /** 'active' | 'inactive' | 'all' — defaults to 'active' */
  activeStatus?: 'active' | 'inactive' | 'all'
  /** @deprecated use activeStatus instead */
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
  activeStatus = 'active',
  showInactive, // legacy compat
}: ClientsFilters = {}): UseClientsResult {
  // Resolve legacy showInactive prop
  const resolvedActiveStatus: 'active' | 'inactive' | 'all' =
    activeStatus !== 'active'
      ? activeStatus
      : showInactive
      ? 'all'
      : 'active'

  const queryKey = ['clients', { page, pageSize, search, zone, serviceFrequency, contractStatus, resolvedActiveStatus }]

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

      // Active status filter
      if (resolvedActiveStatus === 'active') {
        query = query.eq('is_active', true)
      } else if (resolvedActiveStatus === 'inactive') {
        query = query.eq('is_active', false)
      }
      // 'all' — no filter applied

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

      // Zone filter — exact match (zones are stored as proper-cased strings)
      if (zone && zone !== 'all') {
        query = query.eq('zone', zone)
      }

      // Service frequency filter — DB stores numeric strings ('1','2','3','4','7')
      if (serviceFrequency && serviceFrequency !== 'all') {
        query = query.eq('service_frequency', serviceFrequency)
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
