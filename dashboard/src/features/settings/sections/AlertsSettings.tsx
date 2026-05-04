import { useEffect, useState } from 'react'
import { useSettings, useSaveSettings, buildValuesMap } from '../useSettings'

// ---------------------------------------------------------------------------
// Alert config
// ---------------------------------------------------------------------------

interface AlertConfig {
  key: string
  enabledKey: string
  label: string
  description: string
  inputType?: 'number' | 'time'
  inputLabel?: string
  inputKey?: string
  defaultValue?: string
}

const ALERTS: AlertConfig[] = [
  {
    key: 'pending_sync',
    enabledKey: 'alert_pending_sync_enabled',
    label: 'Pending Sync Alert',
    description: 'Trigger an alert when pending sync records across all drivers exceed the threshold.',
    inputType: 'number',
    inputLabel: 'Threshold (records)',
    inputKey: 'alert_pending_sync_threshold',
    defaultValue: '50',
  },
  {
    key: 'missed_route',
    enabledKey: 'alert_missed_route_enabled',
    label: 'Missed Route Check',
    description: 'Alert when drivers have no collections recorded by the specified time.',
    inputType: 'time',
    inputLabel: 'Check time',
    inputKey: 'alert_missed_route_time',
    defaultValue: '18:00',
  },
  {
    key: 'overdue_sms',
    enabledKey: 'alert_overdue_sms_enabled',
    label: 'Invoice Overdue SMS Reminder',
    description: 'Send an SMS reminder to clients when their invoice becomes overdue.',
  },
  {
    key: 'new_complaint',
    enabledKey: 'alert_new_complaint_enabled',
    label: 'New Complaint Notification',
    description: 'Receive an in-app notification when a new complaint is submitted.',
  },
]

// ---------------------------------------------------------------------------
// AlertsSettings
// ---------------------------------------------------------------------------

export default function AlertsSettings() {
  const { data: settings = [], isLoading, error } = useSettings()
  const saveMutation = useSaveSettings()

  const [values, setValues] = useState<Record<string, string>>({})
  const [saveSuccess, setSaveSuccess] = useState(false)

  useEffect(() => {
    if (settings.length > 0) setValues(buildValuesMap(settings))
  }, [settings])

  function handleChange(key: string, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }))
    setSaveSuccess(false)
  }

  function handleToggle(key: string) {
    const current = values[key] === 'true'
    handleChange(key, String(!current))
  }

  async function handleSave() {
    const keys = ALERTS.flatMap((a) => {
      const ks = [a.enabledKey]
      if (a.inputKey) ks.push(a.inputKey)
      return ks
    })
    await saveMutation.mutateAsync(keys.map((k) => ({ key: k, value: values[k] ?? '' })))
    setSaveSuccess(true)
    setTimeout(() => setSaveSuccess(false), 4000)
  }

  if (isLoading) return <div className="text-sm text-gray-400 py-8 text-center">Loading…</div>
  if (error) return <div className="text-sm text-red-600 py-4">Failed to load settings: {error.message}</div>

  return (
    <div className="flex flex-col gap-5">
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-1">Alerts & Automation</h3>
        <p className="text-sm text-gray-500 mb-5">Configure when automated alerts and notifications are triggered.</p>

        <div className="space-y-5">
          {ALERTS.map((alert) => {
            const enabled = values[alert.enabledKey] === 'true'
            return (
              <div key={alert.key} className="border border-gray-100 rounded-lg p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{alert.label}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{alert.description}</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={enabled}
                    onClick={() => handleToggle(alert.enabledKey)}
                    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${enabled ? 'bg-blue-600' : 'bg-gray-200'}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>

                {enabled && alert.inputKey && (
                  <div className="mt-3 flex items-center gap-3">
                    <label className="text-xs font-medium text-gray-600 whitespace-nowrap">{alert.inputLabel}:</label>
                    <input
                      type={alert.inputType}
                      value={values[alert.inputKey] ?? alert.defaultValue ?? ''}
                      onChange={(e) => handleChange(alert.inputKey!, e.target.value)}
                      min={alert.inputType === 'number' ? 1 : undefined}
                      className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white w-32"
                    />
                  </div>
                )}
              </div>
            )
          })}
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
          {saveMutation.isPending ? 'Saving…' : 'Save Alert Settings'}
        </button>
      </div>
    </div>
  )
}
