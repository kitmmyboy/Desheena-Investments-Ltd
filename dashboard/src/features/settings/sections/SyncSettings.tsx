import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSettings, useSaveSettings, buildValuesMap } from '../useSettings'
import { supabase } from '../../../lib/supabase'

// ---------------------------------------------------------------------------
// Live sync stats
// ---------------------------------------------------------------------------

function useSyncStats() {
  return useQuery({
    queryKey: ['sync_stats'],
    queryFn: async () => {
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      const [pendingRes, syncedTodayRes] = await Promise.all([
        supabase
          .from('collections')
          .select('id', { count: 'exact', head: true })
          .eq('sync_status', 'pending'),
        supabase
          .from('collections')
          .select('id', { count: 'exact', head: true })
          .eq('sync_status', 'synced')
          .gte('collected_at', today.toISOString()),
      ])

      return {
        pending: pendingRes.count ?? 0,
        syncedToday: syncedTodayRes.count ?? 0,
      }
    },
    refetchInterval: 30_000,
  })
}

// ---------------------------------------------------------------------------
// SyncSettings
// ---------------------------------------------------------------------------

export default function SyncSettings() {
  const { data: settings = [], isLoading, error } = useSettings()
  const saveMutation = useSaveSettings()
  const { data: syncStats } = useSyncStats()

  const [values, setValues] = useState<Record<string, string>>({})
  const [saveSuccess, setSaveSuccess] = useState(false)

  useEffect(() => {
    if (settings.length > 0) setValues(buildValuesMap(settings))
  }, [settings])

  function handleChange(key: string, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }))
    setSaveSuccess(false)
  }

  async function handleSave() {
    const keys = ['sync_retry_interval', 'sync_max_retries', 'sync_queue_warning_threshold']
    await saveMutation.mutateAsync(keys.map((k) => ({ key: k, value: values[k] ?? '' })))
    setSaveSuccess(true)
    setTimeout(() => setSaveSuccess(false), 4000)
  }

  const baseInput = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white'

  if (isLoading) return <div className="text-sm text-gray-400 py-8 text-center">Loading…</div>
  if (error) return <div className="text-sm text-red-600 py-4">Failed to load settings: {error.message}</div>

  return (
    <div className="flex flex-col gap-5">
      {/* Live Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Pending Sync Records</p>
          <p className="text-3xl font-bold text-orange-600 mt-1">{syncStats?.pending ?? '—'}</p>
          <p className="text-xs text-gray-400 mt-1">Across all drivers</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Synced Today</p>
          <p className="text-3xl font-bold text-green-600 mt-1">{syncStats?.syncedToday ?? '—'}</p>
          <p className="text-xs text-gray-400 mt-1">Records synced since midnight</p>
        </div>
      </div>

      {/* Settings */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-1">Sync Configuration</h3>
        <p className="text-sm text-gray-500 mb-5">Configure how the mobile app syncs data to the server.</p>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
            <div>
              <label className="text-sm font-medium text-gray-800 block">Sync Retry Interval (minutes)</label>
              <p className="text-xs text-gray-500 mt-0.5">How often the sync engine retries failed uploads</p>
            </div>
            <input type="number" min={1} value={values['sync_retry_interval'] ?? '5'} onChange={(e) => handleChange('sync_retry_interval', e.target.value)} className={baseInput} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
            <div>
              <label className="text-sm font-medium text-gray-800 block">Max Retries Per Record</label>
              <p className="text-xs text-gray-500 mt-0.5">Maximum retry attempts before marking as failed</p>
            </div>
            <input type="number" min={1} value={values['sync_max_retries'] ?? '3'} onChange={(e) => handleChange('sync_max_retries', e.target.value)} className={baseInput} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
            <div>
              <label className="text-sm font-medium text-gray-800 block">Queue Size Warning Threshold</label>
              <p className="text-xs text-gray-500 mt-0.5">Alert when pending records exceed this count</p>
            </div>
            <input type="number" min={1} value={values['sync_queue_warning_threshold'] ?? '50'} onChange={(e) => handleChange('sync_queue_warning_threshold', e.target.value)} className={baseInput} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
            <div>
              <label className="text-sm font-medium text-gray-800 block">Conflict Resolution Strategy</label>
              <p className="text-xs text-gray-500 mt-0.5">How sync conflicts are resolved</p>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" /></svg>
              <span className="text-sm text-gray-600">Server wins — locked</span>
            </div>
          </div>
        </div>
      </div>

      {/* Save */}
      <div className="flex items-center justify-between">
        {saveSuccess && (
          <span className="text-sm text-green-600 flex items-center gap-1">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
            Saved successfully
          </span>
        )}
        {saveMutation.error && <span className="text-sm text-red-600">Save failed: {(saveMutation.error as Error).message}</span>}
        {!saveSuccess && !saveMutation.error && <span />}
        <button
          onClick={handleSave}
          disabled={saveMutation.isPending}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
        >
          {saveMutation.isPending && <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" /></svg>}
          {saveMutation.isPending ? 'Saving…' : 'Save Sync Settings'}
        </button>
      </div>
    </div>
  )
}
