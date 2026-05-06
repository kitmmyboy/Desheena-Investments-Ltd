import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useContractMutations } from '../../features/contracts/useContractMutations'
import ContractForm from '../../features/contracts/ContractForm'
import TerminateDialog from '../../features/contracts/TerminateDialog'
import { computeEffectiveStatus } from '../../features/billing/contractCalculations'
import type { ContractRow } from '../../features/contracts/types'

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
  end_date?: string | null
  billing_model: 'flat' | 'frequency-based'
  rate_per_collection?: number | null
  created_at: string
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
// ContractPanel — main export
// ---------------------------------------------------------------------------

interface ContractPanelProps {
  clientId: string
}

export default function ContractPanel({ clientId }: ContractPanelProps) {
  const { data: contract, isLoading, error } = useClientContract(clientId)
  const { updateStatus, terminateContract } = useContractMutations()

  const [showContractForm, setShowContractForm] = useState(false)
  const [showTerminateDialog, setShowTerminateDialog] = useState(false)

  const effective_status = contract
    ? computeEffectiveStatus(contract.status, contract.end_date ?? null, new Date())
    : null

  // Build a minimal ContractRow for TerminateDialog (which expects ContractRow)
  const contractRow: ContractRow | null = contract
    ? {
        id: contract.id,
        client_id: contract.client_id,
        client_name: '',
        monthly_rate: contract.monthly_rate,
        start_date: contract.start_date,
        end_date: contract.end_date ?? null,
        status: contract.status,
        effective_status: effective_status ?? contract.status,
        updated_at: contract.created_at,
      }
    : null

  async function handleTerminateConfirm(effectiveDate: string, reason: string) {
    if (!contract) return
    try {
      await terminateContract.mutateAsync({ id: contract.id, effective_date: effectiveDate, reason: reason || undefined })
      setShowTerminateDialog(false)
    } catch {
      // Error surfaced via terminateContract.error — keep dialog open
    }
  }

  const mutationError = updateStatus.error || terminateContract.error

  return (
    <div className="border-t border-gray-200 pt-5 mt-2">
      <h3 className="text-sm font-semibold text-gray-900 mb-3">Contract</h3>

      {isLoading && <ContractSkeleton />}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          Failed to load contract: {error.message}
        </div>
      )}

      {/* Contract exists */}
      {!isLoading && !error && contract && (
        <div className="space-y-4">
          {/* Read-only contract details */}
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
              <span className="text-sm font-medium text-gray-500">Start date</span>
              <span className="text-sm text-gray-900">{formatDate(contract.start_date)}</span>
            </div>
            {contract.end_date && (
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-500">End date</span>
                <span className="text-sm text-gray-900">{formatDate(contract.end_date)}</span>
              </div>
            )}
          </div>

          {/* Inline mutation error */}
          {mutationError && (
            <div
              role="alert"
              className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700"
            >
              {mutationError.message}
            </div>
          )}

          {/* Quick-action buttons */}
          <div className="flex flex-wrap gap-2">
            {effective_status === 'active' && (
              <>
                <button
                  type="button"
                  disabled={updateStatus.isPending}
                  onClick={() =>
                    updateStatus.mutate({ id: contract.id, status: 'suspended' })
                  }
                  className="px-3 py-1.5 text-sm font-medium text-yellow-700 bg-yellow-50 border border-yellow-300 rounded-lg hover:bg-yellow-100 focus:outline-none focus:ring-2 focus:ring-yellow-400 disabled:opacity-50 transition-colors"
                >
                  {updateStatus.isPending ? 'Suspending…' : 'Suspend'}
                </button>
                <button
                  type="button"
                  disabled={terminateContract.isPending}
                  onClick={() => setShowTerminateDialog(true)}
                  className="px-3 py-1.5 text-sm font-medium text-red-700 bg-red-50 border border-red-300 rounded-lg hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-400 disabled:opacity-50 transition-colors"
                >
                  Terminate
                </button>
              </>
            )}

            {effective_status === 'suspended' && (
              <>
                <button
                  type="button"
                  disabled={updateStatus.isPending}
                  onClick={() =>
                    updateStatus.mutate({ id: contract.id, status: 'active' })
                  }
                  className="px-3 py-1.5 text-sm font-medium text-green-700 bg-green-50 border border-green-300 rounded-lg hover:bg-green-100 focus:outline-none focus:ring-2 focus:ring-green-400 disabled:opacity-50 transition-colors"
                >
                  {updateStatus.isPending ? 'Resuming…' : 'Resume'}
                </button>
                <button
                  type="button"
                  disabled={terminateContract.isPending}
                  onClick={() => setShowTerminateDialog(true)}
                  className="px-3 py-1.5 text-sm font-medium text-red-700 bg-red-50 border border-red-300 rounded-lg hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-400 disabled:opacity-50 transition-colors"
                >
                  Terminate
                </button>
              </>
            )}

            {(effective_status === 'terminated' || effective_status === 'ended') && (
              <button
                type="button"
                onClick={() => setShowContractForm(true)}
                className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
              >
                Create New Contract
              </button>
            )}
          </div>

          {/* View Contract History link */}
          <Link
            to={`/dashboard/contracts?clientId=${clientId}`}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium focus:outline-none focus:underline"
          >
            View Contract History
          </Link>
        </div>
      )}

      {/* No contract */}
      {!isLoading && !error && !contract && (
        <div className="space-y-3">
          <p className="text-sm text-gray-500">No contract found for this client.</p>
          <button
            type="button"
            onClick={() => setShowContractForm(true)}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
          >
            Create Contract
          </button>
        </div>
      )}

      {/* ContractForm modal */}
      {showContractForm && (
        <ContractForm
          defaultClientId={clientId}
          onClose={() => setShowContractForm(false)}
        />
      )}

      {/* TerminateDialog modal */}
      {showTerminateDialog && contractRow && (
        <TerminateDialog
          contract={contractRow}
          onConfirm={handleTerminateConfirm}
          onCancel={() => setShowTerminateDialog(false)}
          isLoading={terminateContract.isPending}
          error={terminateContract.error}
        />
      )}
    </div>
  )
}
