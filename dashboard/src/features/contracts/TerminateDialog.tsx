import { useEffect, useState } from 'react'
import type { ContractRow } from './types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TerminateDialogProps {
  contract: ContractRow
  onConfirm: (effectiveDate: string) => void
  onCancel: () => void
  isLoading: boolean
  error?: Error | null
}

// ---------------------------------------------------------------------------
// TerminateDialog
// ---------------------------------------------------------------------------

export default function TerminateDialog({
  contract,
  onConfirm,
  onCancel,
  isLoading,
  error,
}: TerminateDialogProps) {
  const today = new Date().toISOString().split('T')[0]
  const [effectiveDate, setEffectiveDate] = useState<string>(today)

  // Close on Escape key
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onCancel])

  function handleConfirm() {
    onConfirm(effectiveDate)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="terminate-dialog-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onCancel}
        aria-hidden="true"
      />

      {/* Card */}
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md p-6 z-10">
        {/* Header */}
        <div className="flex items-start gap-3 mb-4">
          {/* Warning icon */}
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
            <svg
              className="w-5 h-5 text-red-600"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
              />
            </svg>
          </div>
          <div>
            <h2
              id="terminate-dialog-title"
              className="text-lg font-semibold text-gray-900"
            >
              Terminate contract
            </h2>
            <p className="text-sm text-gray-600 mt-0.5">
              {contract.client_name}
            </p>
          </div>
        </div>

        {/* Warning text */}
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
          <p className="text-sm text-red-700">
            <strong>This action is permanent and cannot be undone.</strong> Terminating
            this contract will set its status to <em>terminated</em> and lock it from
            further edits. The client will no longer be included in billing cycles after
            the effective date.
          </p>
        </div>

        {/* Inline mutation error */}
        {error && (
          <div
            role="alert"
            className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-sm text-red-700"
          >
            {error.message}
          </div>
        )}

        {/* Effective date picker */}
        <div className="flex flex-col gap-1 mb-6">
          <label
            htmlFor="terminate-effective-date"
            className="text-sm font-medium text-gray-700"
          >
            Terminate Effective Date
          </label>
          <input
            id="terminate-effective-date"
            type="date"
            value={effectiveDate}
            onChange={(e) => setEffectiveDate(e.target.value)}
            disabled={isLoading}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50"
          />
          <p className="text-xs text-gray-500">
            Defaults to today. The contract will be terminated as of this date.
          </p>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-400 disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isLoading || !effectiveDate}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-60 transition-colors flex items-center gap-2"
          >
            {isLoading && (
              <svg
                className="animate-spin h-4 w-4 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v8H4z"
                />
              </svg>
            )}
            {isLoading ? 'Terminating…' : 'Confirm Termination'}
          </button>
        </div>
      </div>
    </div>
  )
}
