import React, { useEffect, useMemo, useState } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getExpandedRowModel,
  flexRender,
  createColumnHelper,
  type PaginationState,
  type ExpandedState,
  type RowData,
} from '@tanstack/react-table'

declare module '@tanstack/react-table' {
  interface TableMeta<TData extends RowData> {
    onClearDefaulter?: (data: {
      clientId: string
      clientName: string
      contractId: string
      outstandingBalance: number
    }) => void
  }
}
import { useInvoices, type Invoice } from './useInvoices'
import { useContractDefaulters, type ContractDefaulter, type MonthBreakdown } from './useContractDefaulters'
import { useContracts, type ContractWithClient, type ContractStatusFilter } from './useContracts'
import ManualInvoiceForm from './ManualInvoiceForm'
import InvoicePdfButton from './InvoicePdfButton'
import { useAuth } from '../auth/AuthContext'
import { supabase } from '../../lib/supabase'
import { downloadCsv } from '../../lib/exportCsv'
import ManualPaymentModal from './ManualPaymentModal'

import { formatCurrency, formatDate, formatPeriod } from '../../lib/utils'

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
// Page size options
// ---------------------------------------------------------------------------

const PAGE_SIZE_OPTIONS = [25, 50, 100]

// ---------------------------------------------------------------------------
// Invoices tab
// ---------------------------------------------------------------------------

const invoiceColumnHelper = createColumnHelper<Invoice>()

function buildInvoiceColumns(onRecordPayment: (invoice: Invoice) => void) {
  return [
    invoiceColumnHelper.accessor((row) => row.clients?.name ?? '—', {
      id: 'client_name',
      header: 'Client',
      cell: (info) => (
        <span className="font-medium text-gray-900">{info.getValue()}</span>
      ),
    }),
    invoiceColumnHelper.accessor('period_start', {
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
      id: 'actions',
      header: 'Actions',
      cell: (info) => (
        <div className="flex items-center gap-2">
          <InvoicePdfButton invoice={info.row.original} />
          <PayNowButton invoice={info.row.original} />
          {info.row.original.status !== 'paid' && (
            <button
              onClick={() => onRecordPayment(info.row.original)}
              className="text-blue-600 hover:bg-blue-50 px-2 py-1 rounded text-xs font-medium border border-blue-200 transition-colors"
            >
              Record
            </button>
          )}
        </div>
      ),
    }),
  ]
}

function InvoicesTab({ onRecordPayment }: { onRecordPayment: (invoice: Invoice) => void }) {
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

  const columns = useMemo(() => buildInvoiceColumns(onRecordPayment), [onRecordPayment])

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
      formatPeriod(inv.period_start),
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
// Defaulters tab (contract-powered)
// ---------------------------------------------------------------------------

type DefaulterFilter = 'all' | 'active' | 'ended'

// ---------------------------------------------------------------------------
// Month breakdown panel (rendered inside expanded rows)
// ---------------------------------------------------------------------------

interface MonthBreakdownPanelProps {
  defaulter: ContractDefaulter
  onRecordPayment: (invoiceId: string, amount: number) => void
}

function MonthBreakdownPanel({ defaulter, onRecordPayment }: MonthBreakdownPanelProps) {
  const hasPhone = defaulter.client_phone && defaulter.client_phone !== '—'

  return (
    <div className="px-6 py-4 bg-gray-50 border-t border-gray-100">
      {/* Contact card */}
      <div className="mb-4 bg-white border border-blue-100 rounded-xl p-4 flex flex-col sm:flex-row sm:items-start gap-4">
        {/* Avatar */}
        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-base shrink-0">
          {defaulter.client_name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900">{defaulter.client_name}</p>
          <div className="mt-1.5 flex flex-wrap gap-x-5 gap-y-1">
            {hasPhone && (
              <a
                href={`tel:${defaulter.client_phone}`}
                className="flex items-center gap-1.5 text-sm text-blue-700 hover:underline font-medium"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                </svg>
                {defaulter.client_phone}
              </a>
            )}
            {defaulter.client_email && (
              <a
                href={`mailto:${defaulter.client_email}`}
                className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-blue-700 hover:underline"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                  <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                </svg>
                {defaulter.client_email}
              </a>
            )}
            {defaulter.client_location && (
              <span className="flex items-center gap-1.5 text-sm text-gray-500">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                </svg>
                {defaulter.client_location}
                {defaulter.client_zone && ` · ${defaulter.client_zone}`}
              </span>
            )}
          </div>
        </div>
        {/* Quick summary */}
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className="text-xs text-gray-500">Outstanding</span>
          <span className="text-base font-bold text-red-600 tabular-nums">{formatCurrency(defaulter.outstanding_balance)}</span>
          <span className="text-xs text-gray-400">{defaulter.months_unpaid} month{defaulter.months_unpaid !== 1 ? 's' : ''} unpaid</span>
        </div>
      </div>

      {/* Month breakdown table */}
      {defaulter.month_breakdown.length === 0 ? (
        <div className="text-sm text-gray-400 py-2">No month breakdown available.</div>
      ) : (
        <table className="min-w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">Month</th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">Amount Owed (UGX)</th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">Status</th>
              <th className="px-4 py-2 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {defaulter.month_breakdown.map((entry) => {
              const statusStyles: Record<MonthBreakdown['status'], string> = {
                paid: 'bg-green-100 text-green-800',
                partial: 'bg-yellow-100 text-yellow-800',
                unpaid: 'bg-red-100 text-red-800',
              }
              const statusLabels: Record<MonthBreakdown['status'], string> = {
                paid: 'Paid', partial: 'Partial', unpaid: 'Unpaid',
              }
              return (
                <tr key={entry.month} className="hover:bg-gray-50">
                  <td className="px-4 py-2 whitespace-nowrap text-gray-700">{formatPeriod(entry.month)}</td>
                  <td className="px-4 py-2 whitespace-nowrap tabular-nums text-gray-700">{formatCurrency(entry.amount_owed)}</td>
                  <td className="px-4 py-2 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusStyles[entry.status]}`}>
                      {statusLabels[entry.status]}
                    </span>
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap text-right space-x-2">
                    {entry.status !== 'paid' && entry.invoice_id && (
                      <button
                        onClick={() => onRecordPayment(entry.invoice_id!, entry.amount_owed)}
                        className="text-blue-600 hover:text-blue-800 font-medium text-xs bg-blue-50 px-2 py-1 rounded"
                      >
                        Record Payment
                      </button>
                    )}
                    {entry.invoice_id && (
                      <InvoicePdfButton invoice={{
                        id: entry.invoice_id,
                        invoice_period: entry.month,
                        status: entry.status === 'paid' ? 'paid' : 'unpaid',
                        amount: entry.monthly_rate,
                        paid_amount: entry.paid_amount,
                        clients: { name: defaulter.client_name, phone: defaulter.client_phone }
                      } as any} />
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}

const defaulterColumnHelper = createColumnHelper<ContractDefaulter>()

function buildDefaulterColumns() {
  return [
    defaulterColumnHelper.display({
      id: 'expand',
      header: '',
      cell: (info) => (
        <button
          onClick={() => info.row.toggleExpanded()}
          className="p-1 text-gray-500 hover:text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded transition-colors"
          aria-label={info.row.getIsExpanded() ? 'Collapse row' : 'Expand row'}
          aria-expanded={info.row.getIsExpanded()}
        >
          {info.row.getIsExpanded() ? '▼' : '▶'}
        </button>
      ),
    }),
    defaulterColumnHelper.accessor('client_name', {
      id: 'client_name',
      header: 'Client Name',
      cell: (info) => (
        <span className="font-medium text-gray-900">{info.getValue()}</span>
      ),
    }),
    defaulterColumnHelper.accessor('client_phone', {
      id: 'client_phone',
      header: 'Phone',
      cell: (info) => (
        <span className="text-gray-700 tabular-nums text-sm">{info.getValue()}</span>
      ),
    }),
    defaulterColumnHelper.accessor('monthly_rate', {
      id: 'monthly_rate',
      header: 'Monthly Rate (UGX)',
      cell: (info) => (
        <span className="text-gray-700 tabular-nums text-sm">
          {formatCurrency(info.getValue())}
        </span>
      ),
    }),
    defaulterColumnHelper.accessor('months_unpaid', {
      id: 'months_unpaid',
      header: 'Months Unpaid',
      cell: (info) => (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
          {info.getValue()}
        </span>
      ),
    }),
    defaulterColumnHelper.accessor('outstanding_balance', {
      id: 'outstanding_balance',
      header: 'Outstanding Balance (UGX)',
      cell: (info) => (
        <span className="text-red-700 font-semibold tabular-nums text-sm">
          {formatCurrency(info.getValue())}
        </span>
      ),
    }),
    defaulterColumnHelper.accessor('end_date', {
      id: 'end_date',
      header: 'Contract End Date',
      cell: (info) => {
        const val = info.getValue()
        return (
          <span className="text-gray-700 text-sm tabular-nums">
            {val ? formatDate(val) : 'Open-ended'}
          </span>
        )
      },
    }),
    defaulterColumnHelper.display({
      id: 'actions',
      header: 'Actions',
      cell: (info) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              // This will trigger the Modal with clientId and outstandingBalance, but NO invoiceId
              // The Modal will then use useClearDefaulter
              info.table.options.meta?.onClearDefaulter?.({
                clientId: info.row.original.client_id,
                clientName: info.row.original.client_name,
                contractId: info.row.original.contract_id,
                outstandingBalance: info.row.original.outstanding_balance,
              })
            }}
            className="text-white bg-green-600 hover:bg-green-700 px-3 py-1 rounded-lg text-xs font-semibold transition-colors"
          >
            Pay / Adjust
          </button>
        </div>
      ),
    }),
  ]
}

function DefaultersTab({
  onRecordPayment,
  onClearDefaulter,
}: {
  onRecordPayment: (invoiceId: string, amount: number, clientName: string, clientId: string) => void
  onClearDefaulter: (data: any) => void
}) {
  const { data, isLoading, error } = useContractDefaulters()
  const [filter, setFilter] = useState<DefaulterFilter>('all')
  const [expanded, setExpanded] = useState<ExpandedState>({})

  const filteredData = useMemo(() => {
    if (filter === 'active') return data.filter((d) => d.defaulter_category === 'active')
    if (filter === 'ended') return data.filter((d) => d.defaulter_category === 'ended')
    return data
  }, [data, filter])

  const columns = useMemo(() => buildDefaulterColumns(), [])

  const table = useReactTable({
    data: filteredData,
    columns,
    state: { expanded },
    onExpandedChange: setExpanded,
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    meta: {
      onClearDefaulter,
    },
  })

  function handleExportCsv() {
    const headers = [
      'Client Name',
      'Phone',
      'Monthly Rate (UGX)',
      'Months Unpaid',
      'Outstanding Balance (UGX)',
      'Contract End Date',
    ]
    const rows = filteredData.map((d) => [
      d.client_name,
      d.client_phone,
      String(d.monthly_rate),
      String(d.months_unpaid),
      String(d.outstanding_balance),
      d.end_date ?? 'Open-ended',
    ])
    downloadCsv('defaulters.csv', [headers, ...rows])
  }

  const colCount = columns.length

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex flex-wrap items-center gap-3">
          {/* Category filter */}
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as DefaulterFilter)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Filter defaulters by category"
          >
            <option value="all">All Defaulters</option>
            <option value="active">Active Contract Defaulters</option>
            <option value="ended">Ended Contract Defaulters</option>
          </select>

          {!isLoading && (
            <span className="text-sm text-gray-500">
              {filteredData.length} client{filteredData.length !== 1 ? 's' : ''} with outstanding balance
            </span>
          )}
        </div>

        <button
          onClick={handleExportCsv}
          disabled={filteredData.length === 0}
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
                  <td colSpan={colCount} className="px-4 py-2">
                    <TableSkeleton rows={6} cols={colCount} />
                  </td>
                </tr>
              ) : table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={colCount}
                    className="px-4 py-12 text-center text-gray-400 text-sm"
                  >
                    No defaulters found for the selected filter.
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <React.Fragment key={row.id}>
                    <tr className="hover:bg-gray-50 transition-colors">
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id} className="px-4 py-2.5 whitespace-nowrap">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                    {row.getIsExpanded() && (
                      <tr>
                        <td colSpan={colCount} className="px-0 py-0 bg-gray-50">
                          <MonthBreakdownPanel
                            defaulter={row.original}
                            onRecordPayment={(invoiceId, amount) =>
                              onRecordPayment(invoiceId, amount, row.original.client_name, row.original.client_id)
                            }
                          />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
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
// ContractsTab
// ---------------------------------------------------------------------------

const contractColumnHelper = createColumnHelper<ContractWithClient>()

function buildContractColumns() {
  return [
    contractColumnHelper.accessor('client_name', {
      header: 'Client Name',
      cell: (info) => (
        <span className="font-medium text-gray-900">{info.getValue()}</span>
      ),
    }),
    contractColumnHelper.accessor('monthly_rate', {
      header: 'Monthly Rate (UGX)',
      cell: (info) => (
        <span className="text-gray-700 tabular-nums text-sm">
          {formatCurrency(info.getValue())}
        </span>
      ),
    }),
    contractColumnHelper.accessor('start_date', {
      header: 'Start Date',
      cell: (info) => (
        <span className="text-gray-700 text-sm tabular-nums">{formatDate(info.getValue())}</span>
      ),
    }),
    contractColumnHelper.accessor('end_date', {
      header: 'End Date',
      cell: (info) => {
        const val = info.getValue()
        return (
          <span className="text-gray-700 text-sm tabular-nums">
            {val ? formatDate(val) : 'Open-ended'}
          </span>
        )
      },
    }),
    contractColumnHelper.accessor('duration_months', {
      header: 'Duration',
      cell: (info) => (
        <span className="text-gray-700 text-sm tabular-nums">{info.getValue()} months</span>
      ),
    }),
    contractColumnHelper.accessor('effective_status', {
      header: 'Status',
      cell: (info) => {
        const status = info.getValue()
        const styles: Record<string, string> = {
          active: 'bg-green-100 text-green-800',
          suspended: 'bg-yellow-100 text-yellow-800',
          terminated: 'bg-red-100 text-red-800',
          ended: 'bg-gray-100 text-gray-700',
        }
        return (
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${styles[status] ?? 'bg-gray-100 text-gray-700'}`}
          >
            {status}
          </span>
        )
      },
    }),
  ]
}

function ContractsTab() {
  const [filter, setFilter] = useState<ContractStatusFilter>('all')
  const [search, setSearch] = useState('')
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 25,
  })

  const { data, count, isLoading, error } = useContracts({
    page: pagination.pageIndex,
    pageSize: pagination.pageSize,
    filter,
    search,
  })

  const pageCount = useMemo(
    () => Math.max(1, Math.ceil(count / pagination.pageSize)),
    [count, pagination.pageSize]
  )

  const columns = useMemo(() => buildContractColumns(), [])

  const table = useReactTable({
    data,
    columns,
    pageCount,
    state: { pagination },
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
  })

  function handleExportCsv() {
    const headers = ['Client Name', 'Monthly Rate (UGX)', 'Start Date', 'End Date', 'Duration', 'Status']
    const rows = data.map((c) => [
      c.client_name,
      String(c.monthly_rate),
      c.start_date,
      c.end_date ?? 'Open-ended',
      `${c.duration_months} months`,
      c.effective_status,
    ])
    downloadCsv('contracts.csv', [headers, ...rows])
  }

  const from = pagination.pageIndex * pagination.pageSize + 1
  const to = Math.min((pagination.pageIndex + 1) * pagination.pageSize, count)

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
            <input
              type="text"
              placeholder="Search contacts..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPagination((p) => ({ ...p, pageIndex: 0 }))
              }}
              className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 w-64 transition-all"
            />
          </div>

          {/* Status filter */}
          <select
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value as ContractStatusFilter)
              setPagination((p) => ({ ...p, pageIndex: 0 }))
            }}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Filter by contract status"
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive / Ended</option>
          </select>

          {!isLoading && count > 0 && (
            <span className="text-sm text-gray-500">
              {from}–{to} of {count.toLocaleString()} contracts
            </span>
          )}
        </div>

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
          Failed to load contracts: {error.message}
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
                  <td colSpan={6} className="px-4 py-2">
                    <TableSkeleton rows={8} cols={6} />
                  </td>
                </tr>
              ) : table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-12 text-center text-gray-400 text-sm"
                  >
                    No contracts found matching the current filter.
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
    </div>
  )
}

// ---------------------------------------------------------------------------
// BillingPage — tabbed layout
// ---------------------------------------------------------------------------

type Tab = 'invoices' | 'defaulters' | 'contracts'

export default function BillingPage() {
  const [activeTab, setActiveTab] = useState<Tab>('invoices')
  const [selectedPayment, setSelectedPayment] = useState<{
    clientId: string
    clientName: string
    contractId?: string
    outstandingBalance: number
    invoiceId?: string
  } | null>(null)

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
            { id: 'contracts', label: 'Contracts' },
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
        {activeTab === 'invoices' && (
          <InvoicesTab
            onRecordPayment={(invoice) =>
              setSelectedPayment({
                clientId: invoice.client_id,
                clientName: invoice.clients?.name ?? 'Unknown',
                outstandingBalance: invoice.amount - (invoice.paid_amount ?? 0),
                invoiceId: invoice.id,
              })
            }
          />
        )}
      </div>

      <div
        id="tabpanel-defaulters"
        role="tabpanel"
        aria-labelledby="tab-defaulters"
        hidden={activeTab !== 'defaulters'}
      >
        {activeTab === 'defaulters' && (
          <DefaultersTab
            onRecordPayment={(invoiceId, amount, clientName, clientId) =>
              setSelectedPayment({
                clientId,
                clientName,
                outstandingBalance: amount,
                invoiceId,
              })
            }
            onClearDefaulter={(data) => setSelectedPayment(data)}
          />
        )}
      </div>

      <div
        id="tabpanel-contracts"
        role="tabpanel"
        aria-labelledby="tab-contracts"
        hidden={activeTab !== 'contracts'}
      >
        {activeTab === 'contracts' && <ContractsTab />}
      </div>

      {selectedPayment && (
        <ManualPaymentModal
          clientId={selectedPayment.clientId}
          clientName={selectedPayment.clientName}
          contractId={selectedPayment.contractId}
          outstandingBalance={selectedPayment.outstandingBalance}
          invoiceId={selectedPayment.invoiceId}
          onClose={() => setSelectedPayment(null)}
        />
      )}
    </div>
  )
}
