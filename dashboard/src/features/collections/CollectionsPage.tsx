import { useEffect, useMemo, useState } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
  type PaginationState,
  type SortingState,
} from '@tanstack/react-table'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useCollections, type CollectionRecord, type CollectionsFiltersState } from './useCollections'
import CollectionsFilters from './CollectionsFilters'
import CollectionsMapView from './CollectionsMapView'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

function formatGps(record: CollectionRecord): string {
  if (record.missing_gps) return 'Missing'
  if (record.gps_lat != null && record.gps_lng != null) {
    return `${record.gps_lat.toFixed(5)}, ${record.gps_lng.toFixed(5)}`
  }
  return 'Missing'
}

function SyncStatusBadge({ status }: { status: string }) {
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
// Loading skeleton
// ---------------------------------------------------------------------------

function TableSkeleton({ rows = 10, cols = 7 }: { rows?: number; cols?: number }) {
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
// Column helper
// ---------------------------------------------------------------------------

const columnHelper = createColumnHelper<CollectionRecord>()

const columns = [
  columnHelper.accessor((row) => row.clients?.name ?? '—', {
    id: 'client_name',
    header: 'Client',
    cell: (info) => <span className="font-medium text-gray-900">{info.getValue()}</span>,
  }),
  columnHelper.accessor((row) => row.users?.email ?? '—', {
    id: 'driver_email',
    header: 'Driver',
    cell: (info) => <span className="text-gray-700">{info.getValue()}</span>,
  }),
  columnHelper.accessor('waste_type', {
    header: 'Waste type',
    cell: (info) => (
      <span className="capitalize text-gray-700">{info.getValue()}</span>
    ),
  }),
  columnHelper.accessor('weight_kg', {
    header: 'Weight (kg)',
    cell: (info) => (
      <span className="text-gray-700 tabular-nums">
        {info.getValue() != null ? info.getValue().toFixed(1) : '—'}
      </span>
    ),
  }),
  columnHelper.accessor((row) => formatGps(row), {
    id: 'gps',
    header: 'GPS',
    cell: (info) => {
      const val = info.getValue()
      return (
        <span className={val === 'Missing' ? 'text-gray-400 italic' : 'text-gray-700 tabular-nums text-xs'}>
          {val}
        </span>
      )
    },
  }),
  columnHelper.accessor('collected_at', {
    header: 'Collected at',
    cell: (info) => (
      <span className="text-gray-700 text-sm whitespace-nowrap">
        {formatDateTime(info.getValue())}
      </span>
    ),
  }),
  columnHelper.accessor('sync_status', {
    header: 'Sync status',
    cell: (info) => <SyncStatusBadge status={info.getValue()} />,
  }),
]

// ---------------------------------------------------------------------------
// Page size options
// ---------------------------------------------------------------------------

const PAGE_SIZE_OPTIONS = [25, 50, 100]

// ---------------------------------------------------------------------------
// CollectionsPage
// ---------------------------------------------------------------------------

type ViewMode = 'table' | 'map'

export default function CollectionsPage() {
  const queryClient = useQueryClient()

  const [viewMode, setViewMode] = useState<ViewMode>('table')
  const [filters, setFilters] = useState<CollectionsFiltersState>({})
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 50,
  })
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'collected_at', desc: true },
  ])

  const sortBy = sorting[0]?.id ?? 'collected_at'
  const sortDesc = sorting[0]?.desc ?? true

  const { data, count, isLoading, error } = useCollections({
    filters,
    page: pagination.pageIndex,
    pageSize: pagination.pageSize,
    sortBy,
    sortDesc,
  })

  // Reset to page 0 when filters change
  useEffect(() => {
    setPagination((prev) => ({ ...prev, pageIndex: 0 }))
  }, [filters])

  // Supabase Realtime subscription — invalidate query on INSERT
  useEffect(() => {
    const channel = supabase
      .channel('collections-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'collections' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['collections'] })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [queryClient])

  const pageCount = useMemo(
    () => Math.max(1, Math.ceil(count / pagination.pageSize)),
    [count, pagination.pageSize]
  )

  const table = useReactTable({
    data,
    columns,
    pageCount,
    state: {
      pagination,
      sorting,
    },
    onPaginationChange: setPagination,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
  })

  const from = pagination.pageIndex * pagination.pageSize + 1
  const to = Math.min((pagination.pageIndex + 1) * pagination.pageSize, count)

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Collections log</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Real-time view of all waste collection records
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* View mode toggle */}
          <div
            className="inline-flex rounded-lg border border-gray-300 overflow-hidden text-sm"
            role="group"
            aria-label="View mode"
          >
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-1.5 font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 ${
                viewMode === 'table'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
              aria-pressed={viewMode === 'table'}
            >
              Table
            </button>
            <button
              onClick={() => setViewMode('map')}
              className={`px-3 py-1.5 font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 border-l border-gray-300 ${
                viewMode === 'map'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
              aria-pressed={viewMode === 'map'}
            >
              Map
            </button>
          </div>

          {viewMode === 'table' && !isLoading && count > 0 && (
            <span className="text-sm text-gray-500 hidden sm:inline">
              {from}–{to} of {count.toLocaleString()}
            </span>
          )}
        </div>
      </div>

      {/* Map view */}
      {viewMode === 'map' && <CollectionsMapView />}

      {/* Table view — filters + table */}
      {viewMode === 'table' && (
        <>
      {/* Filters */}
      <CollectionsFilters filters={filters} onChange={setFilters} />

      {/* Error state */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
          Failed to load collections: {error.message}
        </div>
      )}

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {/* Scrollable table area — CSS overflow for virtualization on large datasets */}
        <div className="max-h-[600px] overflow-y-auto overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 sticky top-0 z-10">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap select-none"
                      onClick={header.column.getToggleSortingHandler()}
                      style={{ cursor: header.column.getCanSort() ? 'pointer' : 'default' }}
                    >
                      <span className="flex items-center gap-1">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getIsSorted() === 'asc' && (
                          <span aria-hidden="true">↑</span>
                        )}
                        {header.column.getIsSorted() === 'desc' && (
                          <span aria-hidden="true">↓</span>
                        )}
                      </span>
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {isLoading ? (
                <tr>
                  <td colSpan={columns.length} className="px-4 py-2">
                    <TableSkeleton rows={pagination.pageSize > 25 ? 10 : 5} cols={columns.length} />
                  </td>
                </tr>
              ) : table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length}
                    className="px-4 py-12 text-center text-gray-400 text-sm"
                  >
                    No collections found matching the current filters.
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50 transition-colors">
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

        {/* Pagination controls */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
          {/* Page size selector */}
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span>Rows per page:</span>
            <select
              value={pagination.pageSize}
              onChange={(e) =>
                setPagination({ pageIndex: 0, pageSize: Number(e.target.value) })
              }
              className="border border-gray-300 rounded px-2 py-1 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>

          {/* Page navigation */}
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span>
              Page {pagination.pageIndex + 1} of {pageCount}
            </span>
            <button
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
              aria-label="Previous page"
            >
              ← Prev
            </button>
            <button
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
              aria-label="Next page"
            >
              Next →
            </button>
          </div>
        </div>
      </div>
        </>
      )}
    </div>
  )
}
