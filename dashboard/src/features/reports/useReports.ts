import { useQuery } from "@tanstack/react-query"
import { supabase } from "../../lib/supabase"
import {
  computeContractMonths,
  computeExpectedTotal,
  computeOutstandingBalance,
} from "../billing/contractCalculations"

export interface MonthlyFinancialRow {
  month: string
  label: string
  totalInvoiced: number
  totalCollected: number
  outstanding: number
}

export interface FinancialSummary {
  totalOutstanding: number
  totalCollected: number
  totalInvoiced: number
  defaulterCount: number
  paidCount: number
  unpaidCount: number
  overdueCount: number
  monthlyRows: MonthlyFinancialRow[]
}

export interface FinancialFilters {
  dateFrom?: string
  dateTo?: string
  zone?: string
  status?: "all" | "paid" | "unpaid" | "overdue"
}

export interface DefaulterRow {
  client_id: string
  client_name: string
  client_phone: string
  zone: string | null
  total_invoiced: number
  total_paid: number
  outstanding: number
  invoice_count: number
  overdue_count: number
  last_invoice_period: string | null
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

export function useFinancialReport(filters: FinancialFilters = {}) {
  return useQuery({
    queryKey: ["reports", "financial", filters],
    queryFn: async (): Promise<FinancialSummary> => {
      let invQuery = supabase
        .from("invoices")
        .select("amount, paid_amount, status, invoice_period, client_id, clients(zone)")
        .order("invoice_period", { ascending: true })

      if (filters.dateFrom) invQuery = invQuery.gte("invoice_period", filters.dateFrom)
      if (filters.dateTo) invQuery = invQuery.lte("invoice_period", filters.dateTo)
      if (filters.status && filters.status !== "all") invQuery = invQuery.eq("status", filters.status)

      const { data: invoices, error: invError } = await invQuery
      if (invError) throw new Error(invError.message)

      const filtered = filters.zone
        ? (invoices ?? []).filter((inv) => { const c = inv.clients as { zone?: string } | null; return c?.zone === filters.zone })
        : (invoices ?? [])

      const now = new Date()
      const months: string[] = []
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
        months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`)
      }

      const invoicedByMonth = new Map<string, number>()
      const collectedByMonth = new Map<string, number>()

      for (const inv of filtered) {
        const key = (inv.invoice_period ?? "").slice(0, 7)
        if (!key) continue
        invoicedByMonth.set(key, (invoicedByMonth.get(key) ?? 0) + Number(inv.amount ?? 0))
        collectedByMonth.set(key, (collectedByMonth.get(key) ?? 0) + Number(inv.paid_amount ?? 0))
      }

      const monthlyRows: MonthlyFinancialRow[] = months.map((month) => {
        const totalInvoiced = invoicedByMonth.get(month) ?? 0
        const totalCollected = collectedByMonth.get(month) ?? 0
        const outstanding = Math.max(0, totalInvoiced - totalCollected)
        const [year, mon] = month.split("-")
        const label = new Date(Number(year), Number(mon) - 1, 1).toLocaleDateString("en-UG", { year: "numeric", month: "short" })
        return { month, label, totalInvoiced, totalCollected, outstanding }
      })

      const totalInvoiced = filtered.reduce((s, i) => s + Number(i.amount ?? 0), 0)
      const totalCollected = filtered.reduce((s, i) => s + Number(i.paid_amount ?? 0), 0)
      const totalOutstanding = Math.max(0, totalInvoiced - totalCollected)
      const paidCount = filtered.filter((i) => i.status === "paid").length
      const unpaidCount = filtered.filter((i) => i.status === "unpaid").length
      const overdueCount = filtered.filter((i) => i.status === "overdue").length
      const defaulterSet = new Set(filtered.filter((i) => i.status === "unpaid" || i.status === "overdue").map((i) => i.client_id))

      return { totalOutstanding, totalCollected, totalInvoiced, defaulterCount: defaulterSet.size, paidCount, unpaidCount, overdueCount, monthlyRows: [...monthlyRows].reverse() }
    },
    staleTime: 5 * 60 * 1000,
  })
}

// ---------------------------------------------------------------------------
// useDefaultersReport — uses contract-based calculation (same as Billing tab)
// Computes expected total from start_date to today, compares against paid invoices
// ---------------------------------------------------------------------------

export function useDefaultersReport(filters: { zone?: string; minOutstanding?: number } = {}) {
  return useQuery({
    queryKey: ["reports", "defaulters", filters],
    queryFn: async (): Promise<DefaulterRow[]> => {
      // Fetch all contracts with client info
      const { data: contracts, error: contractsError } = await supabase
        .from("contracts")
        .select("id, client_id, monthly_rate, start_date, end_date, status, clients(name, phone, zone)")

      if (contractsError) throw new Error(contractsError.message)

      // Fetch all invoices for paid amount calculation
      const { data: invoices, error: invoicesError } = await supabase
        .from("invoices")
        .select("contract_id, invoice_period, paid_amount")

      if (invoicesError) throw new Error(invoicesError.message)

      const defaulters: DefaulterRow[] = []

      for (const contract of contracts ?? []) {
        const monthlyRate = Number(contract.monthly_rate ?? 0)
        if (!monthlyRate) continue

        const c = contract.clients as { name?: string; phone?: string; zone?: string } | null
        const zone = c?.zone ?? null

        // Zone filter
        if (filters.zone && zone !== filters.zone) continue

        // Compute expected months and total
        const contractMonths = computeContractMonths(contract.start_date, contract.end_date)
        const expectedTotal = computeExpectedTotal(contractMonths, monthlyRate)

        // Sum paid amounts from invoices for this contract
        const contractInvoices = (invoices ?? []).filter((inv) => inv.contract_id === contract.id)
        const amountPaid = contractInvoices.reduce((sum, inv) => sum + Number(inv.paid_amount ?? 0), 0)

        const outstanding = computeOutstandingBalance(expectedTotal, amountPaid)

        const minOutstanding = filters.minOutstanding ?? 1
        if (outstanding < minOutstanding) continue

        // Find last invoice period
        const lastPeriod = contractInvoices.length > 0
          ? contractInvoices.reduce((latest, inv) => {
              if (!latest) return inv.invoice_period
              return (inv.invoice_period ?? "") > latest ? inv.invoice_period : latest
            }, null as string | null)
          : null

        // Count overdue invoices (no invoice for a month = overdue)
        const overdueCount = Math.max(0, contractMonths.length - contractInvoices.length)

        defaulters.push({
          client_id: contract.client_id,
          client_name: c?.name ?? "Unknown",
          client_phone: c?.phone ?? "—",
          zone,
          total_invoiced: expectedTotal,
          total_paid: amountPaid,
          outstanding,
          invoice_count: contractInvoices.length,
          overdue_count: overdueCount,
          last_invoice_period: lastPeriod,
        })
      }

      return defaulters.sort((a, b) => b.outstanding - a.outstanding)
    },
    staleTime: 5 * 60 * 1000,
  })
}

export function useDriverPerformanceReport(dateFrom?: string, dateTo?: string) {
  return useQuery({
    queryKey: ["reports", "driver-performance", dateFrom, dateTo],
    queryFn: async (): Promise<DriverPerformanceRow[]> => {
      let query = supabase.from("collections").select("driver_id, weight_kg, collected_at, users(full_name, email)")
      if (dateFrom) query = query.gte("collected_at", `${dateFrom}T00:00:00`)
      if (dateTo) query = query.lte("collected_at", `${dateTo}T23:59:59`)
      const { data: collections, error: colError } = await query
      if (colError) throw new Error(colError.message)
      const { data: routeDrivers, error: rdError } = await supabase.from("route_drivers").select("driver_id, route_id")
      if (rdError) throw new Error(rdError.message)
      const routesByDriver = new Map<string, Set<string>>()
      for (const rd of routeDrivers ?? []) {
        if (!routesByDriver.has(rd.driver_id)) routesByDriver.set(rd.driver_id, new Set())
        routesByDriver.get(rd.driver_id)!.add(rd.route_id)
      }
      const driverMap = new Map<string, { driver_name: string; collections_count: number; total_weight_kg: number }>()
      for (const col of collections ?? []) {
        const userData = col.users as { full_name?: string; email?: string } | null
        const name = userData?.full_name ?? userData?.email ?? "Unknown"
        const existing = driverMap.get(col.driver_id)
        if (existing) { existing.collections_count += 1; existing.total_weight_kg += col.weight_kg ?? 0 }
        else driverMap.set(col.driver_id, { driver_name: name, collections_count: 1, total_weight_kg: col.weight_kg ?? 0 })
      }
      return Array.from(driverMap.entries()).map(([driver_id, stats]) => ({ driver_id, driver_name: stats.driver_name, collections_count: stats.collections_count, total_weight_kg: Math.round(stats.total_weight_kg * 10) / 10, routes_completed: routesByDriver.get(driver_id)?.size ?? 0 }))
    },
    staleTime: 5 * 60 * 1000,
  })
}

export function useCollectionsReport(filters: CollectionsReportFilters) {
  return useQuery({
    queryKey: ["reports", "collections", filters],
    queryFn: async (): Promise<CollectionReportRow[]> => {
      let query = supabase.from("collections").select("id, waste_type, weight_kg, collected_at, sync_status, clients(name, zone), users(full_name, email), routes(id, name)").order("collected_at", { ascending: false }).limit(1000)
      if (filters.dateFrom) query = query.gte("collected_at", `${filters.dateFrom}T00:00:00`)
      if (filters.dateTo) query = query.lte("collected_at", `${filters.dateTo}T23:59:59`)
      if (filters.driverId) query = query.eq("driver_id", filters.driverId)
      if (filters.zone) query = query.eq("clients.zone", filters.zone)
      const { data, error } = await query
      if (error) throw new Error(error.message)
      return (data ?? []).map((row: any) => {
        const clientData = row.clients as { name?: string; zone?: string } | null
        const userData = row.users as { full_name?: string; email?: string } | null
        const routeData = row.routes as { name?: string } | null
        return { id: row.id, client_name: clientData?.name ?? "—", driver_name: userData?.full_name ?? userData?.email ?? "—", waste_type: row.waste_type ?? "—", weight_kg: row.weight_kg, collected_at: row.collected_at, zone: clientData?.zone ?? "—", sync_status: row.sync_status ?? "—", route_name: routeData?.name ?? "—" }
      })
    },
    staleTime: 2 * 60 * 1000,
  })
}

export function useDriverList() {
  return useQuery({
    queryKey: ["reports", "driver-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("users").select("id, full_name, email").eq("role", "Driver").order("full_name")
      if (error) throw new Error(error.message)
      return (data ?? []) as { id: string; full_name: string | null; email: string }[]
    },
    staleTime: 10 * 60 * 1000,
  })
}

export function useRouteList() {
  return useQuery({
    queryKey: ["reports", "route-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("routes").select("id, name, zone").order("name")
      if (error) throw new Error(error.message)
      return (data ?? []) as { id: string; name: string; zone: string | null }[]
    },
    staleTime: 10 * 60 * 1000,
  })
}

export function useZoneList() {
  return useQuery({
    queryKey: ["reports", "zone-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("zone").not("zone", "is", null).order("zone")
      if (error) throw new Error(error.message)
      const zones = [...new Set((data ?? []).map((r) => r.zone).filter(Boolean))] as string[]
      return zones
    },
    staleTime: 10 * 60 * 1000,
  })
}