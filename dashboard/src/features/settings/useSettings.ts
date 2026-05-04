import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../auth/AuthContext'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Setting {
  key: string
  value: string
  label: string
  description: string | null
  updated_at: string
}

// ---------------------------------------------------------------------------
// Fetch all settings
// ---------------------------------------------------------------------------

export async function fetchSettings(): Promise<Setting[]> {
  const { data, error } = await supabase
    .from('system_settings')
    .select('key, value, label, description, updated_at')
    .order('key')
  if (error) throw new Error(error.message)
  return (data ?? []) as Setting[]
}

// ---------------------------------------------------------------------------
// Save specific keys
// ---------------------------------------------------------------------------

export async function saveSettingKeys(
  updates: { key: string; value: string }[],
  userId: string
): Promise<void> {
  for (const { key, value } of updates) {
    const { error } = await supabase
      .from('system_settings')
      .update({ value, updated_at: new Date().toISOString(), updated_by: userId })
      .eq('key', key)
    if (error) throw new Error(error.message)
  }
}

// ---------------------------------------------------------------------------
// useSettings hook — returns all settings as a key→value map
// ---------------------------------------------------------------------------

export function useSettings() {
  return useQuery<Setting[]>({
    queryKey: ['system_settings'],
    queryFn: fetchSettings,
    staleTime: 30_000,
  })
}

// ---------------------------------------------------------------------------
// useSaveSettings — mutation to save a subset of keys
// ---------------------------------------------------------------------------

export function useSaveSettings() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async (updates: { key: string; value: string }[]) => {
      if (!user) throw new Error('Not authenticated')
      await saveSettingKeys(updates, user.id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system_settings'] })
    },
  })
}

// ---------------------------------------------------------------------------
// Helper: build a values map from settings array
// ---------------------------------------------------------------------------

export function buildValuesMap(settings: Setting[]): Record<string, string> {
  const map: Record<string, string> = {}
  settings.forEach((s) => { map[s.key] = s.value })
  return map
}
