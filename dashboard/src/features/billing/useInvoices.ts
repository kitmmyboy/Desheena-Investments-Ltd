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
  period_start: string | null
  period_end: string | null
  paid_amount?: number
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

      // Sort by period_start DESC so the most recent month is at the top.
      // invoice_period is legacy/null; period_start is the reliable date column.
      query = query.order('period_start', { ascending: false })
      query = query.order('due_date', { ascending: false })

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
// useRecordPayment — manually record a payment for an invoice
// ---------------------------------------------------------------------------

export interface RecordPaymentInput {
  invoice_id: string
  client_id: string
  amount: number
  payment_method: 'pesapal' | 'manual' | 'bank_transfer' | 'mobile_money' | 'adjustment'
  transaction_ref?: string
  notes?: string
}

export function useRecordPayment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: RecordPaymentInput) => {
      // 1. Record the payment
      const { error: paymentError } = await supabase.from('payments').insert({
        invoice_id: input.invoice_id,
        client_id: input.client_id,
        amount: input.amount,
        payment_method: input.payment_method,
        transaction_ref: input.transaction_ref,
        notes: input.notes,
        status: 'completed',
        paid_at: new Date().toISOString(),
      })

      if (paymentError) throw new Error(paymentError.message)

      // 2. Fetch current invoice to update paid_amount
      const { data: invoice, error: fetchError } = await supabase
        .from('invoices')
        .select('amount, paid_amount')
        .eq('id', input.invoice_id)
        .single()

      if (fetchError) throw new Error(fetchError.message)

      const newPaidAmount = (invoice.paid_amount ?? 0) + input.amount
      const newStatus = newPaidAmount >= invoice.amount ? 'paid' : 'unpaid'

      // 3. Update the invoice
      const { error: updateError } = await supabase
        .from('invoices')
        .update({
          paid_amount: newPaidAmount,
          status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', input.invoice_id)

      if (updateError) throw new Error(updateError.message)

      return { success: true }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      queryClient.invalidateQueries({ queryKey: ['contractDefaulters'] })
      queryClient.invalidateQueries({ queryKey: ['kpis'] })
      queryClient.invalidateQueries({ queryKey: ['reports'] })
    },
  })
}

// ---------------------------------------------------------------------------
// useClearDefaulter — clear all outstanding invoices for a client/contract
// ---------------------------------------------------------------------------

export interface ClearDefaulterInput {
  client_id: string
  contract_id: string
  payment_method: 'manual' | 'adjustment'
  notes?: string
}

export function useClearDefaulter() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: ClearDefaulterInput) => {
      // 1. Fetch all unpaid/overdue invoices for this contract
      const { data: invoices, error: fetchError } = await supabase
        .from('invoices')
        .select('id, amount, paid_amount')
        .eq('contract_id', input.contract_id)
        .in('status', ['unpaid', 'overdue'])

      if (fetchError) throw new Error(fetchError.message)
      if (!invoices || invoices.length === 0) return { success: true, count: 0 }

      const timestamp = new Date().toISOString()
      const payments = invoices.map((inv) => ({
        invoice_id: inv.id,
        client_id: input.client_id,
        amount: Math.max(0, inv.amount - (inv.paid_amount ?? 0)),
        payment_method: input.payment_method,
        notes: input.notes,
        status: 'completed',
        paid_at: timestamp,
      }))

      // 2. Insert payments
      const { error: paymentsError } = await supabase.from('payments').insert(payments)
      if (paymentsError) throw new Error(paymentsError.message)

      // 3. Update invoices to paid

      // Wait, supabase.raw('amount') doesn't work like that in the client.
      // I'll do a promise.all for updates or a more clever query if possible.
      // Since it's a small number of invoices per client, promise.all is fine.
      const updates = invoices.map(inv => 
        supabase.from('invoices')
          .update({ 
            paid_amount: inv.amount, 
            status: 'paid', 
            updated_at: timestamp 
          })
          .eq('id', inv.id)
      )
      
      const results = await Promise.all(updates)
      const firstError = results.find(r => r.error)
      if (firstError) throw new Error(firstError.error?.message)

      return { success: true, count: invoices.length }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      queryClient.invalidateQueries({ queryKey: ['contractDefaulters'] })
      queryClient.invalidateQueries({ queryKey: ['kpis'] })
      queryClient.invalidateQueries({ queryKey: ['reports'] })
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
