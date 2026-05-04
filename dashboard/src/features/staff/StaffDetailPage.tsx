import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { useStaffDetail, useStaffPerformance } from './useStaff'
import type { StaffRole, StaffStatus } from './useStaff'
import StaffForm from './StaffForm'
import { supabase } from '../../lib/supabase'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('en-UG', { year: 'numeric', month: 'long', day: 'numeric' })
  } catch {
    return iso
  }
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('en-UG', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
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

// ---------------------------------------------------------------------------
// Recent collections hook
// ---------------------------------------------------------------------------

function useRecentCollections(userId: string | null | undefined) {
  return useQuery({
    queryKey: ['staff_recent_collections', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('collections')
        .select('id, collected_at, waste_type, weight_kg, sync_status, clients(name)')
        .eq('driver_id', userId!)
        .order('collected_at', { ascending: false })
        .limit(10)
      if (error) throw new Error(error.message)
      return data ?? []
    },
  })
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
// StaffDetailPage
// ---------------------------------------------------------------------------

export default function StaffDetailPage() {
  const { staffId } = useParams<{ staffId: string }>()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<'profile' | 'activity' | 'performance'>('profile')
  const [editOpen, setEditOpen] = useState(false)

  const { data: staff, isLoading, error } = useStaffDetail(staffId)
  const { data: performance } = useStaffPerformance(staffId, staff?.user_id)
  const { data: recentCollections = [] } = useRecentCollections(staff?.user_id)

  if (isLoading) {
    return <div className="flex items-center justify-center h-64 text-gray-400 text-sm">Loading…</div>
  }

  if (error || !staff) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
        {error ? (error as Error).message : 'Staff member not found.'}
      </div>
    )
  }

  // Performance rating
  const rating = performance
    ? performance.sync_success_rate >= 90 && performance.missed_pickups < 2
      ? 'Excellent'
      : performance.sync_success_rate >= 70
        ? 'Good'
        : 'Needs Improvement'
    : null

  const ratingColor = rating === 'Excellent' ? 'text-green-600' : rating === 'Good' ? 'text-blue-600' : 'text-orange-600'

  return (
    <div className="flex flex-col gap-5 max-w-4xl">
      {/* Back button */}
      <button
        onClick={() => navigate('/dashboard/staff')}
        className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 w-fit"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" /></svg>
        Back to Staff
      </button>

      {/* Header */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-full bg-gray-200 flex items-center justify-center text-xl font-bold text-gray-600">
              {staff.full_name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">{staff.full_name}</h2>
              <div className="flex items-center gap-2 mt-1">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${ROLE_BADGE[staff.role] ?? 'bg-gray-100 text-gray-700'}`}>
                  {ROLE_LABELS[staff.role] ?? staff.role}
                </span>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_BADGE[staff.status] ?? 'bg-gray-100 text-gray-700'}`}>
                  {staff.status}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={() => setEditOpen(true)}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Edit
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 bg-white rounded-t-xl overflow-hidden">
        {(['profile', 'activity', 'performance'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-6 py-3 text-sm font-medium capitalize transition-colors focus:outline-none ${
              activeTab === tab
                ? 'border-b-2 border-blue-600 text-blue-700'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Profile Tab */}
      {activeTab === 'profile' && (
        <div className="flex flex-col gap-5">
          {/* Personal Info */}
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Personal Information</h3>
            <dl className="grid grid-cols-2 gap-4">
              {[
                { label: 'Phone', value: staff.phone ?? '—' },
                { label: 'Email', value: staff.email ?? '—' },
                { label: 'National ID', value: staff.national_id ?? '—' },
                { label: 'Zone', value: staff.zone ?? '—' },
                { label: 'Hire Date', value: formatDate(staff.hire_date) },
                { label: 'Employment Type', value: staff.employment_type },
              ].map(({ label, value }) => (
                <div key={label}>
                  <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</dt>
                  <dd className="text-sm text-gray-900 mt-0.5 capitalize">{value}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Job Info */}
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Job Information</h3>
            <dl className="grid grid-cols-2 gap-4">
              <div>
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">Role</dt>
                <dd className="mt-0.5">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${ROLE_BADGE[staff.role] ?? 'bg-gray-100 text-gray-700'}`}>
                    {ROLE_LABELS[staff.role] ?? staff.role}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">Status</dt>
                <dd className="mt-0.5">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_BADGE[staff.status] ?? 'bg-gray-100 text-gray-700'}`}>
                    {staff.status}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">Linked User Account</dt>
                <dd className="text-sm text-gray-900 mt-0.5">
                  {staff.user_id ? (
                    <span className="text-blue-600 font-mono text-xs">{staff.user_id.slice(0, 8)}…</span>
                  ) : (
                    <span className="text-gray-400 italic">Not linked</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">Member Since</dt>
                <dd className="text-sm text-gray-900 mt-0.5">{formatDate(staff.created_at)}</dd>
              </div>
            </dl>
          </div>

          {/* Driver Details */}
          {staff.role === 'Driver' && (
            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Driver Details</h3>
              {staff.driver_details ? (
                <dl className="grid grid-cols-2 gap-4">
                  {[
                    { label: 'License Number', value: staff.driver_details.license_number ?? '—' },
                    { label: 'License Expiry', value: formatDate(staff.driver_details.license_expiry) },
                    { label: 'Assigned Truck', value: staff.driver_details.assigned_truck ?? '—' },
                    { label: 'Device ID', value: staff.driver_details.device_id ?? '—' },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</dt>
                      <dd className="text-sm text-gray-900 mt-0.5 font-mono">{value}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="text-sm text-gray-400 italic">No driver details recorded.</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Activity Tab */}
      {activeTab === 'activity' && (
        <div className="flex flex-col gap-5">
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Recent Activity</h3>
            <dl className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">Last Collection</dt>
                <dd className="text-sm text-gray-900 mt-0.5">
                  {recentCollections.length > 0
                    ? formatDateTime((recentCollections[0] as { collected_at: string }).collected_at)
                    : '—'}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total Collections</dt>
                <dd className="text-sm text-gray-900 mt-0.5">{recentCollections.length}</dd>
              </div>
            </dl>

            <h4 className="text-xs font-semibold text-gray-700 mb-3">Recent Collections (last 10)</h4>
            {recentCollections.length === 0 ? (
              <p className="text-sm text-gray-400 italic">No collections recorded.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm divide-y divide-gray-100">
                  <thead>
                    <tr className="bg-gray-50">
                      {['Date', 'Client', 'Waste Type', 'Weight (kg)', 'Sync'].map((h) => (
                        <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {(recentCollections as unknown as Array<{
                      id: string
                      collected_at: string
                      waste_type: string
                      weight_kg: number
                      sync_status: string
                      clients: { name: string } | null
                    }>).map((c) => (
                      <tr key={c.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2 whitespace-nowrap text-gray-600">{formatDateTime(c.collected_at)}</td>
                        <td className="px-3 py-2 text-gray-700">{c.clients?.name ?? '—'}</td>
                        <td className="px-3 py-2 text-gray-600 capitalize">{c.waste_type}</td>
                        <td className="px-3 py-2 text-gray-600">{c.weight_kg}</td>
                        <td className="px-3 py-2">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${c.sync_status === 'synced' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                            {c.sync_status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Performance Tab */}
      {activeTab === 'performance' && (
        <div className="flex flex-col gap-5">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Collections Today', value: performance?.collections_today ?? '—', color: 'text-blue-600' },
              { label: 'Total Weight (kg)', value: performance?.total_weight?.toFixed(1) ?? '—', color: 'text-green-600' },
              { label: 'Sync Success Rate', value: performance ? `${performance.sync_success_rate}%` : '—', color: 'text-purple-600' },
              { label: 'Missed Pickups', value: performance?.missed_pickups ?? '—', color: 'text-orange-600' },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-white border border-gray-200 rounded-xl p-5">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
                <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
              </div>
            ))}
          </div>

          {/* Rating */}
          {rating && (
            <div className="bg-white border border-gray-200 rounded-xl p-5 flex items-center gap-3">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Performance Rating</p>
                <p className={`text-lg font-bold mt-0.5 ${ratingColor}`}>{rating}</p>
              </div>
              <div className="ml-auto text-xs text-gray-400">
                Based on sync rate and missed pickups
              </div>
            </div>
          )}

          {/* Chart */}
          {performance && performance.collections_last_7_days.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Collections — Last 7 Days</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={performance.collections_last_7_days} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v: string) => new Date(v).toLocaleDateString('en-UG', { month: 'short', day: 'numeric' })}
                  />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip
                    labelFormatter={(v: string) => new Date(v).toLocaleDateString('en-UG', { weekday: 'short', month: 'short', day: 'numeric' })}
                    formatter={(v: number) => [v, 'Collections']}
                  />
                  <Bar dataKey="count" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* Edit slide-over */}
      <SlideOver open={editOpen} onClose={() => setEditOpen(false)}>
        <StaffForm staff={staff} onClose={() => setEditOpen(false)} />
      </SlideOver>
    </div>
  )
}
