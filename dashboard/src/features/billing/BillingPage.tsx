import React, { useEffect, useMemo, useState } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
  type PaginationState,
} from '@tanstack/react-table'
import { useInvoices, useDefaulters, type Invoice, type Defaulter } from './useInvoices'
import ManualInvoiceForm from './ManualInvoiceForm'
import InvoicePdfButton from './InvoicePdfButton'
import { useAuth } from '../auth/AuthContext'
import { supabase } from '../../lib/supabase'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCurrency(amount: number): string {
  return `UGX ${amount.toLocaleString()}`
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-UG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function formatPeriod(period: string | null): string {
  if (!period) return '—'
  // period is stored as YYYY-MM
  const [year, month] = period.split('-')
  if (!year || !month) return period
  const date = new Date(Number(year), Number(month) - 1, 1)
  return date.toLocaleDateString('en-UG', { year: 'numeric', month: 'long' })
}

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: Invoice['status'] }) {
  const styles: Record<Invoice['status'], string> = {
    paid: 'bg-green-100 text-green-800',
    unpaid: 'bg-yellow-100 text-yellow-800',
    overdue: 'bg-red-100 text-red-800',
  }
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${styles[status] ?? 'bg-gray-100 text-gray-700'}`}
    >
      {status}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Pay Now button — calls initiate-payment Edge Function
// ---------------------------------------------------------------------------

function PayNowButton({ invoice }: { invoice: Invoice }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Only show for unpaid or overdue invoices
  if (invoice.status === 'paid') return null

  async function handlePay() {
    setLoading(true)
    setError(null)

    try {
      const { data, error: fnError } = await supabase.functions.invoke(
        'initiate-payment',
        {
          body: {
            invoice_id: invoice.id,
            customer_phone: invoice.clients?.phone ?? '',
            customer_email: '',
          },
        }
      )

      if (fnError) {
        throw new Error(fnError.message)
      }

      const redirectUrl: string | undefined = data?.redirect_url
      if (!redirectUrl) {
        throw new Error(data?.error ?? 'No redirect URL returned from payment service')
      }

      // Redirect to Pesapal hosted payment page
      window.location.href = redirectUrl
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setError(message)
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        onClick={handlePay}
        disabled={loading}
        className="px-3 py-1 text-xs font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
        aria-label={`Pay invoice for ${invoice.clients?.name ?? 'client'}`}
      >
        {loading ? 'Processing…' : 'Pay Now'}
      </button>
      {error && (
        <span className="text-xs text-red-600 max-w-[160px] break-words" role="alert">
          {error}
        </span>
      )}
    </div>
  )
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
// Modal overlay
// ---------------------------------------------------------------------------

function Modal({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 z-10">
        {children}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// CSV export utility
// ---------------------------------------------------------------------------

function downloadCsv(filename: string, rows: string[][]): void {
  const csvContent = rows
    .map((row) =>
      row
        .map((cell) => {
          const str = String(cell ?? '')
          // Escape cells that contain commas, quotes, or newlines
          if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`
          }
          return str
        })
        .join(',')
    )
    .join('\n')

  const blob = new Blob([csvContent], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// ---------------------------------------------------------------------------
// Page size options
// ---------------------------------------------------------------------------

const PAGE_SIZE_OPTIONS = [25, 50, 100]

// ---------------------------------------------------------------------------
// Invoices tab
// ---------------------------------------------------------------------------

const invoiceColumnHelper = createColumnHelper<Invoice>()

function buildInvoiceColumns() {
  return [
    invoiceColumnHelper.accessor((row) => row.clients?.name ?? '—', {
      id: 'client_name',
      header: 'Client',
      cell: (info) => (
        <span className="font-medium text-gray-900">{info.getValue()}</span>
      ),
    }),
    invoiceColumnHelper.accessor('invoice_period', {
      header: 'Invoice Period',
      cell: (info) => (
        <span className="text-gray-700 text-sm">{formatPeriod(info.getValue())}</span>
      ),
    }),
    invoiceColumnHelper.accessor('amount', {
      header: 'Amount (UGX)',
      cell: (info) => (
        <span className="text-gray-700 tabular-nums text-sm">
          {formatCurrency(info.getValue())}
        </span>
      ),
    }),
    invoiceColumnHelper.accessor('due_date', {
      header: 'Due Date',
      cell: (info) => (
        <span className="text-gray-700 text-sm tabular-nums">{formatDate(info.getValue())}</span>
      ),
    }),
    invoiceColumnHelper.accessor('status', {
      header: 'Status',
      cell: (info) => <StatusBadge status={info.getValue()} />,
    }),
    invoiceColumnHelper.display({
      id: 'pdf',
      header: '',
      cell: (info) => <InvoicePdfButton invoice={info.row.original} />,
    }),
    invoiceColumnHelper.display({
      id: 'pay',
      header: '',
      cell: (info) => <PayNowButton invoice={info.row.original} />,
    }),
  ]
}

function InvoicesTab() {
  const { role } = useAuth()
  const isFinanceOrAdmin = role === 'Finance' || role === 'Admin'

  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 25,
  })

  const [statusFilter, setStatusFilter] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [modalOpen, setModalOpen] = useState(false)

  const { data, count, isLoading, error } = useInvoices({
    page: pagination.pageIndex,
    pageSize: pagination.pageSize,
    status: statusFilter !== 'all' ? statusFilter : undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  })

  const pageCount = useMemo(
    () => Math.max(1, Math.ceil(count / pagination.pageSize)),
    [count, pagination.pageSize]
  )

  const columns = useMemo(() => buildInvoiceColumns(), [])

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

  function handleExportCsv() {
    const headers = ['Client', 'Invoice Period', 'Amount (UGX)', 'Due Date', 'Status']
    const rows = data.map((inv) => [
      inv.clients?.name ?? '',
      formatPeriod(inv.invoice_period),
      String(inv.amount),
      inv.due_date,
      inv.status,
    ])
    downloadCsv('invoices.csv', [headers, ...rows])
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex flex-wrap items-center gap-3">
          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value)
              setPagination((p) => ({ ...p, pageIndex: 0 }))
            }}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Filter by status"
          >
            <option value="all">All statuses</option>
            <option value="paid">Paid</option>
            <option value="unpaid">Unpaid</option>
            <option value="overdue">Overdue</option>
          </select>

          {/* Date from */}
          <div className="flex items-center gap-1.5">
            <label htmlFor="date-from" className="text-sm text-gray-600 whitespace-nowrap">
              Due from
            </label>
            <input
              id="date-from"
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value)
                setPagination((p) => ({ ...p, pageIndex: 0 }))
              }}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Date to */}
          <div className="flex items-center gap-1.5">
            <label htmlFor="date-to" className="text-sm text-gray-600 whitespace-nowrap">
              to
            </label>
            <input
              id="date-to"
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value)
                setPagination((p) => ({ ...p, pageIndex: 0 }))
              }}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {!isLoading && count > 0 && (
            <span className="text-sm text-gray-500">
              {from}–{to} of {count.toLocaleString()} invoices
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCsv}
            disabled={data.length === 0}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Export CSV
          </button>
          {isFinanceOrAdmin && (
            <button
              onClick={() => setModalOpen(true)}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
            >
              + Generate Invoice
            </button>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
          Failed to load invoices: {error.message}
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
                  <td colSpan={7} className="px-4 py-2">
                    <TableSkeleton rows={8} cols={7} />
                  </td>
                </tr>
              ) : table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-12 text-center text-gray-400 text-sm"
                  >
                    No invoices found matching the current filters.
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

        {/* Pagination */}
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

      {/* Generate Invoice modal */}
      {modalOpen && (
        <Modal onClose={() => setModalOpen(false)}>
          <ManualInvoiceForm onClose={() => setModalOpen(false)} />
        </Modal>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Defaulters tab
// ---------------------------------------------------------------------------

const defaulterColumnHelper = createColumnHelper<Defaulter>()

const defaulterColumns = [
  defaulterColumnHelper.accessor('client_name', {
    header: 'Client',
    cell: (info) => (
      <span className="font-medium text-gray-900">{info.getValue()}</span>
    ),
  }),
  defaulterColumnHelper.accessor('client_phone', {
    header: 'Phone',
    cell: (info) => (
      <span className="text-gray-700 tabular-nums text-sm">{info.getValue()}</span>
    ),
  }),
  defaulterColumnHelper.accessor('total_outstanding', {
    header: 'Total Outstanding (UGX)',
    cell: (info) => (
      <span className="text-red-700 font-semibold tabular-nums text-sm">
        {formatCurrency(info.getValue())}
      </span>
    ),
  }),
  defaulterColumnHelper.accessor('overdue_count', {
    header: 'Overdue Invoices',
    cell: (info) => (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
        {info.getValue()}
      </span>
    ),
  }),
]

function DefaultersTab() {
  const { data, isLoading, error } = useDefaulters()

  const table = useReactTable({
    data,
    columns: defaulterColumns,
    getCoreRowModel: getCoreRowModel(),
  })

  function handleExportCsv() {
    const headers = ['Client', 'Phone', 'Total Outstanding (UGX)', 'Overdue Invoices']
    const rows = data.map((d) => [
      d.client_name,
      d.client_phone,
      String(d.total_outstanding),
      String(d.overdue_count),
    ])
    downloadCsv('defaulters.csv', [headers, ...rows])
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {isLoading ? 'Loading…' : `${data.length} client${data.length !== 1 ? 's' : ''} with overdue invoices`}
        </p>
        <button
          onClick={handleExportCsv}
          disabled={data.length === 0}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Export CSV
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
          Failed to load defaulters: {error.message}
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
                  <td colSpan={4} className="px-4 py-2">
                    <TableSkeleton rows={6} cols={4} />
                  </td>
                </tr>
              ) : table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-12 text-center text-gray-400 text-sm"
                  >
                    No defaulters found. All clients are up to date.
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
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// BillingPage — tabbed layout
// ---------------------------------------------------------------------------

type Tab = 'invoices' | 'defaulters'

export default function BillingPage() {
  const [activeTab, setActiveTab] = useState<Tab>('invoices')

  return (
    <div className="flex flex-col gap-4">
      {/* Page header */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Billing</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Manage invoices and track outstanding balances
        </p>
      </div>

      {/* Tabs */}
      <div
        className="flex border-b border-gray-200"
        role="tablist"
        aria-label="Billing sections"
      >
        {(
          [
            { id: 'invoices', label: 'Invoices' },
            { id: 'defaulters', label: 'Defaulters' },
          ] as { id: Tab; label: string }[]
        ).map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`tabpanel-${tab.id}`}
            id={`tab-${tab.id}`}
            onClick={() => setActiveTab(tab.id)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 ${
              activeTab === tab.id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab panels */}
      <div
        id="tabpanel-invoices"
        role="tabpanel"
        aria-labelledby="tab-invoices"
        hidden={activeTab !== 'invoices'}
      >
        {activeTab === 'invoices' && <InvoicesTab />}
      </div>

      <div
        id="tabpanel-defaulters"
        role="tabpanel"
        aria-labelledby="tab-defaulters"
        hidden={activeTab !== 'defaulters'}
      >
        {activeTab === 'defaulters' && <DefaultersTab />}
      </div>
    </div>
  )
}
