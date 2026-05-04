import { useState } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
} from '@tanstack/react-table'
import { useDriverPerformanceReport, type DriverPerformanceRow } from './useReports'
import { downloadCsv } from '../../lib/exportCsv'

// ---------------------------------------------------------------------------
// Column helper
// ---------------------------------------------------------------------------

const columnHelper = createColumnHelper<DriverPerformanceRow>()

const columns = [
  columnHelper.accessor('driver_name', {
    header: 'Driver',
    cell: (info) => (
      <span className="font-medium text-gray-900">{info.getValue()}</span>
    ),
  }),
  columnHelper.accessor('collections_count', {
    header: 'Collections',
    cell: (info) => (
      <span className="tabular-nums text-gray-700">{info.getValue().toLocaleString()}</span>
    ),
  }),
  columnHelper.accessor('total_weight_kg', {
    header: 'Total Weight (kg)',
    cell: (info) => (
      <span className="tabular-nums text-gray-700">{info.getValue().toLocaleString()}</span>
    ),
  }),
  columnHelper.accessor('routes_completed', {
    header: 'Routes Assigned',
    cell: (info) => (
      <span className="tabular-nums text-gray-700">{info.getValue()}</span>
    ),
  }),
]

// ---------------------------------------------------------------------------
// Table skeleton
// ---------------------------------------------------------------------------

function TableSkeleton({ rows = 6, cols = 4 }: { rows?: number; cols?: number }) {
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
// DriverPerformanceReport
// ---------------------------------------------------------------------------

export default function DriverPerformanceReport() {
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const { data = [], isLoading, error } = useDriverPerformanceReport(
    dateFrom || undefined,
    dateTo || undefined
  )

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  function handleExportCsv() {
    const headers = ['Driver', 'Collections', 'Total Weight (kg)', 'Routes Assigned']
    const rows = data.map((row) => [
      row.driver_name,
      row.collections_count,
      row.total_weight_kg,
      row.routes_completed,
    ])
    downloadCsv('driver-performance.csv', [headers, ...rows])
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
        <span className="text-sm font-medium text-gray-600">Date range:</span>

        <div className="flex items-center gap-1.5">
          <label htmlFor="dp-date-from" className="text-sm text-gray-600 whitespace-nowrap">
            From
          </label>
          <input
            id="dp-date-from"
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-1.5">
          <label htmlFor="dp-date-to" className="text-sm text-gray-600 whitespace-nowrap">
            To
          </label>
          <input
            id="dp-date-to"
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {(dateFrom || dateTo) && (
          <button
            onClick={() => {
              setDateFrom('')
              setDateTo('')
            }}
            className="text-sm text-gray-500 hover:text-gray-700 underline"
          >
            Clear
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
          Failed to load driver performance data: {error.message}
        </div>
      )}

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
          <p className="text-sm text-gray-500">
            {isLoading ? 'Loading…' : `${data.length} driver${data.length !== 1 ? 's' : ''}`}
          </p>
          <button
            onClick={handleExportCsv}
            disabled={data.length === 0}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Export CSV
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap"
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
                  <td colSpan={4} className="px-5 py-2">
                    <TableSkeleton rows={6} cols={4} />
                  </td>
                </tr>
              ) : table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-5 py-12 text-center text-gray-400 text-sm"
                  >
                    No driver performance data found for the selected date range.
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-5 py-3 whitespace-nowrap">
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
