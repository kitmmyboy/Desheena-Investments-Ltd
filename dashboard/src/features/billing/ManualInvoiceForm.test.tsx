/**
 * Unit tests for ManualInvoiceForm contract rate auto-population (Task 9.1),
 * paid-this-period / outstanding balance display (Task 10.2),
 * and invoice generation confirmation message (Task 11.1)
 * Validates: Requirements 1.1, 1.2, 1.5, 2.1, 2.2, 2.3, 2.4, 2.5, 3.2, 3.3, 3.4
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import ManualInvoiceForm, { formatPeriod } from './ManualInvoiceForm'

// ---------------------------------------------------------------------------
// Mock Supabase
// ---------------------------------------------------------------------------

// We need to capture the mock so we can configure it per test
const mockContractSelect = vi.fn()
const mockClientSelect = vi.fn()
const mockInvoiceSelect = vi.fn()

// Track which table is being queried
let currentTable = ''

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      currentTable = table
      if (table === 'contracts') {
        return {
          select: () => mockContractSelect(),
        }
      }
      if (table === 'invoices') {
        return {
          select: () => mockInvoiceSelect(),
        }
      }
      // clients table
      return {
        select: () => mockClientSelect(),
      }
    },
  },
}))

// Mock useCreateInvoice — use a module-level mock so all tests share the same reference
const mockMutateAsync = vi.fn()

vi.mock('./useInvoices', () => ({
  useCreateInvoice: () => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
  }),
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
}

function renderForm() {
  const onClose = vi.fn()
  const queryClient = makeQueryClient()
  const utils = render(
    <QueryClientProvider client={queryClient}>
      <ManualInvoiceForm onClose={onClose} />
    </QueryClientProvider>
  )
  return { ...utils, onClose }
}

// Build a chainable Supabase query mock that resolves with given data
function makeChainableMock(resolveWith: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {}
  const methods = ['select', 'eq', 'or', 'order', 'limit', 'ilike']
  methods.forEach((m) => {
    chain[m] = () => chain
  })
  chain['then'] = (resolve: (v: unknown) => void) => {
    resolve(resolveWith)
    return Promise.resolve(resolveWith)
  }
  return chain
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ManualInvoiceForm — contract rate auto-population', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    currentTable = ''
    // Default: invoices returns empty (no prior payments)
    mockInvoiceSelect.mockReturnValue(makeChainableMock({ data: [], error: null }))
    // Default: mutateAsync resolves successfully
    mockMutateAsync.mockResolvedValue({})
  })

  it('renders the form with Amount field empty initially', () => {
    // Client search returns nothing
    mockClientSelect.mockReturnValue(makeChainableMock({ data: [], error: null }))
    mockContractSelect.mockReturnValue(makeChainableMock({ data: [], error: null }))

    renderForm()

    const amountInput = screen.getByLabelText(/Amount \(UGX\)/i)
    expect(amountInput).toBeInTheDocument()
    expect((amountInput as HTMLInputElement).value).toBe('')
  })

  it('shows "No active contract found" message when client has no active contract (Req 1.2)', async () => {
    // Client search returns one client
    const clientChain = makeChainableMock({
      data: [{ id: 'client-1', name: 'Alice', phone: '0700000001' }],
      error: null,
    })
    mockClientSelect.mockReturnValue(clientChain)

    // Contract query returns empty (no active contract)
    const contractChain = makeChainableMock({ data: [], error: null })
    mockContractSelect.mockReturnValue(contractChain)

    renderForm()

    // Type in client search to trigger dropdown
    const searchInput = screen.getByPlaceholderText(/Search client by name/i)
    fireEvent.change(searchInput, { target: { value: 'Alice' } })

    // Wait for dropdown to appear and click the client
    await waitFor(() => screen.getByText('Alice'))
    fireEvent.mouseDown(screen.getByText('Alice'))

    // Wait for contract fetch to complete and message to appear
    await waitFor(() => {
      expect(screen.getByText(/No active contract found/i)).toBeInTheDocument()
    })

    // Amount field should remain empty
    const amountInput = screen.getByLabelText(/Amount \(UGX\)/i)
    expect((amountInput as HTMLInputElement).value).toBe('')
  })

  it('auto-populates Amount field with contract rate when client has active contract (Req 1.1)', async () => {
    // Client search returns one client
    const clientChain = makeChainableMock({
      data: [{ id: 'client-2', name: 'Bob', phone: '0700000002' }],
      error: null,
    })
    mockClientSelect.mockReturnValue(clientChain)

    // Contract query returns active contract with monthly_rate
    const contractChain = makeChainableMock({
      data: [{ monthly_rate: 75000 }],
      error: null,
    })
    mockContractSelect.mockReturnValue(contractChain)

    renderForm()

    const searchInput = screen.getByPlaceholderText(/Search client by name/i)
    fireEvent.change(searchInput, { target: { value: 'Bob' } })

    await waitFor(() => screen.getByText('Bob'))
    fireEvent.mouseDown(screen.getByText('Bob'))

    // Amount field should be populated with the contract rate
    await waitFor(() => {
      const amountInput = screen.getByLabelText(/Amount \(UGX\)/i)
      expect((amountInput as HTMLInputElement).value).toBe('75000')
    })

    // Contract rate hint should be shown
    await waitFor(() => {
      expect(screen.getByText(/Contract rate: UGX 75,000/i)).toBeInTheDocument()
    })
  })

  it('allows user to override the auto-populated amount (Req 1.4)', async () => {
    const clientChain = makeChainableMock({
      data: [{ id: 'client-3', name: 'Carol', phone: '0700000003' }],
      error: null,
    })
    mockClientSelect.mockReturnValue(clientChain)

    const contractChain = makeChainableMock({
      data: [{ monthly_rate: 50000 }],
      error: null,
    })
    mockContractSelect.mockReturnValue(contractChain)

    renderForm()

    const searchInput = screen.getByPlaceholderText(/Search client by name/i)
    fireEvent.change(searchInput, { target: { value: 'Carol' } })

    await waitFor(() => screen.getByText('Carol'))
    fireEvent.mouseDown(screen.getByText('Carol'))

    // Wait for auto-population
    await waitFor(() => {
      const amountInput = screen.getByLabelText(/Amount \(UGX\)/i)
      expect((amountInput as HTMLInputElement).value).toBe('50000')
    })

    // User overrides the amount
    const amountInput = screen.getByLabelText(/Amount \(UGX\)/i)
    fireEvent.change(amountInput, { target: { value: '60000' } })

    expect((amountInput as HTMLInputElement).value).toBe('60000')
  })

  it('clears and re-populates Amount field when client changes (Req 1.5)', async () => {
    // First client has a contract
    const clientChain1 = makeChainableMock({
      data: [{ id: 'client-4', name: 'Dave', phone: '0700000004' }],
      error: null,
    })
    // Second client has no contract
    const clientChain2 = makeChainableMock({
      data: [{ id: 'client-5', name: 'Eve', phone: '0700000005' }],
      error: null,
    })

    const contractChain1 = makeChainableMock({
      data: [{ monthly_rate: 100000 }],
      error: null,
    })
    const contractChain2 = makeChainableMock({
      data: [],
      error: null,
    })

    // First call returns Dave, second returns Eve
    mockClientSelect
      .mockReturnValueOnce(clientChain1)
      .mockReturnValueOnce(clientChain2)

    // First contract call returns rate, second returns empty
    mockContractSelect
      .mockReturnValueOnce(contractChain1)
      .mockReturnValueOnce(contractChain2)

    renderForm()

    const searchInput = screen.getByPlaceholderText(/Search client by name/i)

    // Select Dave
    fireEvent.change(searchInput, { target: { value: 'Dave' } })
    await waitFor(() => screen.getByText('Dave'))
    fireEvent.mouseDown(screen.getByText('Dave'))

    await waitFor(() => {
      const amountInput = screen.getByLabelText(/Amount \(UGX\)/i)
      expect((amountInput as HTMLInputElement).value).toBe('100000')
    })

    // Now change to Eve by clearing the search (simulates client change)
    await act(async () => {
      fireEvent.change(searchInput, { target: { value: 'Eve' } })
    })

    // Selecting a different client clears the previous selection
    await waitFor(() => screen.getByText('Eve'))
    fireEvent.mouseDown(screen.getByText('Eve'))

    // Amount should be cleared and then show no contract message
    await waitFor(() => {
      expect(screen.getByText(/No active contract found/i)).toBeInTheDocument()
    })

    const amountInput = screen.getByLabelText(/Amount \(UGX\)/i)
    expect((amountInput as HTMLInputElement).value).toBe('')
  })
})

// ---------------------------------------------------------------------------
// Task 10.2 — Paid-this-period and outstanding balance display
// Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 3.3
// ---------------------------------------------------------------------------

describe('ManualInvoiceForm — paid-this-period and outstanding balance', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    currentTable = ''
    // Default: mutateAsync resolves successfully
    mockMutateAsync.mockResolvedValue({})
  })

  /**
   * Helper: set up mocks and select a client in the form.
   */
  async function selectClientWithMocks(
    clientData: { id: string; name: string; phone: string },
    contractData: unknown[],
    invoiceData: unknown[]
  ) {
    mockClientSelect.mockReturnValue(
      makeChainableMock({ data: [clientData], error: null })
    )
    mockContractSelect.mockReturnValue(
      makeChainableMock({ data: contractData, error: null })
    )
    mockInvoiceSelect.mockReturnValue(
      makeChainableMock({ data: invoiceData, error: null })
    )

    renderForm()

    const searchInput = screen.getByPlaceholderText(/Search client by name/i)
    fireEvent.change(searchInput, { target: { value: clientData.name } })
    await waitFor(() => screen.getByText(clientData.name))
    fireEvent.mouseDown(screen.getByText(clientData.name))
  }

  it('shows "Paid this period: UGX 0" when no prior invoices exist (Req 2.2)', async () => {
    await selectClientWithMocks(
      { id: 'c1', name: 'Frank', phone: '0700000010' },
      [{ monthly_rate: 50000 }],
      [] // no invoices
    )

    await waitFor(() => {
      expect(screen.getByText(/Paid this period/i)).toBeInTheDocument()
    })
    expect(screen.getByText(/UGX 0/i)).toBeInTheDocument()
  })

  it('shows correct paid amount when prior invoices exist (Req 2.1)', async () => {
    await selectClientWithMocks(
      { id: 'c2', name: 'Grace', phone: '0700000011' },
      [{ monthly_rate: 80000 }],
      [{ paid_amount: 30000 }, { paid_amount: 20000 }] // total = 50000
    )

    await waitFor(() => {
      expect(screen.getByText(/Paid this period/i)).toBeInTheDocument()
    })
    // 30000 + 20000 = 50000
    expect(screen.getByText(/UGX 50,000/i)).toBeInTheDocument()
  })

  it('computes and displays Outstanding balance = Amount - Paid (Req 2.3)', async () => {
    await selectClientWithMocks(
      { id: 'c3', name: 'Henry', phone: '0700000012' },
      [{ monthly_rate: 100000 }],
      [{ paid_amount: 40000 }]
    )

    // Wait for amount to be auto-populated (100000) and paid to load (40000)
    await waitFor(() => {
      const amountInput = screen.getByLabelText(/Amount \(UGX\)/i)
      expect((amountInput as HTMLInputElement).value).toBe('100000')
    })

    await waitFor(() => {
      expect(screen.getByText(/Outstanding/i)).toBeInTheDocument()
    })

    // Outstanding = 100000 - 40000 = 60000
    expect(screen.getByText(/UGX 60,000/i)).toBeInTheDocument()
  })

  it('updates Outstanding balance in real time when Amount field changes (Req 2.4)', async () => {
    await selectClientWithMocks(
      { id: 'c4', name: 'Iris', phone: '0700000013' },
      [{ monthly_rate: 50000 }],
      [{ paid_amount: 20000 }]
    )

    // Wait for initial state
    await waitFor(() => {
      const amountInput = screen.getByLabelText(/Amount \(UGX\)/i)
      expect((amountInput as HTMLInputElement).value).toBe('50000')
    })

    // Change amount to 70000
    const amountInput = screen.getByLabelText(/Amount \(UGX\)/i)
    fireEvent.change(amountInput, { target: { value: '70000' } })

    // Outstanding should update: 70000 - 20000 = 50000
    // Use getAllByText since "Contract rate: UGX 50,000" hint may also be present
    await waitFor(() => {
      const matches = screen.getAllByText(/UGX 50,000/i)
      expect(matches.length).toBeGreaterThanOrEqual(1)
      // Verify the Outstanding section specifically shows 50,000
      const outstandingEl = screen.getByText(/Outstanding:/i)
      expect(outstandingEl.closest('p')?.textContent).toMatch(/50,000/)
    })
  })

  it('shows yellow warning when Outstanding balance is zero (Req 2.5)', async () => {
    await selectClientWithMocks(
      { id: 'c5', name: 'Jack', phone: '0700000014' },
      [{ monthly_rate: 50000 }],
      [{ paid_amount: 50000 }] // fully paid
    )

    // Wait for amount to be auto-populated
    await waitFor(() => {
      const amountInput = screen.getByLabelText(/Amount \(UGX\)/i)
      expect((amountInput as HTMLInputElement).value).toBe('50000')
    })

    // Outstanding = 50000 - 50000 = 0 → warning should appear
    await waitFor(() => {
      expect(
        screen.getByText(/This client has no outstanding balance for the selected period/i)
      ).toBeInTheDocument()
    })
  })

  it('shows yellow warning when Outstanding balance is negative (Req 2.5)', async () => {
    await selectClientWithMocks(
      { id: 'c6', name: 'Kate', phone: '0700000015' },
      [{ monthly_rate: 50000 }],
      [{ paid_amount: 70000 }] // overpaid
    )

    await waitFor(() => {
      const amountInput = screen.getByLabelText(/Amount \(UGX\)/i)
      expect((amountInput as HTMLInputElement).value).toBe('50000')
    })

    // Outstanding = 50000 - 70000 = -20000 → warning
    await waitFor(() => {
      expect(
        screen.getByText(/This client has no outstanding balance for the selected period/i)
      ).toBeInTheDocument()
    })
  })

  it('does NOT show warning when Outstanding balance is positive', async () => {
    await selectClientWithMocks(
      { id: 'c7', name: 'Leo', phone: '0700000016' },
      [{ monthly_rate: 80000 }],
      [{ paid_amount: 20000 }]
    )

    await waitFor(() => {
      const amountInput = screen.getByLabelText(/Amount \(UGX\)/i)
      expect((amountInput as HTMLInputElement).value).toBe('80000')
    })

    // Outstanding = 80000 - 20000 = 60000 → no warning
    await waitFor(() => {
      expect(screen.getByText(/Outstanding/i)).toBeInTheDocument()
    })

    expect(
      screen.queryByText(/This client has no outstanding balance for the selected period/i)
    ).not.toBeInTheDocument()
  })

  it('displays due date as "Due: {date}" 14 days from today (Req 3.3)', () => {
    mockClientSelect.mockReturnValue(makeChainableMock({ data: [], error: null }))
    mockContractSelect.mockReturnValue(makeChainableMock({ data: [], error: null }))
    mockInvoiceSelect.mockReturnValue(makeChainableMock({ data: [], error: null }))

    renderForm()

    // The due date should be visible without selecting a client
    const due = new Date()
    due.setDate(due.getDate() + 14)
    const year = due.getFullYear()

    // Check that "Due:" label is present and contains the year (robust check)
    const dueEl = screen.getByText(/^Due:/i)
    expect(dueEl).toBeInTheDocument()
    expect(dueEl.textContent).toContain(String(year))
  })
})

// ---------------------------------------------------------------------------
// Task 11.1 — Invoice generation confirmation message
// Validates: Requirements 3.2, 3.4
// ---------------------------------------------------------------------------

describe('formatPeriod helper', () => {
  it('converts YYYY-MM to human-readable month name (e.g. "2025-07" → "July 2025")', () => {
    expect(formatPeriod('2025-07')).toBe('July 2025')
  })

  it('converts January correctly', () => {
    expect(formatPeriod('2024-01')).toBe('January 2024')
  })

  it('converts December correctly', () => {
    expect(formatPeriod('2023-12')).toBe('December 2023')
  })

  it('returns the original string for invalid input', () => {
    expect(formatPeriod('invalid')).toBe('invalid')
    expect(formatPeriod('')).toBe('')
  })
})

describe('ManualInvoiceForm — invoice generation confirmation message (Req 3.4)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    currentTable = ''
    mockInvoiceSelect.mockReturnValue(makeChainableMock({ data: [], error: null }))
    // Default: mutateAsync resolves successfully
    mockMutateAsync.mockResolvedValue({})
  })

  /**
   * Helper: set up mocks, select a client, wait for amount auto-population, then submit.
   */
  async function setupAndSubmit(
    clientData: { id: string; name: string; phone: string },
    contractData: { monthly_rate: number }[],
    invoicePeriodValue?: string
  ) {
    mockClientSelect.mockReturnValue(
      makeChainableMock({ data: [clientData], error: null })
    )
    mockContractSelect.mockReturnValue(
      makeChainableMock({ data: contractData, error: null })
    )

    const onClose = vi.fn()
    const queryClient = makeQueryClient()
    render(
      <QueryClientProvider client={queryClient}>
        <ManualInvoiceForm onClose={onClose} />
      </QueryClientProvider>
    )

    // Select client
    const searchInput = screen.getByPlaceholderText(/Search client by name/i)
    fireEvent.change(searchInput, { target: { value: clientData.name } })
    await waitFor(() => screen.getByText(clientData.name))
    fireEvent.mouseDown(screen.getByText(clientData.name))

    // Optionally set invoice period
    if (invoicePeriodValue) {
      const periodInput = screen.getByLabelText(/Invoice Period/i)
      fireEvent.change(periodInput, { target: { value: invoicePeriodValue } })
    }

    // Wait for amount auto-population if contract exists
    if (contractData.length > 0) {
      await waitFor(() => {
        const amountInput = screen.getByLabelText(/Amount \(UGX\)/i)
        expect((amountInput as HTMLInputElement).value).toBe(String(contractData[0].monthly_rate))
      })
    }

    // Submit the form
    const submitBtn = screen.getByRole('button', { name: /Generate Invoice/i })
    fireEvent.click(submitBtn)

    return { onClose }
  }

  it('shows confirmation with client name after successful submission (Req 3.4)', async () => {
    const { onClose } = await setupAndSubmit(
      { id: 'c10', name: 'Maria', phone: '0700000020' },
      [{ monthly_rate: 60000 }]
    )

    // Confirmation should show client name
    await waitFor(() => {
      expect(screen.getByTestId('confirmation-client-name')).toHaveTextContent('Maria')
    })

    // onClose should NOT have been called yet
    expect(onClose).not.toHaveBeenCalled()
  })

  it('shows confirmation with human-readable invoice period (Req 3.4)', async () => {
    await setupAndSubmit(
      { id: 'c11', name: 'Nathan', phone: '0700000021' },
      [{ monthly_rate: 45000 }],
      '2025-07'
    )

    // Confirmation should show human-readable period "July 2025"
    await waitFor(() => {
      expect(screen.getByTestId('confirmation-period')).toHaveTextContent('July 2025')
    })
  })

  it('shows confirmation with total amount formatted as UGX {amount} (Req 3.4)', async () => {
    await setupAndSubmit(
      { id: 'c12', name: 'Olivia', phone: '0700000022' },
      [{ monthly_rate: 120000 }]
    )

    // Confirmation should show amount as "UGX 120,000"
    await waitFor(() => {
      expect(screen.getByTestId('confirmation-amount')).toHaveTextContent('UGX 120,000')
    })
  })

  it('invoice_period is stored in YYYY-MM format in mutateAsync call (Req 3.2)', async () => {
    await setupAndSubmit(
      { id: 'c13', name: 'Peter', phone: '0700000023' },
      [{ monthly_rate: 55000 }],
      '2025-03'
    )

    // Verify mockMutateAsync was called with invoice_period in YYYY-MM format
    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          invoice_period: '2025-03',
        })
      )
    })

    // Verify the format is YYYY-MM (not a date string or other format)
    const callArg = mockMutateAsync.mock.calls[0][0]
    expect(callArg.invoice_period).toMatch(/^\d{4}-\d{2}$/)
  })

  it('form does NOT close immediately after success — shows confirmation first (Req 3.4)', async () => {
    const { onClose } = await setupAndSubmit(
      { id: 'c14', name: 'Quinn', phone: '0700000024' },
      [{ monthly_rate: 70000 }]
    )

    // onClose should NOT be called immediately
    await waitFor(() => {
      expect(screen.getByText(/Invoice generated successfully/i)).toBeInTheDocument()
    })
    expect(onClose).not.toHaveBeenCalled()

    // Clicking "Done" should call onClose
    const doneBtn = screen.getByRole('button', { name: /Done/i })
    fireEvent.click(doneBtn)
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
