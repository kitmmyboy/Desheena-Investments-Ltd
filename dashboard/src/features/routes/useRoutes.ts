import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'

function generateUUID(): string {
  return crypto.randomUUID()
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RouteDriver {
  id: string
  route_id: string
  driver_id: string
  users: { email: string } | null
}

export interface RouteClient {
  id: string
  route_id: string
  client_id: string
  sequence_order: number | null
  clients: {
    id: string
    name: string
    location_text: string
    gps_lat: number
    gps_lng: number
    zone: string | null
    service_frequency: string
  } | null
}

export interface Route {
  id: string
  name: string
  zone: string | null
  created_at: string
  route_drivers: RouteDriver[]
  route_clients: { id: string }[]
}

export interface RouteDetail {
  id: string
  name: string
  zone: string | null
  created_at: string
  route_clients: RouteClient[]
  route_drivers: RouteDriver[]
}

export interface CreateRouteInput {
  name: string
  zone?: string
}

export interface AssignClientInput {
  routeId: string
  clientId: string
  sequenceOrder?: number
}

export interface AssignDriverInput {
  routeId: string
  driverId: string
}

export interface RemoveClientInput {
  routeClientId: string
}

// ---------------------------------------------------------------------------
// useRoutes — fetches all routes with assigned driver and client count
// ---------------------------------------------------------------------------

export function useRoutes() {
  return useQuery<Route[]>({
    queryKey: ['routes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('routes')
        .select('*, route_drivers(id, route_id, driver_id, users(email)), route_clients(id)', {
          count: 'exact',
        })
        .order('name', { ascending: true })

      if (error) throw new Error(error.message)
      return (data ?? []) as Route[]
    },
    staleTime: 2 * 60 * 1000,
  })
}

// ---------------------------------------------------------------------------
// useRouteDetail — fetches a single route with its clients and assigned driver
// ---------------------------------------------------------------------------

export function useRouteDetail(routeId: string | undefined) {
  return useQuery<RouteDetail>({
    queryKey: ['routes', routeId],
    queryFn: async () => {
      if (!routeId) throw new Error('Route ID is required')

      const { data, error } = await supabase
        .from('routes')
        .select(
          '*, route_clients(id, route_id, client_id, sequence_order, clients(id, name, location_text, gps_lat, gps_lng, zone, service_frequency)), route_drivers(id, route_id, driver_id, users(email))'
        )
        .eq('id', routeId)
        .single()

      if (error) throw new Error(error.message)
      return data as RouteDetail
    },
    enabled: !!routeId,
    staleTime: 2 * 60 * 1000,
  })
}

// ---------------------------------------------------------------------------
// useCreateRoute — mutation to create a new route
// ---------------------------------------------------------------------------

export function useCreateRoute() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CreateRouteInput) => {
      const { data, error } = await supabase
        .from('routes')
        .insert({
          id: generateUUID(),
          name: input.name,
          zone: input.zone ?? null,
          created_at: new Date().toISOString(),
        })
        .select()
        .single()

      if (error) throw new Error(error.message)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['routes'] })
    },
  })
}

// ---------------------------------------------------------------------------
// useAssignClientToRoute — mutation to create a route_clients record
// ---------------------------------------------------------------------------

export function useAssignClientToRoute() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: AssignClientInput) => {
      const { data, error } = await supabase
        .from('route_clients')
        .insert({
          id: generateUUID(),
          route_id: input.routeId,
          client_id: input.clientId,
          sequence_order: input.sequenceOrder ?? null,
        })
        .select()
        .single()

      if (error) throw new Error(error.message)
      return data
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['routes', variables.routeId] })
      queryClient.invalidateQueries({ queryKey: ['routes'] })
    },
  })
}

// ---------------------------------------------------------------------------
// useAssignDriverToRoute — mutation to create a route_drivers record
// ---------------------------------------------------------------------------

export function useAssignDriverToRoute() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: AssignDriverInput) => {
      const { data, error } = await supabase
        .from('route_drivers')
        .insert({
          id: generateUUID(),
          route_id: input.routeId,
          driver_id: input.driverId,
        })
        .select()
        .single()

      if (error) throw new Error(error.message)
      return data
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['routes', variables.routeId] })
      queryClient.invalidateQueries({ queryKey: ['routes'] })
    },
  })
}

// ---------------------------------------------------------------------------
// useRemoveClientFromRoute — mutation to delete a route_clients record
// ---------------------------------------------------------------------------

export function useRemoveClientFromRoute() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ routeClientId }: RemoveClientInput & { routeId: string }) => {
      const { error } = await supabase
        .from('route_clients')
        .delete()
        .eq('id', routeClientId)

      if (error) throw new Error(error.message)
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['routes', variables.routeId] })
      queryClient.invalidateQueries({ queryKey: ['routes'] })
    },
  })
}
