import { useEffect, useRef, useState } from 'react'
import { useSettings, useSaveSettings, buildValuesMap } from '../useSettings'

// ---------------------------------------------------------------------------
// Variable chips
// ---------------------------------------------------------------------------

const SMS_VARIABLES: Record<string, string[]> = {
  invoice: ['{{client_name}}', '{{amount}}', '{{due_date}}', '{{invoice_ref}}', '{{payment_link}}'],
  payment: ['{{client_name}}', '{{amount}}', '{{invoice_ref}}'],
  complaint: ['{{client_name}}', '{{complaint_ref}}', '{{status}}'],
}

function VariableChips({
  variables,
  onInsert,
}: {
  variables: string[]
  onInsert: (v: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {variables.map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => onInsert(v)}
          className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition-colors"
        >
          {v}
        </button>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// SMS template editor
// ---------------------------------------------------------------------------

function SmsTemplateEditor({
  label,
  templateKey,
  variables,
  value,
  onChange,
}: {
  label: string
  templateKey: string
  variables: string[]
  value: string
  onChange: (key: string, value: string) => void
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  function insertVariable(v: string) {
    const el = textareaRef.current
    if (!el) {
      onChange(templateKey, value + v)
      return
    }
    const start = el.selectionStart
    const end = el.selectionEnd
    const newVal = value.slice(0, start) + v + value.slice(end)
    onChange(templateKey, newVal)
    // Restore cursor position after React re-render
    requestAnimationFrame(() => {
      el.selectionStart = start + v.length
      el.selectionEnd = start + v.length
      el.focus()
    })
  }

  return (
    <div className="border border-gray-100 rounded-lg p-4">
      <p className="text-sm font-medium text-gray-800 mb-2">{label}</p>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(templateKey, e.target.value)}
        rows={3}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white resize-none font-mono"
      />
      <p className="text-xs text-gray-400 mt-1">Click a variable to insert at cursor:</p>
      <VariableChips variables={variables} onInsert={insertVariable} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Invoice preview
// ---------------------------------------------------------------------------

function InvoicePreview({
  header,
  footer,
  showPaymentInstructions,
}: {
  header: string
  footer: string
  showPaymentInstructions: boolean
}) {
  return (
    <div className="border border-gray-200 rounded-lg p-5 bg-white text-sm font-mono">
      <div className="text-center font-bold text-base mb-3 border-b pb-3">{header || 'Desheena Investments Ltd'}</div>
      <div className="space-y-1 text-gray-700">
        <div className="flex justify-between"><span>Service: Waste Collection</span><span>UGX 50,000</span></div>
        <div className="flex justify-between font-bold border-t pt-1 mt-1"><span>Total</span><span>UGX 50,000</span></div>
      </div>
      {showPaymentInstructions && (
        <div className="mt-3 p-2 bg-gray-50 rounded text-xs text-gray-600">
          Payment instructions: Pay via MTN Mobile Money to 0700000000 or Airtel Money to 0750000000.
        </div>
      )}
      <div className="mt-3 pt-3 border-t text-xs text-gray-500 text-center">{footer || 'Thank you for your business.'}</div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// TemplatesSettings
// ---------------------------------------------------------------------------

export default function TemplatesSettings() {
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
      'invoice_template_header', 'invoice_template_footer',
      'invoice_show_payment_instructions',
      'sms_template_invoice', 'sms_template_payment', 'sms_template_complaint',
    ]
    await saveMutation.mutateAsync(keys.map((k) => ({ key: k, value: values[k] ?? '' })))
    setSaveSuccess(true)
    setTimeout(() => setSaveSuccess(false), 4000)
  }

  if (isLoading) return <div className="text-sm text-gray-400 py-8 text-center">Loading…</div>
  if (error) return <div className="text-sm text-red-600 py-4">Failed to load settings: {error.message}</div>

  return (
    <div className="flex flex-col gap-5">
      {/* Invoice Template */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-1">Invoice Template</h3>
        <p className="text-sm text-gray-500 mb-5">Customize how invoices look when generated.</p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-800 block mb-1">Header Text</label>
              <textarea
                value={values['invoice_template_header'] ?? ''}
                onChange={(e) => handleChange('invoice_template_header', e.target.value)}
                rows={2}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white resize-none"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-800 block mb-1">Footer Text</label>
              <textarea
                value={values['invoice_template_footer'] ?? ''}
                onChange={(e) => handleChange('invoice_template_footer', e.target.value)}
                rows={2}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white resize-none"
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-800">Show Payment Instructions</p>
                <p className="text-xs text-gray-500">Display payment instructions on invoice</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={values['invoice_show_payment_instructions'] === 'true'}
                onClick={() => handleToggle('invoice_show_payment_instructions')}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${values['invoice_show_payment_instructions'] === 'true' ? 'bg-blue-600' : 'bg-gray-200'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${values['invoice_show_payment_instructions'] === 'true' ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Preview</p>
            <InvoicePreview
              header={values['invoice_template_header'] ?? ''}
              footer={values['invoice_template_footer'] ?? ''}
              showPaymentInstructions={values['invoice_show_payment_instructions'] === 'true'}
            />
          </div>
        </div>
      </div>

      {/* SMS Templates */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-1">SMS Templates</h3>
        <p className="text-sm text-gray-500 mb-5">Customize SMS messages sent to clients. Click variable chips to insert them.</p>

        <div className="space-y-4">
          <SmsTemplateEditor
            label="Invoice Generated"
            templateKey="sms_template_invoice"
            variables={SMS_VARIABLES.invoice}
            value={values['sms_template_invoice'] ?? ''}
            onChange={handleChange}
          />
          <SmsTemplateEditor
            label="Payment Confirmed"
            templateKey="sms_template_payment"
            variables={SMS_VARIABLES.payment}
            value={values['sms_template_payment'] ?? ''}
            onChange={handleChange}
          />
          <SmsTemplateEditor
            label="Complaint Update"
            templateKey="sms_template_complaint"
            variables={SMS_VARIABLES.complaint}
            value={values['sms_template_complaint'] ?? ''}
            onChange={handleChange}
          />
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
          {saveMutation.isPending ? 'Saving…' : 'Save Templates'}
        </button>
      </div>
    </div>
  )
}
