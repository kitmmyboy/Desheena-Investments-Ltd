/**
 * Property-based tests for ContractsPage component.
 * Validates: Requirements 4.1, 4.5, 5.1, 5.4, 5.5, 6.3, 11.2
 */

// Feature: contracts-management-page, Property 8: Edit action visibility matches effective status
// Feature: contracts-management-page, Property 9: Change Status action visibility matches effective status
// Feature: contracts-management-page, Property 13: CSV export contains exactly the visible contracts

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import * as fc from 'fast-check'
import React from 'react'
import ContractsPage from './ContractsPage'
import type { ContractRow } from './types'

// ---------------------------------------------------------------------------
// Mock Supabase
// ---------------------------------------------------------------------------

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}))

// ---------------------------------------------------------------------------
// Mock react-router-dom
// ---------------------------------------------------------------------------

vi.mock('react-router-dom', () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) =>
    React.createElement('a', { href: to }, children),
  useSearchParams: () => [new URLSearchParams(), vi.fn()],
}))

// ---------------------------------------------------------------------------
// Mock downloadCsv
// ---------------------------------------------------------------------------

const mockDownloadCsv = vi.fn()

vi.mock('../../lib/exportCsv', () => ({
  downloadCsv: (...args: unknown[]) => mockDownloadCsv(...args),
}))

// ---------------------------------------------------------------------------
// Mock useContractMutations
// ---------------------------------------------------------------------------

vi.mock('./useContractMutations', () => ({
  useContractMutations: () => ({
    createContract: { mutateAsync: vi.fn(), isPending: false, error: null },
    updateContract: { mutateAsync: vi.fn(), isPending: false, error: null },
    updateStatus: { mutate: vi.fn(), isPending: false, error: null },
    terminateContract: { mutateAsync: vi.fn(), isPending: false, error: null },
  }),
}))

// ---------------------------------------------------------------------------
// Mock useContractsPage — controlled via a module-level variable
// ---------------------------------------------------------------------------

let mockContractsData: ContractRow[] = []
let mockContractsCount = 0

vi.mock('./useContractsPage', () => ({
  useContractsPage: () => ({
    data: mockContractsData,
    count: mockContractsCount,
    isLoading: false,
    error: null,
  }),
}))

// ---------------------------------------------------------------------------
// Helper: build a minimal ContractRow
// ---------------------------------------------------------------------------

function makeContractRow(
  overrides: Partial<ContractRow> & { effective_status: ContractRow['effective_status'] }
): ContractRow {
  return {
    id: 'contract-1',
    client_id: 'client-1',
    client_name: 'Test Client',
    monthly_rate: 50000,
    start_date: '2024-01-01',
    end_date: null,
    status: 'active',
    updated_at: '2024-01-01T00:00:00Z',
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Helper: render ContractsPage with given contracts
// ---------------------------------------------------------------------------

function renderPage(contracts: ContractRow[]) {
  mockContractsData = contracts
  mockContractsCount = contracts.length
  return render(React.createElement(ContractsPage))
}

// ---------------------------------------------------------------------------
// Property 8: Edit action visibility matches effective status
// ---------------------------------------------------------------------------

describe('Property 8: Edit action visibility matches effective status', () => {
  // Feature: contracts-management-page, Property 8: Edit action visibility matches effective status
  // Validates: Requirements 4.1, 4.5, 6.3

  beforeEach(() => {
    vi.clearAllMocks()
    mockContractsData = []
    mockContractsCount = 0
  })

  it('Edit button is present iff effective_status is not terminated and not ended', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          effective_status: fc.constantFrom(
            'active' as const,
            'suspended' as const,
            'terminated' as const,
            'ended' as const
          ),
        }),
        async ({ effective_status }) => {
          const contract = makeContractRow({
            effective_status,
            status:
              effective_status === 'ended'
                ? 'active'
                : (effective_status as 'active' | 'suspended' | 'terminated'),
          })

          renderPage([contract])

          const editButton = screen.queryByRole('button', {
            name: /edit contract for test client/i,
          })

          const shouldBeVisible =
            effective_status !== 'terminated' && effective_status !== 'ended'

          if (shouldBeVisible) {
            expect(editButton).not.toBeNull()
          } else {
            expect(editButton).toBeNull()
          }

          cleanup()
        }
      ),
      { numRuns: 50 }
    )
  })
})

// ---------------------------------------------------------------------------
// Property 9: Change Status action visibility matches effective status
// ---------------------------------------------------------------------------

describe('Property 9: Change Status action visibility matches effective status', () => {
  // Feature: contracts-management-page, Property 9: Change Status action visibility matches effective status
  // Validates: Requirements 5.1, 5.4, 5.5, 6.3

  beforeEach(() => {
    vi.clearAllMocks()
    mockContractsData = []
    mockContractsCount = 0
  })

  it('Suspend or Resume button is present iff effective_status is active or suspended', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          effective_status: fc.constantFrom(
            'active' as const,
            'suspended' as const,
            'terminated' as const,
            'ended' as const
          ),
        }),
        async ({ effective_status }) => {
          const contract = makeContractRow({
            effective_status,
            status:
              effective_status === 'ended'
                ? 'active'
                : (effective_status as 'active' | 'suspended' | 'terminated'),
          })

          renderPage([contract])

          const suspendButton = screen.queryByRole('button', {
            name: /suspend contract for/i,
          })
          const resumeButton = screen.queryByRole('button', {
            name: /resume contract for/i,
          })

          const hasChangeStatusButton = suspendButton !== null || resumeButton !== null
          const shouldHaveChangeStatus =
            effective_status === 'active' || effective_status === 'suspended'

          expect(hasChangeStatusButton).toBe(shouldHaveChangeStatus)

          if (effective_status === 'active') {
            expect(suspendButton).not.toBeNull()
            expect(resumeButton).toBeNull()
          } else if (effective_status === 'suspended') {
            expect(resumeButton).not.toBeNull()
            expect(suspendButton).toBeNull()
          }

          cleanup()
        }
      ),
      { numRuns: 50 }
    )
  })
})

// ---------------------------------------------------------------------------
// Property 13: CSV export contains exactly the visible contracts
// ---------------------------------------------------------------------------

describe('Property 13: CSV export contains exactly the visible contracts', () => {
  // Feature: contracts-management-page, Property 13: CSV export contains exactly the visible contracts
  // Validates: Requirements 11.2

  beforeEach(() => {
    vi.clearAllMocks()
    mockContractsData = []
    mockContractsCount = 0
  })

  it('downloadCsv is called with rows matching the visible contracts', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            client_name: fc.string({ minLength: 1, maxLength: 30 }),
            monthly_rate: fc.integer({ min: 1 }),
            start_date: fc.constant('2024-01-01'),
            end_date: fc.option(fc.constant('2025-01-01'), { nil: null }),
            effective_status: fc.constantFrom(
              'active' as const,
              'suspended' as const,
              'terminated' as const,
              'ended' as const
            ),
          }),
          { minLength: 1, maxLength: 10 }
        ),
        async (contractInputs) => {
          const contracts: ContractRow[] = contractInputs.map((input, i) => ({
            id: `contract-${i}`,
            client_id: `client-${i}`,
            client_name: input.client_name,
            monthly_rate: input.monthly_rate,
            start_date: input.start_date,
            end_date: input.end_date,
            status:
              input.effective_status === 'ended'
                ? 'active'
                : (input.effective_status as 'active' | 'suspended' | 'terminated'),
            effective_status: input.effective_status,
            updated_at: '2024-01-01T00:00:00Z',
          }))

          renderPage(contracts)

          const exportButton = screen.getByRole('button', { name: /export csv/i })
          fireEvent.click(exportButton)

          expect(mockDownloadCsv).toHaveBeenCalledTimes(1)

          const [filename, rows] = mockDownloadCsv.mock.calls[0] as [
            string,
            (string | number | null | undefined)[][]
          ]

          expect(filename).toBe('contracts.csv')

          const [header, ...dataRows] = rows

          expect(header).toContain('Client Name')
          expect(header).toContain('Monthly Rate (UGX)')
          expect(header).toContain('Start Date')
          expect(header).toContain('End Date')
          expect(header).toContain('Status')

          expect(dataRows).toHaveLength(contracts.length)

          for (let i = 0; i < contracts.length; i++) {
            expect(dataRows[i][0]).toBe(contracts[i].client_name)
          }

          cleanup()
          vi.clearAllMocks()
        }
      ),
      { numRuns: 30 }
    )
  })
})
