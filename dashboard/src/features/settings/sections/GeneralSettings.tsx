import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { useSettings, useSaveSettings, buildValuesMap } from '../useSettings'

// ---------------------------------------------------------------------------
// ImageUploadField — upload to Supabase Storage or paste a URL
// ---------------------------------------------------------------------------

interface ImageUploadFieldProps {
  label: string
  description: string
  settingKey: string
  value: string
  accept?: string
  onChange: (key: string, value: string) => void
}

function ImageUploadField({
  label,
  description,
  settingKey,
  value,
  accept = 'image/png,image/svg+xml,image/jpeg,image/webp,image/gif',
  onChange,
}: ImageUploadFieldProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [tab, setTab] = useState<'upload' | 'url'>('upload')

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    // 2 MB limit
    if (file.size > 2 * 1024 * 1024) {
      setUploadError('File is too large. Maximum size is 2 MB.')
      return
    }

    setUploading(true)
    setUploadError(null)

    try {
      // Use a stable filename based on the setting key so re-uploads replace the old file
      const ext = file.name.split('.').pop() ?? 'png'
      const path = `branding/${settingKey}.${ext}`

      const { error: uploadErr } = await supabase.storage
        .from('media')
        .upload(path, file, { upsert: true, contentType: file.type })

      if (uploadErr) throw new Error(uploadErr.message)

      const { data } = supabase.storage.from('media').getPublicUrl(path)
      // Append a cache-busting timestamp so the browser picks up the new image
      const publicUrl = `${data.publicUrl}?t=${Date.now()}`
      onChange(settingKey, publicUrl)
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
      // Reset the input so the same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  function handleRemove() {
    onChange(settingKey, '')
    setUploadError(null)
  }

  // Strip cache-busting param for display
  const displayUrl = value.split('?')[0]
  const isStorageUrl = value.includes('/storage/v1/object/public/media/')

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
      <div>
        <label className="text-sm font-medium text-gray-800 block">{label}</label>
        <p className="text-xs text-gray-500 mt-0.5">{description}</p>
      </div>

      <div className="flex flex-col gap-2">
        {/* Tab switcher */}
        <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden text-xs w-fit">
          <button
            type="button"
            onClick={() => setTab('upload')}
            className={`px-3 py-1.5 font-medium transition-colors focus:outline-none ${
              tab === 'upload' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            Upload file
          </button>
          <button
            type="button"
            onClick={() => setTab('url')}
            className={`px-3 py-1.5 font-medium transition-colors focus:outline-none border-l border-gray-200 ${
              tab === 'url' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            Paste URL
          </button>
        </div>

        {tab === 'upload' ? (
          <div className="flex flex-col gap-2">
            {/* Current image preview */}
            {value && (
              <div className="flex items-center gap-3 p-2 bg-gray-50 border border-gray-200 rounded-lg">
                <img
                  src={value}
                  alt={label}
                  className="h-10 w-10 object-contain rounded border border-gray-200 bg-white"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-700 truncate" title={displayUrl}>
                    {isStorageUrl ? 'Uploaded to media library' : displayUrl}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleRemove}
                  className="text-xs text-red-600 hover:text-red-800 px-2 py-1 rounded hover:bg-red-50 transition-colors shrink-0"
                >
                  Remove
                </button>
              </div>
            )}

            {/* Upload button */}
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept={accept}
                onChange={handleFileChange}
                className="sr-only"
                id={`file-${settingKey}`}
                aria-label={`Upload ${label}`}
              />
              <label
                htmlFor={`file-${settingKey}`}
                className={`inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border cursor-pointer transition-colors focus-within:ring-2 focus-within:ring-blue-500 ${
                  uploading
                    ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                {uploading ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Uploading…
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    {value ? 'Replace image' : 'Choose image'}
                  </>
                )}
              </label>
              <p className="text-xs text-gray-400 mt-1">PNG, SVG, JPG, WebP — max 2 MB</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <input
              type="url"
              value={value}
              onChange={(e) => { onChange(settingKey, e.target.value); setUploadError(null) }}
              placeholder="https://example.com/logo.png"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            />
            {value && (
              <img
                src={value}
                alt={label}
                className="h-10 w-auto object-contain rounded border border-gray-200 bg-gray-50 p-1"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
              />
            )}
          </div>
        )}

        {uploadError && (
          <p className="text-xs text-red-600">{uploadError}</p>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// GeneralSettings
// ---------------------------------------------------------------------------

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
          {/* App Name */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
            <div>
              <label className="text-sm font-medium text-gray-800 block">App Name</label>
              <p className="text-xs text-gray-500 mt-0.5">Browser tab title and dashboard header name</p>
            </div>
            <input
              type="text"
              value={values['app_title'] ?? ''}
              onChange={(e) => handleChange('app_title', e.target.value)}
              placeholder="Desheena Admin"
              className={baseInput}
            />
          </div>

          {/* Logo upload */}
          <ImageUploadField
            label="Company Logo"
            description="Shown in the sidebar. PNG or SVG recommended."
            settingKey="app_logo_url"
            value={values['app_logo_url'] ?? ''}
            accept="image/png,image/svg+xml,image/jpeg,image/webp"
            onChange={handleChange}
          />

          {/* Favicon upload */}
          <ImageUploadField
            label="Favicon"
            description="Browser tab icon. ICO or PNG, 32×32 recommended."
            settingKey="app_favicon_url"
            value={values['app_favicon_url'] ?? ''}
            accept="image/x-icon,image/vnd.microsoft.icon,image/png,image/gif"
            onChange={handleChange}
          />

          {/* Primary Color */}
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
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
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
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 transition-colors sm:ml-auto"
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
