import { useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { useComplaintDetail, useUpdateComplaintStatus } from './useComplaints'
import type { ComplaintStatus } from './useComplaints'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('en-UG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: ComplaintStatus | string }) {
  const styles: Record<string, string> = {
    open: 'bg-orange-100 text-orange-800',
    'in-progress': 'bg-blue-100 text-blue-800',
    resolved: 'bg-green-100 text-green-800',
  }
  const label: Record<string, string> = {
    open: 'Open',
    'in-progress': 'In Progress',
    resolved: 'Resolved',
  }
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${styles[status] ?? 'bg-gray-100 text-gray-700'}`}
    >
      {label[status] ?? status}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function DetailSkeleton() {
  return (
    <div className="animate-pulse space-y-4 p-6">
      <div className="h-5 bg-gray-200 rounded w-1/3" />
      <div className="h-4 bg-gray-200 rounded w-1/2" />
      <div className="h-20 bg-gray-200 rounded" />
      <div className="h-4 bg-gray-200 rounded w-1/4" />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ComplaintDetailPanelProps {
  complaintId: string | null
  onClose: () => void
}

// ---------------------------------------------------------------------------
// ComplaintDetailPanel
// ---------------------------------------------------------------------------

export default function ComplaintDetailPanel({
  complaintId,
  onClose,
}: ComplaintDetailPanelProps) {
  const { user } = useAuth()
  const { data: complaint, isLoading, error } = useComplaintDetail(complaintId)
  const updateStatus = useUpdateComplaintStatus()

  // Form state
  const [formStatus, setFormStatus] = useState<ComplaintStatus>('open')
  const [resolutionNotes, setResolutionNotes] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)

  // Sync form state when complaint loads
  useEffect(() => {
    if (complaint) {
      setFormStatus(complaint.status as ComplaintStatus)
      setResolutionNotes(complaint.resolution_notes ?? '')
      setFormError(null)
      setSaveSuccess(false)
    }
  }, [complaint])

  // Close on Escape key
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    setSaveSuccess(false)

    if (!complaint) return

    // Resolution notes are required when resolving
    if (formStatus === 'resolved' && !resolutionNotes.trim()) {
      setFormError('Resolution notes are required when marking a complaint as resolved.')
      return
    }

    try {
      await updateStatus.mutateAsync({
        id: complaint.id,
        status: formStatus,
        resolution_notes: resolutionNotes.trim() || undefined,
        resolver_id: user?.id,
      })
      setSaveSuccess(true)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to update complaint.')
    }
  }

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="complaint-detail-title"
    >
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto z-10">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2
            id="complaint-detail-title"
            className="text-lg font-semibold text-gray-900"
          >
            Complaint Detail
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
            aria-label="Close complaint detail"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Body */}
        {isLoading ? (
          <DetailSkeleton />
        ) : error ? (
          <div className="p-6 text-sm text-red-700 bg-red-50">
            Failed to load complaint: {error.message}
          </div>
        ) : !complaint ? (
          <div className="p-6 text-sm text-gray-500">Complaint not found.</div>
        ) : (
          <div className="p-6 space-y-6">
            {/* Complaint info */}
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Client
                  </p>
                  <p className="mt-0.5 text-sm font-semibold text-gray-900">
                    {complaint.clients?.name ?? '—'}
                  </p>
                  {complaint.clients?.phone && (
                    <p className="text-xs text-gray-500">{complaint.clients.phone}</p>
                  )}
                </div>
                <StatusBadge status={complaint.status} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Category
                  </p>
                  <p className="mt-0.5 text-sm text-gray-800 capitalize">
                    {complaint.category}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Submitted
                  </p>
                  <p className="mt-0.5 text-sm text-gray-800">
                    {formatDateTime(complaint.created_at)}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Message
                </p>
                <p className="mt-1 text-sm text-gray-800 whitespace-pre-wrap bg-gray-50 rounded-lg p-3 border border-gray-200">
                  {complaint.message}
                </p>
              </div>
            </div>

            {/* Existing resolution info (if already resolved) */}
            {complaint.status === 'resolved' && complaint.resolved_at && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-2">
                <p className="text-xs font-semibold text-green-800 uppercase tracking-wide">
                  Resolution
                </p>
                <p className="text-sm text-green-900">
                  Resolved on {formatDateTime(complaint.resolved_at)}
                </p>
                {complaint.resolution_notes && (
                  <p className="text-sm text-green-800 whitespace-pre-wrap">
                    {complaint.resolution_notes}
                  </p>
                )}
              </div>
            )}

            {/* Divider */}
            <hr className="border-gray-200" />

            {/* Status update form */}
            <form onSubmit={handleSave} className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-900">Update Status</h3>

              {/* Status dropdown */}
              <div>
                <label
                  htmlFor="complaint-status"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Status
                </label>
                <select
                  id="complaint-status"
                  value={formStatus}
                  onChange={(e) => {
                    setFormStatus(e.target.value as ComplaintStatus)
                    setFormError(null)
                    setSaveSuccess(false)
                  }}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="open">Open</option>
                  <option value="in-progress">In Progress</option>
                  <option value="resolved">Resolved</option>
                </select>
              </div>

              {/* Resolution notes */}
              <div>
                <label
                  htmlFor="resolution-notes"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Resolution Notes
                  {formStatus === 'resolved' && (
                    <span className="text-red-500 ml-1" aria-hidden="true">
                      *
                    </span>
                  )}
                </label>
                <textarea
                  id="resolution-notes"
                  value={resolutionNotes}
                  onChange={(e) => {
                    setResolutionNotes(e.target.value)
                    setFormError(null)
                    setSaveSuccess(false)
                  }}
                  rows={4}
                  placeholder={
                    formStatus === 'resolved'
                      ? 'Describe how this complaint was resolved…'
                      : 'Optional notes about the current status…'
                  }
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  aria-required={formStatus === 'resolved'}
                />
                {formStatus === 'resolved' && (
                  <p className="mt-1 text-xs text-gray-500">
                    Required when marking as resolved.
                  </p>
                )}
              </div>

              {/* Error message */}
              {formError && (
                <div
                  className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700"
                  role="alert"
                >
                  {formError}
                </div>
              )}

              {/* Success message */}
              {saveSuccess && (
                <div
                  className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-700"
                  role="status"
                >
                  Complaint status updated successfully.
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-400 transition-colors"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={updateStatus.isPending}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {updateStatus.isPending ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
