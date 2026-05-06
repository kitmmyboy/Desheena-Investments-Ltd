import React, { useEffect, useState } from 'react'
import { useClients } from '../clients/useClients'
import { useContractMutations } from './useContractMutations'
import type { ContractRow, CreateContractInput, UpdateContractInput } from './types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ContractFormProps {
  contract?: ContractRow | null   // null/undefined = create mode, defined = edit mode
  defaultClientId?: string        // pre-fills client when opened from ContractPanel
  onClose: () => void
}

interface FormValues {
  client_id: string
  start_date: string
  end_date: string
  monthly_rate: string
}

interface FormErrors {
  client_id?: string
  start_date?: string
  end_date?: string
  monthly_rate?: string
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function validate(values: FormValues, isEdit: boolean): FormErrors {
  const errors: FormErrors = {}

  if (!isEdit && !values.client_id.trim()) {
    errors.client_id = 'Client is required'
  }

  if (!values.start_date.trim()) {
    errors.start_date = 'Start date is required'
  }

  if (values.end_date.trim()) {
    if (values.start_date.trim() && values.end_date < values.start_date) {
      errors.end_date = 'End date must be on or after the start date'
    }
  }

  if (!values.monthly_rate.trim()) {
    errors.monthly_rate = 'Monthly rate is required'
  } else {
    const rate = Number(values.monthly_rate)
    if (isNaN(rate) || rate <= 0 || !Number.isInteger(rate)) {
      errors.monthly_rate = 'Must be a positive integer (e.g. 50000)'
    }
  }

  return errors
}

// ---------------------------------------------------------------------------
// Field component
// ---------------------------------------------------------------------------

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string
  required?: boolean
  error?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-gray-700">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// ContractForm
// ---------------------------------------------------------------------------

export default function ContractForm({ contract, defaultClientId, onClose }: ContractFormProps) {
  const isEdit = Boolean(contract)

  const { createContract, updateContract } = useContractMutations()
  const isPending = createContract.isPending || updateContract.isPending
  const mutationError = createContract.error || updateContract.error

  // Fetch clients for the dropdown (create mode only)
  const { data: clients, isLoading: clientsLoading } = useClients({ pageSize: 500 })

  const [values, setValues] = useState<FormValues>({
    client_id: contract?.client_id ?? defaultClientId ?? '',
    start_date: contract?.start_date ?? '',
    end_date: contract?.end_date ?? '',
    monthly_rate: contract?.monthly_rate != null ? String(contract.monthly_rate) : '',
  })

  const [errors, setErrors] = useState<FormErrors>({})
  const [touched, setTouched] = useState<Partial<Record<keyof FormValues, boolean>>>({})

  // Reset form when contract prop changes
  useEffect(() => {
    setValues({
      client_id: contract?.client_id ?? defaultClientId ?? '',
      start_date: contract?.start_date ?? '',
      end_date: contract?.end_date ?? '',
      monthly_rate: contract?.monthly_rate != null ? String(contract.monthly_rate) : '',
    })
    setErrors({})
    setTouched({})
  }, [contract, defaultClientId])

  // Close on Escape key
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  function handleChange(field: keyof FormValues, value: string) {
    setValues((prev) => ({ ...prev, [field]: value }))
    if (touched[field]) {
      const newErrors = validate({ ...values, [field]: value }, isEdit)
      setErrors((prev) => ({ ...prev, [field]: newErrors[field as keyof FormErrors] }))
    }
  }

  function handleBlur(field: keyof FormValues) {
    setTouched((prev) => ({ ...prev, [field]: true }))
    const newErrors = validate(values, isEdit)
    setErrors((prev) => ({ ...prev, [field]: newErrors[field as keyof FormErrors] }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    // Mark all relevant fields as touched
    const allTouched: Partial<Record<keyof FormValues, boolean>> = {
      start_date: true,
      end_date: true,
      monthly_rate: true,
    }
    if (!isEdit) {
      allTouched.client_id = true
    }
    setTouched(allTouched)

    const validationErrors = validate(values, isEdit)
    setErrors(validationErrors)

    if (Object.keys(validationErrors).length > 0) return

    try {
      if (isEdit && contract) {
        const input: UpdateContractInput = {
          id: contract.id,
          start_date: values.start_date,
          end_date: values.end_date.trim() || null,
          monthly_rate: Number(values.monthly_rate),
        }
        await updateContract.mutateAsync(input)
      } else {
        const input: CreateContractInput = {
          client_id: values.client_id,
          start_date: values.start_date,
          end_date: values.end_date.trim() || null,
          monthly_rate: Number(values.monthly_rate),
        }
        await createContract.mutateAsync(input)
      }
      onClose()
    } catch {
      // Error is surfaced via mutationError — keep modal open
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="contract-form-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Card */}
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 z-10">
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          <h2 id="contract-form-title" className="text-lg font-semibold text-gray-900">
            {isEdit ? 'Edit contract' : 'New contract'}
          </h2>

          {/* Mutation error */}
          {mutationError && (
            <div
              role="alert"
              className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700"
            >
              {mutationError.message}
            </div>
          )}

          {/* Client field */}
          {isEdit ? (
            <Field label="Client">
              <p className="text-sm text-gray-700 py-2 px-3 bg-gray-50 border border-gray-200 rounded-lg">
                {contract?.client_name ?? '—'}
              </p>
            </Field>
          ) : (
            <Field label="Client" required error={errors.client_id}>
              <select
                value={values.client_id}
                onChange={(e) => handleChange('client_id', e.target.value)}
                onBlur={() => handleBlur('client_id')}
                disabled={clientsLoading}
                className={`border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.client_id ? 'border-red-400' : 'border-gray-300'
                }`}
                aria-label="Select client"
              >
                <option value="">
                  {clientsLoading ? 'Loading clients…' : 'Select a client…'}
                </option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
            </Field>
          )}

          {/* Start Date */}
          <Field label="Start Date" required error={errors.start_date}>
            <input
              type="date"
              value={values.start_date}
              onChange={(e) => handleChange('start_date', e.target.value)}
              onBlur={() => handleBlur('start_date')}
              className={`border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.start_date ? 'border-red-400' : 'border-gray-300'
              }`}
            />
          </Field>

          {/* End Date */}
          <Field label="End Date" error={errors.end_date}>
            <input
              type="date"
              value={values.end_date}
              onChange={(e) => handleChange('end_date', e.target.value)}
              onBlur={() => handleBlur('end_date')}
              className={`border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.end_date ? 'border-red-400' : 'border-gray-300'
              }`}
            />
            <p className="text-xs text-gray-500">Optional. Leave blank for an open-ended contract.</p>
          </Field>

          {/* Monthly Rate */}
          <Field label="Monthly Rate (UGX)" required error={errors.monthly_rate}>
            <input
              type="number"
              min="1"
              step="1"
              value={values.monthly_rate}
              onChange={(e) => handleChange('monthly_rate', e.target.value)}
              onBlur={() => handleBlur('monthly_rate')}
              placeholder="e.g. 50000"
              className={`border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.monthly_rate ? 'border-red-400' : 'border-gray-300'
              }`}
            />
          </Field>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60 transition-colors flex items-center gap-2"
            >
              {isPending && (
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
              {isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Create contract'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
