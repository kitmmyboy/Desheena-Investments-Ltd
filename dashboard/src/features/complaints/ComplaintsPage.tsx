import { useEffect, useMemo, useState } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
  type PaginationState,
} from '@tanstack/react-table'
import { useComplaints, type Complaint, type ComplaintsFilters } from './useComplaints'
import ComplaintDetailPanel from './ComplaintDetailPanel'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
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

function truncate(text: string, maxLen = 80): string {
  if (text.length <= maxLen) return text
  return text.slice(0, maxLen).trimEnd() + '…'
}

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    open: 'bg-orange-100 text-orange-800',
    'in-progress': 'bg-blue-100 text-blue-800',
    resolved: 'bg-green-100 text-green-800',
  }
  const label: Record<string, string> = {
    open: 'Open',
    'in-progress': 'In Progress',
    resolved: 'Resolved',
  }
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status] ?? 'bg-gray-100 text-gray-700'}`}
    >
      {label[status] ?? status}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Category label
// ---------------------------------------------------------------------------

function categoryLabel(cat: string): string {
  const map: Record<string, string> = {
    missed_collection: 'Missed Collection',
    'missed collection': 'Missed Collection',
    billing_dispute: 'Billing Dispute',
    'billing dispute': 'Billing Dispute',
    service_quality: 'Service Quality',
    'service quality': 'Service Quality',
    other: 'Other',
  }
  return map[cat] ?? cat
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function TableSkeleton({ rows = 8, cols = 5 }: { rows?: number; cols?: number }) {
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

const columnHelper = createColumnHelper<Complaint>()

function buildColumns(onRowClick: (complaint: Complaint) => void) {
  return [
    columnHelper.accessor((row) => row.clients?.name ?? '—', {
      id: 'client_name',
      header: 'Client',
      cell: (info) => (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onRowClick(info.row.original)
          }}
          className="font-medium text-blue-700 hover:underline text-left focus:outline-none focus:underline"
        >
          {info.getValue()}
        </button>
      ),
    }),
    columnHelper.accessor('category', {
      header: 'Category',
      cell: (info) => (
        <span className="text-gray-700 text-sm">{categoryLabel(info.getValue())}</span>
      ),
    }),
    columnHelper.accessor('message', {
      header: 'Message',
      cell: (info) => (
        <span className="text-gray-600 text-sm">{truncate(info.getValue())}</span>
      ),
    }),
    columnHelper.accessor('status', {
      header: 'Status',
      cell: (info) => <StatusBadge status={info.getValue()} />,
    }),
    columnHelper.accessor('created_at', {
      header: 'Submitted',
      cell: (info) => (
        <span className="text-gray-600 text-sm whitespace-nowrap">
          {formatDateTime(info.getValue())}
        </span>
      ),
    }),
  ]
}

// ---------------------------------------------------------------------------
// Page size options
// ---------------------------------------------------------------------------

const PAGE_SIZE_OPTIONS = [25, 50, 100]

// ---------------------------------------------------------------------------
// ComplaintsPage
// ---------------------------------------------------------------------------

export default function ComplaintsPage() {
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 25,
  })

  // Filter state
  const [statusFilter, setStatusFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  // Detail panel state
  const [selectedComplaintId, setSelectedComplaintId] = useState<string | null>(null)

  // Build filters object for the hook
  const filters: ComplaintsFilters = useMemo(
    () => ({
      page: pagination.pageIndex,
      pageSize: pagination.pageSize,
      status: statusFilter !== 'all' ? statusFilter : undefined,
      category: categoryFilter !== 'all' ? categoryFilter : undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    }),
    [pagination.pageIndex, pagination.pageSize, statusFilter, categoryFilter, dateFrom, dateTo]
  )

  const { data, count, isLoading, error } = useComplaints(filters)

  // Reset to page 0 when filters change
  useEffect(() => {
    setPagination((prev) => ({ ...prev, pageIndex: 0 }))
  }, [statusFilter, categoryFilter, dateFrom, dateTo])

  const pageCount = useMemo(
    () => Math.max(1, Math.ceil(count / pagination.pageSize)),
    [count, pagination.pageSize]
  )

  const columns = useMemo(() => buildColumns((c) => setSelectedComplaintId(c.id)), [])

  const table = useReactTable({
    data,
    columns,
    pageCount,
    state: { pagination },
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
  })

  const from = pagination.pageIndex * pagination.pageSize + 1
  const to = Math.min((pagination.pageIndex + 1) * pagination.pageSize, count)

  function clearFilters() {
    setStatusFilter('all')
    setCategoryFilter('all')
    setDateFrom('')
    setDateTo('')
  }

  const hasActiveFilters =
    statusFilter !== 'all' || categoryFilter !== 'all' || !!dateFrom || !!dateTo

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Complaints</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Review and manage client complaints
          </p>
        </div>
        {!isLoading && (
          <span className="text-sm text-gray-500">
            {count > 0
              ? `${from}–${to} of ${count.toLocaleString()} complaints`
              : '0 complaints'}
          </span>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        {/* Status filter */}
        <div className="flex flex-col gap-1">
          <label
            htmlFor="filter-status"
            className="text-xs font-medium text-gray-600 uppercase tracking-wide"
          >
            Status
          </label>
          <select
            id="filter-status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All statuses</option>
            <option value="open">Open</option>
            <option value="in-progress">In Progress</option>
            <option value="resolved">Resolved</option>
          </select>
        </div>

        {/* Category filter */}
        <div className="flex flex-col gap-1">
          <label
            htmlFor="filter-category"
            className="text-xs font-medium text-gray-600 uppercase tracking-wide"
          >
            Category
          </label>
          <select
            id="filter-category"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All categories</option>
            <option value="missed_collection">Missed Collection</option>
            <option value="billing_dispute">Billing Dispute</option>
            <option value="service_quality">Service Quality</option>
            <option value="other">Other</option>
          </select>
        </div>

        {/* Date from */}
        <div className="flex flex-col gap-1">
          <label
            htmlFor="filter-date-from"
            className="text-xs font-medium text-gray-600 uppercase tracking-wide"
          >
            From
          </label>
          <input
            id="filter-date-from"
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            max={dateTo || undefined}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Date to */}
        <div className="flex flex-col gap-1">
          <label
            htmlFor="filter-date-to"
            className="text-xs font-medium text-gray-600 uppercase tracking-wide"
          >
            To
          </label>
          <input
            id="filter-date-to"
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            min={dateFrom || undefined}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Clear filters */}
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-400 transition-colors self-end"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Error state */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
          Failed to load complaints: {error.message}
        </div>
      )}

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="max-h-[600px] overflow-y-auto overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 sticky top-0 z-10">
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
                  <td colSpan={columns.length} className="px-4 py-2">
                    <TableSkeleton rows={8} cols={columns.length} />
                  </td>
                </tr>
              ) : table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length}
                    className="px-4 py-12 text-center text-gray-400 text-sm"
                  >
                    No complaints found matching the current filters.
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    className="hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => setSelectedComplaintId(row.original.id)}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        className="px-4 py-2.5 whitespace-nowrap"
                        onClick={(e) => {
                          // Prevent double-fire when clicking the client name button
                          if ((e.target as HTMLElement).tagName === 'BUTTON') {
                            e.stopPropagation()
                          }
                        }}
                      >
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
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
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

      {/* Complaint detail panel (modal) */}
      {selectedComplaintId && (
        <ComplaintDetailPanel
          complaintId={selectedComplaintId}
          onClose={() => setSelectedComplaintId(null)}
        />
      )}
    </div>
  )
}
