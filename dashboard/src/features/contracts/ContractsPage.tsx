import React, { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
  type PaginationState,
} from '@tanstack/react-table'
import { useContractsPage } from './useContractsPage'
import { useContractMutations } from './useContractMutations'
import ContractForm from './ContractForm'
import TerminateDialog from './TerminateDialog'
import type { ContractRow } from './types'
import { downloadCsv } from '../../lib/exportCsv'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return 'Open-ended'
  return new Date(dateStr).toLocaleDateString('en-UG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

function EffectiveStatusBadge({ status }: { status: ContractRow['effective_status'] }) {
  const styles: Record<ContractRow['effective_status'], string> = {
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
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function TableSkeleton({ rows = 8, cols = 6 }: { rows?: number; cols?: number }) {
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
// Page size options
// ---------------------------------------------------------------------------

const PAGE_SIZE_OPTIONS = [25, 50, 100] as const

// ---------------------------------------------------------------------------
// Column helper
// ---------------------------------------------------------------------------

const columnHelper = createColumnHelper<ContractRow>()

// ---------------------------------------------------------------------------
// ContractsPage
// ---------------------------------------------------------------------------

export default function ContractsPage() {
  const [searchParams] = useSearchParams()
  const clientIdParam = searchParams.get('clientId') ?? undefined

  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 25,
  })
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'terminate' | null>(null)
  const [selectedContract, setSelectedContract] = useState<ContractRow | null>(null)

  // Debounce search input — 300 ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput)
      setPagination((prev) => ({ ...prev, pageIndex: 0 }))
    }, 300)
    return () => clearTimeout(timer)
  }, [searchInput])

  // Reset page when filters change
  useEffect(() => {
    setPagination((prev) => ({ ...prev, pageIndex: 0 }))
  }, [statusFilter])

  const { data, count, isLoading, error } = useContractsPage({
    page: pagination.pageIndex,
    pageSize: pagination.pageSize as 25 | 50 | 100,
    search: search || undefined,
    status: statusFilter as 'all' | 'active' | 'suspended' | 'terminated' | 'ended',
    clientId: clientIdParam,
  })

  const { updateStatus, terminateContract } = useContractMutations()

  // -------------------------------------------------------------------------
  // Modal helpers
  // -------------------------------------------------------------------------

  function openCreate() {
    setSelectedContract(null)
    setModalMode('create')
  }

  function openEdit(contract: ContractRow) {
    setSelectedContract(contract)
    setModalMode('edit')
  }

  function openTerminate(contract: ContractRow) {
    setSelectedContract(contract)
    setModalMode('terminate')
  }

  function closeModal() {
    setModalMode(null)
    setSelectedContract(null)
  }

  async function handleTerminateConfirm(effectiveDate: string) {
    if (!selectedContract) return
    try {
      await terminateContract.mutateAsync({
        id: selectedContract.id,
        effective_date: effectiveDate,
      })
      closeModal()
    } catch {
      // Error surfaced via terminateContract.error — keep dialog open
    }
  }

  // -------------------------------------------------------------------------
  // Export CSV
  // -------------------------------------------------------------------------

  function handleExportCsv() {
    const headers = ['Client Name', 'Monthly Rate (UGX)', 'Start Date', 'End Date', 'Status']
    const rows = data.map((c) => [
      c.client_name,
      String(c.monthly_rate),
      c.start_date,
      c.end_date ?? 'Open-ended',
      c.effective_status,
    ])
    downloadCsv('contracts.csv', [headers, ...rows])
  }

  // -------------------------------------------------------------------------
  // Table columns
  // -------------------------------------------------------------------------

  const columns = useMemo(
    () => [
      columnHelper.accessor('client_name', {
        header: 'Client Name',
        cell: (info) => (
          <Link
            to="/dashboard/clients"
            className="font-medium text-blue-700 hover:underline focus:outline-none focus:underline"
          >
            {info.getValue()}
          </Link>
        ),
      }),
      columnHelper.accessor('monthly_rate', {
        header: () => <span className="block text-right">Monthly Rate (UGX)</span>,
        cell: (info) => (
          <span className="block text-right tabular-nums text-gray-700 text-sm">
            {info.getValue().toLocaleString()}
          </span>
        ),
      }),
      columnHelper.accessor('start_date', {
        header: 'Start Date',
        cell: (info) => (
          <span className="text-gray-700 text-sm tabular-nums">{formatDate(info.getValue())}</span>
        ),
      }),
      columnHelper.accessor('end_date', {
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
      columnHelper.accessor('effective_status', {
        header: 'Status',
        cell: (info) => <EffectiveStatusBadge status={info.getValue()} />,
      }),
      columnHelper.display({
        id: 'actions',
        header: 'Actions',
        cell: (info) => {
          const contract = info.row.original
          const { effective_status } = contract

          const canEdit =
            effective_status !== 'terminated' && effective_status !== 'ended'
          const canChangeStatus =
            effective_status === 'active' || effective_status === 'suspended'

          return (
            <div className="flex items-center gap-2 flex-wrap">
              {/* Edit button */}
              {canEdit && (
                <button
                  onClick={() => openEdit(contract)}
                  className="px-2.5 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors whitespace-nowrap"
                  aria-label={`Edit contract for ${contract.client_name}`}
                >
                  Edit
                </button>
              )}

              {/* Change Status actions */}
              {canChangeStatus && effective_status === 'active' && (
                <>
                  <button
                    onClick={() =>
                      updateStatus.mutate({ id: contract.id, status: 'suspended' })
                    }
                    className="px-2.5 py-1 text-xs font-medium text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-md hover:bg-yellow-100 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition-colors whitespace-nowrap"
                    aria-label={`Suspend contract for ${contract.client_name}`}
                  >
                    Suspend
                  </button>
                  <button
                    onClick={() => openTerminate(contract)}
                    className="px-2.5 py-1 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-md hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-400 transition-colors whitespace-nowrap"
                    aria-label={`Terminate contract for ${contract.client_name}`}
                  >
                    Terminate
                  </button>
                </>
              )}

              {canChangeStatus && effective_status === 'suspended' && (
                <>
                  <button
                    onClick={() =>
                      updateStatus.mutate({ id: contract.id, status: 'active' })
                    }
                    className="px-2.5 py-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-md hover:bg-green-100 focus:outline-none focus:ring-2 focus:ring-green-400 transition-colors whitespace-nowrap"
                    aria-label={`Resume contract for ${contract.client_name}`}
                  >
                    Resume
                  </button>
                  <button
                    onClick={() => openTerminate(contract)}
                    className="px-2.5 py-1 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-md hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-400 transition-colors whitespace-nowrap"
                    aria-label={`Terminate contract for ${contract.client_name}`}
                  >
                    Terminate
                  </button>
                </>
              )}
            </div>
          )
        },
      }),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  // -------------------------------------------------------------------------
  // Table instance
  // -------------------------------------------------------------------------

  const pageCount = useMemo(
    () => Math.max(1, Math.ceil(count / pagination.pageSize)),
    [count, pagination.pageSize]
  )

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

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Contracts</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Manage client contracts and their lifecycle
          </p>
        </div>
        <div className="flex items-center gap-3">
          {!isLoading && count > 0 && (
            <span className="text-sm text-gray-500">
              {from}–{to} of {count.toLocaleString()} contracts
            </span>
          )}
          <button
            onClick={openCreate}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
          >
            + New Contract
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"
              />
            </svg>
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by client name…"
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Search contracts by client name"
            />
          </div>

          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Filter by status"
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="terminated">Terminated</option>
            <option value="ended">Ended</option>
          </select>

          {/* Page size selector */}
          <div className="flex items-center gap-1.5 text-sm text-gray-600">
            <label htmlFor="page-size-toolbar" className="whitespace-nowrap">
              Show
            </label>
            <select
              id="page-size-toolbar"
              value={pagination.pageSize}
              onChange={(e) =>
                setPagination({ pageIndex: 0, pageSize: Number(e.target.value) as 25 | 50 | 100 })
              }
              className="border border-gray-300 rounded-lg px-2 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Export CSV */}
        <button
          onClick={handleExportCsv}
          disabled={data.length === 0}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Export CSV
        </button>
      </div>

      {/* Error state */}
      {error && (
        <div
          role="alert"
          className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700"
        >
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
                    No contracts found matching the current filters.
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
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span>Rows per page:</span>
            <select
              value={pagination.pageSize}
              onChange={(e) =>
                setPagination({ pageIndex: 0, pageSize: Number(e.target.value) as 25 | 50 | 100 })
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

      {/* ContractForm modal — create or edit */}
      {(modalMode === 'create' || modalMode === 'edit') && (
        <ContractForm
          contract={modalMode === 'edit' ? selectedContract : null}
          onClose={closeModal}
        />
      )}

      {/* TerminateDialog modal */}
      {modalMode === 'terminate' && selectedContract && (
        <TerminateDialog
          contract={selectedContract}
          onConfirm={handleTerminateConfirm}
          onCancel={closeModal}
          isLoading={terminateContract.isPending}
          error={terminateContract.error}
        />
      )}
    </div>
  )
}
