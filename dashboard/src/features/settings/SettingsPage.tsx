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

type FieldType = 'text' | 'password' | 'number' | 'time' | 'color' | 'select' | 'url'

interface FieldDef {
  key: string
  label: string
  description?: string
  type?: FieldType
  placeholder?: string
  maxLength?: number
  min?: number
  options?: { value: string; label: string }[]
  sensitive?: boolean // mask value display
}

// ---------------------------------------------------------------------------
// Tab definitions
// ---------------------------------------------------------------------------

interface TabDef {
  id: string
  label: string
  icon: string
  sections: { title: string; description?: string; fields: FieldDef[] }[]
}

const TABS: TabDef[] = [
  {
    id: 'appearance',
    label: 'App & Appearance',
    icon: '🎨',
    sections: [
      {
        title: 'Branding',
        description: 'Customize how the dashboard looks and is identified.',
        fields: [
          { key: 'app_title', label: 'App Title', placeholder: 'Desheena Admin', description: 'Browser tab title and dashboard header name' },
          { key: 'app_logo_url', label: 'Logo URL', type: 'url', placeholder: 'https://example.com/logo.png', description: 'Full URL to your company logo (PNG/SVG). Shown in the sidebar.' },
          { key: 'app_favicon_url', label: 'Favicon URL', type: 'url', placeholder: 'https://example.com/favicon.ico', description: 'Full URL to your favicon (ICO/PNG, 32×32 recommended).' },
          { key: 'app_primary_color', label: 'Primary Color', type: 'color', description: 'Accent color used for active nav items and primary buttons.' },
        ],
      },
      {
        title: 'Locale & Regional',
        description: 'Language, timezone, and currency settings.',
        fields: [
          {
            key: 'app_language', label: 'Language', type: 'select',
            description: 'Interface language for the dashboard.',
            options: [
              { value: 'en', label: 'English' },
              { value: 'sw', label: 'Swahili' },
            ],
          },
          { key: 'app_timezone', label: 'Timezone', type: 'select',
            description: 'Used for scheduled jobs and date display.',
            options: [
              { value: 'Africa/Kampala', label: 'Africa/Kampala (UTC+3)' },
              { value: 'Africa/Nairobi', label: 'Africa/Nairobi (UTC+3)' },
              { value: 'Africa/Dar_es_Salaam', label: 'Africa/Dar es Salaam (UTC+3)' },
              { value: 'UTC', label: 'UTC' },
            ],
          },
          { key: 'app_currency', label: 'Currency', type: 'select',
            description: 'Currency code used across invoices and reports.',
            options: [
              { value: 'UGX', label: 'UGX — Ugandan Shilling' },
              { value: 'KES', label: 'KES — Kenyan Shilling' },
              { value: 'TZS', label: 'TZS — Tanzanian Shilling' },
              { value: 'USD', label: 'USD — US Dollar' },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'company',
    label: 'Company',
    icon: '🏢',
    sections: [
      {
        title: 'Company Information',
        description: 'Displayed on invoices, SMS messages, and email footers.',
        fields: [
          { key: 'company_name', label: 'Company Name', placeholder: 'Desheena Investments Ltd' },
          { key: 'company_phone', label: 'Company Phone', placeholder: '+256 700 000000' },
          { key: 'company_email', label: 'Company Email', type: 'url', placeholder: 'info@desheena.co.ug' },
        ],
      },
      {
        title: 'Billing Defaults',
        description: 'Default values applied when generating invoices.',
        fields: [
          { key: 'invoice_due_days', label: 'Invoice Due Days', type: 'number', min: 1, placeholder: '14', description: 'Days after generation before an invoice becomes overdue.' },
        ],
      },
    ],
  },
  {
    id: 'smtp',
    label: 'Email (SMTP)',
    icon: '📧',
    sections: [
      {
        title: 'SMTP Configuration',
        description: 'Configure outgoing email for invoice delivery, password resets, and system alerts. Credentials are stored encrypted.',
        fields: [
          { key: 'smtp_host', label: 'SMTP Host', placeholder: 'smtp.gmail.com', description: 'Your mail server hostname.' },
          { key: 'smtp_port', label: 'SMTP Port', type: 'number', min: 1, placeholder: '587', description: '587 for TLS (recommended), 465 for SSL, 25 for plain.' },
          {
            key: 'smtp_encryption', label: 'Encryption', type: 'select',
            options: [
              { value: 'tls', label: 'TLS (STARTTLS) — port 587' },
              { value: 'ssl', label: 'SSL — port 465' },
              { value: 'none', label: 'None — port 25 (not recommended)' },
            ],
          },
          { key: 'smtp_user', label: 'SMTP Username', placeholder: 'you@gmail.com', description: 'Login username for your SMTP server.' },
          { key: 'smtp_password', label: 'SMTP Password', type: 'password', sensitive: true, placeholder: '••••••••', description: 'App-specific password or SMTP password. Stored encrypted.' },
          { key: 'smtp_from_name', label: 'From Name', placeholder: 'Desheena Investments Ltd', description: 'Sender name shown in outgoing emails.' },
          { key: 'smtp_from_email', label: 'From Email', placeholder: 'noreply@desheena.co.ug', description: 'Sender email address for outgoing emails.' },
        ],
      },
    ],
  },
  {
    id: 'sms',
    label: "SMS (Africa's Talking)",
    icon: '📱',
    sections: [
      {
        title: "Africa's Talking API",
        description: "Connect your Africa's Talking account to send SMS notifications for invoices, payments, and complaints.",
        fields: [
          {
            key: 'at_environment', label: 'Environment', type: 'select',
            description: 'Use sandbox for testing, production for live SMS.',
            options: [
              { value: 'sandbox', label: 'Sandbox (testing)' },
              { value: 'production', label: 'Production (live)' },
            ],
          },
          { key: 'at_username', label: 'Username', placeholder: 'sandbox', description: "Your Africa's Talking account username." },
          { key: 'at_api_key', label: 'API Key', type: 'password', sensitive: true, placeholder: '••••••••••••••••', description: "Found in your Africa's Talking dashboard under API Key." },
          { key: 'at_shortcode', label: 'Shortcode / Sender ID', placeholder: 'Desheena', maxLength: 11, description: 'Registered shortcode or alphanumeric sender ID (max 11 characters).' },
          { key: 'sms_sender_id', label: 'Default Sender ID', placeholder: 'Desheena', maxLength: 11, description: 'Fallback sender ID used in SMS messages.' },
        ],
      },
    ],
  },
  {
    id: 'pesapal',
    label: 'Pesapal Payments',
    icon: '💳',
    sections: [
      {
        title: 'Pesapal API Credentials',
        description: 'Connect Pesapal to accept online payments from clients. Get your credentials from the Pesapal merchant dashboard.',
        fields: [
          {
            key: 'pesapal_environment', label: 'Environment', type: 'select',
            description: 'Use sandbox for testing, production for live payments.',
            options: [
              { value: 'sandbox', label: 'Sandbox (testing) — demo.pesapal.com' },
              { value: 'production', label: 'Production (live) — www.pesapal.com' },
            ],
          },
          { key: 'pesapal_consumer_key', label: 'Consumer Key', placeholder: 'qkio1BGGYi3272AqK…', description: 'From your Pesapal merchant dashboard → API Credentials.' },
          { key: 'pesapal_consumer_secret', label: 'Consumer Secret', type: 'password', sensitive: true, placeholder: '••••••••••••••••', description: 'Keep this secret. Never share it publicly.' },
          { key: 'pesapal_currency', label: 'Currency', type: 'select',
            options: [
              { value: 'UGX', label: 'UGX — Ugandan Shilling' },
              { value: 'KES', label: 'KES — Kenyan Shilling' },
              { value: 'TZS', label: 'TZS — Tanzanian Shilling' },
              { value: 'USD', label: 'USD — US Dollar' },
            ],
          },
        ],
      },
      {
        title: 'Webhook & Callback URLs',
        description: 'These URLs must be configured in your Pesapal merchant dashboard under IPN Settings.',
        fields: [
          { key: 'pesapal_ipn_url', label: 'IPN URL (Webhook)', type: 'url', placeholder: 'https://your-project.supabase.co/functions/v1/pesapal-webhook', description: 'Pesapal posts payment status updates to this URL. Must be publicly accessible over HTTPS.' },
          { key: 'pesapal_callback_url', label: 'Callback URL', type: 'url', placeholder: 'https://your-dashboard.vercel.app/dashboard/billing', description: 'Pesapal redirects the customer here after completing payment.' },
        ],
      },
    ],
  },
  {
    id: 'alerts',
    label: 'Alerts',
    icon: '🔔',
    sections: [
      {
        title: 'Notification Thresholds',
        description: 'Configure when in-app alerts are triggered.',
        fields: [
          { key: 'pending_sync_threshold', label: 'Pending Sync Alert Threshold', type: 'number', min: 1, placeholder: '50', description: 'Trigger an alert when pending sync records across all drivers exceed this count.' },
          { key: 'missed_route_check_time', label: 'Missed Route Check Time', type: 'time', description: 'Local time (HH:MM) to check for drivers with no collections recorded. Runs daily.' },
        ],
      },
    ],
  },
]

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
// SettingField component
// ---------------------------------------------------------------------------

function SettingField({
  field,
  value,
  onChange,
}: {
  field: FieldDef
  value: string
  onChange: (key: string, value: string) => void
}) {
  const [showPassword, setShowPassword] = useState(false)
  const type = field.type ?? 'text'

  const baseInput =
    'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white'

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 py-4 border-b border-gray-100 last:border-0 items-start">
      <div>
        <label htmlFor={`s-${field.key}`} className="text-sm font-medium text-gray-800 block">
          {field.label}
        </label>
        {field.description && (
          <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{field.description}</p>
        )}
      </div>
      <div>
        {type === 'select' && field.options ? (
          <select
            id={`s-${field.key}`}
            value={value}
            onChange={(e) => onChange(field.key, e.target.value)}
            className={baseInput}
          >
            {field.options.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        ) : type === 'color' ? (
          <div className="flex items-center gap-3">
            <input
              id={`s-${field.key}`}
              type="color"
              value={value || '#16a34a'}
              onChange={(e) => onChange(field.key, e.target.value)}
              className="h-9 w-16 rounded border border-gray-300 cursor-pointer p-0.5"
            />
            <input
              type="text"
              value={value}
              onChange={(e) => onChange(field.key, e.target.value)}
              placeholder="#16a34a"
              maxLength={7}
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
            />
          </div>
        ) : type === 'password' ? (
          <div className="relative">
            <input
              id={`s-${field.key}`}
              type={showPassword ? 'text' : 'password'}
              value={value}
              onChange={(e) => onChange(field.key, e.target.value)}
              placeholder={field.placeholder}
              className={`${baseInput} pr-10`}
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword((p) => !p)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
              aria-label={showPassword ? 'Hide' : 'Show'}
            >
              {showPassword ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                  <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clipRule="evenodd" />
                  <path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.064 7 9.542 7 .847 0 1.669-.105 2.454-.303z" />
                </svg>
              )}
            </button>
          </div>
        ) : type === 'number' ? (
          <input
            id={`s-${field.key}`}
            type="number"
            min={field.min ?? 0}
            value={value}
            onChange={(e) => onChange(field.key, e.target.value)}
            placeholder={field.placeholder}
            className={baseInput}
          />
        ) : type === 'time' ? (
          <input
            id={`s-${field.key}`}
            type="time"
            value={value}
            onChange={(e) => onChange(field.key, e.target.value)}
            className={baseInput}
          />
        ) : (
          <input
            id={`s-${field.key}`}
            type="text"
            value={value}
            onChange={(e) => onChange(field.key, e.target.value)}
            placeholder={field.placeholder}
            maxLength={field.maxLength}
            className={baseInput}
          />
        )}
        {field.maxLength && (
          <p className="text-xs text-gray-400 mt-0.5 text-right">{value.length}/{field.maxLength}</p>
        )}
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
  const [activeTab, setActiveTab] = useState(TABS[0].id)

  const { data: settings = [], isLoading, error } = useQuery<Setting[]>({
    queryKey: ['system_settings'],
    queryFn: fetchSettings,
  })

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
      setTimeout(() => setSaveSuccess(false), 4000)
    },
  })

  function handleReset() {
    const original: Record<string, string> = {}
    settings.forEach((s) => { original[s.key] = s.value })
    setValues(original)
    setIsDirty(false)
    setSaveSuccess(false)
  }

  const currentTab = TABS.find((t) => t.id === activeTab) ?? TABS[0]

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
        Loading settings…
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-0 max-w-5xl mx-auto">
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">System Settings</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Configure integrations, appearance, and system defaults
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isDirty && (
            <button
              onClick={handleReset}
              className="px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-400 transition-colors"
            >
              Discard
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
            {saveMutation.isPending ? 'Saving…' : 'Save all changes'}
          </button>
        </div>
      </div>

      {/* Banners */}
      {isDirty && (
        <div className="mb-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800 flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          You have unsaved changes across all tabs. Click <strong className="mx-1">Save all changes</strong> to apply them.
        </div>
      )}
      {saveSuccess && (
        <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700 flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          All settings saved successfully.
        </div>
      )}
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          Failed to load settings: {(error as Error).message}
        </div>
      )}
      {saveMutation.error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          Save failed: {(saveMutation.error as Error).message}
        </div>
      )}

      {/* Tab layout */}
      <div className="flex gap-6">
        {/* Left tab nav */}
        <nav className="w-52 shrink-0 flex flex-col gap-1" aria-label="Settings sections">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={[
                'flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium text-left transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500',
                activeTab === tab.id
                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
              ].join(' ')}
              aria-current={activeTab === tab.id ? 'page' : undefined}
            >
              <span aria-hidden="true">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Right content */}
        <div className="flex-1 flex flex-col gap-5 min-w-0">
          {currentTab.sections.map((section) => (
            <div key={section.title} className="bg-white border border-gray-200 rounded-xl p-6">
              <div className="mb-4">
                <h3 className="text-base font-semibold text-gray-900">{section.title}</h3>
                {section.description && (
                  <p className="text-sm text-gray-500 mt-0.5">{section.description}</p>
                )}
              </div>
              <div>
                {section.fields.map((field) => (
                  <SettingField
                    key={field.key}
                    field={field}
                    value={values[field.key] ?? ''}
                    onChange={handleChange}
                  />
                ))}
              </div>
            </div>
          ))}

          {/* Last saved timestamp */}
          {settings.length > 0 && (
            <p className="text-xs text-gray-400 text-right pb-2">
              Last saved:{' '}
              {new Date(
                Math.max(...settings.map((s) => new Date(s.updated_at).getTime()))
              ).toLocaleString('en-UG')}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
