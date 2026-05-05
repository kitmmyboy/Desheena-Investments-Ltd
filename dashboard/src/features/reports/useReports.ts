import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MonthlyFinancialRow {
  month: string        // "YYYY-MM"
  label: string        // "Jan 2025"
  totalInvoiced: number
  totalCollected: number
  outstanding: number
}

export interface FinancialSummary {
  totalOutstanding: number
  defaulterCount: number
  monthlyRows: MonthlyFinancialRow[]
}

export interface DriverPerformanceRow {
  driver_id: string
  driver_name: string
  collections_count: number
  total_weight_kg: number
  routes_completed: number
}

export interface CollectionReportRow {
  id: string
  client_name: string
  driver_name: string
  waste_type: string
  weight_kg: number | null
  collected_at: string
  zone: string
  sync_status: string
  route_name: string
}

export interface CollectionsReportFilters {
  dateFrom?: string
  dateTo?: string
  driverId?: string
  routeId?: string
  zone?: string
}

// ---------------------------------------------------------------------------
// useFinancialReport
// ---------------------------------------------------------------------------

export function useFinancialReport() {
  return useQuery({
    queryKey: ['reports', 'financial'],
    queryFn: async (): Promise<FinancialSummary> => {
      // Fetch all invoices (no pagination — aggregate data)
      const { data: invoices, error: invError } = await supabase
        .from('invoices')
        .select('amount, status, invoice_period, created_at')
        .order('invoice_period', { ascending: true })

      if (invError) throw new Error(invError.message)

      // Fetch all payments
      const { data: payments, error: payError } = await supabase
        .from('payments')
        .select('amount, paid_at, status')
        .eq('status', 'completed')

      if (payError) throw new Error(payError.message)

      // Build last 12 months list
      const now = new Date()
      const months: string[] = []
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        months.push(key)
      }

      // Aggregate invoiced per month (use invoice_period if available, else created_at)
      const invoicedByMonth = new Map<string, number>()
      for (const inv of invoices ?? []) {
        const period = inv.invoice_period ?? inv.created_at?.slice(0, 7)
        if (!period) continue
        const key = period.slice(0, 7)
        invoicedByMonth.set(key, (invoicedByMonth.get(key) ?? 0) + (inv.amount ?? 0))
      }

      // Aggregate collected per month (use paid_at)
      const collectedByMonth = new Map<string, number>()
      for (const pay of payments ?? []) {
        if (!pay.paid_at) continue
        const key = pay.paid_at.slice(0, 7)
        collectedByMonth.set(key, (collectedByMonth.get(key) ?? 0) + (pay.amount ?? 0))
      }

      // Build monthly rows for last 12 months
      const monthlyRows: MonthlyFinancialRow[] = months.map((month) => {
        const totalInvoiced = invoicedByMonth.get(month) ?? 0
        const totalCollected = collectedByMonth.get(month) ?? 0
        const outstanding = Math.max(0, totalInvoiced - totalCollected)

        // Format label: "Jan 2025"
        const [year, mon] = month.split('-')
        const label = new Date(Number(year), Number(mon) - 1, 1).toLocaleDateString('en-UG', {
          year: 'numeric',
          month: 'short',
        })

        return { month, label, totalInvoiced, totalCollected, outstanding }
      })

      // Summary: total outstanding balance (unpaid + overdue invoices)
      const totalOutstanding = (invoices ?? [])
        .filter((inv) => inv.status === 'unpaid' || inv.status === 'overdue')
        .reduce((sum, inv) => sum + (inv.amount ?? 0), 0)

      // Defaulter count: distinct clients with overdue invoices
      const { data: overdue, error: odError } = await supabase
        .from('invoices')
        .select('client_id')
        .eq('status', 'overdue')

      if (odError) throw new Error(odError.message)

      const defaulterCount = new Set((overdue ?? []).map((r) => r.client_id)).size

      return { totalOutstanding, defaulterCount, monthlyRows }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

// ---------------------------------------------------------------------------
// useDriverPerformanceReport
// ---------------------------------------------------------------------------

export function useDriverPerformanceReport(dateFrom?: string, dateTo?: string) {
  return useQuery({
    queryKey: ['reports', 'driver-performance', dateFrom, dateTo],
    queryFn: async (): Promise<DriverPerformanceRow[]> => {
      // Fetch collections with driver info, filtered by date range
      let query = supabase
        .from('collections')
        .select('driver_id, weight_kg, collected_at, users(full_name, email)')

      if (dateFrom) {
        query = query.gte('collected_at', `${dateFrom}T00:00:00`)
      }
      if (dateTo) {
        query = query.lte('collected_at', `${dateTo}T23:59:59`)
      }

      const { data: collections, error: colError } = await query

      if (colError) throw new Error(colError.message)

      // Fetch route_drivers to count routes per driver
      const { data: routeDrivers, error: rdError } = await supabase
        .from('route_drivers')
        .select('driver_id, route_id')

      if (rdError) throw new Error(rdError.message)

      // Count routes per driver
      const routesByDriver = new Map<string, Set<string>>()
      for (const rd of routeDrivers ?? []) {
        if (!routesByDriver.has(rd.driver_id)) {
          routesByDriver.set(rd.driver_id, new Set())
        }
        routesByDriver.get(rd.driver_id)!.add(rd.route_id)
      }

      // Aggregate by driver
      const driverMap = new Map<
        string,
        { driver_name: string; collections_count: number; total_weight_kg: number }
      >()

      for (const col of collections ?? []) {
        const userData = col.users as { full_name?: string; email?: string } | null
        const name = userData?.full_name ?? userData?.email ?? 'Unknown'
        const existing = driverMap.get(col.driver_id)
        if (existing) {
          existing.collections_count += 1
          existing.total_weight_kg += col.weight_kg ?? 0
        } else {
          driverMap.set(col.driver_id, {
            driver_name: name,
            collections_count: 1,
            total_weight_kg: col.weight_kg ?? 0,
          })
        }
      }

      return Array.from(driverMap.entries()).map(([driver_id, stats]) => ({
        driver_id,
        driver_name: stats.driver_name,
        collections_count: stats.collections_count,
        total_weight_kg: Math.round(stats.total_weight_kg * 10) / 10,
        routes_completed: routesByDriver.get(driver_id)?.size ?? 0,
      }))
    },
    staleTime: 5 * 60 * 1000,
  })
}

// ---------------------------------------------------------------------------
// useCollectionsReport
// ---------------------------------------------------------------------------

export function useCollectionsReport(filters: CollectionsReportFilters) {
  return useQuery({
    queryKey: ['reports', 'collections', filters],
    queryFn: async (): Promise<CollectionReportRow[]> => {
      let query = supabase
        .from('collections')
        .select(
          `id, waste_type, weight_kg, collected_at, sync_status,
           clients(name, zone),
           users(full_name, email),
           routes(id, name)`
        )
        .order('collected_at', { ascending: false })
        .limit(1000)

      if (filters.dateFrom) {
        query = query.gte('collected_at', `${filters.dateFrom}T00:00:00`)
      }
      if (filters.dateTo) {
        query = query.lte('collected_at', `${filters.dateTo}T23:59:59`)
      }
      if (filters.driverId) {
        query = query.eq('driver_id', filters.driverId)
      }
      if (filters.zone) {
        query = query.eq('clients.zone', filters.zone)
      }

      const { data, error } = await query

      if (error) {
        throw new Error(error.message)
      }

      return (data ?? []).map((row: any) => {
        const clientData = row.clients as { name?: string; zone?: string } | null
        const userData = row.users as { full_name?: string; email?: string } | null
        const routeData = row.routes as { name?: string } | null

        return {
          id: row.id,
          client_name: clientData?.name ?? '—',
          driver_name: userData?.full_name ?? userData?.email ?? '—',
          waste_type: row.waste_type ?? '—',
          weight_kg: row.weight_kg,
          collected_at: row.collected_at,
          zone: clientData?.zone ?? '—',
          sync_status: row.sync_status ?? '—',
          route_name: routeData?.name ?? '—',
        }
      })
    },
    staleTime: 2 * 60 * 1000,
  })
}

// ---------------------------------------------------------------------------
// useDriverList — for filter dropdowns
// ---------------------------------------------------------------------------

export function useDriverList() {
  return useQuery({
    queryKey: ['reports', 'driver-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select('id, full_name, email')
        .eq('role', 'Driver')
        .order('full_name')

      if (error) throw new Error(error.message)
      return (data ?? []) as { id: string; full_name: string | null; email: string }[]
    },
    staleTime: 10 * 60 * 1000,
  })
}

// ---------------------------------------------------------------------------
// useRouteList — for filter dropdowns
// ---------------------------------------------------------------------------

export function useRouteList() {
  return useQuery({
    queryKey: ['reports', 'route-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('routes')
        .select('id, name, zone')
        .order('name')

      if (error) throw new Error(error.message)
      return (data ?? []) as { id: string; name: string; zone: string | null }[]
    },
    staleTime: 10 * 60 * 1000,
  })
}

// ---------------------------------------------------------------------------
// useZoneList — distinct zones from clients
// ---------------------------------------------------------------------------

export function useZoneList() {
  return useQuery({
    queryKey: ['reports', 'zone-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('zone')
        .not('zone', 'is', null)
        .order('zone')

      if (error) throw new Error(error.message)

      const zones = [...new Set((data ?? []).map((r) => r.zone).filter(Boolean))] as string[]
      return zones
    },
    staleTime: 10 * 60 * 1000,
  })
}
