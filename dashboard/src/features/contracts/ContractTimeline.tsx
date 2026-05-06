import type { ContractRow } from './types'

interface ContractTimelineProps {
  contracts: ContractRow[]   // all contracts for a client, ordered by start_date DESC
}

const STATUS_BADGE_CLASSES: Record<ContractRow['effective_status'], string> = {
  active: 'bg-green-100 text-green-800',
  suspended: 'bg-yellow-100 text-yellow-800',
  terminated: 'bg-red-100 text-red-800',
  ended: 'bg-gray-100 text-gray-600',
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatDateTime(dateTimeStr: string): string {
  const date = new Date(dateTimeStr)
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function ContractTimeline({ contracts }: ContractTimelineProps) {
  if (contracts.length === 0) {
    return (
      <p className="text-sm text-gray-500 py-4 text-center">No contract history available.</p>
    )
  }

  return (
    <ol className="relative border-l border-gray-200 ml-3">
      {contracts.map((contract) => (
        <li key={contract.id} className="mb-6 ml-6">
          {/* Timeline dot */}
          <span className="absolute -left-3 flex h-6 w-6 items-center justify-center rounded-full bg-white ring-2 ring-gray-200">
            <span
              className={`h-3 w-3 rounded-full ${
                contract.effective_status === 'active'
                  ? 'bg-green-500'
                  : contract.effective_status === 'suspended'
                  ? 'bg-yellow-400'
                  : contract.effective_status === 'terminated'
                  ? 'bg-red-500'
                  : 'bg-gray-400'
              }`}
            />
          </span>

          {/* Entry content */}
          <div className="rounded-lg border border-gray-100 bg-white p-4 shadow-sm">
            {/* Date range */}
            <p className="text-sm font-medium text-gray-900">
              {formatDate(contract.start_date)}
              {' → '}
              {contract.end_date ? formatDate(contract.end_date) : 'Present'}
            </p>

            {/* Status badge */}
            <div className="mt-2">
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_BADGE_CLASSES[contract.effective_status]}`}
              >
                {contract.effective_status}
              </span>
            </div>

            {/* Last changed */}
            <p className="mt-2 text-xs text-gray-500">
              Last changed: {formatDateTime(contract.updated_at)}
            </p>
          </div>
        </li>
      ))}
    </ol>
  )
}
