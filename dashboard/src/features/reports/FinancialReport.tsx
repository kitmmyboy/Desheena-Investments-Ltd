import { useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend,
  ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell,
} from 'recharts'
import { useFinancialReport, useDefaultersReport, useZoneList, type DefaulterRow } from './useReports'
import { downloadCsv } from '../../lib/exportCsv'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatUgx(amount: number): string {
  if (amount >= 1_000_000) return `UGX ${(amount / 1_000_000).toFixed(1)}M`
  if (amount >= 1_000) return `UGX ${(amount / 1_000).toFixed(0)}K`
  return `UGX ${amount.toLocaleString()}`
}

function formatUgxFull(amount: number): string {
  return `UGX ${amount.toLocaleString()}`
}

function formatPeriod(period: string | null): string {
  if (!period) return '—'
  const [y, m] = period.split('-')
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('en-UG', { year: 'numeric', month: 'short' })
}

// ---------------------------------------------------------------------------
// Summary card
// ---------------------------------------------------------------------------

function SummaryCard({ label, value, sub, isLoading, color = 'blue' }: {
  label: string; value: string; sub?: string; isLoading: boolean; color?: 'blue' | 'green' | 'red' | 'orange' | 'purple'
}) {
  const colors = {
    blue: 'border-blue-400 bg-blue-50 text-blue-700',
    green: 'border-green-400 bg-green-50 text-green-700',
    red: 'border-red-400 bg-red-50 text-red-700',
    orange: 'border-orange-400 bg-orange-50 text-orange-700',
    purple: 'border-purple-400 bg-purple-50 text-purple-700',
  }
  return (
    <div className={`rounded-xl border-l-4 p-4 shadow-sm bg-white ${colors[color].split(' ')[0]}`}>
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      {isLoading ? (
        <div className="mt-2 h-7 w-32 rounded bg-gray-200 animate-pulse" />
      ) : (
        <>
          <p className={`mt-1 text-xl font-bold tabular-nums ${colors[color].split(' ')[2]}`}>{value}</p>
          {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Chart tooltip
// ---------------------------------------------------------------------------

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm">
      <p className="font-semibold text-gray-800 mb-1">{label}</p>
      {payload.map((entry: any) => (
        <p key={entry.name} style={{ color: entry.color }}>
          {entry.name}: {formatUgxFull(entry.value)}
        </p>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Donut chart — invoice status breakdown
// ---------------------------------------------------------------------------

const DONUT_COLORS = { paid: '#22c55e', unpaid: '#f59e0b', overdue: '#ef4444' }

function InvoiceStatusDonut({ paid, unpaid, overdue, isLoading }: {
  paid: number; unpaid: number; overdue: number; isLoading: boolean
}) {
  const data = [
    { name: 'Paid', value: paid, color: DONUT_COLORS.paid },
    { name: 'Unpaid', value: unpaid, color: DONUT_COLORS.unpaid },
    { name: 'Overdue', value: overdue, color: DONUT_COLORS.overdue },
  ].filter((d) => d.value > 0)

  const total = paid + unpaid + overdue

  if (isLoading) {
    return <div className="h-48 bg-gray-100 animate-pulse rounded-lg" />
  }

  if (total === 0) {
    return <div className="h-48 flex items-center justify-center text-sm text-gray-400">No invoice data</div>
  }

  return (
    <div className="flex flex-col sm:flex-row items-center gap-4">
      <ResponsiveContainer width={160} height={160}>
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" innerRadius={45} outerRadius={70} dataKey="value" paddingAngle={2}>
            {data.map((entry, i) => <Cell key={i} fill={entry.color} />)}
          </Pie>
          <Tooltip formatter={(v: number) => [`${v.toLocaleString()} invoices`, '']} />
        </PieChart>
      </ResponsiveContainer>
      <div className="flex flex-col gap-2">
        {data.map((d) => (
          <div key={d.name} className="flex items-center gap-2 text-sm">
            <span className="w-3 h-3 rounded-full shrink-0" style={{ background: d.color }} />
            <span className="text-gray-700">{d.name}</span>
            <span className="font-semibold text-gray-900 tabular-nums ml-auto pl-4">{d.value.toLocaleString()}</span>
            <span className="text-gray-400 text-xs">({((d.value / total) * 100).toFixed(0)}%)</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Defaulters table
// ---------------------------------------------------------------------------

function DefaultersTable({ data, isLoading }: { data: DefaulterRow[]; isLoading: boolean }) {
  function handleExport() {
    const headers = ['Client', 'Phone', 'Zone', 'Total Invoiced', 'Total Paid', 'Outstanding', 'Overdue Invoices', 'Last Period']
    const rows = data.map((r) => [
      r.client_name, r.client_phone, r.zone ?? '—',
      r.total_invoiced, r.total_paid, r.outstanding,
      r.overdue_count, formatPeriod(r.last_invoice_period),
    ])
    downloadCsv('defaulters.csv', [headers, ...rows])
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between px-5 py-3 border-b border-gray-200">
        <div>
          <h3 className="text-sm font-semibold text-gray-700">Defaulters — Clients with Outstanding Balance</h3>
          {!isLoading && <p className="text-xs text-gray-400 mt-0.5">{data.length} client{data.length !== 1 ? 's' : ''} identified</p>}
        </div>
        <button
          onClick={handleExport}
          disabled={data.length === 0}
          className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Export CSV
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              {['Client', 'Phone', 'Zone', 'Total Invoiced', 'Paid So Far', 'Outstanding', 'Overdue', 'Last Period'].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {isLoading ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">Loading defaulters…</td></tr>
            ) : data.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-gray-400">No defaulters found — all clients are up to date.</td></tr>
            ) : (
              data.map((row) => (
                <tr key={row.client_id} className="hover:bg-red-50 transition-colors">
                  <td className="px-4 py-2.5 font-medium text-gray-900 whitespace-nowrap">{row.client_name}</td>
                  <td className="px-4 py-2.5 text-gray-600 tabular-nums whitespace-nowrap">{row.client_phone}</td>
                  <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">{row.zone ?? '—'}</td>
                  <td className="px-4 py-2.5 tabular-nums text-gray-700 whitespace-nowrap">{formatUgxFull(row.total_invoiced)}</td>
                  <td className="px-4 py-2.5 tabular-nums text-green-700 whitespace-nowrap">{formatUgxFull(row.total_paid)}</td>
                  <td className="px-4 py-2.5 tabular-nums font-semibold text-red-600 whitespace-nowrap">{formatUgxFull(row.outstanding)}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    {row.overdue_count > 0 ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        {row.overdue_count} overdue
                      </span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">{formatPeriod(row.last_invoice_period)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// FinancialReport
// ---------------------------------------------------------------------------

export default function FinancialReport() {
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [zone, setZone] = useState('')
  const [status, setStatus] = useState<'all' | 'paid' | 'unpaid' | 'overdue'>('all')
  const [activeView, setActiveView] = useState<'overview' | 'defaulters'>('overview')

  const { data: zones = [] } = useZoneList()

  const filters = {
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    zone: zone || undefined,
    status: status !== 'all' ? status : undefined,
  }

  const { data, isLoading, error } = useFinancialReport(filters)
  const { data: defaulters = [], isLoading: defaultersLoading } = useDefaultersReport({ zone: zone || undefined })

  function handleExportCsv() {
    if (!data) return
    const headers = ['Month', 'Total Invoiced (UGX)', 'Total Collected (UGX)', 'Outstanding (UGX)']
    const rows = data.monthlyRows.map((row) => [row.label, row.totalInvoiced, row.totalCollected, row.outstanding])
    downloadCsv('financial-report.csv', [headers, ...rows])
  }

  function clearFilters() {
    setDateFrom(''); setDateTo(''); setZone(''); setStatus('all')
  }

  const hasFilters = dateFrom || dateTo || zone || status !== 'all'

  return (
    <div className="flex flex-col gap-5">
      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-wrap gap-3 items-end">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">From (YYYY-MM)</label>
          <input type="month" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">To (YYYY-MM)</label>
          <input type="month" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">Zone</label>
          <select value={zone} onChange={(e) => setZone(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">All zones</option>
            {zones.map((z) => <option key={z} value={z}>{z}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">Invoice Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value as any)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="all">All statuses</option>
            <option value="paid">Paid</option>
            <option value="unpaid">Unpaid</option>
            <option value="overdue">Overdue</option>
          </select>
        </div>
        {hasFilters && (
          <button onClick={clearFilters}
            className="px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors self-end">
            Clear filters
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
          Failed to load financial report: {error.message}
        </div>
      )}

      {/* View toggle */}
      <div className="flex gap-2">
        {(['overview', 'defaulters'] as const).map((v) => (
          <button key={v} onClick={() => setActiveView(v)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              activeView === v ? 'bg-blue-600 text-white' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}>
            {v === 'overview' ? 'Overview' : `Defaulters${!defaultersLoading ? ` (${defaulters.length})` : ''}`}
          </button>
        ))}
      </div>

      {activeView === 'overview' && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <SummaryCard label="Total Invoiced" value={data ? formatUgx(data.totalInvoiced) : '—'} isLoading={isLoading} color="blue" />
            <SummaryCard label="Total Collected" value={data ? formatUgx(data.totalCollected) : '—'} isLoading={isLoading} color="green" />
            <SummaryCard label="Outstanding" value={data ? formatUgx(data.totalOutstanding) : '—'} isLoading={isLoading} color="red" />
            <SummaryCard label="Defaulters" value={data ? `${data.defaulterCount}` : '—'} sub="clients with balance" isLoading={isLoading} color="orange" />
            <SummaryCard label="Paid Invoices" value={data ? `${data.paidCount.toLocaleString()}` : '—'} sub={`of ${data ? (data.paidCount + data.unpaidCount + data.overdueCount).toLocaleString() : '—'} total`} isLoading={isLoading} color="purple" />
          </div>

          {/* Charts row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Bar chart — 12 months */}
            <div className="lg:col-span-2 bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Invoiced vs Collected — Last 12 Months</h3>
              {isLoading ? (
                <div className="h-56 bg-gray-100 animate-pulse rounded-lg" />
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={[...(data?.monthlyRows ?? [])].reverse()} margin={{ top: 4, right: 8, left: 0, bottom: 0 }} barCategoryGap="30%">
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false}
                      tickFormatter={(v: number) => v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : v >= 1_000 ? `${(v / 1_000).toFixed(0)}K` : String(v)} />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                    <Bar dataKey="totalInvoiced" name="Invoiced" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="totalCollected" name="Collected" fill="#22c55e" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Donut — invoice status */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Invoice Status Breakdown</h3>
              <InvoiceStatusDonut
                paid={data?.paidCount ?? 0}
                unpaid={data?.unpaidCount ?? 0}
                overdue={data?.overdueCount ?? 0}
                isLoading={isLoading}
              />
            </div>
          </div>

          {/* Monthly table */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between px-5 py-3 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-gray-700">Monthly Breakdown</h3>
              <button onClick={handleExportCsv} disabled={!data || data.monthlyRows.length === 0}
                className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                Export CSV
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {['Month', 'Total Invoiced (UGX)', 'Total Collected (UGX)', 'Outstanding (UGX)'].map((col) => (
                      <th key={col} className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {isLoading ? (
                    <tr><td colSpan={4} className="px-5 py-8 text-center text-gray-400">Loading…</td></tr>
                  ) : !data || data.monthlyRows.length === 0 ? (
                    <tr><td colSpan={4} className="px-5 py-10 text-center text-gray-400">No financial data available.</td></tr>
                  ) : (
                    data.monthlyRows.map((row) => (
                      <tr key={row.month} className="hover:bg-gray-50 transition-colors">
                        <td className="px-5 py-3 font-medium text-gray-900 whitespace-nowrap">{row.label}</td>
                        <td className="px-5 py-3 tabular-nums text-gray-700 whitespace-nowrap">{formatUgxFull(row.totalInvoiced)}</td>
                        <td className="px-5 py-3 tabular-nums text-green-700 whitespace-nowrap">{formatUgxFull(row.totalCollected)}</td>
                        <td className={`px-5 py-3 tabular-nums whitespace-nowrap font-medium ${row.outstanding > 0 ? 'text-red-600' : 'text-gray-500'}`}>
                          {formatUgxFull(row.outstanding)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {activeView === 'defaulters' && (
        <DefaultersTable data={defaulters} isLoading={defaultersLoading} />
      )}
    </div>
  )
}
