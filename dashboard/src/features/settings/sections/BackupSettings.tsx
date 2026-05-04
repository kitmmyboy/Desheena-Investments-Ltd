import { useState } from 'react'
import { useSettings, useSaveSettings, buildValuesMap } from '../useSettings'
import { supabase } from '../../../lib/supabase'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BackupRecord {
  backup_id: string
  created_at: string
  size_kb: number
  status: 'completed' | 'failed' | 'in_progress'
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-UG', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  } catch {
    return iso
  }
}

function formatSize(kb: number): string {
  if (kb === 0) return '—'
  if (kb < 1024) return `${kb} KB`
  return `${(kb / 1024).toFixed(1)} MB`
}

// ---------------------------------------------------------------------------
// BackupSettings
// ---------------------------------------------------------------------------

export default function BackupSettings() {
  const { data: settings = [], isLoading } = useSettings()
  const saveMutation = useSaveSettings()

  const [isCreating, setIsCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  // Parse backup history from settings
  const backupHistory: BackupRecord[] = (() => {
    const vals = buildValuesMap(settings)
    try {
      return JSON.parse(vals['backup_history'] ?? '[]') as BackupRecord[]
    } catch {
      return []
    }
  })()

  const lastBackup = backupHistory.length > 0
    ? backupHistory.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
    : null

  async function handleCreateBackup() {
    setIsCreating(true)
    setCreateError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) throw new Error('Not authenticated')

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-backup`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
        }
      )
      if (!res.ok) throw new Error('Backup creation failed')
      const newBackup = await res.json() as BackupRecord

      // Save updated history
      const updated = [newBackup, ...backupHistory].slice(0, 20) // keep last 20
      await saveMutation.mutateAsync([
        { key: 'backup_history', value: JSON.stringify(updated) },
      ])
    } catch (err) {
      setCreateError((err as Error).message)
    } finally {
      setIsCreating(false)
    }
  }

  if (isLoading) return <div className="text-sm text-gray-400 py-8 text-center">Loading…</div>

  return (
    <div className="flex flex-col gap-5">
      {/* Header card */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-1">Backup & Restore</h3>
        <p className="text-sm text-gray-500 mb-5">Create and manage database backups.</p>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-700">
              Last backup:{' '}
              <span className="font-medium">
                {lastBackup ? formatDateTime(lastBackup.created_at) : 'Never'}
              </span>
            </p>
            {lastBackup && (
              <p className="text-xs text-gray-500 mt-0.5">
                Status: <span className={lastBackup.status === 'completed' ? 'text-green-600' : 'text-red-600'}>{lastBackup.status}</span>
                {lastBackup.size_kb > 0 && ` · ${formatSize(lastBackup.size_kb)}`}
              </p>
            )}
          </div>
          <button
            onClick={handleCreateBackup}
            disabled={isCreating}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
          >
            {isCreating && (
              <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            )}
            {isCreating ? 'Creating backup…' : 'Create Backup'}
          </button>
        </div>

        {createError && (
          <div className="mt-3 text-sm text-red-600">Error: {createError}</div>
        )}
      </div>

      {/* Backup history */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-gray-900">Backup History</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['Backup ID', 'Created At', 'Size', 'Status', 'Actions'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {backupHistory.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-gray-400 text-sm">No backups yet. Click "Create Backup" to get started.</td>
                </tr>
              ) : (
                backupHistory
                  .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                  .map((backup) => (
                    <tr key={backup.backup_id} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 font-mono text-xs text-gray-500">{backup.backup_id.slice(0, 8)}…</td>
                      <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap">{formatDateTime(backup.created_at)}</td>
                      <td className="px-4 py-2.5 text-gray-600">{formatSize(backup.size_kb)}</td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${backup.status === 'completed' ? 'bg-green-100 text-green-700' : backup.status === 'failed' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                          {backup.status}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <button
                          disabled
                          title="Contact support to restore"
                          className="text-xs font-medium text-gray-400 px-2 py-1 rounded border border-gray-200 cursor-not-allowed"
                        >
                          Download
                        </button>
                      </td>
                    </tr>
                  ))
              )}
            </tbody>
          </table>
        </div>
        {backupHistory.length > 0 && (
          <div className="px-4 py-2 border-t border-gray-100 bg-gray-50">
            <p className="text-xs text-gray-400">Contact support to restore from a backup.</p>
          </div>
        )}
      </div>
    </div>
  )
}
