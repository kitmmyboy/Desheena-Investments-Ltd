import { useState } from 'react'
import { useRecordPayment } from './useInvoices'
import { formatCurrency } from '../../lib/utils'

interface ManualPaymentModalProps {
  clientId: string
  clientName: string
  outstandingBalance: number
  invoiceId?: string // If provided, records against this specific invoice
  onClose: () => void
}

export default function ManualPaymentModal({
  clientId,
  clientName,
  outstandingBalance,
  invoiceId,
  onClose,
}: ManualPaymentModalProps) {
  const [amount, setAmount] = useState<number>(outstandingBalance)
  const [method, setMethod] = useState<'manual' | 'bank_transfer' | 'mobile_money' | 'adjustment'>('manual')
  const [ref, setRef] = useState('')
  const [notes, setNotes] = useState('')
  const recordPayment = useRecordPayment()
  const clearDefaulter = useClearDefaulter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      if (invoiceId) {
        // Record against specific invoice
        await recordPayment.mutateAsync({
          invoice_id: invoiceId,
          client_id: clientId,
          amount,
          payment_method: method,
          transaction_ref: ref,
          notes: notes || (method === 'adjustment' ? 'Administrative adjustment' : ''),
        })
      } else {
        // Clear all outstanding for this contract
        if (amount < outstandingBalance && method !== 'adjustment') {
          alert('To record a partial payment, please expand the row and pay against a specific month.')
          return
        }
        await clearDefaulter.mutateAsync({
          client_id: clientId,
          contract_id: contractId!,
          payment_method: method === 'adjustment' ? 'adjustment' : 'manual',
          notes: notes || (method === 'adjustment' ? 'Bulk balance adjustment' : 'Bulk payment recording'),
        })
      }
      onClose()
    } catch (err: any) {
      alert(err.message)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-xl font-bold text-gray-900">Record Payment</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-500 mb-1">Client</label>
            <p className="text-gray-900 font-semibold">{clientName}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-500 mb-1">Outstanding Balance</label>
            <p className="text-red-600 font-bold text-lg">{formatCurrency(outstandingBalance)}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-1">Amount to Record</label>
              <input
                id="amount"
                type="number"
                required
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
            <div>
              <label htmlFor="method" className="block text-sm font-medium text-gray-700 mb-1">Method</label>
              <select
                id="method"
                value={method}
                onChange={(e) => setMethod(e.target.value as any)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
              >
                <option value="manual">Manual Cash</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="mobile_money">Mobile Money</option>
                <option value="adjustment">Write-off / Adjustment</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="ref" className="block text-sm font-medium text-gray-700 mb-1">Reference (Optional)</label>
            <input
              id="ref"
              type="text"
              placeholder="e.g. Bank slip # or MM ID"
              value={ref}
              onChange={(e) => setRef(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>

          <div>
            <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              id="notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
              placeholder="Reason for adjustment or payment details"
            />
          </div>

          <div className="pt-4 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={recordPayment.isPending}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50"
            >
              {recordPayment.isPending ? 'Recording...' : 'Record & Close'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
