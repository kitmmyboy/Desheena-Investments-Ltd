import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'

export interface DueTodayClient {
  client_id: string
  client_name: string
  location_text: string
  zone: string | null
  schedule_type: 'weekly' | 'interval' | 'specific'
  interval_days?: number
  already_collected: boolean
}

function todayStr(): string {
  return new Date().toISOString().split('T')[0]
}

function isIntervalDueToday(startDate: string, intervalDays: number): boolean {
  const start = new Date(startDate)
  const today = new Date()
  start.setHours(0, 0, 0, 0)
  today.setHours(0, 0, 0, 0)
  if (today < start) return false
  const diffDays = Math.round((today.getTime() - start.getTime()) / 86_400_000)
  return diffDays % intervalDays === 0
}

export function useDueToday() {
  return useQuery<DueTodayClient[]>({
    queryKey: ['due-today'],
    queryFn: async () => {
      const today = todayStr()
      const todayDow = new Date().getDay()

      // Fetch all schedules with client info
      const { data: schedules, error: schedErr } = await supabase
        .from('collection_schedules')
        .select('client_id, day_of_week, specific_date, interval_days, interval_start_date, clients(name, location_text, zone)')

      if (schedErr) throw new Error(schedErr.message)

      // Fetch today's collections to know who's already been collected
      const { data: todayCollections, error: colErr } = await supabase
        .from('collections')
        .select('client_id')
        .gte('collected_at', today)
        .lt('collected_at', new Date(today + 'T23:59:59').toISOString())

      if (colErr) throw new Error(colErr.message)

      const collectedToday = new Set((todayCollections ?? []).map((c) => c.client_id))

      // Determine which clients are due today
      const dueMap = new Map<string, DueTodayClient>()

      for (const s of schedules ?? []) {
        const client = (s.clients as unknown) as { name: string; location_text: string; zone: string | null } | null
        if (!client) continue

        let isDue = false
        let scheduleType: DueTodayClient['schedule_type'] = 'weekly'

        if (s.day_of_week !== null && s.day_of_week === todayDow) {
          isDue = true
          scheduleType = 'weekly'
        } else if (s.specific_date === today) {
          isDue = true
          scheduleType = 'specific'
        } else if (s.interval_days && s.interval_start_date) {
          isDue = isIntervalDueToday(s.interval_start_date, s.interval_days)
          scheduleType = 'interval'
        }

        if (isDue && !dueMap.has(s.client_id)) {
          dueMap.set(s.client_id, {
            client_id: s.client_id,
            client_name: client.name,
            location_text: client.location_text,
            zone: client.zone,
            schedule_type: scheduleType,
            interval_days: s.interval_days ?? undefined,
            already_collected: collectedToday.has(s.client_id),
          })
        }
      }

      return Array.from(dueMap.values()).sort((a, b) => {
        // Uncollected first
        if (a.already_collected !== b.already_collected) return a.already_collected ? 1 : -1
        return a.client_name.localeCompare(b.client_name)
      })
    },
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  })
}
