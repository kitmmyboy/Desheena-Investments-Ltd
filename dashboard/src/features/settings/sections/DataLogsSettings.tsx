import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../../lib/supabase'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AuditLogEntry {
  id: string
  created_at: string
  event_type: string
  table_name: string | null
  record_id: string | null
  user_email: string | null
}

interface SystemLogEntry {
  id: string
  timestamp: string
  level: 'info' | 'warning' | 'error'
  message: string
  source: string
}

// ---------------------------------------------------------------------------
// Mock system logs
// ---------------------------------------------------------------------------

const MOCK_SYSTEM_LOGS: SystemLogEntry[] = [
  { id: '1', timestamp: new Date(Date.now() - 60000).toISOString(), level: 'info', message: 'Application started successfully', source: 'app' },
  { id: '2', timestamp: new Date(Date.now() - 120000).toISOString(), level: 'info', message: 'Database connection established', source: 'db' },
  { id: '3', timestamp: new Date(Date.now() - 300000).toISOString(), level: 'warning', message: 'Sync queue size approaching threshold (42 records)', source: 'sync' },
  { id: '4', timestamp: new Date(Date.now() - 600000).toISOString(), level: 'info', message: 'Invoice auto-generation completed: 12 invoices created', source: 'billing' },
  { id: '5', timestamp: new Date(Date.now() - 900000).toISOString(), level: 'error', message: 'SMS delivery failed for client ID abc123', source: 'sms' },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-UG', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  } catch {
    return iso
  }
}

const LEVEL_BADGE: Record<string, string> = {
  info: 'bg-blue-100 text-blue-700',
  warning: 'bg-yellow-100 text-yellow-700',
  error: 'bg-red-100 text-red-700',
}

// ---------------------------------------------------------------------------
// Audit log hook
// ---------------------------------------------------------------------------

function useAuditLog(filters: {
  dateFrom?: string
  dateTo?: string
  eventType?: string
  page: number
  pageSize: number
}) {
  return useQuery({
    queryKey: ['audit_log', filters],
    queryFn: async () => {
      let query = supabase
        .from('audit_log')
        .select('id, created_at, event_type, table_name, record_id, user_id', { count: 'exact' })
        .order('created_at', { ascending: false })

      if (filters.dateFrom) query = query.gte('created_at', filters.dateFrom)
      if (filters.dateTo) {
        const end = new Date(filters.dateTo)
        end.setDate(end.getDate() + 1)
        query = query.lt('created_at', end.toISOString().split('T')[0])
      }
      if (filters.eventType) query = query.eq('event_type', filters.eventType)

      const from = filters.page * filters.pageSize
      const to = from + filters.pageSize - 1
      query = query.range(from, to)

      const { data, count, error } = await query
      if (error) throw new Error(error.message)

      // Map to display format
      const rows: AuditLogEntry[] = (data ?? []).map((row: Record<string, unknown>) => ({
        id: row.id as string,
        created_at: row.created_at as string,
        event_type: row.event_type as string,
        table_name: row.table_name as string | null,
        record_id: row.record_id as string | null,
        user_email: null, // Would need a join or separate lookup
      }))

      return { rows, count: count ?? 0 }
    },
  })
}

// ---------------------------------------------------------------------------
// DataLogsSettings
// ---------------------------------------------------------------------------

export default function DataLogsSettings() {
  const [activeTab, setActiveTab] = useState<'audit' | 'system'>('audit')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [eventType, setEventType] = useState('')
  const [page, setPage] = useState(0)
  const pageSize = 25

  const { data: auditData, isLoading: auditLoading } = useAuditLog({
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    eventType: eventType || undefined,
    page,
    pageSize,
  })

  const pageCount = useMemo(
    () => Math.max(1, Math.ceil((auditData?.count ?? 0) / pageSize)),
    [auditData?.count]
  )

  return (
    <div className="flex flex-col gap-5">
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          {(['audit', 'system'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-3 text-sm font-medium transition-colors focus:outline-none ${
                activeTab === tab
                  ? 'border-b-2 border-blue-600 text-blue-700'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab === 'audit' ? 'Audit Log' : 'System Log'}
            </button>
          ))}
        </div>

        {/* Audit Log */}
        {activeTab === 'audit' && (
          <div>
            {/* Filters */}
            <div className="px-6 py-4 border-b border-gray-100 flex flex-wrap gap-3 items-end">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">From</label>
                <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(0) }} className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">To</label>
                <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(0) }} className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">Event Type</label>
                <input type="text" value={eventType} onChange={(e) => { setEventType(e.target.value); setPage(0) }} placeholder="e.g. INSERT" className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 w-40" />
              </div>
              {(dateFrom || dateTo || eventType) && (
                <button onClick={() => { setDateFrom(''); setDateTo(''); setEventType(''); setPage(0) }} className="px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 self-end">Clear</button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {['Timestamp', 'User', 'Event Type', 'Table', 'Record ID'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {auditLoading ? (
                    <tr><td colSpan={5} className="px-4 py-12 text-center text-gray-400 text-sm">Loading audit log…</td></tr>
                  ) : (auditData?.rows ?? []).length === 0 ? (
                    <tr><td colSpan={5} className="px-4 py-12 text-center text-gray-400 text-sm">No audit log entries found.</td></tr>
                  ) : (
                    (auditData?.rows ?? []).map((row) => (
                      <tr key={row.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 whitespace-nowrap text-gray-600">{formatDateTime(row.created_at)}</td>
                        <td className="px-4 py-2.5 text-gray-600">{row.user_email ?? '—'}</td>
                        <td className="px-4 py-2.5">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">{row.event_type}</span>
                        </td>
                        <td className="px-4 py-2.5 text-gray-600">{row.table_name ?? '—'}</td>
                        <td className="px-4 py-2.5 text-gray-500 font-mono text-xs">{row.record_id ? row.record_id.slice(0, 8) + '…' : '—'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
              <span className="text-sm text-gray-500">{auditData?.count ?? 0} entries</span>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <span>Page {page + 1} of {pageCount}</span>
                <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-40 hover:bg-gray-100">← Prev</button>
                <button onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))} disabled={page >= pageCount - 1} className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-40 hover:bg-gray-100">Next →</button>
              </div>
            </div>
          </div>
        )}

        {/* System Log */}
        {activeTab === 'system' && (
          <div>
            <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-500" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>
              <p className="text-sm text-gray-600">Full system logs available in the <a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Supabase dashboard</a>.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {['Timestamp', 'Level', 'Message', 'Source'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {MOCK_SYSTEM_LOGS.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 whitespace-nowrap text-gray-600">{formatDateTime(log.timestamp)}</td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize ${LEVEL_BADGE[log.level] ?? 'bg-gray-100 text-gray-700'}`}>{log.level}</span>
                      </td>
                      <td className="px-4 py-2.5 text-gray-700">{log.message}</td>
                      <td className="px-4 py-2.5 text-gray-500 font-mono text-xs">{log.source}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
