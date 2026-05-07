import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
} from '@tanstack/react-table'
import { supabase } from '../../../lib/supabase'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DriverRow {
  id: string
  email: string
  full_name: string | null
  last_sync: string | null
  pending_records: number
  status: 'active' | 'disabled'
}

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

async function fetchDrivers(): Promise<DriverRow[]> {
  const { data: json, error } = await supabase.functions.invoke('manage-users', {
    method: 'GET',
  })
  if (error || !json) return []

  const users = (json.users ?? []) as Array<{
    id: string
    email: string
    full_name: string | null
    role: string
    user_metadata?: { device_disabled?: boolean }
  }>

  const drivers = users.filter((u) => u.role === 'Driver')

  const rows: DriverRow[] = await Promise.all(
    drivers.map(async (driver) => {
      const [lastSyncRes, pendingRes] = await Promise.all([
        supabase
          .from('collections')
          .select('collected_at')
          .eq('driver_id', driver.id)
          .order('collected_at', { ascending: false })
          .limit(1),
        supabase
          .from('collections')
          .select('id', { count: 'exact', head: true })
          .eq('driver_id', driver.id)
          .eq('sync_status', 'pending'),
      ])

      return {
        id: driver.id,
        email: driver.email,
        full_name: driver.full_name,
        last_sync: lastSyncRes.data?.[0]?.collected_at ?? null,
        pending_records: pendingRes.count ?? 0,
        status: (driver.user_metadata?.device_disabled ? 'disabled' : 'active') as 'active' | 'disabled',
      }
    })
  )

  return rows
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDateTime(iso: string | null): string {
  if (!iso) return 'Never'
  try {
    return new Date(iso).toLocaleString('en-UG', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    })
  } catch {
    return iso
  }
}

const columnHelper = createColumnHelper<DriverRow>()

// ---------------------------------------------------------------------------
// DevicesSettings
// ---------------------------------------------------------------------------

export default function DevicesSettings() {
  const queryClient = useQueryClient()

  const { data: drivers = [], isLoading, error } = useQuery({
    queryKey: ['devices_drivers'],
    queryFn: fetchDrivers,
    refetchInterval: 30_000,
  })

  async function handleForceLogout(driverId: string) {
    await supabase.functions.invoke(`manage-users?id=${driverId}`, {
      method: 'DELETE',
    })
    queryClient.invalidateQueries({ queryKey: ['devices_drivers'] })
  }

  async function handleDisableDevice(driverId: string) {
    await supabase.functions.invoke('manage-users', {
      method: 'PUT',
      body: { id: driverId, user_metadata: { device_disabled: true } },
    })
    queryClient.invalidateQueries({ queryKey: ['devices_drivers'] })
  }

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
    columnHelper.accessor('last_sync', {
      header: 'Last Sync',
      cell: (info) => <span className="text-sm text-gray-600 whitespace-nowrap">{formatDateTime(info.getValue())}</span>,
    }),
    columnHelper.accessor('pending_records', {
      header: 'Pending Records',
      cell: (info) => (
        <span className={`text-sm font-medium ${info.getValue() > 0 ? 'text-orange-600' : 'text-gray-600'}`}>
          {info.getValue()}
        </span>
      ),
    }),
    columnHelper.accessor('status', {
      header: 'Status',
      cell: (info) => (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${info.getValue() === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {info.getValue() === 'active' ? 'Active' : 'Disabled'}
        </span>
      ),
    }),
    columnHelper.display({
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleForceLogout(row.original.id)}
            className="text-xs font-medium text-orange-600 hover:text-orange-800 px-2 py-1 rounded hover:bg-orange-50 transition-colors"
          >
            Force Logout
          </button>
          <button
            onClick={() => handleDisableDevice(row.original.id)}
            disabled={row.original.status === 'disabled'}
            className="text-xs font-medium text-red-600 hover:text-red-800 px-2 py-1 rounded hover:bg-red-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Disable Device
          </button>
        </div>
      ),
    }),
  ]

  const table = useReactTable({
    data: drivers,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <div className="flex flex-col gap-5">
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-gray-900">Devices & Drivers</h3>
            <p className="text-sm text-gray-500 mt-0.5">Live view of all driver devices. Refreshes every 30 seconds.</p>
          </div>
          <span className="text-xs text-gray-400">{drivers.length} driver{drivers.length !== 1 ? 's' : ''}</span>
        </div>

        {error && (
          <div className="px-6 py-4 text-sm text-red-600">Failed to load drivers: {(error as Error).message}</div>
        )}

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
                  <td colSpan={5} className="px-4 py-12 text-center text-gray-400 text-sm">Loading drivers…</td>
                </tr>
              ) : table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-gray-400 text-sm">No drivers found.</td>
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
      </div>
    </div>
  )
}
