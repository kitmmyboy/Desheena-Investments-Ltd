import React from 'react'
import type { CollectionsFiltersState } from './useCollections'

interface CollectionsFiltersProps {
  filters: CollectionsFiltersState
  onChange: (filters: CollectionsFiltersState) => void
}

const WASTE_TYPES = [
  { value: 'all', label: 'All waste types' },
  { value: 'general', label: 'General' },
  { value: 'organic', label: 'Organic' },
  { value: 'recyclable', label: 'Recyclable' },
  { value: 'hazardous', label: 'Hazardous' },
]

const SYNC_STATUSES = [
  { value: 'all', label: 'All statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'synced', label: 'Synced' },
]

export default function CollectionsFilters({ filters, onChange }: CollectionsFiltersProps) {
  function handleChange(field: keyof CollectionsFiltersState, value: string) {
    onChange({ ...filters, [field]: value || undefined })
  }

  function handleClear() {
    onChange({})
  }

  const hasActiveFilters = Object.values(filters).some(
    (v) => v !== undefined && v !== '' && v !== 'all'
  )

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
      <div className="flex flex-wrap gap-3 items-end">
        {/* Date From */}
        <div className="flex flex-col gap-1 min-w-[140px]">
          <label className="text-xs font-medium text-gray-600">Date from</label>
          <input
            type="date"
            value={filters.dateFrom ?? ''}
            onChange={(e) => handleChange('dateFrom', e.target.value)}
            className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Date To */}
        <div className="flex flex-col gap-1 min-w-[140px]">
          <label className="text-xs font-medium text-gray-600">Date to</label>
          <input
            type="date"
            value={filters.dateTo ?? ''}
            onChange={(e) => handleChange('dateTo', e.target.value)}
            className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Driver filter */}
        <div className="flex flex-col gap-1 min-w-[160px]">
          <label className="text-xs font-medium text-gray-600">Driver (email)</label>
          <input
            type="text"
            placeholder="Filter by driver email…"
            value={filters.driverId ?? ''}
            onChange={(e) => handleChange('driverId', e.target.value)}
            className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Waste type */}
        <div className="flex flex-col gap-1 min-w-[160px]">
          <label className="text-xs font-medium text-gray-600">Waste type</label>
          <select
            value={filters.wasteType ?? 'all'}
            onChange={(e) => handleChange('wasteType', e.target.value)}
            className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            {WASTE_TYPES.map((wt) => (
              <option key={wt.value} value={wt.value}>
                {wt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Sync status */}
        <div className="flex flex-col gap-1 min-w-[140px]">
          <label className="text-xs font-medium text-gray-600">Sync status</label>
          <select
            value={filters.syncStatus ?? 'all'}
            onChange={(e) => handleChange('syncStatus', e.target.value)}
            className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            {SYNC_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        {/* Clear button */}
        {hasActiveFilters && (
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-transparent select-none">Clear</label>
            <button
              onClick={handleClear}
              className="px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
            >
              Clear filters
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
