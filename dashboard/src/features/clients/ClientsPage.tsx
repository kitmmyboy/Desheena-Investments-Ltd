import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
  type PaginationState,
} from '@tanstack/react-table'
import { useClients, useMarkClientInactive, useMarkClientActive, type ClientWithContractStatus, type ClientsFilters } from './useClients'
import ClientForm from './ClientForm'
import ClientMapView from './ClientMapView'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCurrency(amount: number): string {
  return `UGX ${amount.toLocaleString()}`
}

function ContractStatusBadge({ status }: { status: string | null }) {
  if (!status) {
    return <span className="text-gray-400 text-xs italic">No contract</span>
  }
  const styles: Record<string, string> = {
    active: 'bg-green-100 text-green-800',
    suspended: 'bg-yellow-100 text-yellow-800',
    terminated: 'bg-red-100 text-red-800',
  }
  const cls = styles[status] ?? 'bg-gray-100 text-gray-700'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${cls}`}>
      {status}
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
// Column helper
// ---------------------------------------------------------------------------

const columnHelper = createColumnHelper<ClientWithContractStatus>()

function buildColumns(onRowClick: (client: ClientWithContractStatus) => void, onMarkInactive: (id: string) => void, onMarkActive: (id: string) => void) {
  return [
    columnHelper.accessor('name', {
      header: 'Name',
      cell: (info) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => onRowClick(info.row.original)}
            className="font-medium text-blue-700 hover:underline text-left focus:outline-none focus:underline"
          >
            {info.getValue()}
          </button>
          {!info.row.original.is_active && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-gray-200 text-gray-600">
              Inactive
            </span>
          )}
        </div>
      ),
    }),
    columnHelper.accessor('phone', {
      header: 'Phone',
      cell: (info) => <span className="text-gray-700 tabular-nums">{info.getValue()}</span>,
    }),
    columnHelper.accessor('email', {
      header: 'Email',
      cell: (info) => (
        <span className="text-gray-600 text-sm">{info.getValue() ?? '—'}</span>
      ),
    }),
    columnHelper.accessor('location_text', {
      header: 'Location',
      cell: (info) => (
        <span className="text-gray-700 text-sm max-w-[200px] truncate block" title={info.getValue()}>
          {info.getValue()}
        </span>
      ),
    }),
    columnHelper.accessor('service_frequency', {
      header: 'Service frequency',
      cell: (info) => <span className="text-gray-700 text-sm">{info.getValue()}</span>,
    }),
    columnHelper.accessor('monthly_rate', {
      header: 'Monthly rate',
      cell: (info) => (
        <span className="text-gray-700 tabular-nums text-sm">
          {formatCurrency(info.getValue())}
        </span>
      ),
    }),
    columnHelper.accessor('contract_status', {
      header: 'Contract status',
      cell: (info) => <ContractStatusBadge status={info.getValue()} />,
    }),
    columnHelper.display({
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        const client = row.original
        return (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              if (client.is_active) {
                if (confirm(`Mark "${client.name}" as inactive? They will be hidden from active client lists.`)) {
                  onMarkInactive(client.id)
                }
              } else {
                onMarkActive(client.id)
              }
            }}
            className={`text-xs font-medium px-2 py-1 rounded transition-colors focus:outline-none ${
              client.is_active
                ? 'text-gray-500 hover:text-red-600 hover:bg-red-50'
                : 'text-green-700 hover:bg-green-50'
            }`}
          >
            {client.is_active ? 'Mark Inactive' : 'Restore'}
          </button>
        )
      },
    }),
  ]
}

// ---------------------------------------------------------------------------
// Modal overlay
// ---------------------------------------------------------------------------

function Modal({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  // Close on Escape key
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
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Card */}
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
// ClientsPage
// ---------------------------------------------------------------------------

type ViewMode = 'table' | 'map'

export default function ClientsPage() {
  const navigate = useNavigate()
  const [viewMode, setViewMode] = useState<ViewMode>('table')

  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 50,
  })

  const [filters, setFilters] = useState<ClientsFilters>({})
  const [searchInput, setSearchInput] = useState('')
  const [zoneFilter, setZoneFilter] = useState('all')
  const [serviceFreqFilter, setServiceFreqFilter] = useState('all')
  const [contractStatusFilter, setContractStatusFilter] = useState('all')
  const [showInactive, setShowInactive] = useState(false)

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters((prev) => ({ ...prev, search: searchInput || undefined }))
      setPagination((prev) => ({ ...prev, pageIndex: 0 }))
    }, 300)
    return () => clearTimeout(timer)
  }, [searchInput])

  // Sync dropdown filters
  useEffect(() => {
    setFilters((prev) => ({
      ...prev,
      zone: zoneFilter !== 'all' ? zoneFilter : undefined,
      serviceFrequency: serviceFreqFilter !== 'all' ? serviceFreqFilter : undefined,
      contractStatus: contractStatusFilter !== 'all' ? contractStatusFilter : undefined,
    }))
    setPagination((prev) => ({ ...prev, pageIndex: 0 }))
  }, [zoneFilter, serviceFreqFilter, contractStatusFilter])

  const { data, count, isLoading, error } = useClients({
    ...filters,
    page: pagination.pageIndex,
    pageSize: pagination.pageSize,
    showInactive,
  })

  // Modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedClient, setSelectedClient] = useState<ClientWithContractStatus | null>(null)

  const markInactive = useMarkClientInactive()
  const markActive = useMarkClientActive()

  function openCreate() {
    setSelectedClient(null)
    setModalOpen(true)
  }

  function openEdit(client: ClientWithContractStatus) {
    setSelectedClient(client)
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    setSelectedClient(null)
  }

  const pageCount = useMemo(
    () => Math.max(1, Math.ceil(count / pagination.pageSize)),
    [count, pagination.pageSize]
  )

  const columns = useMemo(() => buildColumns(openEdit, markInactive.mutate, markActive.mutate), [markInactive.mutate, markActive.mutate])

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

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Clients</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Manage waste collection clients
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
          <button
            onClick={() => navigate('/dashboard/clients/import')}
            className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-400 transition-colors"
          >
            Import CSV
          </button>
          <button
            onClick={openCreate}
            className="px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
          >
            + Add client
          </button>
        </div>
      </div>

      {/* Map view */}
      {viewMode === 'map' && <ClientMapView />}

      {/* Table view */}
      {viewMode === 'table' && (
      <>
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
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
            placeholder="Search by name or phone…"
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Search clients"
          />
        </div>

        {/* Zone filter */}
        <select
          value={zoneFilter}
          onChange={(e) => setZoneFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label="Filter by zone"
        >
          <option value="all">All zones</option>
          <option value="Kito">Kito</option>
          <option value="Nsasa">Nsasa</option>
          <option value="Naalya">Naalya</option>
          <option value="Mbuya">Mbuya</option>
          <option value="Mbalwa">Mbalwa</option>
          <option value="Sonde">Sonde</option>
          <option value="Kimbejja">Kimbejja</option>
          <option value="Buwate">Buwate</option>
          <option value="Nabusigwe">Nabusigwe</option>
          <option value="Janda">Janda</option>
          <option value="Mulawa">Mulawa</option>
        </select>

        {/* Service frequency filter */}
        <select
          value={serviceFreqFilter}
          onChange={(e) => setServiceFreqFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label="Filter by service frequency"
        >
          <option value="all">All frequencies</option>
          <option value="daily">Daily</option>
          <option value="twice per week">Twice per week</option>
          <option value="three times per week">Three times per week</option>
          <option value="weekly">Weekly</option>
        </select>

        {/* Contract status filter */}
        <select
          value={contractStatusFilter}
          onChange={(e) => setContractStatusFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label="Filter by contract status"
        >
          <option value="all">All contract statuses</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="ended">Ended</option>
          <option value="terminated">Terminated</option>
          <option value="">No contract</option>
        </select>

        {/* Show inactive toggle */}
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => { setShowInactive(e.target.checked); setPagination((p) => ({ ...p, pageIndex: 0 })) }}
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          Show inactive clients
        </label>
      </div>

      {/* Error state */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
          Failed to load clients: {error.message}
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
                    No clients found matching the current filters.
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    className="hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => openEdit(row.original)}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        className="px-4 py-2.5 whitespace-nowrap"
                        onClick={(e) => {
                          // Prevent double-fire when clicking the name button
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
      </>
      )}

      {/* Modal */}
      {modalOpen && (
        <Modal onClose={closeModal}>
          <ClientForm
            client={selectedClient}
            onClose={closeModal}
          />
        </Modal>
      )}
    </div>
  )
}
