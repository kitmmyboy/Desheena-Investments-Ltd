import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
  type PaginationState,
} from '@tanstack/react-table'
import { useStaffList, useDeleteStaff } from './useStaff'
import type { StaffMember, StaffRole, StaffStatus, StaffFilters } from './useStaff'
import StaffForm from './StaffForm'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('en-UG', { year: 'numeric', month: 'short', day: 'numeric' })
  } catch {
    return iso
  }
}

const ROLE_BADGE: Record<StaffRole, string> = {
  Driver: 'bg-green-100 text-green-800',
  Admin: 'bg-purple-100 text-purple-800',
  Finance: 'bg-yellow-100 text-yellow-800',
  Operations_Manager: 'bg-blue-100 text-blue-800',
  Support: 'bg-gray-100 text-gray-700',
}

const ROLE_LABELS: Record<StaffRole, string> = {
  Driver: 'Driver',
  Admin: 'Admin',
  Finance: 'Finance',
  Operations_Manager: 'Ops Manager',
  Support: 'Support',
}

const STATUS_BADGE: Record<StaffStatus, string> = {
  active: 'bg-green-100 text-green-800',
  suspended: 'bg-orange-100 text-orange-800',
  terminated: 'bg-red-100 text-red-800',
}

function RoleBadge({ role }: { role: StaffRole }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${ROLE_BADGE[role] ?? 'bg-gray-100 text-gray-700'}`}>
      {ROLE_LABELS[role] ?? role}
    </span>
  )
}

function StatusBadge({ status }: { status: StaffStatus }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_BADGE[status] ?? 'bg-gray-100 text-gray-700'}`}>
      {status}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Slide-over
// ---------------------------------------------------------------------------

function SlideOver({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} aria-hidden="true" />
      <div className="relative w-full max-w-md bg-white shadow-2xl flex flex-col overflow-y-auto">
        <div className="p-6 flex-1">{children}</div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Column helper
// ---------------------------------------------------------------------------

const columnHelper = createColumnHelper<StaffMember>()

const PAGE_SIZE_OPTIONS = [25, 50, 100]

// ---------------------------------------------------------------------------
// StaffListPage
// ---------------------------------------------------------------------------

export default function StaffListPage() {
  const navigate = useNavigate()
  const deleteStaff = useDeleteStaff()

  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 25 })
  const [roleFilter, setRoleFilter] = useState<StaffRole | ''>('')
  const [statusFilter, setStatusFilter] = useState<StaffStatus | ''>('')
  const [zoneFilter, setZoneFilter] = useState('')
  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null)

  const filters: StaffFilters = useMemo(() => ({
    role: roleFilter || undefined,
    status: statusFilter || undefined,
    zone: zoneFilter || undefined,
    search: search || undefined,
    page: pagination.pageIndex,
    pageSize: pagination.pageSize,
  }), [roleFilter, statusFilter, zoneFilter, search, pagination])

  const { data, isLoading, error } = useStaffList(filters)
  const rows = data?.rows ?? []
  const count = data?.count ?? 0

  useEffect(() => {
    setPagination((prev) => ({ ...prev, pageIndex: 0 }))
  }, [roleFilter, statusFilter, zoneFilter, search])

  const pageCount = useMemo(() => Math.max(1, Math.ceil(count / pagination.pageSize)), [count, pagination.pageSize])

  const columns = useMemo(() => [
    columnHelper.accessor('full_name', {
      header: 'Name',
      cell: (info) => (
        <button
          onClick={() => navigate(`/dashboard/staff/${info.row.original.id}`)}
          className="font-medium text-blue-700 hover:underline text-left focus:outline-none"
        >
          {info.getValue()}
        </button>
      ),
    }),
    columnHelper.accessor('role', {
      header: 'Role',
      cell: (info) => <RoleBadge role={info.getValue()} />,
    }),
    columnHelper.accessor('phone', {
      header: 'Phone',
      cell: (info) => <span className="text-sm text-gray-600">{info.getValue() ?? '—'}</span>,
    }),
    columnHelper.accessor('zone', {
      header: 'Zone',
      cell: (info) => <span className="text-sm text-gray-600">{info.getValue() ?? '—'}</span>,
    }),
    columnHelper.accessor('status', {
      header: 'Status',
      cell: (info) => <StatusBadge status={info.getValue()} />,
    }),
    columnHelper.accessor('hire_date', {
      header: 'Hire Date',
      cell: (info) => <span className="text-sm text-gray-500 whitespace-nowrap">{formatDate(info.getValue())}</span>,
    }),
    columnHelper.display({
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex items-center gap-2 justify-end">
          <button
            onClick={(e) => { e.stopPropagation(); setEditingStaff(row.original); setFormOpen(true) }}
            className="text-xs font-medium text-blue-600 hover:text-blue-800 px-2 py-1 rounded hover:bg-blue-50 transition-colors"
          >
            Edit
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); if (confirm('Terminate this staff member?')) deleteStaff.mutate(row.original.id) }}
            className="text-xs font-medium text-red-600 hover:text-red-800 px-2 py-1 rounded hover:bg-red-50 transition-colors"
          >
            Terminate
          </button>
        </div>
      ),
    }),
  ], [navigate, deleteStaff])

  const table = useReactTable({
    data: rows,
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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Staff Management</h2>
          <p className="text-sm text-gray-500 mt-0.5">Manage staff members, drivers, and their details</p>
        </div>
        <div className="flex items-center gap-3">
          {!isLoading && count > 0 && (
            <span className="text-sm text-gray-500">{from}–{to} of {count.toLocaleString()}</span>
          )}
          <button
            onClick={() => { setEditingStaff(null); setFormOpen(true) }}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" /></svg>
            Add Staff
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">Search</label>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name, email, or phone…"
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 w-56"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">Role</label>
          <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as StaffRole | '')} className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">All roles</option>
            <option value="Driver">Driver</option>
            <option value="Admin">Admin</option>
            <option value="Finance">Finance</option>
            <option value="Operations_Manager">Operations Manager</option>
            <option value="Support">Support</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">Status</label>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StaffStatus | '')} className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="terminated">Terminated</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">Zone</label>
          <input type="text" value={zoneFilter} onChange={(e) => setZoneFilter(e.target.value)} placeholder="e.g. Naalya" className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 w-32" />
        </div>
        {(roleFilter || statusFilter || zoneFilter || search) && (
          <button
            onClick={() => { setRoleFilter(''); setStatusFilter(''); setZoneFilter(''); setSearch('') }}
            className="px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 self-end"
          >
            Clear
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
          Failed to load staff: {(error as Error).message}
        </div>
      )}

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id}>
                  {hg.headers.map((h) => (
                    <th key={h.id} className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">
                      {flexRender(h.column.columnDef.header, h.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {isLoading ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-400 text-sm">Loading staff…</td></tr>
              ) : table.getRowModel().rows.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-400 text-sm">No staff members found.</td></tr>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    className="hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => navigate(`/dashboard/staff/${row.original.id}`)}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-4 py-2.5 whitespace-nowrap" onClick={(e) => { if ((e.target as HTMLElement).tagName === 'BUTTON') e.stopPropagation() }}>
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
            <select value={pagination.pageSize} onChange={(e) => setPagination({ pageIndex: 0, pageSize: Number(e.target.value) })} className="border border-gray-300 rounded px-2 py-1 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
              {PAGE_SIZE_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span>Page {pagination.pageIndex + 1} of {pageCount}</span>
            <button onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-40 hover:bg-gray-100">← Prev</button>
            <button onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-40 hover:bg-gray-100">Next →</button>
          </div>
        </div>
      </div>

      {/* Slide-over form */}
      <SlideOver open={formOpen} onClose={() => { setFormOpen(false); setEditingStaff(null) }}>
        <StaffForm staff={editingStaff} onClose={() => { setFormOpen(false); setEditingStaff(null) }} />
      </SlideOver>
    </div>
  )
}
