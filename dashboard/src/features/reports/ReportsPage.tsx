import { useState } from 'react'
import FinancialReport from './FinancialReport'
import DriverPerformanceReport from './DriverPerformanceReport'
import CollectionsReport from './CollectionsReport'

// ---------------------------------------------------------------------------
// Tab definitions
// ---------------------------------------------------------------------------

type Tab = 'financial' | 'driver-performance' | 'collections'

const TABS: { id: Tab; label: string }[] = [
  { id: 'financial', label: 'Financial Report' },
  { id: 'driver-performance', label: 'Driver Performance' },
  { id: 'collections', label: 'Collections Report' },
]

// ---------------------------------------------------------------------------
// ReportsPage
// ---------------------------------------------------------------------------

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('financial')

  return (
    <div className="flex flex-col gap-4">
      {/* Page header */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Reports</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Financial summaries, driver performance, and collection analytics
        </p>
      </div>

      {/* Tabs */}
      <div
        className="flex border-b border-gray-200 print:hidden"
        role="tablist"
        aria-label="Report sections"
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`tabpanel-${tab.id}`}
            id={`tab-${tab.id}`}
            onClick={() => setActiveTab(tab.id)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 ${
              activeTab === tab.id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab panels */}
      <div
        id="tabpanel-financial"
        role="tabpanel"
        aria-labelledby="tab-financial"
        hidden={activeTab !== 'financial'}
      >
        {activeTab === 'financial' && <FinancialReport />}
      </div>

      <div
        id="tabpanel-driver-performance"
        role="tabpanel"
        aria-labelledby="tab-driver-performance"
        hidden={activeTab !== 'driver-performance'}
      >
        {activeTab === 'driver-performance' && <DriverPerformanceReport />}
      </div>

      <div
        id="tabpanel-collections"
        role="tabpanel"
        aria-labelledby="tab-collections"
        hidden={activeTab !== 'collections'}
      >
        {activeTab === 'collections' && <CollectionsReport />}
      </div>
    </div>
  )
}
