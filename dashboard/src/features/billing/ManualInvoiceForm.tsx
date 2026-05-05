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

/**
 * Converts a YYYY-MM string to a human-readable month name, e.g. "2025-07" → "July 2025".
 * Returns the original string if parsing fails.
 */
export function formatPeriod(period: string): string {
  const match = period.match(/^(\d{4})-(\d{2})$/)
  if (!match) return period
  const year = parseInt(match[1], 10)
  const month = parseInt(match[2], 10) - 1 // 0-indexed
  const date = new Date(year, month, 1)
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
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

  // Contract rate state (Task 9)
  const [contractRate, setContractRate] = useState<number | null>(null)
  const [loadingContractRate, setLoadingContractRate] = useState(false)
  // paidThisPeriod and loadingPaidAmount will be used in Task 10
  const [paidThisPeriod, setPaidThisPeriod] = useState<number>(0)
  const [loadingPaidAmount, setLoadingPaidAmount] = useState(false)

  // Validation
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Success confirmation state (Req 3.4)
  const [successInfo, setSuccessInfo] = useState<{
    clientName: string
    period: string
    amount: number
  } | null>(null)

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

  // Fetch active contract rate when selected client changes (Req 1.1, 1.5)
  useEffect(() => {
    if (!selectedClient) {
      setContractRate(null)
      setAmount('')
      return
    }

    const today = new Date().toISOString().split('T')[0]

    setLoadingContractRate(true)
    setContractRate(null)
    setAmount('')

    supabase
      .from('contracts')
      .select('monthly_rate')
      .eq('client_id', selectedClient.id)
      .eq('status', 'active')
      .or(`end_date.is.null,end_date.gte.${today}`)
      .order('start_date', { ascending: false })
      .limit(1)
      .then(({ data, error }) => {
        if (!error && data && data.length > 0) {
          const rate = data[0].monthly_rate as number | null
          if (rate !== null && rate !== undefined) {
            setContractRate(rate)
            setAmount(String(rate))
          } else {
            setContractRate(null)
            setAmount('')
          }
        } else {
          setContractRate(null)
          setAmount('')
        }
        setLoadingContractRate(false)
      })
  }, [selectedClient])

  // Fetch paid amount for selected client + period (Req 2.1, 2.2)
  useEffect(() => {
    if (!selectedClient || !invoicePeriod) {
      setPaidThisPeriod(0)
      return
    }

    setLoadingPaidAmount(true)
    supabase
      .from('invoices')
      .select('paid_amount')
      .eq('client_id', selectedClient.id)
      .eq('invoice_period', invoicePeriod)
      .then(({ data, error }) => {
        if (!error && data && data.length > 0) {
          const total = (data as Array<{ paid_amount: number }>).reduce(
            (sum, row) => sum + (row.paid_amount ?? 0),
            0
          )
          setPaidThisPeriod(total)
        } else {
          setPaidThisPeriod(0)
        }
        setLoadingPaidAmount(false)
      })
  }, [selectedClient, invoicePeriod])

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
      // Show confirmation instead of closing immediately (Req 3.4)
      setSuccessInfo({
        clientName: selectedClient!.name,
        period: invoicePeriod,
        amount: parseFloat(amount),
      })
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

      {/* Success confirmation (Req 3.4) */}
      {successInfo ? (
        <div className="flex flex-col gap-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex flex-col gap-2">
            <div className="flex items-center gap-2 text-green-700">
              <svg className="h-5 w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="font-semibold text-sm">Invoice generated successfully</span>
            </div>
            <dl className="text-sm text-gray-700 flex flex-col gap-1 mt-1">
              <div className="flex gap-2">
                <dt className="font-medium w-28 flex-shrink-0">Client:</dt>
                <dd data-testid="confirmation-client-name">{successInfo.clientName}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="font-medium w-28 flex-shrink-0">Invoice period:</dt>
                <dd data-testid="confirmation-period">{formatPeriod(successInfo.period)}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="font-medium w-28 flex-shrink-0">Amount:</dt>
                <dd data-testid="confirmation-amount">UGX {successInfo.amount.toLocaleString()}</dd>
              </div>
            </dl>
          </div>
          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      ) : (
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
            {/* Contract rate hint (Req 1.2, 1.3) */}
            {loadingContractRate ? (
              <p className="mt-1 text-xs text-gray-400 animate-pulse">Loading contract rate…</p>
            ) : contractRate !== null ? (
              <p className="mt-1 text-xs text-gray-500">
                Contract rate: UGX {contractRate.toLocaleString()}
              </p>
            ) : selectedClient ? (
              <p className="mt-1 text-xs text-amber-600">
                No active contract found — enter amount manually.
              </p>
            ) : null}
          </div>

          {/* Paid this period + Outstanding balance (Req 2.1–2.5) */}
          {selectedClient && invoicePeriod && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 flex flex-col gap-1 text-sm">
              {loadingPaidAmount ? (
                <p className="text-xs text-gray-400 animate-pulse">Loading paid amount…</p>
              ) : (
                <>
                  <p className="text-gray-700">
                    Paid this period:{' '}
                    <span className="font-medium">UGX {paidThisPeriod.toLocaleString()}</span>
                  </p>
                  {(() => {
                    const amountNum = parseFloat(amount) || 0
                    const outstanding = amountNum - paidThisPeriod
                    return (
                      <>
                        <p className="text-gray-700">
                          Outstanding:{' '}
                          <span className="font-medium">UGX {outstanding.toLocaleString()}</span>
                        </p>
                        {outstanding <= 0 && (
                          <div className="mt-1 bg-yellow-50 border border-yellow-200 rounded p-2 text-xs text-yellow-800">
                            This client has no outstanding balance for the selected period.
                          </div>
                        )}
                      </>
                    )
                  })()}
                </>
              )}
            </div>
          )}

          {/* Due date preview (Req 3.3) */}
          {(() => {
            const due = new Date()
            due.setDate(due.getDate() + 14)
            const formatted = due.toLocaleDateString('en-GB', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })
            return (
              <p className="text-xs text-gray-500">
                Due: <strong>{formatted}</strong>
              </p>
            )
          })()}

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
      )}
    </form>
  )
}
