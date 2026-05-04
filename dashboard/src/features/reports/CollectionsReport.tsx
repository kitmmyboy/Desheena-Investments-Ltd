import { useState } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
} from '@tanstack/react-table'
import {
  useCollectionsReport,
  useDriverList,
  useRouteList,
  useZoneList,
  type CollectionReportRow,
} from './useReports'
import { downloadCsv } from '../../lib/exportCsv'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-UG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

function SyncBadge({ status }: { status: string }) {
  if (status === 'synced') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
        Synced
      </span>
    )
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
      Pending
    </span>
  )
}

// ---------------------------------------------------------------------------
// Column helper
// ---------------------------------------------------------------------------

const columnHelper = createColumnHelper<CollectionReportRow>()

const columns = [
  columnHelper.accessor('client_name', {
    header: 'Client',
    cell: (info) => (
      <span className="font-medium text-gray-900">{info.getValue()}</span>
    ),
  }),
  columnHelper.accessor('driver_name', {
    header: 'Driver',
    cell: (info) => <span className="text-gray-700">{info.getValue()}</span>,
  }),
  columnHelper.accessor('waste_type', {
    header: 'Waste Type',
    cell: (info) => (
      <span className="capitalize text-gray-700">{info.getValue()}</span>
    ),
  }),
  columnHelper.accessor('weight_kg', {
    header: 'Weight (kg)',
    cell: (info) => (
      <span className="tabular-nums text-gray-700">
        {info.getValue() != null ? info.getValue()!.toFixed(1) : '—'}
      </span>
    ),
  }),
  columnHelper.accessor('collected_at', {
    header: 'Collected At',
    cell: (info) => (
      <span className="text-gray-700 text-sm whitespace-nowrap">
        {formatDateTime(info.getValue())}
      </span>
    ),
  }),
  columnHelper.accessor('zone', {
    header: 'Zone',
    cell: (info) => <span className="text-gray-700">{info.getValue()}</span>,
  }),
  columnHelper.accessor('route_name', {
    header: 'Route',
    cell: (info) => <span className="text-gray-700">{info.getValue()}</span>,
  }),
  columnHelper.accessor('sync_status', {
    header: 'Sync',
    cell: (info) => <SyncBadge status={info.getValue()} />,
  }),
]

// ---------------------------------------------------------------------------
// Table skeleton
// ---------------------------------------------------------------------------

function TableSkeleton({ rows = 8, cols = 8 }: { rows?: number; cols?: number }) {
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

// ---------------------------------------------------------------------------
// CollectionsReport
// ---------------------------------------------------------------------------

export default function CollectionsReport() {
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [driverId, setDriverId] = useState('')
  const [routeId, setRouteId] = useState('')
  const [zone, setZone] = useState('')

  const { data: drivers = [] } = useDriverList()
  const { data: routes = [] } = useRouteList()
  const { data: zones = [] } = useZoneList()

  const filters = {
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    driverId: driverId || undefined,
    routeId: routeId || undefined,
    zone: zone || undefined,
  }

  const { data = [], isLoading, error } = useCollectionsReport(filters)

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  function handleExportCsv() {
    const headers = [
      'Client',
      'Driver',
      'Waste Type',
      'Weight (kg)',
      'Collected At',
      'Zone',
      'Route',
      'Sync Status',
    ]
    const rows = data.map((row) => [
      row.client_name,
      row.driver_name,
      row.waste_type,
      row.weight_kg ?? '',
      row.collected_at,
      row.zone,
      row.route_name,
      row.sync_status,
    ])
    downloadCsv('collections-report.csv', [headers, ...rows])
  }

  function handleExportPdf() {
    // Use browser print with print-specific styles
    window.print()
  }

  function handleClearFilters() {
    setDateFrom('')
    setDateTo('')
    setDriverId('')
    setRouteId('')
    setZone('')
  }

  const hasFilters = dateFrom || dateTo || driverId || routeId || zone

  return (
    <div className="flex flex-col gap-5">
      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm print:hidden">
        <div className="flex flex-wrap items-end gap-3">
          {/* Date from */}
          <div className="flex flex-col gap-1">
            <label htmlFor="cr-date-from" className="text-xs font-medium text-gray-600">
              From
            </label>
            <input
              id="cr-date-from"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Date to */}
          <div className="flex flex-col gap-1">
            <label htmlFor="cr-date-to" className="text-xs font-medium text-gray-600">
              To
            </label>
            <input
              id="cr-date-to"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Driver filter */}
          <div className="flex flex-col gap-1">
            <label htmlFor="cr-driver" className="text-xs font-medium text-gray-600">
              Driver
            </label>
            <select
              id="cr-driver"
              value={driverId}
              onChange={(e) => setDriverId(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[160px]"
            >
              <option value="">All drivers</option>
              {drivers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.full_name ?? d.email}
                </option>
              ))}
            </select>
          </div>

          {/* Route filter */}
          <div className="flex flex-col gap-1">
            <label htmlFor="cr-route" className="text-xs font-medium text-gray-600">
              Route
            </label>
            <select
              id="cr-route"
              value={routeId}
              onChange={(e) => setRouteId(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[160px]"
            >
              <option value="">All routes</option>
              {routes.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>

          {/* Zone filter */}
          <div className="flex flex-col gap-1">
            <label htmlFor="cr-zone" className="text-xs font-medium text-gray-600">
              Zone
            </label>
            <select
              id="cr-zone"
              value={zone}
              onChange={(e) => setZone(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[140px]"
            >
              <option value="">All zones</option>
              {zones.map((z) => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))}
            </select>
          </div>

          {hasFilters && (
            <button
              onClick={handleClearFilters}
              className="text-sm text-gray-500 hover:text-gray-700 underline self-end pb-2"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700 print:hidden">
          Failed to load collections report: {error.message}
        </div>
      )}

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 print:hidden">
          <p className="text-sm text-gray-500">
            {isLoading
              ? 'Loading…'
              : `${data.length.toLocaleString()} record${data.length !== 1 ? 's' : ''}`}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCsv}
              disabled={data.length === 0}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Export CSV
            </button>
            <button
              onClick={handleExportPdf}
              disabled={data.length === 0}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Export PDF
            </button>
          </div>
        </div>

        {/* Print header — only visible when printing */}
        <div className="hidden print:block px-5 py-4 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900">
            Desheena Investments Ltd — Collections Report
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Generated: {new Date().toLocaleString('en-UG')}
            {dateFrom && ` | From: ${dateFrom}`}
            {dateTo && ` | To: ${dateTo}`}
          </p>
        </div>

        <div className="overflow-x-auto max-h-[600px] overflow-y-auto print:max-h-none print:overflow-visible">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 sticky top-0 z-10 print:static">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap"
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-2">
                    <TableSkeleton rows={8} cols={8} />
                  </td>
                </tr>
              ) : table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-12 text-center text-gray-400 text-sm"
                  >
                    No collections found matching the current filters.
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50 transition-colors print:hover:bg-transparent">
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-4 py-2.5 whitespace-nowrap">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
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
