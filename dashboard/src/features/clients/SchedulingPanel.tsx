import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Schedule {
  id: string
  day_of_week: number | null
  specific_date: string | null
  interval_days: number | null
  interval_start_date: string | null
}

interface SchedulingPanelProps {
  clientId: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const DAY_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function todayStr(): string {
  return new Date().toISOString().split('T')[0]
}

/** Returns true if an interval schedule is due today */
function isIntervalDueToday(startDate: string, intervalDays: number): boolean {
  const start = new Date(startDate)
  const today = new Date()
  start.setHours(0, 0, 0, 0)
  today.setHours(0, 0, 0, 0)
  if (today < start) return false
  const diffDays = Math.round((today.getTime() - start.getTime()) / 86_400_000)
  return diffDays % intervalDays === 0
}

/** Returns the next due date for an interval schedule */
function nextIntervalDate(startDate: string, intervalDays: number): string {
  const start = new Date(startDate)
  const today = new Date()
  start.setHours(0, 0, 0, 0)
  today.setHours(0, 0, 0, 0)
  if (today < start) return startDate
  const diffDays = Math.round((today.getTime() - start.getTime()) / 86_400_000)
  const remainder = diffDays % intervalDays
  const daysUntilNext = remainder === 0 ? 0 : intervalDays - remainder
  const next = new Date(today)
  next.setDate(next.getDate() + daysUntilNext)
  return next.toISOString().split('T')[0]
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

// ---------------------------------------------------------------------------
// SchedulingPanel
// ---------------------------------------------------------------------------

export default function SchedulingPanel({ clientId }: SchedulingPanelProps) {
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)

  // Interval form state
  const [intervalDays, setIntervalDays] = useState('')
  const [intervalStart, setIntervalStart] = useState(todayStr())

  // Specific date form state
  const [specificDate, setSpecificDate] = useState('')

  useEffect(() => {
    fetchSchedules()
  }, [clientId])

  async function fetchSchedules() {
    setIsLoading(true)
    const { data, error } = await supabase
      .from('collection_schedules')
      .select('id, day_of_week, specific_date, interval_days, interval_start_date')
      .eq('client_id', clientId)
      .order('created_at', { ascending: true })
    if (!error && data) setSchedules(data as Schedule[])
    setIsLoading(false)
  }

  // ── Weekly day toggle ──────────────────────────────────────────────────────

  async function toggleDay(dayIndex: number) {
    const existing = schedules.find((s) => s.day_of_week === dayIndex)
    setSaving(`day-${dayIndex}`)
    if (existing) {
      const { error } = await supabase.from('collection_schedules').delete().eq('id', existing.id)
      if (!error) setSchedules((prev) => prev.filter((s) => s.id !== existing.id))
    } else {
      const { data, error } = await supabase
        .from('collection_schedules')
        .insert({ client_id: clientId, day_of_week: dayIndex })
        .select()
        .single()
      if (!error && data) setSchedules((prev) => [...prev, data as Schedule])
    }
    setSaving(null)
  }

  // ── Interval schedule ──────────────────────────────────────────────────────

  async function addInterval() {
    const days = parseInt(intervalDays, 10)
    if (!days || days < 1 || !intervalStart) return
    setSaving('interval')
    const { data, error } = await supabase
      .from('collection_schedules')
      .insert({ client_id: clientId, interval_days: days, interval_start_date: intervalStart })
      .select()
      .single()
    if (!error && data) {
      setSchedules((prev) => [...prev, data as Schedule])
      setIntervalDays('')
      setIntervalStart(todayStr())
    }
    setSaving(null)
  }

  // ── Specific date ──────────────────────────────────────────────────────────

  async function addSpecificDate() {
    if (!specificDate) return
    setSaving('specific')
    const { data, error } = await supabase
      .from('collection_schedules')
      .insert({ client_id: clientId, specific_date: specificDate })
      .select()
      .single()
    if (!error && data) {
      setSchedules((prev) => [...prev, data as Schedule])
      setSpecificDate('')
    }
    setSaving(null)
  }

  async function removeSchedule(id: string) {
    setSaving(`remove-${id}`)
    const { error } = await supabase.from('collection_schedules').delete().eq('id', id)
    if (!error) setSchedules((prev) => prev.filter((s) => s.id !== id))
    setSaving(null)
  }

  // ── Derived data ───────────────────────────────────────────────────────────

  const weeklyDays = schedules.filter((s) => s.day_of_week !== null)
  const intervalSchedules = schedules.filter((s) => s.interval_days !== null)
  const specificDates = schedules.filter((s) => s.specific_date !== null)

  const todayDow = new Date().getDay()
  const isDueToday =
    weeklyDays.some((s) => s.day_of_week === todayDow) ||
    intervalSchedules.some(
      (s) => s.interval_start_date && isIntervalDueToday(s.interval_start_date, s.interval_days!)
    ) ||
    specificDates.some((s) => s.specific_date === todayStr())

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="border-t border-gray-100 pt-6 mt-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-gray-900">Collection Schedule</h3>
            {isDueToday && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                Due today
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            Set recurring days, interval cycles, or one-off dates.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="animate-pulse space-y-2">
          <div className="h-4 bg-gray-200 rounded w-3/4" />
          <div className="h-4 bg-gray-200 rounded w-1/2" />
        </div>
      ) : (
        <div className="space-y-6">

          {/* ── 1. Weekly recurring days ── */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Weekly recurring days
            </p>
            <div className="flex flex-wrap gap-2">
              {DAYS.map((label, i) => {
                const active = weeklyDays.some((s) => s.day_of_week === i)
                const isSaving = saving === `day-${i}`
                const isToday = i === todayDow
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => toggleDay(i)}
                    disabled={!!saving}
                    title={DAY_FULL[i]}
                    className={`
                      w-12 h-12 rounded-xl text-xs font-semibold border transition-all flex flex-col items-center justify-center gap-0.5
                      ${active ? 'bg-blue-600 border-blue-600 text-white shadow-sm' : 'bg-white border-gray-200 text-gray-600 hover:border-blue-300 hover:bg-blue-50'}
                      ${isSaving ? 'opacity-50 cursor-wait' : ''}
                    `}
                  >
                    {label}
                    {isToday && (
                      <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-white' : 'bg-blue-400'}`} />
                    )}
                  </button>
                )
              })}
            </div>
            {weeklyDays.length > 0 && (
              <p className="text-xs text-gray-500 mt-2">
                {weeklyDays.map((s) => DAY_FULL[s.day_of_week!]).join(', ')}
                {' '}— {weeklyDays.length}× per week
              </p>
            )}
          </div>

          {/* ── 2. Every N days ── */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Every N days (interval)
            </p>

            {/* Existing interval schedules */}
            {intervalSchedules.length > 0 && (
              <div className="space-y-2 mb-3">
                {intervalSchedules.map((s) => {
                  const next = s.interval_start_date
                    ? nextIntervalDate(s.interval_start_date, s.interval_days!)
                    : null
                  const dueToday = s.interval_start_date
                    ? isIntervalDueToday(s.interval_start_date, s.interval_days!)
                    : false
                  return (
                    <div
                      key={s.id}
                      className="flex items-center justify-between bg-blue-50 border border-blue-100 rounded-lg px-3 py-2"
                    >
                      <div>
                        <span className="text-sm font-medium text-blue-800">
                          Every {s.interval_days} day{s.interval_days !== 1 ? 's' : ''}
                        </span>
                        <span className="text-xs text-blue-600 ml-2">
                          starting {s.interval_start_date ? formatDate(s.interval_start_date) : '—'}
                        </span>
                        {next && (
                          <span className={`ml-2 text-xs font-medium ${dueToday ? 'text-green-600' : 'text-gray-500'}`}>
                            · {dueToday ? '✓ Due today' : `Next: ${formatDate(next)}`}
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeSchedule(s.id)}
                        disabled={saving === `remove-${s.id}`}
                        className="text-gray-400 hover:text-red-600 transition-colors p-1 ml-2"
                        aria-label="Remove interval schedule"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Add interval form */}
            <div className="flex flex-wrap gap-2 items-end">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-500">Every</label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min="1"
                    max="365"
                    value={intervalDays}
                    onChange={(e) => setIntervalDays(e.target.value)}
                    placeholder="e.g. 3"
                    className="w-20 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-500">days</span>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-500">Starting from</label>
                <input
                  type="date"
                  value={intervalStart}
                  onChange={(e) => setIntervalStart(e.target.value)}
                  className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button
                type="button"
                onClick={addInterval}
                disabled={!intervalDays || parseInt(intervalDays) < 1 || !intervalStart || !!saving}
                className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {saving === 'interval' ? '…' : 'Add'}
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              e.g. every 3 days, every 7 days (weekly), every 14 days (fortnightly)
            </p>
          </div>

          {/* ── 3. Specific one-off dates ── */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              One-off dates
            </p>

            {specificDates.length > 0 && (
              <div className="space-y-1.5 mb-3">
                {specificDates
                  .sort((a, b) => (a.specific_date! > b.specific_date! ? 1 : -1))
                  .map((s) => {
                    const isPast = s.specific_date! < todayStr()
                    const isToday = s.specific_date === todayStr()
                    return (
                      <div
                        key={s.id}
                        className={`flex items-center justify-between px-3 py-2 rounded-lg border ${
                          isToday
                            ? 'bg-green-50 border-green-200'
                            : isPast
                            ? 'bg-gray-50 border-gray-100 opacity-60'
                            : 'bg-white border-gray-200'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <svg className="h-4 w-4 text-blue-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <span className="text-sm text-gray-700">{formatDate(s.specific_date!)}</span>
                          {isToday && (
                            <span className="text-xs font-medium text-green-600">Today</span>
                          )}
                          {isPast && (
                            <span className="text-xs text-gray-400">Past</span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => removeSchedule(s.id)}
                          disabled={saving === `remove-${s.id}`}
                          className="text-gray-400 hover:text-red-600 transition-colors p-1"
                          aria-label="Remove date"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    )
                  })}
              </div>
            )}

            <div className="flex gap-2">
              <input
                type="date"
                value={specificDate}
                onChange={(e) => setSpecificDate(e.target.value)}
                className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={addSpecificDate}
                disabled={!specificDate || !!saving}
                className="px-4 py-1.5 text-sm font-medium text-white bg-gray-800 rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors"
              >
                {saving === 'specific' ? '…' : 'Add date'}
              </button>
            </div>
          </div>

        </div>
      )}
    </div>
  )
}
