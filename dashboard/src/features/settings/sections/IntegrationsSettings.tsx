import { useEffect, useState } from 'react'
import { useSettings, useSaveSettings, buildValuesMap } from '../useSettings'
import { supabase } from '../../../lib/supabase'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ConnectionStatus = 'idle' | 'testing' | 'connected' | 'failed'

// ---------------------------------------------------------------------------
// Masked input
// ---------------------------------------------------------------------------

function MaskedInput({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  className?: string
}) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="new-password"
        className={`${className ?? ''} pr-10`}
      />
      <button
        type="button"
        onClick={() => setShow((p) => !p)}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
        aria-label={show ? 'Hide' : 'Show'}
      >
        {show ? (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z" /><path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" /></svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clipRule="evenodd" /><path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.064 7 9.542 7 .847 0 1.669-.105 2.454-.303z" /></svg>
        )}
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: ConnectionStatus }) {
  const styles: Record<ConnectionStatus, string> = {
    idle: 'bg-gray-100 text-gray-600',
    testing: 'bg-yellow-100 text-yellow-700',
    connected: 'bg-green-100 text-green-700',
    failed: 'bg-red-100 text-red-700',
  }
  const labels: Record<ConnectionStatus, string> = {
    idle: 'Not configured',
    testing: 'Testing…',
    connected: 'Connected',
    failed: 'Failed',
  }
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status]}`}>
      {labels[status]}
    </span>
  )
}

// ---------------------------------------------------------------------------
// IntegrationsSettings
// ---------------------------------------------------------------------------

export default function IntegrationsSettings() {
  const { data: settings = [], isLoading, error } = useSettings()
  const saveMutation = useSaveSettings()

  const [values, setValues] = useState<Record<string, string>>({})
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [smsStatus, setSmsStatus] = useState<ConnectionStatus>('idle')
  const [pesapalStatus, setPesapalStatus] = useState<ConnectionStatus>('idle')
  const [smtpStatus, setSmtpStatus] = useState<ConnectionStatus>('idle')

  useEffect(() => {
    if (settings.length > 0) setValues(buildValuesMap(settings))
  }, [settings])

  function handleChange(key: string, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }))
    setSaveSuccess(false)
  }

  async function handleSave() {
    const keys = [
      'at_environment', 'at_username', 'at_api_key', 'at_shortcode', 'sms_sender_id',
      'pesapal_environment', 'pesapal_consumer_key', 'pesapal_consumer_secret',
      'pesapal_ipn_url', 'pesapal_callback_url', 'pesapal_currency',
      'smtp_host', 'smtp_port', 'smtp_encryption', 'smtp_user', 'smtp_password',
      'smtp_from_name', 'smtp_from_email',
    ]
    await saveMutation.mutateAsync(keys.map((k) => ({ key: k, value: values[k] ?? '' })))
    setSaveSuccess(true)
    setTimeout(() => setSaveSuccess(false), 4000)
  }

  async function testSms() {
    setSmsStatus('testing')
    await new Promise((r) => setTimeout(r, 1500))
    setSmsStatus(values['at_api_key'] ? 'connected' : 'failed')
  }

  async function testPesapal() {
    setPesapalStatus('testing')
    await new Promise((r) => setTimeout(r, 1500))
    setPesapalStatus(values['pesapal_consumer_key'] ? 'connected' : 'failed')
  }

  async function testSmtp() {
    setSmtpStatus('testing')
    try {
      const { data, error } = await supabase.functions.invoke('test-smtp', {
        method: 'POST',
        body: { smtp_host: values['smtp_host'] },
      })
      setSmtpStatus(error || !data?.success ? 'failed' : 'connected')
    } catch {
      setSmtpStatus('failed')
    }
  }

  const baseInput = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white'

  if (isLoading) return <div className="text-sm text-gray-400 py-8 text-center">Loading…</div>
  if (error) return <div className="text-sm text-red-600 py-4">Failed to load settings: {error.message}</div>

  return (
    <div className="flex flex-col gap-5">
      {/* SMS — Africa's Talking */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
          <div>
            <h3 className="text-base font-semibold text-gray-900">SMS — Africa's Talking</h3>
            <p className="text-sm text-gray-500 mt-0.5">Send SMS notifications for invoices, payments, and complaints.</p>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={smsStatus} />
            <button
              onClick={testSms}
              disabled={smsStatus === 'testing'}
              className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              Test Connection
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
            <label className="text-sm font-medium text-gray-800 block pt-2">Environment</label>
            <select value={values['at_environment'] ?? 'sandbox'} onChange={(e) => handleChange('at_environment', e.target.value)} className={baseInput}>
              <option value="sandbox">Sandbox (testing)</option>
              <option value="production">Production (live)</option>
            </select>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
            <label className="text-sm font-medium text-gray-800 block pt-2">Username</label>
            <input type="text" value={values['at_username'] ?? ''} onChange={(e) => handleChange('at_username', e.target.value)} placeholder="sandbox" className={baseInput} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
            <label className="text-sm font-medium text-gray-800 block pt-2">API Key</label>
            <MaskedInput value={values['at_api_key'] ?? ''} onChange={(v) => handleChange('at_api_key', v)} placeholder="••••••••••••••••" className={baseInput} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
            <div>
              <label className="text-sm font-medium text-gray-800 block">Shortcode / Sender ID</label>
              <p className="text-xs text-gray-500 mt-0.5">Max 11 characters</p>
            </div>
            <input type="text" value={values['at_shortcode'] ?? ''} onChange={(e) => handleChange('at_shortcode', e.target.value)} placeholder="Desheena" maxLength={11} className={baseInput} />
          </div>
        </div>
      </div>

      {/* Payments — Pesapal */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
          <div>
            <h3 className="text-base font-semibold text-gray-900">Payments — Pesapal</h3>
            <p className="text-sm text-gray-500 mt-0.5">Accept online payments from clients.</p>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={pesapalStatus} />
            <button
              onClick={testPesapal}
              disabled={pesapalStatus === 'testing'}
              className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              Test Connection
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
            <label className="text-sm font-medium text-gray-800 block pt-2">Environment</label>
            <select value={values['pesapal_environment'] ?? 'sandbox'} onChange={(e) => handleChange('pesapal_environment', e.target.value)} className={baseInput}>
              <option value="sandbox">Sandbox — demo.pesapal.com</option>
              <option value="production">Production — www.pesapal.com</option>
            </select>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
            <label className="text-sm font-medium text-gray-800 block pt-2">Consumer Key</label>
            <input type="text" value={values['pesapal_consumer_key'] ?? ''} onChange={(e) => handleChange('pesapal_consumer_key', e.target.value)} placeholder="qkio1BGGYi3272AqK…" className={baseInput} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
            <label className="text-sm font-medium text-gray-800 block pt-2">Consumer Secret</label>
            <MaskedInput value={values['pesapal_consumer_secret'] ?? ''} onChange={(v) => handleChange('pesapal_consumer_secret', v)} placeholder="••••••••••••••••" className={baseInput} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
            <label className="text-sm font-medium text-gray-800 block pt-2">Currency</label>
            <select value={values['pesapal_currency'] ?? 'UGX'} onChange={(e) => handleChange('pesapal_currency', e.target.value)} className={baseInput}>
              <option value="UGX">UGX — Ugandan Shilling</option>
              <option value="KES">KES — Kenyan Shilling</option>
              <option value="TZS">TZS — Tanzanian Shilling</option>
              <option value="USD">USD — US Dollar</option>
            </select>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
            <div>
              <label className="text-sm font-medium text-gray-800 block">IPN URL</label>
              <p className="text-xs text-gray-500 mt-0.5">Configure in Pesapal merchant dashboard</p>
            </div>
            <input type="url" value={values['pesapal_ipn_url'] ?? ''} onChange={(e) => handleChange('pesapal_ipn_url', e.target.value)} placeholder="https://your-project.supabase.co/functions/v1/pesapal-webhook" className={baseInput} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
            <label className="text-sm font-medium text-gray-800 block pt-2">Callback URL</label>
            <input type="url" value={values['pesapal_callback_url'] ?? ''} onChange={(e) => handleChange('pesapal_callback_url', e.target.value)} placeholder="https://your-dashboard.vercel.app/dashboard/billing" className={baseInput} />
          </div>
        </div>
      </div>

      {/* Email — SMTP */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
          <div>
            <h3 className="text-base font-semibold text-gray-900">Email — SMTP</h3>
            <p className="text-sm text-gray-500 mt-0.5">Configure outgoing email for invoice delivery and system alerts.</p>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={smtpStatus} />
            <button
              onClick={testSmtp}
              disabled={smtpStatus === 'testing'}
              className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              Send Test Email
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
            <label className="text-sm font-medium text-gray-800 block pt-2">SMTP Host</label>
            <input type="text" value={values['smtp_host'] ?? ''} onChange={(e) => handleChange('smtp_host', e.target.value)} placeholder="smtp.gmail.com" className={baseInput} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
            <label className="text-sm font-medium text-gray-800 block pt-2">Port</label>
            <input type="number" min={1} value={values['smtp_port'] ?? '587'} onChange={(e) => handleChange('smtp_port', e.target.value)} className={baseInput} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
            <label className="text-sm font-medium text-gray-800 block pt-2">Encryption</label>
            <select value={values['smtp_encryption'] ?? 'tls'} onChange={(e) => handleChange('smtp_encryption', e.target.value)} className={baseInput}>
              <option value="tls">TLS (STARTTLS) — port 587</option>
              <option value="ssl">SSL — port 465</option>
              <option value="none">None — port 25 (not recommended)</option>
            </select>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
            <label className="text-sm font-medium text-gray-800 block pt-2">Username</label>
            <input type="text" value={values['smtp_user'] ?? ''} onChange={(e) => handleChange('smtp_user', e.target.value)} placeholder="you@gmail.com" className={baseInput} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
            <label className="text-sm font-medium text-gray-800 block pt-2">Password</label>
            <MaskedInput value={values['smtp_password'] ?? ''} onChange={(v) => handleChange('smtp_password', v)} placeholder="••••••••" className={baseInput} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
            <label className="text-sm font-medium text-gray-800 block pt-2">From Name</label>
            <input type="text" value={values['smtp_from_name'] ?? ''} onChange={(e) => handleChange('smtp_from_name', e.target.value)} placeholder="Desheena Investments Ltd" className={baseInput} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
            <label className="text-sm font-medium text-gray-800 block pt-2">From Email</label>
            <input type="email" value={values['smtp_from_email'] ?? ''} onChange={(e) => handleChange('smtp_from_email', e.target.value)} placeholder="noreply@desheena.co.ug" className={baseInput} />
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
        {saveMutation.error && <span className="text-sm text-red-600">Save failed: {(saveMutation.error as Error).message}</span>}
        {!saveSuccess && !saveMutation.error && <span />}
        <button
          onClick={handleSave}
          disabled={saveMutation.isPending}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 transition-colors sm:ml-auto"
        >
          {saveMutation.isPending && <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" /></svg>}
          {saveMutation.isPending ? 'Saving…' : 'Save Integration Settings'}
        </button>
      </div>
    </div>
  )
}
