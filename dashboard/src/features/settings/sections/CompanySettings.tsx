import { useEffect, useState } from 'react'
import { useSettings, useSaveSettings, buildValuesMap } from '../useSettings'

export default function CompanySettings() {
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

  async function handleSave() {
    const keys = [
      'company_name', 'company_phone', 'company_email', 'company_address', 'company_tin',
      'invoice_footer', 'sms_sender_id', 'invoice_due_days', 'vat_rate',
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
      {/* Company Info */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-1">Company Information</h3>
        <p className="text-sm text-gray-500 mb-5">Displayed on invoices, SMS messages, and email footers.</p>

        <div className="space-y-4">
          {[
            { key: 'company_name', label: 'Company Name', placeholder: 'Desheena Investments Ltd' },
            { key: 'company_phone', label: 'Phone', placeholder: '+256 700 000000' },
            { key: 'company_email', label: 'Email', placeholder: 'info@desheena.co.ug' },
            { key: 'company_address', label: 'Physical Address', placeholder: 'Plot 123, Kampala Road, Kampala' },
            { key: 'company_tin', label: 'TIN / Tax ID', placeholder: '1000000000' },
          ].map(({ key, label, placeholder }) => (
            <div key={key} className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
              <label className="text-sm font-medium text-gray-800 block pt-2">{label}</label>
              <input
                type="text"
                value={values[key] ?? ''}
                onChange={(e) => handleChange(key, e.target.value)}
                placeholder={placeholder}
                className={baseInput}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Billing Defaults */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-1">Billing Defaults</h3>
        <p className="text-sm text-gray-500 mb-5">Default values applied when generating invoices.</p>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
            <div>
              <label className="text-sm font-medium text-gray-800 block">Invoice Footer Text</label>
              <p className="text-xs text-gray-500 mt-0.5">Shown at the bottom of every invoice</p>
            </div>
            <textarea
              value={values['invoice_footer'] ?? ''}
              onChange={(e) => handleChange('invoice_footer', e.target.value)}
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white resize-none"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
            <div>
              <label className="text-sm font-medium text-gray-800 block">Default SMS Sender Name</label>
              <p className="text-xs text-gray-500 mt-0.5">Max 11 characters</p>
            </div>
            <input
              type="text"
              value={values['sms_sender_id'] ?? ''}
              onChange={(e) => handleChange('sms_sender_id', e.target.value)}
              placeholder="Desheena"
              maxLength={11}
              className={baseInput}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
            <div>
              <label className="text-sm font-medium text-gray-800 block">Invoice Due Days</label>
              <p className="text-xs text-gray-500 mt-0.5">Days after generation before invoice becomes overdue</p>
            </div>
            <input
              type="number"
              min={1}
              value={values['invoice_due_days'] ?? '14'}
              onChange={(e) => handleChange('invoice_due_days', e.target.value)}
              className={baseInput}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
            <div>
              <label className="text-sm font-medium text-gray-800 block">VAT Rate (%)</label>
              <p className="text-xs text-gray-500 mt-0.5">Set to 0 to disable VAT</p>
            </div>
            <input
              type="number"
              min={0}
              max={100}
              value={values['vat_rate'] ?? '18'}
              onChange={(e) => handleChange('vat_rate', e.target.value)}
              className={baseInput}
            />
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
          {saveMutation.isPending ? 'Saving…' : 'Save Company Settings'}
        </button>
      </div>
    </div>
  )
}
