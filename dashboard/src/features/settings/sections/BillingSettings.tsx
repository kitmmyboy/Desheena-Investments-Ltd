import { useEffect, useState } from 'react'
import { useSettings, useSaveSettings, buildValuesMap } from '../useSettings'

export default function BillingSettings() {
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
    const keys = [
      'vat_rate', 'late_payment_fee_pct', 'grace_period_days',
      'invoice_number_prefix', 'invoice_next_number',
      'payment_terms', 'invoice_auto_generate',
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
        <h3 className="text-base font-semibold text-gray-900 mb-1">Billing & Finance</h3>
        <p className="text-sm text-gray-500 mb-5">Configure invoice generation, fees, and payment terms.</p>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
            <div>
              <label className="text-sm font-medium text-gray-800 block">VAT Rate (%)</label>
              <p className="text-xs text-gray-500 mt-0.5">Set to 0 to disable VAT</p>
            </div>
            <input type="number" min={0} max={100} value={values['vat_rate'] ?? '18'} onChange={(e) => handleChange('vat_rate', e.target.value)} className={baseInput} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
            <div>
              <label className="text-sm font-medium text-gray-800 block">Late Payment Fee (%)</label>
              <p className="text-xs text-gray-500 mt-0.5">Percentage fee added to overdue invoices</p>
            </div>
            <input type="number" min={0} max={100} value={values['late_payment_fee_pct'] ?? '0'} onChange={(e) => handleChange('late_payment_fee_pct', e.target.value)} className={baseInput} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
            <div>
              <label className="text-sm font-medium text-gray-800 block">Grace Period (days)</label>
              <p className="text-xs text-gray-500 mt-0.5">Days after due date before late fee applies</p>
            </div>
            <input type="number" min={0} value={values['grace_period_days'] ?? '3'} onChange={(e) => handleChange('grace_period_days', e.target.value)} className={baseInput} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
            <div>
              <label className="text-sm font-medium text-gray-800 block">Invoice Number Prefix</label>
              <p className="text-xs text-gray-500 mt-0.5">e.g. "INV-"</p>
            </div>
            <input type="text" value={values['invoice_number_prefix'] ?? 'INV-'} onChange={(e) => handleChange('invoice_number_prefix', e.target.value)} placeholder="INV-" className={baseInput} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
            <div>
              <label className="text-sm font-medium text-gray-800 block">Next Invoice Number</label>
              <p className="text-xs text-gray-500 mt-0.5">The next sequential invoice number</p>
            </div>
            <input type="number" min={1} value={values['invoice_next_number'] ?? '1001'} onChange={(e) => handleChange('invoice_next_number', e.target.value)} className={baseInput} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
            <div>
              <label className="text-sm font-medium text-gray-800 block">Payment Terms</label>
              <p className="text-xs text-gray-500 mt-0.5">Shown on invoices</p>
            </div>
            <textarea
              value={values['payment_terms'] ?? ''}
              onChange={(e) => handleChange('payment_terms', e.target.value)}
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white resize-none"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-center">
            <div>
              <label className="text-sm font-medium text-gray-800 block">Auto-generate Invoices</label>
              <p className="text-xs text-gray-500 mt-0.5">Automatically generate invoices on the 1st of each month</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={values['invoice_auto_generate'] === 'true'}
              onClick={() => handleToggle('invoice_auto_generate')}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${values['invoice_auto_generate'] === 'true' ? 'bg-blue-600' : 'bg-gray-200'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${values['invoice_auto_generate'] === 'true' ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
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
          {saveMutation.isPending ? 'Saving…' : 'Save Billing Settings'}
        </button>
      </div>
    </div>
  )
}
