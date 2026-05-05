import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import {
  computeContractMonths,
  computeExpectedTotal,
  computeOutstandingBalance,
  computeMonthBreakdown,
  computeEffectiveStatus,
} from './contractCalculations'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

// Re-export MonthBreakdown from contractCalculations rather than redefining it
export type { MonthBreakdown } from './contractCalculations'

export interface ContractDefaulter {
  client_id: string
  client_name: string
  client_phone: string
  contract_id: string
  monthly_rate: number
  contract_status: 'active' | 'suspended' | 'terminated'
  end_date: string | null
  updated_at: string
  expected_total: number
  amount_paid: number
  outstanding_balance: number
  months_unpaid: number
  defaulter_category: 'active' | 'ended'
  month_breakdown: import('./contractCalculations').MonthBreakdown[]
}

// ---------------------------------------------------------------------------
// useContractDefaulters
// ---------------------------------------------------------------------------

export function useContractDefaulters(): {
  data: ContractDefaulter[]
  isLoading: boolean
  error: Error | null
} {
  const { data, isLoading, error } = useQuery({
    queryKey: ['contractDefaulters'],
    queryFn: async () => {
      // Fetch all contracts with client join
      const { data: contractRows, error: contractsError } = await supabase
        .from('contracts')
        .select(
          'id, client_id, monthly_rate, start_date, end_date, status, updated_at, clients(name, phone)'
        )

      if (contractsError) throw new Error(contractsError.message)

      // Fetch all invoices with contract_id, invoice_period, paid_amount
      const { data: invoiceRows, error: invoicesError } = await supabase
        .from('invoices')
        .select('contract_id, invoice_period, paid_amount')

      if (invoicesError) throw new Error(invoicesError.message)

      const today = new Date()
      const defaulters: ContractDefaulter[] = []

      for (const row of contractRows ?? []) {
        const monthlyRate = row.monthly_rate ?? 0

        // Skip contracts with no monthly rate
        if (!monthlyRate) continue

        const clientData = (row.clients as unknown) as { name: string; phone: string } | null

        // Compute contract months
        const contractMonths = computeContractMonths(row.start_date, row.end_date)

        // Get invoices for this contract
        const contractInvoices = (invoiceRows ?? []).filter(
          (inv) => inv.contract_id === row.id
        )

        // Compute expected total
        const expectedTotal = computeExpectedTotal(contractMonths, monthlyRate)

        // Compute amount paid (sum of all paid_amounts for this contract)
        const amountPaid = contractInvoices.reduce(
          (sum, inv) => sum + (inv.paid_amount ?? 0),
          0
        )

        // Compute outstanding balance
        const outstandingBalance = computeOutstandingBalance(expectedTotal, amountPaid)

        // Skip clients with no outstanding balance
        if (outstandingBalance <= 0) continue

        // Compute month breakdown
        const monthBreakdown = computeMonthBreakdown(contractMonths, monthlyRate, contractInvoices)

        // Compute months unpaid (count of breakdown entries where status !== 'paid')
        const monthsUnpaid = monthBreakdown.filter((b) => b.status !== 'paid').length

        // Compute effective status and defaulter category
        const effectiveStatus = computeEffectiveStatus(row.status, row.end_date, today)
        const defaulterCategory: 'active' | 'ended' =
          effectiveStatus === 'active' ? 'active' : 'ended'

        defaulters.push({
          client_id: row.client_id,
          client_name: clientData?.name ?? 'Unknown',
          client_phone: clientData?.phone ?? '—',
          contract_id: row.id,
          monthly_rate: monthlyRate,
          contract_status: row.status as 'active' | 'suspended' | 'terminated',
          end_date: row.end_date,
          updated_at: row.updated_at,
          expected_total: expectedTotal,
          amount_paid: amountPaid,
          outstanding_balance: outstandingBalance,
          months_unpaid: monthsUnpaid,
          defaulter_category: defaulterCategory,
          month_breakdown: monthBreakdown,
        })
      }

      // Sort by outstanding_balance descending
      return defaulters.sort((a, b) => b.outstanding_balance - a.outstanding_balance)
    },
  })

  return {
    data: data ?? [],
    isLoading,
    error: error as Error | null,
  }
}
