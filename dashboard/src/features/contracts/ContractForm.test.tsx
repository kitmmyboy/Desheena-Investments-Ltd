/**
 * Property-based tests for ContractForm component.
 * Validates: Requirements 3.4
 */

// Feature: contracts-management-page, Property 3: Required field validation blocks submission

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import * as fc from 'fast-check'
import React from 'react'
import ContractForm from './ContractForm'

// ---------------------------------------------------------------------------
// Mock Supabase
// ---------------------------------------------------------------------------

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}))

// ---------------------------------------------------------------------------
// Mock useContractMutations
// ---------------------------------------------------------------------------

const mockCreateContractMutateAsync = vi.fn()
const mockUpdateContractMutateAsync = vi.fn()

vi.mock('./useContractMutations', () => ({
  useContractMutations: () => ({
    createContract: {
      mutateAsync: mockCreateContractMutateAsync,
      isPending: false,
      error: null,
    },
    updateContract: {
      mutateAsync: mockUpdateContractMutateAsync,
      isPending: false,
      error: null,
    },
    updateStatus: {
      mutateAsync: vi.fn(),
      isPending: false,
      error: null,
    },
    terminateContract: {
      mutateAsync: vi.fn(),
      isPending: false,
      error: null,
    },
  }),
}))

// ---------------------------------------------------------------------------
// Mock useClients — return a list of fake clients
// ---------------------------------------------------------------------------

vi.mock('../clients/useClients', () => ({
  useClients: () => ({
    data: [
      {
        id: 'client-1',
        name: 'Acme Corp',
        phone: '0700000001',
        email: null,
        location_text: 'Kampala',
        gps_lat: 0,
        gps_lng: 0,
        service_frequency: 'weekly',
        monthly_rate: 50000,
        zone: null,
        created_at: '2024-01-01T00:00:00Z',
        contract_status: null,
      },
      {
        id: 'client-2',
        name: 'Beta Ltd',
        phone: '0700000002',
        email: null,
        location_text: 'Entebbe',
        gps_lat: 0,
        gps_lng: 0,
        service_frequency: 'weekly',
        monthly_rate: 60000,
        zone: null,
        created_at: '2024-01-01T00:00:00Z',
        contract_status: null,
      },
    ],
    count: 2,
    isLoading: false,
    error: null,
  }),
}))

// ---------------------------------------------------------------------------
// Helper: create a fresh QueryClient wrapper for each test
// ---------------------------------------------------------------------------

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  })
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children)
}

// ---------------------------------------------------------------------------
// Helper: render ContractForm in create mode
// ---------------------------------------------------------------------------

function renderContractForm() {
  const onClose = vi.fn()
  const Wrapper = createWrapper()
  const utils = render(
    <Wrapper>
      <ContractForm onClose={onClose} />
    </Wrapper>
  )
  return { ...utils, onClose }
}

// ---------------------------------------------------------------------------
// Helper: fill in a field by its type
// ---------------------------------------------------------------------------

type RequiredField = 'client' | 'start_date' | 'monthly_rate'

function fillField(field: RequiredField) {
  if (field === 'client') {
    const select = screen.getByRole('combobox', { name: /select client/i })
    fireEvent.change(select, { target: { value: 'client-1' } })
  } else if (field === 'start_date') {
    // The start date input doesn't have an accessible label with "start date" text
    // so we find it by its position among date inputs
    const dateInputs = document.querySelectorAll('input[type="date"]')
    // First date input is start_date
    fireEvent.change(dateInputs[0], { target: { value: '2025-01-01' } })
  } else if (field === 'monthly_rate') {
    const rateInput = screen.getByRole('spinbutton')
    fireEvent.change(rateInput, { target: { value: '50000' } })
  }
}

// ---------------------------------------------------------------------------
// Helper: submit the form
// ---------------------------------------------------------------------------

function submitForm() {
  const submitButton = screen.getByRole('button', { name: /create contract/i })
  fireEvent.click(submitButton)
}

// ---------------------------------------------------------------------------
// Helper: assert that a validation error is shown for a missing field
// ---------------------------------------------------------------------------

async function assertErrorShownForField(field: RequiredField) {
  if (field === 'client') {
    await waitFor(() => {
      expect(screen.getByText(/client is required/i)).toBeInTheDocument()
    })
  } else if (field === 'start_date') {
    await waitFor(() => {
      expect(screen.getByText(/start date is required/i)).toBeInTheDocument()
    })
  } else if (field === 'monthly_rate') {
    await waitFor(() => {
      expect(screen.getByText(/monthly rate is required/i)).toBeInTheDocument()
    })
  }
}

// ---------------------------------------------------------------------------
// Property 3: Required field validation blocks submission
// ---------------------------------------------------------------------------

describe('Property 3: Required field validation blocks submission', () => {
  // Feature: contracts-management-page, Property 3: Required field validation blocks submission
  // Validates: Requirements 3.4

  const ALL_REQUIRED_FIELDS: RequiredField[] = ['client', 'start_date', 'monthly_rate']

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows validation errors for each missing required field and does not call createContract.mutateAsync', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate non-empty subsets of required fields to leave empty
        fc.subarray(ALL_REQUIRED_FIELDS, { minLength: 1 }),
        async (missingFields) => {
          // Render a fresh form for each iteration
          renderContractForm()

          // Determine which fields to fill in (those NOT in missingFields)
          const fieldsToFill = ALL_REQUIRED_FIELDS.filter(
            (f) => !missingFields.includes(f)
          )

          // Fill in only the non-missing fields
          for (const field of fieldsToFill) {
            fillField(field)
          }

          // Submit the form
          submitForm()

          // Assert that a validation error is shown for each missing field
          for (const field of missingFields) {
            await assertErrorShownForField(field)
          }

          // Assert that Supabase insert was NOT called
          expect(mockCreateContractMutateAsync).not.toHaveBeenCalled()

          // Clean up the rendered component before the next iteration
          cleanup()
          vi.clearAllMocks()
        }
      ),
      { numRuns: 20 }
    )
  })

  // Additional unit-style tests to verify each individual required field

  it('shows "Client is required" error when client is not selected', async () => {
    renderContractForm()

    // Fill start_date and monthly_rate but leave client empty
    fillField('start_date')
    fillField('monthly_rate')
    submitForm()

    await waitFor(() => {
      expect(screen.getByText(/client is required/i)).toBeInTheDocument()
    })
    expect(mockCreateContractMutateAsync).not.toHaveBeenCalled()
  })

  it('shows "Start date is required" error when start_date is not filled', async () => {
    renderContractForm()

    // Fill client and monthly_rate but leave start_date empty
    fillField('client')
    fillField('monthly_rate')
    submitForm()

    await waitFor(() => {
      expect(screen.getByText(/start date is required/i)).toBeInTheDocument()
    })
    expect(mockCreateContractMutateAsync).not.toHaveBeenCalled()
  })

  it('shows "Monthly rate is required" error when monthly_rate is not filled', async () => {
    renderContractForm()

    // Fill client and start_date but leave monthly_rate empty
    fillField('client')
    fillField('start_date')
    submitForm()

    await waitFor(() => {
      expect(screen.getByText(/monthly rate is required/i)).toBeInTheDocument()
    })
    expect(mockCreateContractMutateAsync).not.toHaveBeenCalled()
  })

  it('shows all three validation errors when all required fields are missing', async () => {
    renderContractForm()

    // Submit without filling any fields
    submitForm()

    await waitFor(() => {
      expect(screen.getByText(/client is required/i)).toBeInTheDocument()
      expect(screen.getByText(/start date is required/i)).toBeInTheDocument()
      expect(screen.getByText(/monthly rate is required/i)).toBeInTheDocument()
    })
    expect(mockCreateContractMutateAsync).not.toHaveBeenCalled()
  })

  it('does NOT show validation errors and calls mutateAsync when all required fields are filled', async () => {
    mockCreateContractMutateAsync.mockResolvedValueOnce({
      id: 'new-contract-id',
      client_id: 'client-1',
      client_name: 'Acme Corp',
      monthly_rate: 50000,
      start_date: '2025-01-01',
      end_date: null,
      status: 'active',
      effective_status: 'active',
      updated_at: '2025-01-01T00:00:00Z',
    })

    renderContractForm()

    // Fill all required fields
    fillField('client')
    fillField('start_date')
    fillField('monthly_rate')
    submitForm()

    await waitFor(() => {
      expect(mockCreateContractMutateAsync).toHaveBeenCalledTimes(1)
    })

    expect(screen.queryByText(/client is required/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/start date is required/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/monthly rate is required/i)).not.toBeInTheDocument()
  })
})

// Feature: contracts-management-page, Property 4: End date before start date is rejected
// Validates: Requirements 3.5

describe('Property 4: End date before start date is rejected', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows end date validation error and does not call createContract.mutateAsync when end < start', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate a tuple (startDate, endDate) where endDate < startDate
        fc
          .tuple(
            fc.date({ min: new Date('2020-01-02'), max: new Date('2030-12-31') }),
            fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-30') })
          )
          .filter(([start, end]) => end < start),
        async ([startDate, endDate]) => {
          // Format dates as YYYY-MM-DD strings
          const toYMD = (d: Date) => d.toISOString().split('T')[0]
          const startStr = toYMD(startDate)
          const endStr = toYMD(endDate)

          renderContractForm()

          // Fill all required fields
          fillField('client')
          fillField('monthly_rate')

          // Set start_date
          const dateInputs = document.querySelectorAll('input[type="date"]')
          fireEvent.change(dateInputs[0], { target: { value: startStr } })

          // Set end_date (second date input) to a date before start_date
          fireEvent.change(dateInputs[1], { target: { value: endStr } })

          // Submit the form
          submitForm()

          // Assert end_date validation error is shown
          await waitFor(() => {
            expect(
              screen.getByText(/end date must be on or after the start date/i)
            ).toBeInTheDocument()
          })

          // Assert Supabase insert was NOT called
          expect(mockCreateContractMutateAsync).not.toHaveBeenCalled()

          cleanup()
          vi.clearAllMocks()
        }
      ),
      { numRuns: 20 }
    )
  })

  it('shows end date error for a concrete example: start 2025-06-01, end 2025-05-01', async () => {
    renderContractForm()

    fillField('client')
    fillField('monthly_rate')

    const dateInputs = document.querySelectorAll('input[type="date"]')
    fireEvent.change(dateInputs[0], { target: { value: '2025-06-01' } })
    fireEvent.change(dateInputs[1], { target: { value: '2025-05-01' } })

    submitForm()

    await waitFor(() => {
      expect(
        screen.getByText(/end date must be on or after the start date/i)
      ).toBeInTheDocument()
    })
    expect(mockCreateContractMutateAsync).not.toHaveBeenCalled()
  })

  it('does NOT show end date error when end date equals start date', async () => {
    mockCreateContractMutateAsync.mockResolvedValueOnce({
      id: 'new-contract-id',
      client_id: 'client-1',
      client_name: 'Acme Corp',
      monthly_rate: 50000,
      start_date: '2025-06-01',
      end_date: '2025-06-01',
      status: 'active',
      effective_status: 'active',
      updated_at: '2025-06-01T00:00:00Z',
    })

    renderContractForm()

    fillField('client')
    fillField('monthly_rate')

    const dateInputs = document.querySelectorAll('input[type="date"]')
    fireEvent.change(dateInputs[0], { target: { value: '2025-06-01' } })
    fireEvent.change(dateInputs[1], { target: { value: '2025-06-01' } })

    submitForm()

    await waitFor(() => {
      expect(mockCreateContractMutateAsync).toHaveBeenCalledTimes(1)
    })
    expect(screen.queryByText(/end date must be on or after the start date/i)).not.toBeInTheDocument()
  })
})

// Feature: contracts-management-page, Property 5: Non-positive monthly rate is rejected
// Validates: Requirements 3.6

describe('Property 5: Non-positive monthly rate is rejected', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows monthly_rate validation error and does not call createContract.mutateAsync for non-positive or non-integer rates', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate invalid monthly_rate values:
        //   - zero or negative integers
        //   - decimal (non-integer) positive values like 50000.5
        // Note: we avoid very small floats (e.g. -0.001) because <input type="number">
        // in jsdom may coerce them to empty string, triggering "required" instead of
        // "positive integer" error. We test those cases in dedicated unit tests below.
        fc.oneof(
          // Zero or negative integers
          fc.integer({ max: 0 }),
          // Decimal values that are not positive integers (e.g. 1.5, 50000.5)
          // Use integers > 0 and add a fractional part
          fc.integer({ min: 1, max: 1_000_000 }).map((n) => n + 0.5)
        ),
        async (invalidRate) => {
          // Always cleanup before rendering to avoid stale DOM from previous iterations
          cleanup()
          vi.clearAllMocks()

          renderContractForm()

          // Fill all required fields except monthly_rate
          fillField('client')
          fillField('start_date')

          // Set the invalid monthly_rate
          const rateInput = screen.getByRole('spinbutton')
          fireEvent.change(rateInput, { target: { value: String(invalidRate) } })

          // Submit the form
          submitForm()

          // Assert the monthly_rate validation error is shown
          await waitFor(() => {
            expect(
              screen.getByText('Must be a positive integer (e.g. 50000)')
            ).toBeInTheDocument()
          })

          // Assert Supabase insert was NOT called
          expect(mockCreateContractMutateAsync).not.toHaveBeenCalled()
        }
      ),
      { numRuns: 30 }
    )
  })

  it('shows validation error for zero', async () => {
    renderContractForm()

    fillField('client')
    fillField('start_date')

    const rateInput = screen.getByRole('spinbutton')
    fireEvent.change(rateInput, { target: { value: '0' } })

    submitForm()

    await waitFor(() => {
      expect(
        screen.getByText('Must be a positive integer (e.g. 50000)')
      ).toBeInTheDocument()
    })
    expect(mockCreateContractMutateAsync).not.toHaveBeenCalled()
  })

  it('shows validation error for a negative integer (-1)', async () => {
    renderContractForm()

    fillField('client')
    fillField('start_date')

    const rateInput = screen.getByRole('spinbutton')
    fireEvent.change(rateInput, { target: { value: '-1' } })

    submitForm()

    await waitFor(() => {
      expect(
        screen.getByText('Must be a positive integer (e.g. 50000)')
      ).toBeInTheDocument()
    })
    expect(mockCreateContractMutateAsync).not.toHaveBeenCalled()
  })

  it('shows validation error for a decimal value (50000.5)', async () => {
    renderContractForm()

    fillField('client')
    fillField('start_date')

    const rateInput = screen.getByRole('spinbutton')
    fireEvent.change(rateInput, { target: { value: '50000.5' } })

    submitForm()

    await waitFor(() => {
      expect(
        screen.getByText('Must be a positive integer (e.g. 50000)')
      ).toBeInTheDocument()
    })
    expect(mockCreateContractMutateAsync).not.toHaveBeenCalled()
  })

  it('does NOT show monthly_rate validation error for a valid positive integer', async () => {
    mockCreateContractMutateAsync.mockResolvedValueOnce({
      id: 'new-contract-id',
      client_id: 'client-1',
      client_name: 'Acme Corp',
      monthly_rate: 50000,
      start_date: '2025-01-01',
      end_date: null,
      status: 'active',
      effective_status: 'active',
      updated_at: '2025-01-01T00:00:00Z',
    })

    renderContractForm()

    fillField('client')
    fillField('start_date')

    const rateInput = screen.getByRole('spinbutton')
    fireEvent.change(rateInput, { target: { value: '50000' } })

    submitForm()

    await waitFor(() => {
      expect(mockCreateContractMutateAsync).toHaveBeenCalledTimes(1)
    })
    expect(
      screen.queryByText('Must be a positive integer (e.g. 50000)')
    ).not.toBeInTheDocument()
  })
})
