import { useState } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
} from '@tanstack/react-table'
import { useUsers, useDeleteUser } from './useUsers'
import type { SystemUser, UserRole } from './useUsers'
import UserForm from './UserForm'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-UG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return iso
  }
}

const ROLE_BADGE: Record<UserRole, string> = {
  Admin: 'bg-purple-100 text-purple-800',
  Operations_Manager: 'bg-blue-100 text-blue-800',
  Driver: 'bg-green-100 text-green-800',
  Finance: 'bg-yellow-100 text-yellow-800',
  Customer: 'bg-gray-100 text-gray-700',
}

const ROLE_LABELS: Record<UserRole, string> = {
  Admin: 'Admin',
  Operations_Manager: 'Ops Manager',
  Driver: 'Driver',
  Finance: 'Finance',
  Customer: 'Customer',
}

function RoleBadge({ role }: { role: UserRole }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${ROLE_BADGE[role] ?? 'bg-gray-100 text-gray-700'}`}>
      {ROLE_LABELS[role] ?? role}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Delete confirmation dialog
// ---------------------------------------------------------------------------

function DeleteDialog({
  user,
  onConfirm,
  onCancel,
  isPending,
}: {
  user: SystemUser
  onConfirm: () => void
  onCancel: () => void
  isPending: boolean
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 flex flex-col gap-4">
        <h3 className="text-base font-semibold text-gray-900">Delete user?</h3>
        <p className="text-sm text-gray-600">
          This will permanently delete <strong>{user.email}</strong> and all their data. This action cannot be undone.
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={isPending}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isPending}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-60 transition-colors flex items-center gap-2"
          >
            {isPending && (
              <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            )}
            {isPending ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Slide-over panel
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

const columnHelper = createColumnHelper<SystemUser>()

// ---------------------------------------------------------------------------
// UsersPage
// ---------------------------------------------------------------------------

export default function UsersPage() {
  const { data: users = [], isLoading, error } = useUsers()
  const deleteUser = useDeleteUser()

  const [formOpen, setFormOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<SystemUser | null>(null)
  const [deletingUser, setDeletingUser] = useState<SystemUser | null>(null)
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [search, setSearch] = useState('')

  const filtered = users.filter((u) => {
    const matchesRole = roleFilter === 'all' || u.role === roleFilter
    const q = search.toLowerCase()
    const matchesSearch =
      !q ||
      u.email.toLowerCase().includes(q) ||
      (u.full_name ?? '').toLowerCase().includes(q) ||
      (u.phone ?? '').toLowerCase().includes(q)
    return matchesRole && matchesSearch
  })

  const columns = [
    columnHelper.accessor('full_name', {
      header: 'Name',
      cell: (info) => (
        <div>
          <p className="font-medium text-gray-900 text-sm">{info.getValue() || '—'}</p>
          <p className="text-xs text-gray-500">{info.row.original.email}</p>
        </div>
      ),
    }),
    columnHelper.accessor('phone', {
      header: 'Phone',
      cell: (info) => <span className="text-sm text-gray-600">{info.getValue() || '—'}</span>,
    }),
    columnHelper.accessor('role', {
      header: 'Role',
      cell: (info) => <RoleBadge role={info.getValue()} />,
    }),
    columnHelper.accessor('created_at', {
      header: 'Created',
      cell: (info) => <span className="text-sm text-gray-500 whitespace-nowrap">{formatDate(info.getValue())}</span>,
    }),
    columnHelper.display({
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex items-center gap-2 justify-end">
          <button
            onClick={() => { setEditingUser(row.original); setFormOpen(true) }}
            className="text-xs font-medium text-blue-600 hover:text-blue-800 px-2 py-1 rounded hover:bg-blue-50 transition-colors focus:outline-none focus:ring-1 focus:ring-blue-400"
          >
            Edit
          </button>
          <button
            onClick={() => setDeletingUser(row.original)}
            className="text-xs font-medium text-red-600 hover:text-red-800 px-2 py-1 rounded hover:bg-red-50 transition-colors focus:outline-none focus:ring-1 focus:ring-red-400"
          >
            Delete
          </button>
        </div>
      ),
    }),
  ]

  const table = useReactTable({
    data: filtered,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  function openCreate() {
    setEditingUser(null)
    setFormOpen(true)
  }

  function closeForm() {
    setFormOpen(false)
    setEditingUser(null)
  }

  async function handleDelete() {
    if (!deletingUser) return
    await deleteUser.mutateAsync(deletingUser.id)
    setDeletingUser(null)
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">User Management</h2>
          <p className="text-sm text-gray-500 mt-0.5">Manage system accounts and roles</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
          Add user
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex flex-col gap-1">
          <label htmlFor="search-users" className="text-xs font-medium text-gray-600 uppercase tracking-wide">Search</label>
          <input
            id="search-users"
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name, email, or phone…"
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="filter-role" className="text-xs font-medium text-gray-600 uppercase tracking-wide">Role</label>
          <select
            id="filter-role"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All roles</option>
            <option value="Admin">Admin</option>
            <option value="Operations_Manager">Operations Manager</option>
            <option value="Driver">Driver</option>
            <option value="Finance">Finance</option>
            <option value="Customer">Customer</option>
          </select>
        </div>
        {(roleFilter !== 'all' || search) && (
          <button
            onClick={() => { setRoleFilter('all'); setSearch('') }}
            className="px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-400 transition-colors self-end"
          >
            Clear
          </button>
        )}
      </div>

      {/* Stats row */}
      {!isLoading && (
        <div className="flex gap-4 flex-wrap">
          {(['Admin', 'Operations_Manager', 'Driver', 'Finance', 'Customer'] as UserRole[]).map((r) => {
            const count = users.filter((u) => u.role === r).length
            return (
              <div key={r} className="bg-white border border-gray-200 rounded-lg px-4 py-2 flex items-center gap-2">
                <RoleBadge role={r} />
                <span className="text-sm font-semibold text-gray-800">{count}</span>
              </div>
            )
          })}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
          Failed to load users: {error.message}
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
                <tr>
                  <td colSpan={columns.length} className="px-4 py-12 text-center text-gray-400 text-sm">
                    Loading users…
                  </td>
                </tr>
              ) : table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="px-4 py-12 text-center text-gray-400 text-sm">
                    No users found.
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-4 py-3">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {!isLoading && filtered.length > 0 && (
          <div className="px-4 py-2 border-t border-gray-100 bg-gray-50 text-xs text-gray-500">
            Showing {filtered.length} of {users.length} users
          </div>
        )}
      </div>

      {/* Slide-over form */}
      <SlideOver open={formOpen} onClose={closeForm}>
        <UserForm user={editingUser} onClose={closeForm} />
      </SlideOver>

      {/* Delete confirmation */}
      {deletingUser && (
        <DeleteDialog
          user={deletingUser}
          onConfirm={handleDelete}
          onCancel={() => setDeletingUser(null)}
          isPending={deleteUser.isPending}
        />
      )}
    </div>
  )
}
