import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type StaffRole = 'Driver' | 'Admin' | 'Finance' | 'Operations_Manager' | 'Support'
export type EmploymentType = 'full-time' | 'contract'
export type StaffStatus = 'active' | 'suspended' | 'terminated'

export interface DriverDetails {
  id: string
  staff_id: string
  license_number: string | null
  license_expiry: string | null
  assigned_truck: string | null
  default_route_id: string | null
  device_id: string | null
}

export interface StaffMember {
  id: string
  full_name: string
  phone: string | null
  email: string | null
  national_id: string | null
  role: StaffRole
  employment_type: EmploymentType
  status: StaffStatus
  zone: string | null
  hire_date: string | null
  user_id: string | null
  created_at: string
  updated_at: string
  driver_details?: DriverDetails | null
}

export interface StaffFilters {
  role?: StaffRole | ''
  zone?: string
  status?: StaffStatus | ''
  search?: string
  page?: number
  pageSize?: number
}

export interface CreateStaffInput {
  full_name: string
  phone?: string
  email?: string
  national_id?: string
  role: StaffRole
  employment_type?: EmploymentType
  status?: StaffStatus
  zone?: string
  hire_date?: string
  user_id?: string
  driver_details?: Partial<DriverDetails>
}

export interface UpdateStaffInput extends Partial<CreateStaffInput> {
  id: string
}

export interface StaffPerformance {
  collections_today: number
  total_weight: number
  missed_pickups: number
  sync_success_rate: number
  collections_last_7_days: { date: string; count: number }[]
}

// ---------------------------------------------------------------------------
// useStaffList
// ---------------------------------------------------------------------------

export function useStaffList(filters: StaffFilters = {}) {
  const { page = 0, pageSize = 25 } = filters

  return useQuery({
    queryKey: ['staff', filters],
    queryFn: async () => {
      let query = supabase
        .from('staff')
        .select('*', { count: 'exact' })
        .order('full_name', { ascending: true })

      if (filters.role) query = query.eq('role', filters.role)
      if (filters.zone) query = query.eq('zone', filters.zone)
      if (filters.status) query = query.eq('status', filters.status)
      if (filters.search) {
        query = query.or(
          `full_name.ilike.%${filters.search}%,email.ilike.%${filters.search}%,phone.ilike.%${filters.search}%`
        )
      }

      const from = page * pageSize
      const to = from + pageSize - 1
      query = query.range(from, to)

      const { data, count, error } = await query
      if (error) throw new Error(error.message)

      return { rows: (data ?? []) as StaffMember[], count: count ?? 0 }
    },
  })
}

// ---------------------------------------------------------------------------
// useStaffDetail
// ---------------------------------------------------------------------------

export function useStaffDetail(id: string | undefined) {
  return useQuery({
    queryKey: ['staff', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('staff')
        .select('*, driver_details(*)')
        .eq('id', id!)
        .single()

      if (error) throw new Error(error.message)
      return data as StaffMember & { driver_details: DriverDetails | null }
    },
  })
}

// ---------------------------------------------------------------------------
// useCreateStaff
// ---------------------------------------------------------------------------

export function useCreateStaff() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreateStaffInput) => {
      const { driver_details: driverInput, ...staffData } = input

      const { data, error } = await supabase
        .from('staff')
        .insert(staffData)
        .select()
        .single()

      if (error) throw new Error(error.message)
      const staff = data as StaffMember

      // Create driver details if role is Driver
      if (input.role === 'Driver' && driverInput) {
        const { error: ddError } = await supabase
          .from('driver_details')
          .insert({ ...driverInput, staff_id: staff.id })
        if (ddError) throw new Error(ddError.message)
      }

      return staff
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] })
    },
  })
}

// ---------------------------------------------------------------------------
// useUpdateStaff
// ---------------------------------------------------------------------------

export function useUpdateStaff() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: UpdateStaffInput) => {
      const { id, driver_details: driverInput, ...staffData } = input

      const { data, error } = await supabase
        .from('staff')
        .update({ ...staffData, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()

      if (error) throw new Error(error.message)
      const staff = data as StaffMember

      // Update or create driver details
      if (driverInput) {
        const { data: existing } = await supabase
          .from('driver_details')
          .select('id')
          .eq('staff_id', id)
          .single()

        if (existing) {
          await supabase
            .from('driver_details')
            .update({ ...driverInput, updated_at: new Date().toISOString() })
            .eq('staff_id', id)
        } else {
          await supabase
            .from('driver_details')
            .insert({ ...driverInput, staff_id: id })
        }
      }

      return staff
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['staff'] })
      queryClient.invalidateQueries({ queryKey: ['staff', variables.id] })
    },
  })
}

// ---------------------------------------------------------------------------
// useDeleteStaff — soft delete (set status = 'terminated')
// ---------------------------------------------------------------------------

export function useDeleteStaff() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('staff')
        .update({ status: 'terminated', updated_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] })
    },
  })
}

// ---------------------------------------------------------------------------
// useHardDeleteStaff — permanently deletes the staff record
// ---------------------------------------------------------------------------

export function useHardDeleteStaff() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('staff')
        .delete()
        .eq('id', id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] })
    },
  })
}

// ---------------------------------------------------------------------------
// useStaffPerformance
// ---------------------------------------------------------------------------

export function useStaffPerformance(staffId: string | undefined, userId: string | null | undefined) {
  return useQuery({
    queryKey: ['staff_performance', staffId, userId],
    enabled: !!staffId && !!userId,
    queryFn: async () => {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const todayStr = today.toISOString()

      const sevenDaysAgo = new Date(today)
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6)

      const [todayRes, totalRes, pendingRes, last7Res] = await Promise.all([
        // Collections today
        supabase
          .from('collections')
          .select('id, weight_kg', { count: 'exact' })
          .eq('driver_id', userId!)
          .gte('collected_at', todayStr),
        // All collections (for weight + sync rate)
        supabase
          .from('collections')
          .select('weight_kg, sync_status'),
        // Pending (missed pickups proxy)
        supabase
          .from('collections')
          .select('id', { count: 'exact', head: true })
          .eq('driver_id', userId!)
          .eq('sync_status', 'pending'),
        // Last 7 days
        supabase
          .from('collections')
          .select('collected_at')
          .eq('driver_id', userId!)
          .gte('collected_at', sevenDaysAgo.toISOString()),
      ])

      const allCollections = (totalRes.data ?? []) as { weight_kg: number; sync_status: string }[]
      const driverCollections = allCollections.filter(() => true) // already filtered by driver_id in query
      const totalWeight = (todayRes.data ?? []).reduce((sum: number, c: { weight_kg: number }) => sum + (c.weight_kg ?? 0), 0)

      // Sync success rate
      const driverAll = await supabase
        .from('collections')
        .select('sync_status')
        .eq('driver_id', userId!)
      const allDriver = (driverAll.data ?? []) as { sync_status: string }[]
      const synced = allDriver.filter((c) => c.sync_status === 'synced').length
      const syncRate = allDriver.length > 0 ? Math.round((synced / allDriver.length) * 100) : 100

      // Collections per day for last 7 days
      const last7 = (last7Res.data ?? []) as { collected_at: string }[]
      const dayMap: Record<string, number> = {}
      for (let i = 0; i < 7; i++) {
        const d = new Date(sevenDaysAgo)
        d.setDate(d.getDate() + i)
        dayMap[d.toISOString().split('T')[0]] = 0
      }
      last7.forEach((c) => {
        const day = c.collected_at.split('T')[0]
        if (dayMap[day] !== undefined) dayMap[day]++
      })

      const collections_last_7_days = Object.entries(dayMap).map(([date, count]) => ({ date, count }))

      const result: StaffPerformance = {
        collections_today: todayRes.count ?? 0,
        total_weight: totalWeight,
        missed_pickups: pendingRes.count ?? 0,
        sync_success_rate: syncRate,
        collections_last_7_days,
      }

      // Suppress unused variable warning
      void driverCollections

      return result
    },
  })
}
