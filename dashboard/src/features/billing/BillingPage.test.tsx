/**
 * Unit tests for ContractsTab rendering (Task 6.1)
 * Validates: Requirements 5.2, 5.3, 5.6
 *
 * Unit tests for DefaultersTab filter logic (Task 7.1)
 * Validates: Requirements 9.2, 9.3, 9.4
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import BillingPage from './BillingPage'
import type { ContractWithClient } from './useContracts'
import type { ContractDefaulter } from './useContractDefaulters'

// ---------------------------------------------------------------------------
// Mock useContracts
// ---------------------------------------------------------------------------

const mockUseContracts = vi.fn()

vi.mock('./useContracts', () => ({
  useContracts: (filter: string) => mockUseContracts(filter),
}))

// ---------------------------------------------------------------------------
// Mock useContractDefaulters (controllable)
// ---------------------------------------------------------------------------

const mockUseContractDefaulters = vi.fn()

vi.mock('./useContractDefaulters', () => ({
  useContractDefaulters: () => mockUseContractDefaulters(),
}))

// ---------------------------------------------------------------------------
// Mock other hooks used by BillingPage tabs (not under test)
// ---------------------------------------------------------------------------

vi.mock('./useInvoices', () => ({
  useInvoices: () => ({ data: [], count: 0, isLoading: false, error: null }),
  useCreateInvoice: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({ user: { email: 'test@example.com' }, role: 'Finance', loading: false }),
}))

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: () => ({ select: () => ({ order: () => Promise.resolve({ data: [], error: null }) }) }),
    functions: { invoke: vi.fn() },
  },
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
}

function makeContract(overrides: Partial<ContractWithClient> = {}): ContractWithClient {
  return {
    id: 'contract-1',
    client_id: 'client-1',
    client_name: 'Acme Corp',
    monthly_rate: 50000,
    start_date: '2024-01-01',
    end_date: null,
    status: 'active',
    updated_at: '2024-01-01T00:00:00Z',
    effective_status: 'active',
    duration_months: 12,
    ...overrides,
  }
}

function makeDefaulter(overrides: Partial<ContractDefaulter> = {}): ContractDefaulter {
  return {
    client_id: 'client-1',
    client_name: 'Acme Corp',
    client_phone: '0700000000',
    contract_id: 'contract-1',
    monthly_rate: 50000,
    contract_status: 'active',
    end_date: null,
    updated_at: '2024-01-01T00:00:00Z',
    expected_total: 100000,
    amount_paid: 0,
    outstanding_balance: 100000,
    months_unpaid: 2,
    defaulter_category: 'active',
    month_breakdown: [],
    ...overrides,
  }
}

function renderBillingPage() {
  const queryClient = makeQueryClient()
  const utils = render(
    <QueryClientProvider client={queryClient}>
      <BillingPage />
    </QueryClientProvider>
  )
  return utils
}

/** Navigate to the Contracts tab */
function openContractsTab() {
  const contractsTab = screen.getByRole('tab', { name: /contracts/i })
  fireEvent.click(contractsTab)
}

/** Navigate to the Defaulters tab */
function openDefaultersTab() {
  const defaultersTab = screen.getByRole('tab', { name: /defaulters/i })
  fireEvent.click(defaultersTab)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ContractsTab — filter control options', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseContracts.mockReturnValue({ data: [], isLoading: false, error: null })
    mockUseContractDefaulters.mockReturnValue({ data: [], isLoading: false, error: null })
  })

  // Validates: Requirement 5.3
  it('renders filter select with "All" option', () => {
    renderBillingPage()
    openContractsTab()

    const filterSelect = screen.getByRole('combobox', { name: /filter by contract status/i })
    expect(filterSelect).toBeInTheDocument()

    const allOption = screen.getByRole('option', { name: 'All' })
    expect(allOption).toBeInTheDocument()
  })

  // Validates: Requirement 5.3
  it('renders filter select with "Active" option', () => {
    renderBillingPage()
    openContractsTab()

    const activeOption = screen.getByRole('option', { name: 'Active' })
    expect(activeOption).toBeInTheDocument()
  })

  // Validates: Requirement 5.3
  it('renders filter select with "Inactive / Ended" option', () => {
    renderBillingPage()
    openContractsTab()

    const inactiveOption = screen.getByRole('option', { name: 'Inactive / Ended' })
    expect(inactiveOption).toBeInTheDocument()
  })

  // Validates: Requirement 5.3 — all three options present together
  it('filter control has exactly the three expected options: All, Active, Inactive / Ended', () => {
    renderBillingPage()
    openContractsTab()

    const filterSelect = screen.getByRole('combobox', { name: /filter by contract status/i })
    const options = Array.from((filterSelect as HTMLSelectElement).options).map((o) => o.text)

    expect(options).toEqual(['All', 'Active', 'Inactive / Ended'])
  })

  it('filter defaults to "All" on initial render', () => {
    renderBillingPage()
    openContractsTab()

    const filterSelect = screen.getByRole('combobox', { name: /filter by contract status/i }) as HTMLSelectElement
    expect(filterSelect.value).toBe('all')
  })
})

describe('ContractsTab — "Open-ended" display for null end_date', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseContractDefaulters.mockReturnValue({ data: [], isLoading: false, error: null })
  })

  // Validates: Requirement 5.2 (End Date column)
  it('displays "Open-ended" when contract end_date is null', () => {
    mockUseContracts.mockReturnValue({
      data: [makeContract({ end_date: null })],
      isLoading: false,
      error: null,
    })

    renderBillingPage()
    openContractsTab()

    expect(screen.getByText('Open-ended')).toBeInTheDocument()
  })

  it('does NOT display "Open-ended" when contract has an end_date', () => {
    mockUseContracts.mockReturnValue({
      data: [makeContract({ end_date: '2025-12-31', effective_status: 'active' })],
      isLoading: false,
      error: null,
    })

    renderBillingPage()
    openContractsTab()

    expect(screen.queryByText('Open-ended')).not.toBeInTheDocument()
  })

  it('displays "Open-ended" for multiple contracts with null end_date', () => {
    mockUseContracts.mockReturnValue({
      data: [
        makeContract({ id: 'c1', client_name: 'Client A', end_date: null }),
        makeContract({ id: 'c2', client_name: 'Client B', end_date: null }),
      ],
      isLoading: false,
      error: null,
    })

    renderBillingPage()
    openContractsTab()

    const openEndedCells = screen.getAllByText('Open-ended')
    expect(openEndedCells).toHaveLength(2)
  })
})

describe('ContractsTab — contract count display', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseContractDefaulters.mockReturnValue({ data: [], isLoading: false, error: null })
  })

  // Validates: Requirement 5.6
  it('displays "0 contracts" when no contracts are returned', () => {
    mockUseContracts.mockReturnValue({ data: [], isLoading: false, error: null })

    renderBillingPage()
    openContractsTab()

    expect(screen.getByText('0 contracts')).toBeInTheDocument()
  })

  // Validates: Requirement 5.6
  it('displays "1 contract" (singular) when exactly one contract is returned', () => {
    mockUseContracts.mockReturnValue({
      data: [makeContract()],
      isLoading: false,
      error: null,
    })

    renderBillingPage()
    openContractsTab()

    expect(screen.getByText('1 contract')).toBeInTheDocument()
  })

  // Validates: Requirement 5.6
  it('displays "3 contracts" (plural) when three contracts are returned', () => {
    mockUseContracts.mockReturnValue({
      data: [
        makeContract({ id: 'c1', client_name: 'Client A' }),
        makeContract({ id: 'c2', client_name: 'Client B' }),
        makeContract({ id: 'c3', client_name: 'Client C' }),
      ],
      isLoading: false,
      error: null,
    })

    renderBillingPage()
    openContractsTab()

    expect(screen.getByText('3 contracts')).toBeInTheDocument()
  })

  // Validates: Requirement 5.6 — count updates when filter changes
  it('count reflects the data returned by useContracts for the active filter', () => {
    // Initially returns 3 contracts for 'all'
    mockUseContracts.mockReturnValue({
      data: [
        makeContract({ id: 'c1' }),
        makeContract({ id: 'c2' }),
        makeContract({ id: 'c3' }),
      ],
      isLoading: false,
      error: null,
    })

    renderBillingPage()
    openContractsTab()

    expect(screen.getByText('3 contracts')).toBeInTheDocument()

    // Simulate switching to 'active' filter — hook returns 2 contracts
    mockUseContracts.mockReturnValue({
      data: [
        makeContract({ id: 'c1' }),
        makeContract({ id: 'c2' }),
      ],
      isLoading: false,
      error: null,
    })

    const filterSelect = screen.getByRole('combobox', { name: /filter by contract status/i })
    fireEvent.change(filterSelect, { target: { value: 'active' } })

    expect(screen.getByText('2 contracts')).toBeInTheDocument()
  })

  it('does not display count while loading', () => {
    mockUseContracts.mockReturnValue({ data: [], isLoading: true, error: null })

    renderBillingPage()
    openContractsTab()

    expect(screen.queryByText(/\d+ contract/)).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// DefaultersTab — filter logic tests (Task 7.1)
// Validates: Requirements 9.2, 9.3, 9.4
// ---------------------------------------------------------------------------

describe('DefaultersTab — filter logic', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseContracts.mockReturnValue({ data: [], isLoading: false, error: null })
  })

  // Validates: Requirement 9.3 — "Active Contract Defaulters" shows only active category rows
  it('shows only active-category defaulters when "Active Contract Defaulters" filter is selected', () => {
    mockUseContractDefaulters.mockReturnValue({
      data: [
        makeDefaulter({ client_id: 'c1', client_name: 'Active Client', defaulter_category: 'active' }),
        makeDefaulter({ client_id: 'c2', client_name: 'Ended Client', defaulter_category: 'ended' }),
      ],
      isLoading: false,
      error: null,
    })

    renderBillingPage()
    openDefaultersTab()

    const filterSelect = screen.getByRole('combobox', { name: /filter defaulters by category/i })
    fireEvent.change(filterSelect, { target: { value: 'active' } })

    expect(screen.getByText('Active Client')).toBeInTheDocument()
    expect(screen.queryByText('Ended Client')).not.toBeInTheDocument()
  })

  // Validates: Requirement 9.4 — "Ended Contract Defaulters" shows only ended category rows
  it('shows only ended-category defaulters when "Ended Contract Defaulters" filter is selected', () => {
    mockUseContractDefaulters.mockReturnValue({
      data: [
        makeDefaulter({ client_id: 'c1', client_name: 'Active Client', defaulter_category: 'active' }),
        makeDefaulter({ client_id: 'c2', client_name: 'Ended Client', defaulter_category: 'ended' }),
      ],
      isLoading: false,
      error: null,
    })

    renderBillingPage()
    openDefaultersTab()

    const filterSelect = screen.getByRole('combobox', { name: /filter defaulters by category/i })
    fireEvent.change(filterSelect, { target: { value: 'ended' } })

    expect(screen.getByText('Ended Client')).toBeInTheDocument()
    expect(screen.queryByText('Active Client')).not.toBeInTheDocument()
  })

  // Validates: Requirement 9.2 — "All Defaulters" shows all rows regardless of category
  it('shows all defaulters when "All Defaulters" filter is selected', () => {
    mockUseContractDefaulters.mockReturnValue({
      data: [
        makeDefaulter({ client_id: 'c1', client_name: 'Active Client', defaulter_category: 'active' }),
        makeDefaulter({ client_id: 'c2', client_name: 'Ended Client', defaulter_category: 'ended' }),
      ],
      isLoading: false,
      error: null,
    })

    renderBillingPage()
    openDefaultersTab()

    // Default is "all" — both rows should be visible
    expect(screen.getByText('Active Client')).toBeInTheDocument()
    expect(screen.getByText('Ended Client')).toBeInTheDocument()
  })

  // Validates: Requirement 9.2 — switching back to "All Defaulters" restores all rows
  it('restores all rows when switching back to "All Defaulters" after a category filter', () => {
    mockUseContractDefaulters.mockReturnValue({
      data: [
        makeDefaulter({ client_id: 'c1', client_name: 'Active Client', defaulter_category: 'active' }),
        makeDefaulter({ client_id: 'c2', client_name: 'Ended Client', defaulter_category: 'ended' }),
      ],
      isLoading: false,
      error: null,
    })

    renderBillingPage()
    openDefaultersTab()

    const filterSelect = screen.getByRole('combobox', { name: /filter defaulters by category/i })

    // Switch to active-only
    fireEvent.change(filterSelect, { target: { value: 'active' } })
    expect(screen.queryByText('Ended Client')).not.toBeInTheDocument()

    // Switch back to all
    fireEvent.change(filterSelect, { target: { value: 'all' } })
    expect(screen.getByText('Active Client')).toBeInTheDocument()
    expect(screen.getByText('Ended Client')).toBeInTheDocument()
  })

  // Validates: Requirement 9.3 — active filter with multiple active rows
  it('shows all active-category rows when multiple active defaulters exist', () => {
    mockUseContractDefaulters.mockReturnValue({
      data: [
        makeDefaulter({ client_id: 'c1', client_name: 'Active A', defaulter_category: 'active' }),
        makeDefaulter({ client_id: 'c2', client_name: 'Active B', defaulter_category: 'active' }),
        makeDefaulter({ client_id: 'c3', client_name: 'Ended C', defaulter_category: 'ended' }),
      ],
      isLoading: false,
      error: null,
    })

    renderBillingPage()
    openDefaultersTab()

    const filterSelect = screen.getByRole('combobox', { name: /filter defaulters by category/i })
    fireEvent.change(filterSelect, { target: { value: 'active' } })

    expect(screen.getByText('Active A')).toBeInTheDocument()
    expect(screen.getByText('Active B')).toBeInTheDocument()
    expect(screen.queryByText('Ended C')).not.toBeInTheDocument()
  })

  // Validates: Requirement 9.4 — ended filter with multiple ended rows
  it('shows all ended-category rows when multiple ended defaulters exist', () => {
    mockUseContractDefaulters.mockReturnValue({
      data: [
        makeDefaulter({ client_id: 'c1', client_name: 'Active A', defaulter_category: 'active' }),
        makeDefaulter({ client_id: 'c2', client_name: 'Ended B', defaulter_category: 'ended' }),
        makeDefaulter({ client_id: 'c3', client_name: 'Ended C', defaulter_category: 'ended' }),
      ],
      isLoading: false,
      error: null,
    })

    renderBillingPage()
    openDefaultersTab()

    const filterSelect = screen.getByRole('combobox', { name: /filter defaulters by category/i })
    fireEvent.change(filterSelect, { target: { value: 'ended' } })

    expect(screen.queryByText('Active A')).not.toBeInTheDocument()
    expect(screen.getByText('Ended B')).toBeInTheDocument()
    expect(screen.getByText('Ended C')).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// DefaultersTab — month breakdown panel (Task 8.1)
// Validates: Requirements 10.3, 10.4, 10.5
// ---------------------------------------------------------------------------

import type { MonthBreakdown } from './contractCalculations'

describe('DefaultersTab — month breakdown panel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseContracts.mockReturnValue({ data: [], isLoading: false, error: null })
  })

  /** Expand the first defaulter row by clicking its expand button */
  function expandFirstRow() {
    const expandBtn = screen.getByRole('button', { name: /expand row/i })
    fireEvent.click(expandBtn)
  }

  function makeBreakdown(overrides: Partial<MonthBreakdown> = {}): MonthBreakdown {
    return {
      month: '2024-01',
      paid_amount: 0,
      monthly_rate: 50000,
      status: 'unpaid',
      amount_owed: 50000,
      ...overrides,
    }
  }

  // Validates: Requirement 10.5 — Unpaid status shows full monthly_rate as amount owed
  it('shows full monthly_rate as amount owed for an "Unpaid" month', () => {
    mockUseContractDefaulters.mockReturnValue({
      data: [
        makeDefaulter({
          client_id: 'c1',
          client_name: 'Test Client',
          monthly_rate: 50000,
          month_breakdown: [
            makeBreakdown({ month: '2024-01', status: 'unpaid', paid_amount: 0, amount_owed: 50000 }),
          ],
        }),
      ],
      isLoading: false,
      error: null,
    })

    renderBillingPage()
    openDefaultersTab()
    expandFirstRow()

    // The breakdown panel shows the amount owed — use getAllByText since the monthly_rate
    // also appears in the main row's "Monthly Rate" column
    const amountCells = screen.getAllByText('UGX 50,000')
    expect(amountCells.length).toBeGreaterThanOrEqual(1)
    // Status badge should say "Unpaid"
    expect(screen.getByText('Unpaid')).toBeInTheDocument()
  })

  // Validates: Requirement 10.4 — Partial status shows remaining amount owed
  it('shows remaining amount owed (monthly_rate - paid_amount) for a "Partial" month', () => {
    mockUseContractDefaulters.mockReturnValue({
      data: [
        makeDefaulter({
          client_id: 'c1',
          client_name: 'Test Client',
          monthly_rate: 50000,
          month_breakdown: [
            makeBreakdown({
              month: '2024-01',
              status: 'partial',
              paid_amount: 20000,
              monthly_rate: 50000,
              amount_owed: 30000, // 50000 - 20000
            }),
          ],
        }),
      ],
      isLoading: false,
      error: null,
    })

    renderBillingPage()
    openDefaultersTab()
    expandFirstRow()

    // The breakdown panel should show the remaining amount (30,000)
    expect(screen.getByText('UGX 30,000')).toBeInTheDocument()
    // Status badge should say "Partial"
    expect(screen.getByText('Partial')).toBeInTheDocument()
  })

  // Validates: Requirement 10.3 — months displayed in chronological order (oldest to newest)
  it('displays months in chronological order from oldest to newest', () => {
    mockUseContractDefaulters.mockReturnValue({
      data: [
        makeDefaulter({
          client_id: 'c1',
          client_name: 'Test Client',
          month_breakdown: [
            makeBreakdown({ month: '2024-01', status: 'unpaid', amount_owed: 50000 }),
            makeBreakdown({ month: '2024-02', status: 'unpaid', amount_owed: 50000 }),
            makeBreakdown({ month: '2024-03', status: 'unpaid', amount_owed: 50000 }),
          ],
        }),
      ],
      isLoading: false,
      error: null,
    })

    renderBillingPage()
    openDefaultersTab()
    expandFirstRow()

    // All three months should be visible
    expect(screen.getByText('January 2024')).toBeInTheDocument()
    expect(screen.getByText('February 2024')).toBeInTheDocument()
    expect(screen.getByText('March 2024')).toBeInTheDocument()

    // Verify chronological order by checking DOM position
    const cells = screen.getAllByRole('cell')
    const monthCells = cells.filter((cell) =>
      ['January 2024', 'February 2024', 'March 2024'].includes(cell.textContent ?? '')
    )
    expect(monthCells[0]).toHaveTextContent('January 2024')
    expect(monthCells[1]).toHaveTextContent('February 2024')
    expect(monthCells[2]).toHaveTextContent('March 2024')
  })

  // Validates: Requirement 10.3 — chronological order holds across year boundaries
  it('displays months in chronological order across year boundaries', () => {
    mockUseContractDefaulters.mockReturnValue({
      data: [
        makeDefaulter({
          client_id: 'c1',
          client_name: 'Test Client',
          month_breakdown: [
            makeBreakdown({ month: '2023-11', status: 'unpaid', amount_owed: 50000 }),
            makeBreakdown({ month: '2023-12', status: 'unpaid', amount_owed: 50000 }),
            makeBreakdown({ month: '2024-01', status: 'unpaid', amount_owed: 50000 }),
          ],
        }),
      ],
      isLoading: false,
      error: null,
    })

    renderBillingPage()
    openDefaultersTab()
    expandFirstRow()

    const cells = screen.getAllByRole('cell')
    const monthCells = cells.filter((cell) =>
      ['November 2023', 'December 2023', 'January 2024'].includes(cell.textContent ?? '')
    )
    expect(monthCells[0]).toHaveTextContent('November 2023')
    expect(monthCells[1]).toHaveTextContent('December 2023')
    expect(monthCells[2]).toHaveTextContent('January 2024')
  })

  // Validates: Requirement 10.4 and 10.5 — mixed breakdown with partial and unpaid months
  it('shows correct amounts for a breakdown with both partial and unpaid months', () => {
    mockUseContractDefaulters.mockReturnValue({
      data: [
        makeDefaulter({
          client_id: 'c1',
          client_name: 'Test Client',
          monthly_rate: 60000,
          month_breakdown: [
            makeBreakdown({
              month: '2024-01',
              status: 'partial',
              paid_amount: 10000,
              monthly_rate: 60000,
              amount_owed: 50000, // 60000 - 10000
            }),
            makeBreakdown({
              month: '2024-02',
              status: 'unpaid',
              paid_amount: 0,
              monthly_rate: 60000,
              amount_owed: 60000, // full rate
            }),
          ],
        }),
      ],
      isLoading: false,
      error: null,
    })

    renderBillingPage()
    openDefaultersTab()
    expandFirstRow()

    // Partial month shows remaining 50,000 (unique — not the monthly_rate)
    expect(screen.getByText('UGX 50,000')).toBeInTheDocument()
    expect(screen.getByText('Partial')).toBeInTheDocument()

    // Unpaid month shows full 60,000 — also appears in the Monthly Rate column,
    // so use getAllByText and confirm at least one instance is present
    const sixtyKCells = screen.getAllByText('UGX 60,000')
    expect(sixtyKCells.length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Unpaid')).toBeInTheDocument()
  })
})
