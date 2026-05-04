import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { supabase } from '../../lib/supabase'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type NotificationType = 'missed_route' | 'pending_sync_overflow' | 'new_complaint'

export interface AppNotification {
  id: string
  type: NotificationType | string
  title: string
  body: string | null
  related_id: string | null
  is_dismissed: boolean
  created_at: string
  expires_at: string | null
}

// ---------------------------------------------------------------------------
// Fetcher
// ---------------------------------------------------------------------------

async function fetchNotifications(): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('id, type, title, body, related_id, is_dismissed, created_at, expires_at')
    .eq('is_dismissed', false)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []) as AppNotification[]
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useNotifications() {
  const queryClient = useQueryClient()

  // Subscribe to Realtime INSERT events on the notifications table
  useEffect(() => {
    const channel = supabase
      .channel('notifications-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['notifications'] })
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [queryClient])

  const { data: notifications = [], isLoading } = useQuery<AppNotification[]>({
    queryKey: ['notifications'],
    queryFn: fetchNotifications,
    refetchInterval: 60_000, // fallback poll every 60 seconds
  })

  const dismissMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('notifications')
        .update({ is_dismissed: true })
        .eq('id', id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  const dismissAllMutation = useMutation({
    mutationFn: async () => {
      const ids = notifications.map((n) => n.id)
      if (ids.length === 0) return
      const { error } = await supabase
        .from('notifications')
        .update({ is_dismissed: true })
        .in('id', ids)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  return {
    notifications,
    unreadCount: notifications.length,
    dismissNotification: (id: string) => dismissMutation.mutate(id),
    dismissAllNotifications: () => dismissAllMutation.mutate(),
    isLoading,
  }
}
