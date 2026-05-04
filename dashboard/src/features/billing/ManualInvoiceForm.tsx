import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useCreateInvoice } from './useInvoices'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ClientOption {
  id: string
  name: string
  phone: string
}

interface ManualInvoiceFormProps {
  onClose: () => void
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getCurrentYearMonth(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

// ---------------------------------------------------------------------------
// ManualInvoiceForm
// ---------------------------------------------------------------------------

export default function ManualInvoiceForm({ onClose }: ManualInvoiceFormProps) {
  const createInvoice = useCreateInvoice()

  // Client search state
  const [clientSearch, setClientSearch] = useState('')
  const [clientOptions, setClientOptions] = useState<ClientOption[]>([])
  const [selectedClient, setSelectedClient] = useState<ClientOption | null>(null)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [clientsLoading, setClientsLoading] = useState(false)

  // Form fields
  const [invoicePeriod, setInvoicePeriod] = useState(getCurrentYearMonth())
  const [amount, setAmount] = useState('')

  // Validation
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Search clients when input changes
  useEffect(() => {
    if (clientSearch.trim().length < 1) {
      setClientOptions([])
      return
    }

    const timer = setTimeout(async () => {
      setClientsLoading(true)
      const { data, error } = await supabase
        .from('clients')
        .select('id, name, phone')
        .ilike('name', `%${clientSearch.trim()}%`)
        .limit(10)

      if (!error && data) {
        setClientOptions(data as ClientOption[])
        setDropdownOpen(true)
      }
      setClientsLoading(false)
    }, 300)

    return () => clearTimeout(timer)
  }, [clientSearch])

  function selectClient(client: ClientOption) {
    setSelectedClient(client)
    setClientSearch(client.name)
    setDropdownOpen(false)
    setErrors((prev) => ({ ...prev, client: '' }))
  }

  function validate(): boolean {
    const newErrors: Record<string, string> = {}

    if (!selectedClient) {
      newErrors.client = 'Please select a client.'
    }

    if (!invoicePeriod) {
      newErrors.invoicePeriod = 'Invoice period is required.'
    }

    const amountNum = parseFloat(amount)
    if (!amount || isNaN(amountNum) || amountNum <= 0) {
      newErrors.amount = 'Please enter a valid amount greater than 0.'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitError(null)

    if (!validate()) return

    try {
      await createInvoice.mutateAsync({
        client_id: selectedClient!.id,
        invoice_period: invoicePeriod,
        amount: parseFloat(amount),
      })
      onClose()
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to create invoice.')
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-lg font-semibold text-gray-900">Generate Invoice</h3>
        <button
          type="button"
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-400 rounded"
          aria-label="Close"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="flex flex-col gap-4">
        {/* Client searchable dropdown */}
        <div className="relative">
          <label
            htmlFor="client-search"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Client <span className="text-red-500">*</span>
          </label>
          <input
            id="client-search"
            type="text"
            value={clientSearch}
            onChange={(e) => {
              setClientSearch(e.target.value)
              if (selectedClient && e.target.value !== selectedClient.name) {
                setSelectedClient(null)
              }
            }}
            onFocus={() => {
              if (clientOptions.length > 0) setDropdownOpen(true)
            }}
            onBlur={() => {
              // Delay to allow click on option
              setTimeout(() => setDropdownOpen(false), 150)
            }}
            placeholder="Search client by name…"
            className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.client ? 'border-red-400' : 'border-gray-300'
            }`}
            aria-autocomplete="list"
            aria-expanded={dropdownOpen}
            aria-haspopup="listbox"
            autoComplete="off"
          />
          {clientsLoading && (
            <div className="absolute right-3 top-9 text-gray-400 text-xs">Loading…</div>
          )}
          {dropdownOpen && clientOptions.length > 0 && (
            <ul
              role="listbox"
              className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto text-sm"
            >
              {clientOptions.map((client) => (
                <li
                  key={client.id}
                  role="option"
                  aria-selected={selectedClient?.id === client.id}
                  onMouseDown={() => selectClient(client)}
                  className="px-3 py-2 cursor-pointer hover:bg-blue-50 flex flex-col"
                >
                  <span className="font-medium text-gray-900">{client.name}</span>
                  <span className="text-gray-500 text-xs">{client.phone}</span>
                </li>
              ))}
            </ul>
          )}
          {errors.client && (
            <p className="mt-1 text-xs text-red-600">{errors.client}</p>
          )}
        </div>

        {/* Invoice period (month/year) */}
        <div>
          <label
            htmlFor="invoice-period"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Invoice Period <span className="text-red-500">*</span>
          </label>
          <input
            id="invoice-period"
            type="month"
            value={invoicePeriod}
            onChange={(e) => setInvoicePeriod(e.target.value)}
            className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.invoicePeriod ? 'border-red-400' : 'border-gray-300'
            }`}
          />
          {errors.invoicePeriod && (
            <p className="mt-1 text-xs text-red-600">{errors.invoicePeriod}</p>
          )}
        </div>

        {/* Amount */}
        <div>
          <label
            htmlFor="invoice-amount"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Amount (UGX) <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500 select-none">
              UGX
            </span>
            <input
              id="invoice-amount"
              type="number"
              min="1"
              step="1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              className={`w-full pl-12 pr-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.amount ? 'border-red-400' : 'border-gray-300'
              }`}
            />
          </div>
          {errors.amount && (
            <p className="mt-1 text-xs text-red-600">{errors.amount}</p>
          )}
        </div>

        {/* Due date info */}
        <p className="text-xs text-gray-500">
          Due date will be set to <strong>14 days</strong> from today.
        </p>

        {/* Submit error */}
        {submitError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
            {submitError}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-400 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={createInvoice.isPending}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {createInvoice.isPending ? 'Generating…' : 'Generate Invoice'}
          </button>
        </div>
      </div>
    </form>
  )
}
