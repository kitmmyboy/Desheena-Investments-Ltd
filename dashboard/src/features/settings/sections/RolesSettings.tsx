import { useEffect, useState } from 'react'
import { useSettings, useSaveSettings, buildValuesMap } from '../useSettings'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Role = 'Admin' | 'Operations_Manager' | 'Finance' | 'Driver' | 'Customer'
type Module =
  | 'Dashboard' | 'Collections' | 'Clients' | 'Routes' | 'Billing'
  | 'Reports' | 'Complaints' | 'SMS Log' | 'Staff' | 'Users' | 'Settings'
type Action = 'view' | 'create' | 'edit' | 'delete'

interface PermissionMatrix {
  [module: string]: {
    [role: string]: {
      [action: string]: boolean
    }
  }
}

const ROLES: Role[] = ['Admin', 'Operations_Manager', 'Finance', 'Driver', 'Customer']
const MODULES: Module[] = [
  'Dashboard', 'Collections', 'Clients', 'Routes', 'Billing',
  'Reports', 'Complaints', 'SMS Log', 'Staff', 'Users', 'Settings',
]
const ACTIONS: Action[] = ['view', 'create', 'edit', 'delete']

const ROLE_LABELS: Record<Role, string> = {
  Admin: 'Admin',
  Operations_Manager: 'Ops Mgr',
  Finance: 'Finance',
  Driver: 'Driver',
  Customer: 'Customer',
}

// Default permissions
function buildDefaultMatrix(): PermissionMatrix {
  const matrix: PermissionMatrix = {}
  for (const mod of MODULES) {
    matrix[mod] = {}
    for (const role of ROLES) {
      matrix[mod][role] = {}
      for (const action of ACTIONS) {
        // Admin always has all
        if (role === 'Admin') {
          matrix[mod][role][action] = true
        } else {
          matrix[mod][role][action] = false
        }
      }
    }
  }
  return matrix
}

function parseMatrix(json: string): PermissionMatrix {
  try {
    const parsed = JSON.parse(json)
    if (typeof parsed === 'object' && parsed !== null) {
      return parsed as PermissionMatrix
    }
  } catch {
    // ignore
  }
  return buildDefaultMatrix()
}

// ---------------------------------------------------------------------------
// RolesSettings
// ---------------------------------------------------------------------------

export default function RolesSettings() {
  const { data: settings = [], isLoading, error } = useSettings()
  const saveMutation = useSaveSettings()

  const [matrix, setMatrix] = useState<PermissionMatrix>(buildDefaultMatrix())
  const [saveSuccess, setSaveSuccess] = useState(false)

  useEffect(() => {
    if (settings.length > 0) {
      const vals = buildValuesMap(settings)
      const raw = vals['role_permissions'] ?? '{}'
      const parsed = parseMatrix(raw)
      // Merge with defaults to ensure all modules/roles/actions exist
      const defaults = buildDefaultMatrix()
      for (const mod of MODULES) {
        if (!parsed[mod]) parsed[mod] = defaults[mod]
        for (const role of ROLES) {
          if (!parsed[mod][role]) parsed[mod][role] = defaults[mod][role]
          for (const action of ACTIONS) {
            if (parsed[mod][role][action] === undefined) {
              parsed[mod][role][action] = defaults[mod][role][action]
            }
          }
        }
      }
      setMatrix(parsed)
    }
  }, [settings])

  function handleToggle(mod: Module, role: Role, action: Action) {
    if (role === 'Admin') return // Admin is locked
    setMatrix((prev) => ({
      ...prev,
      [mod]: {
        ...prev[mod],
        [role]: {
          ...prev[mod][role],
          [action]: !prev[mod][role][action],
        },
      },
    }))
    setSaveSuccess(false)
  }

  async function handleSave() {
    await saveMutation.mutateAsync([
      { key: 'role_permissions', value: JSON.stringify(matrix) },
    ])
    setSaveSuccess(true)
    setTimeout(() => setSaveSuccess(false), 4000)
  }

  if (isLoading) return <div className="text-sm text-gray-400 py-8 text-center">Loading…</div>
  if (error) return <div className="text-sm text-red-600 py-4">Failed to load settings: {error.message}</div>

  return (
    <div className="flex flex-col gap-5">
      {/* Permissions Matrix */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-1">Permissions Matrix</h3>
        <p className="text-sm text-gray-500 mb-5">
          Configure what each role can do. Admin permissions are locked and cannot be changed.
        </p>

        <div className="overflow-x-auto">
          <table className="min-w-full text-xs border-collapse">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-3 py-2 text-left font-semibold text-gray-700 border border-gray-200 w-32">Module</th>
                {ROLES.map((role) => (
                  <th key={role} colSpan={4} className="px-3 py-2 text-center font-semibold text-gray-700 border border-gray-200">
                    {ROLE_LABELS[role]}
                    {role === 'Admin' && (
                      <span className="ml-1 text-xs text-purple-600 font-normal">(locked)</span>
                    )}
                  </th>
                ))}
              </tr>
              <tr className="bg-gray-50">
                <th className="px-3 py-2 border border-gray-200" />
                {ROLES.map((role) =>
                  ACTIONS.map((action) => (
                    <th key={`${role}-${action}`} className="px-2 py-1 text-center font-medium text-gray-500 border border-gray-200 capitalize">
                      {action.charAt(0).toUpperCase()}
                    </th>
                  ))
                )}
              </tr>
            </thead>
            <tbody>
              {MODULES.map((mod, idx) => (
                <tr key={mod} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-3 py-2 font-medium text-gray-800 border border-gray-200 whitespace-nowrap">{mod}</td>
                  {ROLES.map((role) =>
                    ACTIONS.map((action) => {
                      const checked = matrix[mod]?.[role]?.[action] ?? false
                      const locked = role === 'Admin'
                      return (
                        <td key={`${role}-${action}`} className="px-2 py-2 text-center border border-gray-200">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => handleToggle(mod as Module, role, action)}
                            disabled={locked}
                            className={`h-3.5 w-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 ${locked ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                            aria-label={`${role} ${action} ${mod}`}
                          />
                        </td>
                      )
                    })
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-gray-400 mt-3">V=View, C=Create, E=Edit, D=Delete</p>
      </div>

      {/* Role Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {ROLES.filter((r) => r !== 'Admin').map((role) => {
          const allowedModules = MODULES.filter((mod) =>
            ACTIONS.some((a) => matrix[mod]?.[role]?.[a])
          )
          return (
            <div key={role} className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-sm font-semibold text-gray-900">{ROLE_LABELS[role]}</span>
                <span className="text-xs text-gray-400">({allowedModules.length} modules)</span>
              </div>
              {allowedModules.length === 0 ? (
                <p className="text-xs text-gray-400 italic">No permissions assigned</p>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {allowedModules.map((mod) => (
                    <span key={mod} className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-blue-50 text-blue-700">
                      {mod}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Save */}
      <div className="flex items-center justify-between">
        {saveSuccess && (
          <span className="text-sm text-green-600 flex items-center gap-1">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
            Saved successfully
          </span>
        )}
        {saveMutation.error && <span className="text-sm text-red-600">Save failed: {(saveMutation.error as Error).message}</span>}
        {!saveSuccess && !saveMutation.error && <span />}
        <button
          onClick={handleSave}
          disabled={saveMutation.isPending}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
        >
          {saveMutation.isPending && <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" /></svg>}
          {saveMutation.isPending ? 'Saving…' : 'Save Permissions'}
        </button>
      </div>
    </div>
  )
}
