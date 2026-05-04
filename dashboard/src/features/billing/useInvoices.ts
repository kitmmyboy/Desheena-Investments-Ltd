import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Invoice {
  id: string
  client_id: string
  amount: number
  due_date: string
  status: 'paid' | 'unpaid' | 'overdue'
  invoice_period: string | null
  created_at: string
  clients: {
    name: string
    phone: string
  } | null
}

export interface InvoicesFilters {
  page?: number
  pageSize?: number
  clientId?: string
  status?: string
  dateFrom?: string
  dateTo?: string
}

export interface UseInvoicesResult {
  data: Invoice[]
  count: number
  isLoading: boolean
  error: Error | null
}

export interface CreateInvoiceInput {
  client_id: string
  invoice_period: string
  amount: number
}

export interface Defaulter {
  client_id: string
  client_name: string
  client_phone: string
  total_outstanding: number
  overdue_count: number
}

// ---------------------------------------------------------------------------
// useInvoices — list with server-side pagination and filtering
// ---------------------------------------------------------------------------

export function useInvoices({
  page = 0,
  pageSize = 25,
  clientId,
  status,
  dateFrom,
  dateTo,
}: InvoicesFilters = {}): UseInvoicesResult {
  const queryKey = ['invoices', { page, pageSize, clientId, status, dateFrom, dateTo }]

  const { data, isLoading, error } = useQuery({
    queryKey,
    queryFn: async () => {
      let query = supabase
        .from('invoices')
        .select('*, clients(name, phone)', { count: 'exact' })

      if (clientId) {
        query = query.eq('client_id', clientId)
      }

      if (status && status !== 'all') {
        query = query.eq('status', status)
      }

      if (dateFrom) {
        query = query.gte('due_date', dateFrom)
      }

      if (dateTo) {
        query = query.lte('due_date', dateTo)
      }

      query = query.order('created_at', { ascending: false })

      const from = page * pageSize
      const to = from + pageSize - 1
      query = query.range(from, to)

      const { data: rows, count, error: queryError } = await query

      if (queryError) throw new Error(queryError.message)

      return { rows: (rows ?? []) as Invoice[], count: count ?? 0 }
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
// useCreateInvoice — manually generate an invoice
// ---------------------------------------------------------------------------

export function useCreateInvoice() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CreateInvoiceInput) => {
      const dueDate = new Date()
      dueDate.setDate(dueDate.getDate() + 14)

      const { data, error } = await supabase
        .from('invoices')
        .insert({
          id: crypto.randomUUID(),
          client_id: input.client_id,
          invoice_period: input.invoice_period,
          amount: input.amount,
          due_date: dueDate.toISOString().split('T')[0],
          status: 'unpaid',
          created_at: new Date().toISOString(),
        })
        .select()
        .single()

      if (error) throw new Error(error.message)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
    },
  })
}

// ---------------------------------------------------------------------------
// useDefaulters — clients with one or more overdue invoices
// ---------------------------------------------------------------------------

export function useDefaulters(): {
  data: Defaulter[]
  isLoading: boolean
  error: Error | null
} {
  const { data, isLoading, error } = useQuery({
    queryKey: ['defaulters'],
    queryFn: async () => {
      const { data: rows, error: queryError } = await supabase
        .from('invoices')
        .select('client_id, amount, clients(name, phone)')
        .eq('status', 'overdue')

      if (queryError) throw new Error(queryError.message)

      // Group by client_id in JS
      const map = new Map<string, Defaulter>()

      for (const row of rows ?? []) {
        const clientData = (row.clients as unknown) as { name: string; phone: string } | null
        const existing = map.get(row.client_id)
        if (existing) {
          existing.total_outstanding += row.amount
          existing.overdue_count += 1
        } else {
          map.set(row.client_id, {
            client_id: row.client_id,
            client_name: clientData?.name ?? 'Unknown',
            client_phone: clientData?.phone ?? '—',
            total_outstanding: row.amount,
            overdue_count: 1,
          })
        }
      }

      return Array.from(map.values()).sort(
        (a, b) => b.total_outstanding - a.total_outstanding
      )
    },
  })

  return {
    data: data ?? [],
    isLoading,
    error: error as Error | null,
  }
}
