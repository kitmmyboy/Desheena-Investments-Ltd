import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SmsLogEntry {
  id: string
  recipient_phone: string
  message_content: string
  message_type: string | null
  event_type: string | null
  related_id: string | null
  delivery_status: string | null
  africas_talking_id: string | null
  attempt_count: number
  error_code: string | null
  sent_at: string | null
  created_at: string
  updated_at: string | null
  last_retry_at: string | null
}

export interface SmsLogFilters {
  page?: number
  pageSize?: number
  dateFrom?: string
  dateTo?: string
  recipientPhone?: string
  deliveryStatus?: string
  sortBy?: string
  sortDesc?: boolean
}

export interface UseSmsLogResult {
  data: SmsLogEntry[]
  count: number
  isLoading: boolean
  error: Error | null
  refetch: () => void
}

// ---------------------------------------------------------------------------
// useSmsLog — list with server-side pagination, sorting, and filtering
// ---------------------------------------------------------------------------

export function useSmsLog({
  page = 0,
  pageSize = 25,
  dateFrom,
  dateTo,
  recipientPhone,
  deliveryStatus,
  sortBy = 'sent_at',
  sortDesc = true,
}: SmsLogFilters = {}): UseSmsLogResult {
  const queryKey = [
    'sms_log',
    { page, pageSize, dateFrom, dateTo, recipientPhone, deliveryStatus, sortBy, sortDesc },
  ]

  const { data, isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      let query = supabase
        .from('sms_log')
        .select('*', { count: 'exact' })

      if (dateFrom) {
        query = query.gte('created_at', dateFrom)
      }

      if (dateTo) {
        // Include the full end day
        const endDate = new Date(dateTo)
        endDate.setDate(endDate.getDate() + 1)
        query = query.lt('created_at', endDate.toISOString().split('T')[0])
      }

      if (recipientPhone && recipientPhone.trim() !== '') {
        query = query.ilike('recipient_phone', `%${recipientPhone.trim()}%`)
      }

      if (deliveryStatus && deliveryStatus !== 'all') {
        query = query.eq('delivery_status', deliveryStatus)
      }

      query = query.order(sortBy, { ascending: !sortDesc })

      const from = page * pageSize
      const to = from + pageSize - 1
      query = query.range(from, to)

      const { data: rows, count, error: queryError } = await query

      if (queryError) throw new Error(queryError.message)

      return { rows: (rows ?? []) as SmsLogEntry[], count: count ?? 0 }
    },
  })

  return {
    data: data?.rows ?? [],
    count: data?.count ?? 0,
    isLoading,
    error: error as Error | null,
    refetch,
  }
}
