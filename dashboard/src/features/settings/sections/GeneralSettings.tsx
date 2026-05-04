import { useEffect, useState } from 'react'
import { useSettings, useSaveSettings, buildValuesMap } from '../useSettings'

export default function GeneralSettings() {
  const { data: settings = [], isLoading, error } = useSettings()
  const saveMutation = useSaveSettings()

  const [values, setValues] = useState<Record<string, string>>({})
  const [saveSuccess, setSaveSuccess] = useState(false)

  useEffect(() => {
    if (settings.length > 0) {
      setValues(buildValuesMap(settings))
    }
  }, [settings])

  function handleChange(key: string, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }))
    setSaveSuccess(false)
  }

  async function handleSave() {
    const keys = [
      'app_title', 'app_logo_url', 'app_favicon_url', 'app_primary_color',
      'app_language', 'app_timezone', 'app_currency',
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
      {/* Branding */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-1">Branding</h3>
        <p className="text-sm text-gray-500 mb-5">Customize how the dashboard looks and is identified.</p>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
            <div>
              <label className="text-sm font-medium text-gray-800 block">App Name</label>
              <p className="text-xs text-gray-500 mt-0.5">Browser tab title and dashboard header name</p>
            </div>
            <input type="text" value={values['app_title'] ?? ''} onChange={(e) => handleChange('app_title', e.target.value)} placeholder="Desheena Admin" className={baseInput} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
            <div>
              <label className="text-sm font-medium text-gray-800 block">Logo URL</label>
              <p className="text-xs text-gray-500 mt-0.5">Full URL to your company logo (PNG/SVG)</p>
            </div>
            <input type="url" value={values['app_logo_url'] ?? ''} onChange={(e) => handleChange('app_logo_url', e.target.value)} placeholder="https://example.com/logo.png" className={baseInput} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
            <div>
              <label className="text-sm font-medium text-gray-800 block">Favicon URL</label>
              <p className="text-xs text-gray-500 mt-0.5">Full URL to your favicon (ICO/PNG, 32×32 recommended)</p>
            </div>
            <input type="url" value={values['app_favicon_url'] ?? ''} onChange={(e) => handleChange('app_favicon_url', e.target.value)} placeholder="https://example.com/favicon.ico" className={baseInput} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
            <div>
              <label className="text-sm font-medium text-gray-800 block">Primary Color</label>
              <p className="text-xs text-gray-500 mt-0.5">Accent color used for active nav items and primary buttons</p>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={values['app_primary_color'] || '#16a34a'}
                onChange={(e) => handleChange('app_primary_color', e.target.value)}
                className="h-9 w-16 rounded border border-gray-300 cursor-pointer p-0.5"
              />
              <input
                type="text"
                value={values['app_primary_color'] ?? ''}
                onChange={(e) => handleChange('app_primary_color', e.target.value)}
                placeholder="#16a34a"
                maxLength={7}
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Locale */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-1">Locale & Regional</h3>
        <p className="text-sm text-gray-500 mb-5">Language, timezone, and currency settings.</p>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
            <div>
              <label className="text-sm font-medium text-gray-800 block">Language</label>
              <p className="text-xs text-gray-500 mt-0.5">Interface language for the dashboard</p>
            </div>
            <select value={values['app_language'] ?? 'en'} onChange={(e) => handleChange('app_language', e.target.value)} className={baseInput}>
              <option value="en">English</option>
              <option value="sw">Swahili</option>
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
            <div>
              <label className="text-sm font-medium text-gray-800 block">Timezone</label>
              <p className="text-xs text-gray-500 mt-0.5">Used for scheduled jobs and date display</p>
            </div>
            <select value={values['app_timezone'] ?? 'Africa/Kampala'} onChange={(e) => handleChange('app_timezone', e.target.value)} className={baseInput}>
              <option value="Africa/Kampala">Africa/Kampala (UTC+3)</option>
              <option value="Africa/Nairobi">Africa/Nairobi (UTC+3)</option>
              <option value="Africa/Dar_es_Salaam">Africa/Dar es Salaam (UTC+3)</option>
              <option value="UTC">UTC</option>
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
            <div>
              <label className="text-sm font-medium text-gray-800 block">Currency</label>
              <p className="text-xs text-gray-500 mt-0.5">Currency code used across invoices and reports</p>
            </div>
            <select value={values['app_currency'] ?? 'UGX'} onChange={(e) => handleChange('app_currency', e.target.value)} className={baseInput}>
              <option value="UGX">UGX — Ugandan Shilling</option>
              <option value="KES">KES — Kenyan Shilling</option>
              <option value="TZS">TZS — Tanzanian Shilling</option>
              <option value="USD">USD — US Dollar</option>
            </select>
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
        {saveMutation.error && (
          <span className="text-sm text-red-600">Save failed: {(saveMutation.error as Error).message}</span>
        )}
        {!saveSuccess && !saveMutation.error && <span />}
        <button
          onClick={handleSave}
          disabled={saveMutation.isPending}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
        >
          {saveMutation.isPending && (
            <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          )}
          {saveMutation.isPending ? 'Saving…' : 'Save General Settings'}
        </button>
      </div>
    </div>
  )
}
