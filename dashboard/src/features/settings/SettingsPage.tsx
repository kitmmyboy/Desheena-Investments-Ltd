import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../auth/AuthContext'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Setting {
  key: string
  value: string
  label: string
  description: string | null
  updated_at: string
}

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

async function fetchSettings(): Promise<Setting[]> {
  const { data, error } = await supabase
    .from('system_settings')
    .select('key, value, label, description, updated_at')
    .order('key')
  if (error) throw new Error(error.message)
  return (data ?? []) as Setting[]
}

async function saveSettings(
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
// Setting groups for display
// ---------------------------------------------------------------------------

const SETTING_GROUPS: { title: string; keys: string[] }[] = [
  {
    title: 'Company Information',
    keys: ['company_name', 'company_phone', 'company_email'],
  },
  {
    title: 'Billing',
    keys: ['invoice_due_days', 'vat_rate'],
  },
  {
    title: 'SMS',
    keys: ['sms_sender_id'],
  },
  {
    title: 'Alerts & Notifications',
    keys: ['pending_sync_threshold', 'missed_route_check_time'],
  },
]

// ---------------------------------------------------------------------------
// Field
// ---------------------------------------------------------------------------

function SettingField({
  setting,
  value,
  onChange,
}: {
  setting: Setting
  value: string
  onChange: (key: string, value: string) => void
}) {
  const isNumeric = ['invoice_due_days', 'vat_rate', 'pending_sync_threshold'].includes(setting.key)
  const isTime = setting.key === 'missed_route_check_time'

  return (
    <div className="flex flex-col gap-1.5 py-4 border-b border-gray-100 last:border-0">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <label
            htmlFor={`setting-${setting.key}`}
            className="text-sm font-medium text-gray-800"
          >
            {setting.label}
          </label>
          {setting.description && (
            <p className="text-xs text-gray-500 mt-0.5">{setting.description}</p>
          )}
        </div>
        <div className="w-64 shrink-0">
          {isTime ? (
            <input
              id={`setting-${setting.key}`}
              type="time"
              value={value}
              onChange={(e) => onChange(setting.key, e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          ) : isNumeric ? (
            <input
              id={`setting-${setting.key}`}
              type="number"
              min="0"
              value={value}
              onChange={(e) => onChange(setting.key, e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          ) : (
            <input
              id={`setting-${setting.key}`}
              type="text"
              value={value}
              onChange={(e) => onChange(setting.key, e.target.value)}
              maxLength={setting.key === 'sms_sender_id' ? 11 : undefined}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          )}
          {setting.key === 'sms_sender_id' && (
            <p className="text-xs text-gray-400 mt-0.5 text-right">{value.length}/11</p>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// SettingsPage
// ---------------------------------------------------------------------------

export default function SettingsPage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const { data: settings = [], isLoading, error } = useQuery<Setting[]>({
    queryKey: ['system_settings'],
    queryFn: fetchSettings,
  })

  // Local editable state: key → value
  const [values, setValues] = useState<Record<string, string>>({})
  const [isDirty, setIsDirty] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  useEffect(() => {
    if (settings.length > 0) {
      const initial: Record<string, string> = {}
      settings.forEach((s) => { initial[s.key] = s.value })
      setValues(initial)
      setIsDirty(false)
    }
  }, [settings])

  function handleChange(key: string, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }))
    setIsDirty(true)
    setSaveSuccess(false)
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const updates = Object.entries(values).map(([key, value]) => ({ key, value }))
      await saveSettings(updates, user!.id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system_settings'] })
      setIsDirty(false)
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    },
  })

  function handleReset() {
    const original: Record<string, string> = {}
    settings.forEach((s) => { original[s.key] = s.value })
    setValues(original)
    setIsDirty(false)
    setSaveSuccess(false)
  }

  // Build a lookup map for quick access
  const settingMap = Object.fromEntries(settings.map((s) => [s.key, s]))

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
        Loading settings…
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">System Settings</h2>
          <p className="text-sm text-gray-500 mt-0.5">Configure system-wide defaults for Desheena Waste Management</p>
        </div>
        <div className="flex items-center gap-3">
          {isDirty && (
            <button
              onClick={handleReset}
              className="px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-400 transition-colors"
            >
              Reset
            </button>
          )}
          <button
            onClick={() => saveMutation.mutate()}
            disabled={!isDirty || saveMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
          >
            {saveMutation.isPending && (
              <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            )}
            {saveMutation.isPending ? 'Saving…' : 'Save settings'}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
          Failed to load settings: {(error as Error).message}
        </div>
      )}
      {saveMutation.error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
          Failed to save: {(saveMutation.error as Error).message}
        </div>
      )}
      {saveSuccess && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-green-700">
          Settings saved successfully.
        </div>
      )}

      {/* Unsaved changes banner */}
      {isDirty && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800 flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          You have unsaved changes.
        </div>
      )}

      {/* Setting groups */}
      {SETTING_GROUPS.map((group) => {
        const groupSettings = group.keys
          .map((k) => settingMap[k])
          .filter(Boolean) as Setting[]

        if (groupSettings.length === 0) return null

        return (
          <div key={group.title} className="bg-white border border-gray-200 rounded-xl p-6">
            <h3 className="text-base font-semibold text-gray-900 mb-2">{group.title}</h3>
            <div>
              {groupSettings.map((setting) => (
                <SettingField
                  key={setting.key}
                  setting={setting}
                  value={values[setting.key] ?? setting.value}
                  onChange={handleChange}
                />
              ))}
            </div>
          </div>
        )
      })}

      {/* Last updated info */}
      {settings.length > 0 && (
        <p className="text-xs text-gray-400 text-center pb-4">
          Last saved:{' '}
          {new Date(
            Math.max(...settings.map((s) => new Date(s.updated_at).getTime()))
          ).toLocaleString('en-UG')}
        </p>
      )}
    </div>
  )
}
