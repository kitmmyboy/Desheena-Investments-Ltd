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
import { supabase } from '../../lib/supabase'

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

  // Test SMS state
  const [testPhone, setTestPhone] = useState('')
  const [testSending, setTestSending] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [showTestPanel, setShowTestPanel] = useState(false)

  const sortBy = sorting[0]?.id ?? 'sent_at'
  const sortDesc = sorting[0]?.desc ?? true

  const { data, count, isLoading, error, refetch } = useSmsLog({
    page: pagination.pageIndex,
    pageSize: pagination.pageSize,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    recipientPhone: recipientPhone || undefined,
    deliveryStatus: deliveryStatus !== 'all' ? deliveryStatus : undefined,
    sortBy,
    sortDesc,
  })

  async function handleTestSms() {
    if (!testPhone.trim()) return
    setTestSending(true)
    setTestResult(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-sms`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({
            phone: testPhone.trim(),
            message: 'Test SMS from Desheena dashboard. Gateway is working correctly.',
            event_type: 'invoice_generated',
          }),
        }
      )
      const json = await res.json()
      if (json.success) {
        setTestResult({ success: true, message: `Sent! Message ID: ${json.message_id}` })
        refetch()
      } else {
        setTestResult({ success: false, message: json.error ?? 'Send failed' })
      }
    } catch (err) {
      setTestResult({ success: false, message: err instanceof Error ? err.message : 'Network error' })
    } finally {
      setTestSending(false)
    }
  }

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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">SMS Log</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Outbound SMS messages sent via Africa's Talking
          </p>
        </div>
        <button
          onClick={() => { setShowTestPanel((p) => !p); setTestResult(null) }}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
          Test SMS Gateway
        </button>
      </div>

      {/* Test SMS panel */}
      {showTestPanel && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex flex-col gap-3">
          <div>
            <p className="text-sm font-medium text-blue-900">Send a test SMS</p>
            <p className="text-xs text-blue-700 mt-0.5">
              Sends a test message using your configured Africa's Talking credentials. Check Settings → Integrations to configure the gateway.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              type="tel"
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
              placeholder="+256700000000"
              className="border border-blue-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-56"
              aria-label="Test recipient phone number"
            />
            <button
              onClick={handleTestSms}
              disabled={testSending || !testPhone.trim()}
              className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
            >
              {testSending && (
                <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              )}
              {testSending ? 'Sending…' : 'Send Test'}
            </button>
          </div>
          {testResult && (
            <div className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg ${testResult.success ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
              {testResult.success ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
              )}
              {testResult.message}
            </div>
          )}
        </div>
      )}

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
        {!isLoading && (
          <span className="text-sm text-gray-500 hidden sm:inline ml-auto">
            {count > 0 ? `${from}–${to} of ${count.toLocaleString()} messages` : '0 messages'}
          </span>
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
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
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
