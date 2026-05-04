import { useEffect, useState } from 'react'
import { useSettings, useSaveSettings, buildValuesMap } from '../useSettings'

export default function SecuritySettings() {
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
    handleChange(key, values[key] === 'true' ? 'false' : 'true')
  }

  async function handleSave() {
    const keys = [
      'session_timeout_minutes', 'max_login_attempts', 'password_min_length',
      'password_require_uppercase', 'password_require_number',
    ]
    await saveMutation.mutateAsync(keys.map((k) => ({ key: k, value: values[k] ?? '' })))
    setSaveSuccess(true)
    setTimeout(() => setSaveSuccess(false), 4000)
  }

  const baseInput = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white'

  if (isLoading) return <div className="text-sm text-gray-400 py-8 text-center">Loading…</div>
  if (error) return <div className="text-sm text-red-600 py-4">Failed to load settings: {error.message}</div>

  return (
    <div className="flex flex-col gap-5">
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-1">Security Settings</h3>
        <p className="text-sm text-gray-500 mb-1">Configure session and password security policies.</p>
        <div className="mb-5 flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-500 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>
          <p className="text-xs text-blue-700">These settings are enforced at the application level.</p>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
            <div>
              <label className="text-sm font-medium text-gray-800 block">Session Timeout (minutes)</label>
              <p className="text-xs text-gray-500 mt-0.5">Idle session timeout before automatic sign-out</p>
            </div>
            <input type="number" min={1} value={values['session_timeout_minutes'] ?? '60'} onChange={(e) => handleChange('session_timeout_minutes', e.target.value)} className={baseInput} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
            <div>
              <label className="text-sm font-medium text-gray-800 block">Max Login Attempts</label>
              <p className="text-xs text-gray-500 mt-0.5">Lockout after this many failed attempts</p>
            </div>
            <input type="number" min={1} value={values['max_login_attempts'] ?? '5'} onChange={(e) => handleChange('max_login_attempts', e.target.value)} className={baseInput} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
            <div>
              <label className="text-sm font-medium text-gray-800 block">Minimum Password Length</label>
              <p className="text-xs text-gray-500 mt-0.5">Minimum characters required for passwords</p>
            </div>
            <input type="number" min={6} max={32} value={values['password_min_length'] ?? '8'} onChange={(e) => handleChange('password_min_length', e.target.value)} className={baseInput} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-center">
            <div>
              <label className="text-sm font-medium text-gray-800 block">Require Uppercase Letter</label>
              <p className="text-xs text-gray-500 mt-0.5">Password must contain at least one uppercase letter</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={values['password_require_uppercase'] === 'true'}
              onClick={() => handleToggle('password_require_uppercase')}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${values['password_require_uppercase'] === 'true' ? 'bg-blue-600' : 'bg-gray-200'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${values['password_require_uppercase'] === 'true' ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-center">
            <div>
              <label className="text-sm font-medium text-gray-800 block">Require Number</label>
              <p className="text-xs text-gray-500 mt-0.5">Password must contain at least one number</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={values['password_require_number'] === 'true'}
              onClick={() => handleToggle('password_require_number')}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${values['password_require_number'] === 'true' ? 'bg-blue-600' : 'bg-gray-200'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${values['password_require_number'] === 'true' ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Save */}
      <div className="flex items-center justify-between">
        {saveSuccess && (
          <span className="text-sm text-green-600 flex items-center gap-1">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
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
          {saveMutation.isPending ? 'Saving…' : 'Save Security Settings'}
        </button>
      </div>
    </div>
  )
}
