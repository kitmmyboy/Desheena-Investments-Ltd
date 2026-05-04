import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Contract {
  id: string
  client_id: string
  status: 'active' | 'suspended' | 'terminated'
  monthly_rate: number
  billing_cycle: string
  start_date: string
  billing_model: 'flat' | 'frequency-based'
  rate_per_collection?: number | null
  created_at: string
}

interface CreateContractInput {
  client_id: string
  start_date: string
  billing_cycle: string
  monthly_rate: number
  billing_model: 'flat' | 'frequency-based'
  rate_per_collection?: number | null
}

interface UpdateContractStatusInput {
  id: string
  status: 'active' | 'suspended' | 'terminated'
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export function useClientContract(clientId: string) {
  return useQuery<Contract | null>({
    queryKey: ['contract', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contracts')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (error) throw new Error(error.message)
      return data as Contract | null
    },
    enabled: Boolean(clientId),
  })
}

export function useCreateContract() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CreateContractInput) => {
      const { data, error } = await supabase
        .from('contracts')
        .insert({
          id: crypto.randomUUID(),
          client_id: input.client_id,
          status: 'active',
          monthly_rate: input.monthly_rate,
          billing_cycle: input.billing_cycle,
          start_date: input.start_date,
          billing_model: input.billing_model,
          rate_per_collection: input.rate_per_collection ?? null,
          created_at: new Date().toISOString(),
        })
        .select()
        .single()

      if (error) throw new Error(error.message)
      return data as Contract
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['contract', variables.client_id] })
      queryClient.invalidateQueries({ queryKey: ['clients'] })
    },
  })
}

export function useUpdateContractStatus() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, status }: UpdateContractStatusInput) => {
      const { data, error } = await supabase
        .from('contracts')
        .update({ status })
        .eq('id', id)
        .select()
        .single()

      if (error) throw new Error(error.message)
      return data as Contract
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['contract', data.client_id] })
      queryClient.invalidateQueries({ queryKey: ['clients'] })
    },
  })
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-UG', {
    style: 'currency',
    currency: 'UGX',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-UG', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function StatusBadge({ status }: { status: Contract['status'] }) {
  const styles: Record<Contract['status'], string> = {
    active: 'bg-green-100 text-green-800',
    suspended: 'bg-yellow-100 text-yellow-800',
    terminated: 'bg-red-100 text-red-800',
  }
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${styles[status]}`}
    >
      {status}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function ContractSkeleton() {
  return (
    <div className="animate-pulse space-y-3">
      <div className="h-4 bg-gray-200 rounded w-1/3" />
      <div className="h-4 bg-gray-200 rounded w-1/2" />
      <div className="h-4 bg-gray-200 rounded w-2/5" />
      <div className="h-4 bg-gray-200 rounded w-1/4" />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Contract detail view
// ---------------------------------------------------------------------------

function ContractDetail({
  contract,
  onStatusChange,
  isUpdating,
  updateError,
}: {
  contract: Contract
  onStatusChange: (status: Contract['status']) => void
  isUpdating: boolean
  updateError: Error | null
}) {
  const [selectedStatus, setSelectedStatus] = useState<Contract['status']>(contract.status)
  const [showStatusForm, setShowStatusForm] = useState(false)

  function handleStatusSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (selectedStatus !== contract.status) {
      onStatusChange(selectedStatus)
      setShowStatusForm(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Contract details */}
      <div className="bg-gray-50 rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-500">Status</span>
          <StatusBadge status={contract.status} />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-500">Monthly rate</span>
          <span className="text-sm text-gray-900 font-semibold">
            {formatCurrency(contract.monthly_rate)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-500">Billing cycle</span>
          <span className="text-sm text-gray-900 capitalize">{contract.billing_cycle}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-500">Billing model</span>
          <span className="text-sm text-gray-900 capitalize">
            {contract.billing_model === 'flat' ? 'Flat rate' : 'Frequency-based'}
          </span>
        </div>
        {contract.billing_model === 'frequency-based' && contract.rate_per_collection != null && (
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-500">Rate per collection</span>
            <span className="text-sm text-gray-900 font-semibold">
              {formatCurrency(contract.rate_per_collection)}
            </span>
          </div>
        )}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-500">Start date</span>
          <span className="text-sm text-gray-900">{formatDate(contract.start_date)}</span>
        </div>
      </div>

      {/* Status update */}
      {contract.status !== 'terminated' && (
        <div>
          {!showStatusForm ? (
            <button
              type="button"
              onClick={() => setShowStatusForm(true)}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium focus:outline-none focus:underline"
            >
              Update status
            </button>
          ) : (
            <form onSubmit={handleStatusSubmit} className="space-y-3">
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">Change status to</label>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value as Contract['status'])}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                  <option value="terminated">Terminated</option>
                </select>
              </div>

              {updateError && (
                <p className="text-xs text-red-600">{updateError.message}</p>
              )}

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={isUpdating || selectedStatus === contract.status}
                  className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
                >
                  {isUpdating ? 'Saving…' : 'Save'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowStatusForm(false)
                    setSelectedStatus(contract.status)
                  }}
                  disabled={isUpdating}
                  className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Create contract form
// ---------------------------------------------------------------------------

interface CreateFormValues {
  start_date: string
  billing_cycle: string
  monthly_rate: string
  billing_model: 'flat' | 'frequency-based'
  rate_per_collection: string
}

interface CreateFormErrors {
  start_date?: string
  monthly_rate?: string
  rate_per_collection?: string
}

function validateCreateForm(values: CreateFormValues): CreateFormErrors {
  const errors: CreateFormErrors = {}

  if (!values.start_date) {
    errors.start_date = 'Start date is required'
  }

  if (!values.monthly_rate.trim()) {
    errors.monthly_rate = 'Monthly rate is required'
  } else {
    const rate = Number(values.monthly_rate)
    if (isNaN(rate) || rate <= 0) {
      errors.monthly_rate = 'Must be a positive number'
    }
  }

  if (values.billing_model === 'frequency-based') {
    if (!values.rate_per_collection.trim()) {
      errors.rate_per_collection = 'Rate per collection is required for frequency-based billing'
    } else {
      const rpc = Number(values.rate_per_collection)
      if (isNaN(rpc) || rpc <= 0) {
        errors.rate_per_collection = 'Must be a positive number'
      }
    }
  }

  return errors
}

function CreateContractForm({
  clientId,
  onCreated,
}: {
  clientId: string
  onCreated: () => void
}) {
  const createContract = useCreateContract()

  const [values, setValues] = useState<CreateFormValues>({
    start_date: new Date().toISOString().split('T')[0],
    billing_cycle: 'monthly',
    monthly_rate: '',
    billing_model: 'flat',
    rate_per_collection: '',
  })
  const [errors, setErrors] = useState<CreateFormErrors>({})
  const [touched, setTouched] = useState<Partial<Record<keyof CreateFormValues, boolean>>>({})

  function handleChange(field: keyof CreateFormValues, value: string) {
    const updated = { ...values, [field]: value }
    setValues(updated)
    if (touched[field]) {
      const newErrors = validateCreateForm(updated)
      setErrors((prev) => ({ ...prev, [field]: newErrors[field as keyof CreateFormErrors] }))
    }
  }

  function handleBlur(field: keyof CreateFormValues) {
    setTouched((prev) => ({ ...prev, [field]: true }))
    const newErrors = validateCreateForm(values)
    setErrors((prev) => ({ ...prev, [field]: newErrors[field as keyof CreateFormErrors] }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const allTouched = Object.keys(values).reduce(
      (acc, k) => ({ ...acc, [k]: true }),
      {} as Partial<Record<keyof CreateFormValues, boolean>>
    )
    setTouched(allTouched)

    const validationErrors = validateCreateForm(values)
    setErrors(validationErrors)
    if (Object.keys(validationErrors).length > 0) return

    try {
      await createContract.mutateAsync({
        client_id: clientId,
        start_date: values.start_date,
        billing_cycle: values.billing_cycle,
        monthly_rate: Number(values.monthly_rate),
        billing_model: values.billing_model,
        rate_per_collection:
          values.billing_model === 'frequency-based' && values.rate_per_collection
            ? Number(values.rate_per_collection)
            : null,
      })
      onCreated()
    } catch {
      // Error surfaced via createContract.error
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      {/* Start date */}
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">
          Start date <span className="text-red-500">*</span>
        </label>
        <input
          type="date"
          value={values.start_date}
          onChange={(e) => handleChange('start_date', e.target.value)}
          onBlur={() => handleBlur('start_date')}
          className={`border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            errors.start_date ? 'border-red-400' : 'border-gray-300'
          }`}
        />
        {errors.start_date && <p className="text-xs text-red-600">{errors.start_date}</p>}
      </div>

      {/* Billing cycle (fixed to monthly) */}
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">Billing cycle</label>
        <input
          type="text"
          value="Monthly"
          readOnly
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-500 cursor-not-allowed"
        />
      </div>

      {/* Billing model */}
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">Billing model</label>
        <select
          value={values.billing_model}
          onChange={(e) => handleChange('billing_model', e.target.value as 'flat' | 'frequency-based')}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="flat">Flat rate</option>
          <option value="frequency-based">Frequency-based</option>
        </select>
      </div>

      {/* Monthly rate */}
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">
          Monthly rate (UGX) <span className="text-red-500">*</span>
        </label>
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
        {errors.monthly_rate && <p className="text-xs text-red-600">{errors.monthly_rate}</p>}
      </div>

      {/* Rate per collection (frequency-based only) */}
      {values.billing_model === 'frequency-based' && (
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">
            Rate per collection (UGX) <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            min="1"
            step="1"
            value={values.rate_per_collection}
            onChange={(e) => handleChange('rate_per_collection', e.target.value)}
            onBlur={() => handleBlur('rate_per_collection')}
            placeholder="e.g. 5000"
            className={`border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.rate_per_collection ? 'border-red-400' : 'border-gray-300'
            }`}
          />
          {errors.rate_per_collection && (
            <p className="text-xs text-red-600">{errors.rate_per_collection}</p>
          )}
        </div>
      )}

      {/* Mutation error */}
      {createContract.error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          {createContract.error.message}
        </div>
      )}

      <button
        type="submit"
        disabled={createContract.isPending}
        className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
      >
        {createContract.isPending && (
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
        {createContract.isPending ? 'Creating…' : 'Create contract'}
      </button>
    </form>
  )
}

// ---------------------------------------------------------------------------
// ContractPanel — main export
// ---------------------------------------------------------------------------

interface ContractPanelProps {
  clientId: string
}

export default function ContractPanel({ clientId }: ContractPanelProps) {
  const { data: contract, isLoading, error } = useClientContract(clientId)
  const updateContractStatus = useUpdateContractStatus()
  const [showCreateForm, setShowCreateForm] = useState(false)

  function handleStatusChange(status: Contract['status']) {
    if (!contract) return
    updateContractStatus.mutate({ id: contract.id, status })
  }

  return (
    <div className="border-t border-gray-200 pt-5 mt-2">
      <h3 className="text-sm font-semibold text-gray-900 mb-3">Contract</h3>

      {isLoading && <ContractSkeleton />}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          Failed to load contract: {error.message}
        </div>
      )}

      {!isLoading && !error && contract && (
        <ContractDetail
          contract={contract}
          onStatusChange={handleStatusChange}
          isUpdating={updateContractStatus.isPending}
          updateError={updateContractStatus.error as Error | null}
        />
      )}

      {!isLoading && !error && !contract && (
        <div className="space-y-3">
          {!showCreateForm ? (
            <div className="flex flex-col items-start gap-3">
              <p className="text-sm text-gray-500">No contract found for this client.</p>
              <button
                type="button"
                onClick={() => setShowCreateForm(true)}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
              >
                Create contract
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-700">New contract</p>
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="text-sm text-gray-500 hover:text-gray-700 focus:outline-none focus:underline"
                >
                  Cancel
                </button>
              </div>
              <CreateContractForm
                clientId={clientId}
                onCreated={() => setShowCreateForm(false)}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
