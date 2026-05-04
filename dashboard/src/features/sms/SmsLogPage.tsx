import { useMemo, useState } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
  type PaginationState,
  type SortingState,
} from '@tanstack/react-table'
import { useSmsLog, type SmsLogEntry } from './useSmsLog'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDateTime(iso: string | null): string {
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

// ---------------------------------------------------------------------------
// Delivery status badge
// ---------------------------------------------------------------------------

function DeliveryStatusBadge({ status }: { status: string | null }) {
  if (!status) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
        Unknown
      </span>
    )
  }

  const lower = status.toLowerCase()

  if (lower === 'sent' || lower === 'delivered' || lower === 'success') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
        {status}
      </span>
    )
  }

  if (lower === 'failed' || lower === 'error') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
        {status}
      </span>
    )
  }

  if (lower === 'pending' || lower === 'queued') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
        {status}
      </span>
    )
  }

  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 capitalize">
      {status}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Error code tooltip cell
// ---------------------------------------------------------------------------

function ErrorCodeCell({ errorCode }: { errorCode: string | null }) {
  if (!errorCode) return <span className="text-gray-400">—</span>

  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono bg-red-50 text-red-700 cursor-help border border-red-200"
      title={errorCode}
    >
      {errorCode.length > 20 ? `${errorCode.slice(0, 20)}…` : errorCode}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Message content cell — truncated with title tooltip
// ---------------------------------------------------------------------------

function MessageCell({ content }: { content: string }) {
  const truncated = content.length > 80 ? `${content.slice(0, 80)}…` : content
  return (
    <span
      className="text-gray-700 text-sm"
      title={content.length > 80 ? content : undefined}
    >
      {truncated}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function TableSkeleton({ rows = 8, cols = 7 }: { rows?: number; cols?: number }) {
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
// Column definitions
// ---------------------------------------------------------------------------

const columnHelper = createColumnHelper<SmsLogEntry>()

function buildColumns() {
  return [
    columnHelper.accessor('recipient_phone', {
      header: 'Recipient',
      cell: (info) => (
        <span className="font-medium text-gray-900 tabular-nums whitespace-nowrap">
          {info.getValue()}
        </span>
      ),
    }),
    columnHelper.accessor('message_content', {
      header: 'Message',
      cell: (info) => <MessageCell content={info.getValue()} />,
    }),
    columnHelper.accessor('event_type', {
      header: 'Event Type',
      cell: (info) => (
        <span className="text-gray-600 text-sm capitalize whitespace-nowrap">
          {info.getValue() ?? '—'}
        </span>
      ),
    }),
    columnHelper.accessor('delivery_status', {
      header: 'Status',
      cell: (info) => <DeliveryStatusBadge status={info.getValue()} />,
    }),
    columnHelper.accessor('attempt_count', {
      header: 'Attempts',
      cell: (info) => (
        <span className="text-gray-600 text-sm tabular-nums text-center block">
          {info.getValue()}
        </span>
      ),
    }),
    columnHelper.accessor('sent_at', {
      header: 'Sent At',
      cell: (info) => (
        <span className="text-gray-600 text-sm whitespace-nowrap">
          {formatDateTime(info.getValue())}
        </span>
      ),
    }),
    columnHelper.accessor('error_code', {
      header: 'Error Code',
      cell: (info) => <ErrorCodeCell errorCode={info.getValue()} />,
    }),
  ]
}

// ---------------------------------------------------------------------------
// Page size options
// ---------------------------------------------------------------------------

const PAGE_SIZE_OPTIONS = [25, 50, 100]

// ---------------------------------------------------------------------------
// SmsLogPage
// ---------------------------------------------------------------------------

export default function SmsLogPage() {
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 25,
  })
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'sent_at', desc: true },
  ])

  // Filters
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [recipientPhone, setRecipientPhone] = useState('')
  const [deliveryStatus, setDeliveryStatus] = useState('all')

  const sortBy = sorting[0]?.id ?? 'sent_at'
  const sortDesc = sorting[0]?.desc ?? true

  const { data, count, isLoading, error } = useSmsLog({
    page: pagination.pageIndex,
    pageSize: pagination.pageSize,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    recipientPhone: recipientPhone || undefined,
    deliveryStatus: deliveryStatus !== 'all' ? deliveryStatus : undefined,
    sortBy,
    sortDesc,
  })

  const pageCount = useMemo(
    () => Math.max(1, Math.ceil(count / pagination.pageSize)),
    [count, pagination.pageSize]
  )

  const columns = useMemo(() => buildColumns(), [])

  const table = useReactTable({
    data,
    columns,
    pageCount,
    state: { pagination, sorting },
    onPaginationChange: setPagination,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
  })

  const from = pagination.pageIndex * pagination.pageSize + 1
  const to = Math.min((pagination.pageIndex + 1) * pagination.pageSize, count)

  function handleFilterChange(setter: (v: string) => void) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setter(e.target.value)
      setPagination((p) => ({ ...p, pageIndex: 0 }))
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Page header */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900">SMS Log</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Outbound SMS messages sent via Africa's Talking
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Date from */}
        <div className="flex items-center gap-1.5">
          <label htmlFor="sms-date-from" className="text-sm text-gray-600 whitespace-nowrap">
            From
          </label>
          <input
            id="sms-date-from"
            type="date"
            value={dateFrom}
            onChange={handleFilterChange(setDateFrom)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Date to */}
        <div className="flex items-center gap-1.5">
          <label htmlFor="sms-date-to" className="text-sm text-gray-600 whitespace-nowrap">
            to
          </label>
          <input
            id="sms-date-to"
            type="date"
            value={dateTo}
            onChange={handleFilterChange(setDateTo)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Recipient phone search */}
        <input
          type="text"
          placeholder="Search recipient phone…"
          value={recipientPhone}
          onChange={handleFilterChange(setRecipientPhone)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 w-52"
          aria-label="Filter by recipient phone"
        />

        {/* Delivery status filter */}
        <select
          value={deliveryStatus}
          onChange={handleFilterChange(setDeliveryStatus)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label="Filter by delivery status"
        >
          <option value="all">All statuses</option>
          <option value="sent">Sent</option>
          <option value="delivered">Delivered</option>
          <option value="failed">Failed</option>
          <option value="pending">Pending</option>
        </select>

        {/* Record count */}
        {!isLoading && count > 0 && (
          <span className="text-sm text-gray-500 ml-auto">
            {from}–{to} of {count.toLocaleString()} messages
          </span>
        )}
        {!isLoading && count === 0 && (
          <span className="text-sm text-gray-500 ml-auto">0 messages</span>
        )}
      </div>

      {/* Error state */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
          Failed to load SMS log: {error.message}
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
                    <TableSkeleton rows={8} cols={columns.length} />
                  </td>
                </tr>
              ) : table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length}
                    className="px-4 py-12 text-center text-gray-400 text-sm"
                  >
                    No SMS messages found matching the current filters.
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-4 py-2.5">
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
    </div>
  )
}
