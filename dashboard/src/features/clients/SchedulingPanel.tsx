import { useEffect, useState } from 'react'
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
  const [isSaving, setIsSaving] = useState<number | string | null>(null)
  
  const [specificDate, setSpecificDate] = useState<string>('')

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

  async function toggleDay(dayIndex: number) {
    const existing = schedules.find(s => s.day_of_week === dayIndex)
    
    setIsSaving(dayIndex)
    if (existing) {
      const { error } = await supabase
        .from('collection_schedules')
        .delete()
        .eq('id', existing.id)
      
      if (!error) {
        setSchedules(prev => prev.filter(s => s.id !== existing.id))
      }
    } else {
      const { data, error } = await supabase
        .from('collection_schedules')
        .insert({
          client_id: clientId,
          day_of_week: dayIndex
        })
        .select()
        .single()
      
      if (!error && data) {
        setSchedules(prev => [...prev, data])
      }
    }
    setIsSaving(null)
  }

  async function addSpecificDate() {
    if (!specificDate) return
    setIsSaving('specific')
    const { data, error } = await supabase
      .from('collection_schedules')
      .insert({
        client_id: clientId,
        specific_date: specificDate
      })
      .select()
      .single()
    
    if (!error && data) {
      setSpecificDate('')
      setSchedules(prev => [...prev, data])
    }
    setIsSaving(null)
  }

  async function removeSchedule(id: string) {
    const { error } = await supabase
      .from('collection_schedules')
      .delete()
      .eq('id', id)
    
    if (!error) {
      setSchedules(prev => prev.filter(s => s.id !== id))
    }
  }

  return (
    <div className="border-t border-gray-100 pt-6 mt-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Collection Schedule</h3>
          <p className="text-xs text-gray-500">
            Define recurring weekly days or specific dates for waste collection.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="animate-pulse flex space-x-2">
          <div className="h-4 bg-gray-200 rounded w-full"></div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Recurring Days Grid */}
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3 block">
              Weekly Recurring Days
            </label>
            <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
              {DAYS.map((day, i) => {
                const isActive = schedules.some(s => s.day_of_week === i)
                const saving = isSaving === i
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleDay(i)}
                    disabled={saving}
                    className={`
                      px-2 py-2 text-xs font-medium rounded-lg border transition-all
                      flex flex-col items-center justify-center gap-1
                      ${isActive 
                        ? 'bg-blue-600 border-blue-600 text-white shadow-sm' 
                        : 'bg-white border-gray-200 text-gray-600 hover:border-blue-300 hover:bg-blue-50'}
                      ${saving ? 'opacity-50 cursor-wait' : ''}
                    `}
                  >
                    <span className={isActive ? 'text-blue-100' : 'text-gray-400'}>
                      {day.substring(0, 3)}
                    </span>
                    {saving ? (
                      <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <div className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-white' : 'bg-transparent border border-gray-300'}`} />
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Specific Dates */}
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3 block">
              Irregular / Specific Dates
            </label>
            
            <div className="space-y-2 mb-4">
              {schedules.filter(s => s.specific_date).map((s) => (
                <div key={s.id} className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded-lg border border-gray-100">
                  <div className="flex items-center gap-2">
                    <svg className="h-4 w-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="text-sm text-gray-700">
                      {new Date(s.specific_date!).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeSchedule(s.id)}
                    className="text-gray-400 hover:text-red-600 transition-colors p-1"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <input
                type="date"
                value={specificDate}
                onChange={(e) => setSpecificDate(e.target.value)}
                className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={addSpecificDate}
                disabled={!specificDate || isSaving === 'specific'}
                className="px-4 py-1.5 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors"
              >
                {isSaving === 'specific' ? '...' : 'Add Date'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
