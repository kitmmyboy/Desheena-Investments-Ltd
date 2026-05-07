import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { supabase } from '../../lib/supabase'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface KpiData {
  collectionsToday: number
  weightToday: number       // kg
  revenueToday: number      // UGX
  activeClients: number
  pendingSync: number
  openComplaints: number
}

// ---------------------------------------------------------------------------
// Fetcher helpers
// ---------------------------------------------------------------------------

async function fetchKpis(): Promise<KpiData> {
  const today = new Date().toISOString().split('T')[0]

  const [
    collectionsTodayRes,
    weightTodayRes,
    revenueTodayRes,
    activeClientsRes,
    pendingSyncRes,
    openComplaintsRes,
  ] = await Promise.all([
    // 1. Total collections today (count)
    supabase
      .from('collections')
      .select('id', { count: 'exact', head: true })
      .gte('collected_at', today),

    // 2. Total weight collected today
    supabase
      .from('collections')
      .select('weight_kg')
      .gte('collected_at', today),

    // 3. Revenue today — sum of paid_amount on invoices updated today
    //    (payments table may be empty; invoices.paid_amount is the source of truth)
    supabase
      .from('invoices')
      .select('paid_amount')
      .gte('updated_at', today)
      .gt('paid_amount', 0),

    // 4. Active clients — unique clients with active contracts
    //    (contract status = 'active' AND end_date is null OR end_date >= today)
    supabase
      .from('contracts')
      .select('client_id')
      .eq('status', 'active')
      .or(`end_date.is.null,end_date.gte.${today}`),

    // 5. Pending sync records
    supabase
      .from('collections')
      .select('id', { count: 'exact', head: true })
      .eq('sync_status', 'pending'),

    // 6. Open complaints
    supabase
      .from('complaints')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'open'),
  ])

  // Sum weight_kg in JS
  const weightToday =
    weightTodayRes.data?.reduce(
      (sum: number, row: { weight_kg: number | null }) => sum + (row.weight_kg ?? 0),
      0,
    ) ?? 0

  // Sum paid_amount from invoices updated today
  const revenueToday =
    revenueTodayRes.data?.reduce(
      (sum: number, row: { paid_amount: number | null }) => sum + (row.paid_amount ?? 0),
      0,
    ) ?? 0

  // Count unique active clients (by client_id from contracts)
  const uniqueActiveClients = new Set(
    activeClientsRes.data?.map((c: { client_id: string }) => c.client_id) ?? []
  ).size

  return {
    collectionsToday: collectionsTodayRes.count ?? 0,
    weightToday,
    revenueToday,
    activeClients: uniqueActiveClients,
    pendingSync: pendingSyncRes.count ?? 0,
    openComplaints: openComplaintsRes.count ?? 0,
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useKpiData() {
  const queryClient = useQueryClient()

  // Subscribe to Realtime INSERT events on collections, payments, complaints
  useEffect(() => {
    const invalidate = () => {
      queryClient.invalidateQueries({ queryKey: ['kpis'] })
    }

    const collectionsChannel = supabase
      .channel('kpi-collections')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'collections' },
        invalidate,
      )
      .subscribe()

    const paymentsChannel = supabase
      .channel('kpi-payments')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'payments' },
        invalidate,
      )
      .subscribe()

    const complaintsChannel = supabase
      .channel('kpi-complaints')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'complaints' },
        invalidate,
      )
      .subscribe()

    return () => {
      supabase.removeChannel(collectionsChannel)
      supabase.removeChannel(paymentsChannel)
      supabase.removeChannel(complaintsChannel)
    }
  }, [queryClient])

  const { data: kpis, isLoading, error } = useQuery<KpiData>({
    queryKey: ['kpis'],
    queryFn: fetchKpis,
    refetchInterval: 30_000, // refresh every 30 seconds
  })

  return { kpis, isLoading, error }
}
