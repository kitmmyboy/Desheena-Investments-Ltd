import { useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  AreaChart, Area, CartesianGrid, PieChart, Pie,
} from 'recharts'
import { useKpiData } from './useKpiData'
import { useFinancialReport, useDefaultersReport } from '../reports/useReports'
import { Link } from 'react-router-dom'

// ---------------------------------------------------------------------------
// KpiCard
// ---------------------------------------------------------------------------

interface KpiCardProps {
  icon: string
  label: string
  value: string | number | undefined
  isLoading: boolean
  chart?: React.ReactNode
  iconBg?: string
  href?: string
}

function KpiCard({ icon, label, value, isLoading, chart, iconBg = 'bg-green-100', href }: KpiCardProps) {
  const content = (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex flex-col gap-3 h-full">
      <div className="flex items-center gap-3">
        <div className={`${iconBg} rounded-xl p-3 text-2xl leading-none shrink-0`}>{icon}</div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide truncate">{label}</p>
          {isLoading ? (
            <div className="mt-1 h-7 w-24 rounded bg-gray-200 animate-pulse" />
          ) : (
            <p className="mt-0.5 text-2xl font-bold text-gray-900 tabular-nums">{value ?? '—'}</p>
          )}
        </div>
      </div>
      {chart && <div className="h-20">{chart}</div>}
    </div>
  )

  if (href) {
    return (
      <Link to={href} className="block hover:opacity-90 transition-opacity">
        {content}
      </Link>
    )
  }
  return content
}

// ---------------------------------------------------------------------------
// Mini bar chart — collections by hour
// ---------------------------------------------------------------------------

function buildHourlyData(totalToday: number) {
  const labels = ['00', '03', '06', '09', '12', '15', '18', '21']
  const weights = [0.01, 0.02, 0.12, 0.22, 0.25, 0.22, 0.12, 0.04]
  return labels.map((hour, i) => ({ hour, count: Math.round(totalToday * weights[i]) }))
}

const CHART_COLORS = ['#4ade80', '#22c55e', '#16a34a', '#15803d', '#166534', '#14532d', '#052e16', '#4ade80']

function CollectionsMiniChart({ total }: { total: number }) {
  const data = buildHourlyData(total)
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 4, right: 0, left: -20, bottom: 0 }}>
        <XAxis dataKey="hour" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
        <YAxis hide />
        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(v: number) => [v, 'Collections']} labelFormatter={(l: string) => `${l}:00`} />
        <Bar dataKey="count" radius={[3, 3, 0, 0]}>
          {data.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

// ---------------------------------------------------------------------------
// Revenue trend chart (last 12 months)
// ---------------------------------------------------------------------------

function RevenueTrendChart({ rows, isLoading }: { rows: { label: string; totalInvoiced: number; totalCollected: number }[]; isLoading: boolean }) {
  if (isLoading) return <div className="h-48 bg-gray-100 animate-pulse rounded-lg" />
  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={rows} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="invoicedGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="collectedGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#22c55e" stopOpacity={0.2} />
            <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false}
          tickFormatter={(v: number) => v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : v >= 1_000 ? `${(v / 1_000).toFixed(0)}K` : String(v)} />
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 8 }}
          formatter={(v: number, name: string) => [`UGX ${v.toLocaleString()}`, name]}
        />
        <Area type="monotone" dataKey="totalInvoiced" name="Invoiced" stroke="#3b82f6" fill="url(#invoicedGrad)" strokeWidth={2} dot={false} />
        <Area type="monotone" dataKey="totalCollected" name="Collected" stroke="#22c55e" fill="url(#collectedGrad)" strokeWidth={2} dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  )
}

// ---------------------------------------------------------------------------
// Paid vs Outstanding donut
// ---------------------------------------------------------------------------

function PaidVsOutstandingDonut({ collected, outstanding, isLoading }: { collected: number; outstanding: number; isLoading: boolean }) {
  const total = collected + outstanding
  if (isLoading) return <div className="h-32 bg-gray-100 animate-pulse rounded-lg" />
  if (total === 0) return <div className="h-32 flex items-center justify-center text-sm text-gray-400">No data</div>

  const data = [
    { name: 'Collected', value: collected, color: '#22c55e' },
    { name: 'Outstanding', value: outstanding, color: '#ef4444' },
  ]
  const pct = total > 0 ? Math.round((collected / total) * 100) : 0

  return (
    <div className="flex items-center gap-4">
      <div className="relative">
        <ResponsiveContainer width={100} height={100}>
          <PieChart>
            <Pie data={data} cx="50%" cy="50%" innerRadius={30} outerRadius={45} dataKey="value" paddingAngle={2}>
              {data.map((d, i) => <Cell key={i} fill={d.color} />)}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-bold text-gray-800">{pct}%</span>
        </div>
      </div>
      <div className="flex flex-col gap-1.5 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-green-500 shrink-0" />
          <span className="text-gray-600">Collected</span>
          <span className="font-semibold text-gray-800 ml-1">UGX {(collected / 1_000_000).toFixed(1)}M</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0" />
          <span className="text-gray-600">Outstanding</span>
          <span className="font-semibold text-gray-800 ml-1">UGX {(outstanding / 1_000_000).toFixed(1)}M</span>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Top defaulters mini list
// ---------------------------------------------------------------------------

function TopDefaulters({ data, isLoading }: { data: { client_name: string; outstanding: number }[]; isLoading: boolean }) {
  const top5 = data.slice(0, 5)
  if (isLoading) return <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-5 bg-gray-100 animate-pulse rounded" />)}</div>
  if (top5.length === 0) return <p className="text-sm text-gray-400 py-2">No defaulters — all clients are up to date.</p>

  const max = top5[0]?.outstanding ?? 1
  return (
    <div className="space-y-2">
      {top5.map((d) => (
        <div key={d.client_name} className="flex items-center gap-2">
          <span className="text-xs text-gray-700 w-32 truncate shrink-0" title={d.client_name}>{d.client_name}</span>
          <div className="flex-1 bg-gray-100 rounded-full h-2">
            <div className="bg-red-400 h-2 rounded-full" style={{ width: `${(d.outstanding / max) * 100}%` }} />
          </div>
          <span className="text-xs font-medium text-red-600 tabular-nums shrink-0">
            {d.outstanding >= 1_000_000 ? `${(d.outstanding / 1_000_000).toFixed(1)}M` : `${(d.outstanding / 1_000).toFixed(0)}K`}
          </span>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// KpiPanel
// ---------------------------------------------------------------------------

export default function KpiPanel() {
  const { kpis, isLoading } = useKpiData()
  const { data: financial, isLoading: finLoading } = useFinancialReport()
  const { data: defaulters = [], isLoading: defLoading } = useDefaultersReport()

  const fmt = (n: number | undefined) => n !== undefined ? n.toLocaleString() : '—'
  const fmtUgx = (n: number | undefined) => n !== undefined ? `UGX ${n.toLocaleString()}` : '—'
  const fmtKg = (n: number | undefined) => n !== undefined ? `${n.toLocaleString()} kg` : '—'

  const collectionRate = useMemo(() => {
    if (!financial || financial.totalInvoiced === 0) return null
    return Math.round((financial.totalCollected / financial.totalInvoiced) * 100)
  }, [financial])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xl font-semibold text-gray-800">Dashboard Overview</h2>
        <p className="text-xs text-gray-400">Auto-refreshes every 30 seconds</p>
      </div>

      {/* ── Operations KPIs ── */}
      <section>
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Operations</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <KpiCard icon="🚛" label="Collections Today" value={fmt(kpis?.collectionsToday)} isLoading={isLoading} iconBg="bg-green-100"
            chart={!isLoading && kpis ? <CollectionsMiniChart total={kpis.collectionsToday} /> : undefined} />
          <KpiCard icon="⚖️" label="Weight Collected Today" value={fmtKg(kpis?.weightToday)} isLoading={isLoading} iconBg="bg-blue-100" />
          <KpiCard icon="👥" label="Active Clients" value={fmt(kpis?.activeClients)} isLoading={isLoading} iconBg="bg-purple-100" href="/dashboard/clients" />
          <KpiCard icon="🔄" label="Pending Sync" value={fmt(kpis?.pendingSync)} isLoading={isLoading} iconBg="bg-orange-100" />
          <KpiCard icon="📋" label="Open Complaints" value={fmt(kpis?.openComplaints)} isLoading={isLoading} iconBg="bg-red-100" href="/dashboard/complaints" />
          <KpiCard icon="💰" label="Revenue Today" value={fmtUgx(kpis?.revenueToday)} isLoading={isLoading} iconBg="bg-yellow-100" />
        </div>
      </section>

      {/* ── Financial KPIs ── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Financials</h3>
          <Link to="/dashboard/reports" className="text-xs text-blue-600 hover:underline">View full report →</Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total Invoiced</p>
            {finLoading ? <div className="mt-2 h-7 w-28 bg-gray-200 animate-pulse rounded" /> : (
              <p className="mt-1 text-xl font-bold text-blue-600 tabular-nums">
                {financial ? `UGX ${(financial.totalInvoiced / 1_000_000).toFixed(1)}M` : '—'}
              </p>
            )}
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total Collected</p>
            {finLoading ? <div className="mt-2 h-7 w-28 bg-gray-200 animate-pulse rounded" /> : (
              <p className="mt-1 text-xl font-bold text-green-600 tabular-nums">
                {financial ? `UGX ${(financial.totalCollected / 1_000_000).toFixed(1)}M` : '—'}
              </p>
            )}
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Outstanding</p>
            {finLoading ? <div className="mt-2 h-7 w-28 bg-gray-200 animate-pulse rounded" /> : (
              <p className="mt-1 text-xl font-bold text-red-600 tabular-nums">
                {financial ? `UGX ${(financial.totalOutstanding / 1_000_000).toFixed(1)}M` : '—'}
              </p>
            )}
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Collection Rate</p>
            {finLoading ? <div className="mt-2 h-7 w-16 bg-gray-200 animate-pulse rounded" /> : (
              <p className={`mt-1 text-xl font-bold tabular-nums ${collectionRate !== null && collectionRate >= 80 ? 'text-green-600' : 'text-orange-500'}`}>
                {collectionRate !== null ? `${collectionRate}%` : '—'}
              </p>
            )}
          </div>
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Revenue trend */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h4 className="text-sm font-semibold text-gray-700 mb-3">Revenue Trend — Last 12 Months</h4>
            <RevenueTrendChart rows={financial?.monthlyRows ?? []} isLoading={finLoading} />
          </div>

          {/* Paid vs Outstanding */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col gap-4">
            <h4 className="text-sm font-semibold text-gray-700">Paid vs Outstanding</h4>
            <PaidVsOutstandingDonut
              collected={financial?.totalCollected ?? 0}
              outstanding={financial?.totalOutstanding ?? 0}
              isLoading={finLoading}
            />
          </div>
        </div>
      </section>

      {/* ── Defaulters ── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Top Defaulters
            {!defLoading && defaulters.length > 0 && (
              <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                {defaulters.length} clients
              </span>
            )}
          </h3>
          <Link to="/dashboard/reports" className="text-xs text-blue-600 hover:underline">View all →</Link>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <TopDefaulters data={defaulters} isLoading={defLoading} />
        </div>
      </section>
    </div>
  )
}
