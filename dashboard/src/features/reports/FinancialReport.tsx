import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'
import { useFinancialReport, type MonthlyFinancialRow } from './useReports'
import { downloadCsv } from '../../lib/exportCsv'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatUgx(amount: number): string {
  return `UGX ${amount.toLocaleString()}`
}

// ---------------------------------------------------------------------------
// Summary cards
// ---------------------------------------------------------------------------

function SummaryCard({
  label,
  value,
  isLoading,
  accent = 'blue',
}: {
  label: string
  value: string
  isLoading: boolean
  accent?: 'blue' | 'red' | 'orange'
}) {
  const accentMap = {
    blue: 'border-blue-400 bg-blue-50',
    red: 'border-red-400 bg-red-50',
    orange: 'border-orange-400 bg-orange-50',
  }
  return (
    <div
      className={`rounded-xl border-l-4 p-5 shadow-sm ${accentMap[accent]} bg-white`}
    >
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      {isLoading ? (
        <div className="mt-2 h-7 w-32 rounded bg-gray-200 animate-pulse" />
      ) : (
        <p className="mt-1 text-2xl font-bold text-gray-900 tabular-nums">{value}</p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Table skeleton
// ---------------------------------------------------------------------------

function TableSkeleton({ rows = 6, cols = 4 }: { rows?: number; cols?: number }) {
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
// Custom tooltip for the bar chart
// ---------------------------------------------------------------------------

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: { name: string; value: number; color: string }[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm">
      <p className="font-semibold text-gray-800 mb-1">{label}</p>
      {payload.map((entry) => (
        <p key={entry.name} style={{ color: entry.color }}>
          {entry.name}: {formatUgx(entry.value)}
        </p>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// FinancialReport
// ---------------------------------------------------------------------------

export default function FinancialReport() {
  const { data, isLoading, error } = useFinancialReport()

  function handleExportCsv() {
    if (!data) return
    const headers = ['Month', 'Total Invoiced (UGX)', 'Total Collected (UGX)', 'Outstanding (UGX)']
    const rows = data.monthlyRows.map((row) => [
      row.label,
      row.totalInvoiced,
      row.totalCollected,
      row.outstanding,
    ])
    downloadCsv('financial-report.csv', [headers, ...rows])
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
          Failed to load financial report: {error.message}
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <SummaryCard
          label="Total Outstanding Balance"
          value={data ? formatUgx(data.totalOutstanding) : '—'}
          isLoading={isLoading}
          accent="red"
        />
        <SummaryCard
          label="Defaulter Count"
          value={data ? `${data.defaulterCount.toLocaleString()} clients` : '—'}
          isLoading={isLoading}
          accent="orange"
        />
      </div>

      {/* Bar chart — last 12 months */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">
          Invoiced vs Collected — Last 12 Months
        </h3>
        {isLoading ? (
          <div className="h-64 flex items-center justify-center">
            <div className="h-48 w-full bg-gray-100 animate-pulse rounded-lg" />
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart
              data={data?.monthlyRows ?? []}
              margin={{ top: 4, right: 16, left: 0, bottom: 0 }}
              barCategoryGap="30%"
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: '#6b7280' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#6b7280' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) =>
                  v >= 1_000_000
                    ? `${(v / 1_000_000).toFixed(1)}M`
                    : v >= 1_000
                    ? `${(v / 1_000).toFixed(0)}K`
                    : String(v)
                }
              />
              <Tooltip content={<ChartTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
              />
              <Bar
                dataKey="totalInvoiced"
                name="Total Invoiced"
                fill="#3b82f6"
                radius={[3, 3, 0, 0]}
              />
              <Bar
                dataKey="totalCollected"
                name="Total Collected"
                fill="#22c55e"
                radius={[3, 3, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Data table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        {/* Table toolbar */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-gray-700">Monthly Breakdown</h3>
          <button
            onClick={handleExportCsv}
            disabled={!data || data.monthlyRows.length === 0}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Export CSV
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['Month', 'Total Invoiced (UGX)', 'Total Collected (UGX)', 'Outstanding (UGX)'].map(
                  (col) => (
                    <th
                      key={col}
                      className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap"
                    >
                      {col}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {isLoading ? (
                <tr>
                  <td colSpan={4} className="px-5 py-2">
                    <TableSkeleton rows={6} cols={4} />
                  </td>
                </tr>
              ) : !data || data.monthlyRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-5 py-10 text-center text-gray-400 text-sm"
                  >
                    No financial data available.
                  </td>
                </tr>
              ) : (
                data.monthlyRows.map((row: MonthlyFinancialRow) => (
                  <tr key={row.month} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3 font-medium text-gray-900 whitespace-nowrap">
                      {row.label}
                    </td>
                    <td className="px-5 py-3 tabular-nums text-gray-700 whitespace-nowrap">
                      {formatUgx(row.totalInvoiced)}
                    </td>
                    <td className="px-5 py-3 tabular-nums text-green-700 whitespace-nowrap">
                      {formatUgx(row.totalCollected)}
                    </td>
                    <td
                      className={`px-5 py-3 tabular-nums whitespace-nowrap font-medium ${
                        row.outstanding > 0 ? 'text-red-600' : 'text-gray-500'
                      }`}
                    >
                      {formatUgx(row.outstanding)}
                    </td>
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
