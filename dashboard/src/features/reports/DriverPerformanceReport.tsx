import { useState } from "react"
import { useReactTable, getCoreRowModel, flexRender, createColumnHelper } from "@tanstack/react-table"
import { useDriverPerformanceReport } from "./useReports"
import { useQuery } from "@tanstack/react-query"
import { supabase } from "../../lib/supabase"
import { downloadCsv } from "../../lib/exportCsv"

interface DriverStaffRow {
  id: string
  full_name: string
  phone: string | null
  email: string | null
  zone: string | null
  status: string
  user_id: string | null
}

function useAllDrivers(search: string) {
  return useQuery({
    queryKey: ["staff_drivers", search],
    queryFn: async (): Promise<DriverStaffRow[]> => {
      let query = supabase.from("staff").select("id, full_name, phone, email, zone, status, user_id").eq("role", "Driver").order("full_name")
      if (search.trim()) query = query.or(`full_name.ilike.%${search.trim()}%,phone.ilike.%${search.trim()}%,email.ilike.%${search.trim()}%`)
      const { data, error } = await query
      if (error) throw new Error(error.message)
      return (data ?? []) as DriverStaffRow[]
    },
    staleTime: 2 * 60 * 1000,
  })
}

interface MergedDriver {
  driver_id: string
  driver_name: string
  phone: string | null
  zone: string | null
  status: string
  has_account: boolean
  collections_count: number
  total_weight_kg: number
  routes_completed: number
}

const columnHelper = createColumnHelper<MergedDriver>()

function TableSkeleton({ rows = 6, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <div className="animate-pulse">
      {Array.from({ length: rows }).map((_, ri) => (
        <div key={ri} className="flex gap-2 py-2 border-b border-gray-100">
          {Array.from({ length: cols }).map((_, ci) => (
            <div key={ci} className="h-4 bg-gray-200 rounded flex-1" />
          ))}
        </div>
      ))}
    </div>
  )
}

export default function DriverPerformanceReport() {
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [search, setSearch] = useState("")

  const { data: perfData = [], isLoading: perfLoading } = useDriverPerformanceReport(dateFrom || undefined, dateTo || undefined)
  const { data: allDrivers = [], isLoading: driversLoading } = useAllDrivers(search)

  const merged: MergedDriver[] = allDrivers.map((driver) => {
    const perf = perfData.find((p) => p.driver_id === driver.user_id)
    return {
      driver_id: driver.user_id ?? driver.id,
      driver_name: driver.full_name,
      phone: driver.phone,
      zone: driver.zone,
      status: driver.status,
      has_account: !!driver.user_id,
      collections_count: perf?.collections_count ?? 0,
      total_weight_kg: perf?.total_weight_kg ?? 0,
      routes_completed: perf?.routes_completed ?? 0,
    }
  })

  const isLoading = perfLoading || driversLoading

  const columns = [
    columnHelper.accessor("driver_name", {
      header: "Driver",
      cell: (info) => (
        <div>
          <p className="font-medium text-gray-900">{info.getValue()}</p>
          {info.row.original.phone && (
            <a href={`tel:${info.row.original.phone}`} className="text-xs text-blue-600 hover:underline">{info.row.original.phone}</a>
          )}
        </div>
      ),
    }),
    columnHelper.accessor("zone", {
      header: "Zone",
      cell: (info) => <span className="text-sm text-gray-600">{info.getValue() ?? "—"}</span>,
    }),
    columnHelper.accessor("status", {
      header: "Status",
      cell: (info) => {
        const s = info.getValue() ?? "active"
        const styles: Record<string, string> = { active: "bg-green-100 text-green-800", suspended: "bg-orange-100 text-orange-800", terminated: "bg-red-100 text-red-800" }
        return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${styles[s] ?? "bg-gray-100 text-gray-700"}`}>{s}</span>
      },
    }),
    columnHelper.accessor("has_account", {
      header: "App Account",
      cell: (info) => info.getValue()
        ? <span className="inline-flex items-center gap-1 text-xs text-green-700"><svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>Active</span>
        : <span className="inline-flex items-center gap-1 text-xs text-orange-600"><svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>No account</span>,
    }),
    columnHelper.accessor("collections_count", {
      header: "Collections",
      cell: (info) => <span className="tabular-nums text-gray-700">{info.getValue().toLocaleString()}</span>,
    }),
    columnHelper.accessor("total_weight_kg", {
      header: "Weight (kg)",
      cell: (info) => <span className="tabular-nums text-gray-700">{info.getValue().toLocaleString()}</span>,
    }),
  ]

  const table = useReactTable({ data: merged, columns, getCoreRowModel: getCoreRowModel() })

  function handleExportCsv() {
    const headers = ["Driver", "Phone", "Zone", "Status", "App Account", "Collections", "Weight (kg)"]
    const rows = merged.map((row) => [row.driver_name, row.phone ?? "—", row.zone ?? "—", row.status, row.has_account ? "Yes" : "No", row.collections_count, row.total_weight_kg])
    downloadCsv("drivers.csv", [headers, ...rows])
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm flex flex-wrap gap-3 items-end">
        <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
          <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">Search driver</label>
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" /></svg>
            <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name, phone, or email..." className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">Collections from</label>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">To</label>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        {(dateFrom || dateTo) && <button onClick={() => { setDateFrom(""); setDateTo("") }} className="text-sm text-gray-500 hover:text-gray-700 underline self-end pb-2">Clear dates</button>}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between px-5 py-3 border-b border-gray-200">
          <p className="text-sm text-gray-500">
            {isLoading ? "Loading..." : `${merged.length} driver${merged.length !== 1 ? "s" : ""}`}
            {!isLoading && merged.filter((d) => !d.has_account).length > 0 && (
              <span className="ml-2 text-orange-600 text-xs">· {merged.filter((d) => !d.has_account).length} without app account</span>
            )}
          </p>
          <button onClick={handleExportCsv} disabled={merged.length === 0} className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">Export CSV</button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id}>
                  {hg.headers.map((h) => (
                    <th key={h.id} className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">{flexRender(h.column.columnDef.header, h.getContext())}</th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {isLoading ? (
                <tr><td colSpan={6} className="px-4 py-2"><TableSkeleton rows={6} cols={6} /></td></tr>
              ) : table.getRowModel().rows.length === 0 ? (
                <tr><td colSpan={6} className="px-5 py-12 text-center text-gray-400 text-sm">{search ? "No drivers match your search." : "No drivers found. Add drivers in Staff Management."}</td></tr>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <tr key={row.id} className={`hover:bg-gray-50 transition-colors ${!row.original.has_account ? "bg-orange-50/30" : ""}`}>
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-4 py-3 whitespace-nowrap">{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}