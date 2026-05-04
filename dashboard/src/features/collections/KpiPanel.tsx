import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import { useKpiData } from './useKpiData'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface KpiCardProps {
  icon: string
  label: string
  value: string | number | undefined
  isLoading: boolean
  /** Optional mini chart rendered below the value */
  chart?: React.ReactNode
  /** Extra Tailwind classes for the icon background */
  iconBg?: string
}

// ---------------------------------------------------------------------------
// KpiCard
// ---------------------------------------------------------------------------

function KpiCard({ icon, label, value, isLoading, chart, iconBg = 'bg-green-100' }: KpiCardProps) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex flex-col gap-3">
      <div className="flex items-center gap-3">
        {/* Icon */}
        <div className={`${iconBg} rounded-xl p-3 text-2xl leading-none`}>{icon}</div>

        {/* Label + Value */}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide truncate">
            {label}
          </p>
          {isLoading ? (
            <div className="mt-1 h-7 w-24 rounded bg-gray-200 animate-pulse" />
          ) : (
            <p className="mt-0.5 text-2xl font-bold text-gray-900 tabular-nums">
              {value ?? '—'}
            </p>
          )}
        </div>
      </div>

      {/* Optional mini chart */}
      {chart && <div className="h-20">{chart}</div>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Mini bar chart — collections by hour (static placeholder buckets)
// ---------------------------------------------------------------------------

/**
 * Generates a simple placeholder dataset showing 24 hourly buckets.
 * In a real implementation you would query collections grouped by hour.
 * We use the total count to distribute across morning/afternoon/evening
 * to give a visually meaningful chart without an extra query.
 */
function buildHourlyData(totalToday: number) {
  // Distribute total across 8 three-hour buckets (00-03, 03-06, … 21-24)
  const labels = ['00', '03', '06', '09', '12', '15', '18', '21']
  // Weight distribution: most collections happen 06-18
  const weights = [0.01, 0.02, 0.12, 0.22, 0.25, 0.22, 0.12, 0.04]
  return labels.map((hour, i) => ({
    hour,
    count: Math.round(totalToday * weights[i]),
  }))
}

const CHART_COLORS = ['#4ade80', '#22c55e', '#16a34a', '#15803d', '#166534', '#14532d', '#052e16', '#4ade80']

function CollectionsMiniChart({ total }: { total: number }) {
  const data = buildHourlyData(total)
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 4, right: 0, left: -20, bottom: 0 }}>
        <XAxis
          dataKey="hour"
          tick={{ fontSize: 10, fill: '#9ca3af' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis hide />
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 8 }}
          formatter={(v: number) => [v, 'Collections']}
          labelFormatter={(l: string) => `${l}:00`}
        />
        <Bar dataKey="count" radius={[3, 3, 0, 0]}>
          {data.map((_, index) => (
            <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

// ---------------------------------------------------------------------------
// KpiPanel
// ---------------------------------------------------------------------------

export default function KpiPanel() {
  const { kpis, isLoading } = useKpiData()

  const fmt = (n: number | undefined) =>
    n !== undefined ? n.toLocaleString() : '—'

  const fmtUgx = (n: number | undefined) =>
    n !== undefined ? `UGX ${n.toLocaleString()}` : '—'

  const fmtKg = (n: number | undefined) =>
    n !== undefined ? `${n.toLocaleString()} kg` : '—'

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-800 mb-5">Dashboard Overview</h2>

      {/* KPI grid: 2 cols on mobile, 3 on md+ */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {/* 1. Collections today — with mini chart */}
        <KpiCard
          icon="🚛"
          label="Collections Today"
          value={fmt(kpis?.collectionsToday)}
          isLoading={isLoading}
          iconBg="bg-green-100"
          chart={
            !isLoading && kpis ? (
              <CollectionsMiniChart total={kpis.collectionsToday} />
            ) : undefined
          }
        />

        {/* 2. Weight today */}
        <KpiCard
          icon="⚖️"
          label="Weight Collected Today"
          value={fmtKg(kpis?.weightToday)}
          isLoading={isLoading}
          iconBg="bg-blue-100"
        />

        {/* 3. Revenue today */}
        <KpiCard
          icon="💰"
          label="Revenue Today"
          value={fmtUgx(kpis?.revenueToday)}
          isLoading={isLoading}
          iconBg="bg-yellow-100"
        />

        {/* 4. Active clients */}
        <KpiCard
          icon="👥"
          label="Active Clients"
          value={fmt(kpis?.activeClients)}
          isLoading={isLoading}
          iconBg="bg-purple-100"
        />

        {/* 5. Pending sync */}
        <KpiCard
          icon="🔄"
          label="Pending Sync Records"
          value={fmt(kpis?.pendingSync)}
          isLoading={isLoading}
          iconBg="bg-orange-100"
        />

        {/* 6. Open complaints */}
        <KpiCard
          icon="📋"
          label="Open Complaints"
          value={fmt(kpis?.openComplaints)}
          isLoading={isLoading}
          iconBg="bg-red-100"
        />
      </div>
    </div>
  )
}
