import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ComplaintStatus = 'open' | 'in-progress' | 'resolved'

export type ComplaintCategory =
  | 'missed collection'
  | 'billing dispute'
  | 'service quality'
  | 'other'

export interface Complaint {
  id: string
  client_id: string
  message: string
  category: ComplaintCategory | string
  status: ComplaintStatus
  created_at: string
  updated_at: string | null
  resolver_id: string | null
  resolution_notes: string | null
  resolved_at: string | null
  clients: {
    name: string
    phone: string
  } | null
}

export interface ComplaintsFilters {
  page?: number
  pageSize?: number
  status?: string
  category?: string
  dateFrom?: string
  dateTo?: string
}

export interface UseComplaintsResult {
  data: Complaint[]
  count: number
  isLoading: boolean
  error: Error | null
}

export interface UpdateComplaintStatusInput {
  id: string
  status: ComplaintStatus
  resolution_notes?: string
  resolver_id?: string
}

// ---------------------------------------------------------------------------
// useComplaints — list with server-side pagination and filtering
// ---------------------------------------------------------------------------

export function useComplaints({
  page = 0,
  pageSize = 25,
  status,
  category,
  dateFrom,
  dateTo,
}: ComplaintsFilters = {}): UseComplaintsResult {
  const queryKey = ['complaints', { page, pageSize, status, category, dateFrom, dateTo }]

  const { data, isLoading, error } = useQuery({
    queryKey,
    queryFn: async () => {
      let query = supabase
        .from('complaints')
        .select('*, clients(name, phone)', { count: 'exact' })

      if (status && status !== 'all') {
        query = query.eq('status', status)
      }

      if (category && category !== 'all') {
        query = query.eq('category', category)
      }

      if (dateFrom) {
        query = query.gte('created_at', dateFrom)
      }

      if (dateTo) {
        // Include the full day by going to end of day
        query = query.lte('created_at', `${dateTo}T23:59:59.999Z`)
      }

      query = query.order('created_at', { ascending: false })

      const from = page * pageSize
      const to = from + pageSize - 1
      query = query.range(from, to)

      const { data: rows, count, error: queryError } = await query

      if (queryError) throw new Error(queryError.message)

      return { rows: (rows ?? []) as Complaint[], count: count ?? 0 }
    },
  })

  return {
    data: data?.rows ?? [],
    count: data?.count ?? 0,
    isLoading,
    error: error as Error | null,
  }
}

// ---------------------------------------------------------------------------
// useComplaintDetail — fetch a single complaint with client details
// ---------------------------------------------------------------------------

export function useComplaintDetail(id: string | null): {
  data: Complaint | null
  isLoading: boolean
  error: Error | null
} {
  const { data, isLoading, error } = useQuery({
    queryKey: ['complaint', id],
    queryFn: async () => {
      if (!id) return null

      const { data: row, error: queryError } = await supabase
        .from('complaints')
        .select('*, clients(name, phone)')
        .eq('id', id)
        .single()

      if (queryError) throw new Error(queryError.message)
      return row as Complaint
    },
    enabled: !!id,
  })

  return {
    data: data ?? null,
    isLoading,
    error: error as Error | null,
  }
}

// ---------------------------------------------------------------------------
// useUpdateComplaintStatus — mutation to update status + resolution fields
// ---------------------------------------------------------------------------

export function useUpdateComplaintStatus() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: UpdateComplaintStatusInput) => {
      const now = new Date().toISOString()

      const updatePayload: Record<string, unknown> = {
        status: input.status,
        updated_at: now,
      }

      if (input.status === 'resolved') {
        updatePayload.resolver_id = input.resolver_id ?? null
        updatePayload.resolution_notes = input.resolution_notes ?? null
        updatePayload.resolved_at = now
      }

      const { data, error } = await supabase
        .from('complaints')
        .update(updatePayload)
        .eq('id', input.id)
        .select('*, clients(name, phone)')
        .single()

      if (error) throw new Error(error.message)

      const updated = data as Complaint

      // Requirement 13.6: Send SMS to client when complaint status changes
      const clientPhone = updated.clients?.phone
      if (clientPhone) {
        const statusLabel: Record<string, string> = {
          open: 'Open',
          'in-progress': 'In Progress',
          resolved: 'Resolved',
        }
        const label = statusLabel[updated.status] ?? updated.status
        const smsMessage =
          `Dear ${updated.clients?.name ?? 'Customer'}, your complaint (ref: ${updated.id.slice(0, 8)}) ` +
          `status has been updated to: ${label}. ` +
          (updated.status === 'resolved' && updated.resolution_notes
            ? `Resolution: ${updated.resolution_notes.slice(0, 100)}. `
            : '') +
          'Thank you, Desheena Investments Ltd.'

        // Fire-and-forget: SMS failure must not block the status update
        supabase.functions
          .invoke('send-sms', {
            body: {
              phone: clientPhone,
              message: smsMessage,
              event_type: 'complaint_status_changed',
              reference_id: updated.id,
            },
          })
          .catch((err: unknown) => {
            console.warn('[useUpdateComplaintStatus] SMS notification failed:', err)
          })
      }

      return updated
    },
    onSuccess: (updated) => {
      // Invalidate list queries
      queryClient.invalidateQueries({ queryKey: ['complaints'] })
      // Update the detail cache directly
      queryClient.setQueryData(['complaint', updated.id], updated)
    },
  })
}
