import React, { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

interface Schedule {
  id: string
  day_of_week: number | null
  specific_date: string | null
}

interface SchedulingPanelProps {
  clientId: string
}

const DAYS = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'
]

export default function SchedulingPanel({ clientId }: SchedulingPanelProps) {
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  
  const [newDay, setNewDay] = useState<string>('')

  useEffect(() => {
    fetchSchedules()
  }, [clientId])

  async function fetchSchedules() {
    setIsLoading(true)
    const { data, error } = await supabase
      .from('collection_schedules')
      .select('id, day_of_week, specific_date')
      .eq('client_id', clientId)
    
    if (!error && data) {
      setSchedules(data)
    }
    setIsLoading(false)
  }

  async function addDaySchedule() {
    if (!newDay) return
    setIsSaving(true)
    const { error } = await supabase
      .from('collection_schedules')
      .insert({
        client_id: clientId,
        day_of_week: parseInt(newDay)
      })
    
    if (!error) {
      setNewDay('')
      fetchSchedules()
    }
    setIsSaving(false)
  }

  async function removeSchedule(id: string) {
    const { error } = await supabase
      .from('collection_schedules')
      .delete()
      .eq('id', id)
    
    if (!error) {
      fetchSchedules()
    }
  }

  return (
    <div className="border-t border-gray-100 pt-6 mt-6">
      <h3 className="text-sm font-semibold text-gray-900 mb-2">Collection Schedule</h3>
      <p className="text-xs text-gray-500 mb-4">
        Define the recurring days when waste should be collected from this client.
      </p>

      {isLoading ? (
        <div className="animate-pulse flex space-x-2">
          <div className="h-4 bg-gray-200 rounded w-24"></div>
        </div>
      ) : (
        <div className="space-y-2">
          {schedules.map((s) => (
            <div key={s.id} className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded-lg">
              <span className="text-sm text-gray-700">
                {s.day_of_week !== null ? `Weekly on ${DAYS[s.day_of_week]}` : s.specific_date}
              </span>
              <button
                type="button"
                onClick={() => removeSchedule(s.id)}
                className="text-gray-400 hover:text-red-600 transition-colors"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          ))}

          <div className="flex gap-2 mt-4">
            <select
              value={newDay}
              onChange={(e) => setNewDay(e.target.value)}
              className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Add recurring day...</option>
              {DAYS.map((day, i) => (
                <option key={day} value={i}>{day}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={addDaySchedule}
              disabled={!newDay || isSaving}
              className="px-3 py-1.5 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors"
            >
              Add
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
