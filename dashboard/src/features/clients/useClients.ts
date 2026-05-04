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
}: ClientsFilters = {}): UseClientsResult {
  const queryKey = ['clients', { page, pageSize, search, zone, serviceFrequency, contractStatus }]

  const { data, isLoading, error } = useQuery({
    queryKey,
    queryFn: async () => {
      let query = supabase
        .from('clients')
        .select('*, contracts(status)', { count: 'exact' })

      // Search by name or phone
      if (search && search.trim() !== '') {
        const term = search.trim()
        query = query.or(`name.ilike.%${term}%,phone.ilike.%${term}%`)
      }

      // Zone filter
      if (zone && zone !== 'all') {
        query = query.eq('zone', zone)
      }

      // Service frequency filter
      if (serviceFrequency && serviceFrequency !== 'all') {
        query = query.ilike('service_frequency', `%${serviceFrequency}%`)
      }

      // Sorting
      query = query.order('name', { ascending: true })

      // Pagination
      const from = page * pageSize
      const to = from + pageSize - 1
      query = query.range(from, to)

      const { data: rows, count, error: queryError } = await query

      if (queryError) throw new Error(queryError.message)

      // Flatten contract status
      const clients: ClientWithContractStatus[] = (rows ?? []).map((row: Client) => {
        const latestContract = row.contracts?.[0] ?? null
        return {
          ...row,
          contract_status: latestContract?.status ?? null,
        }
      })

      // Client-side filter by contract status (since it comes from a join)
      const filtered =
        contractStatus && contractStatus !== 'all'
          ? clients.filter((c) => c.contract_status === contractStatus)
          : clients

      return { rows: filtered, count: count ?? 0 }
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
