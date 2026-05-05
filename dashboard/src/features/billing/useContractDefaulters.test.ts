/**
 * Tests for useContractDefaulters hook logic.
 * Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 7.1, 8.1, 8.4, 10.5
 */
import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import {
  computeContractMonths,
  computeExpectedTotal,
  computeOutstandingBalance,
  computeMonthBreakdown,
  computeEffectiveStatus,
  type MonthBreakdown,
} from './contractCalculations'

// ---------------------------------------------------------------------------
// Types mirroring ContractDefaulter (for testing the pure logic)
// ---------------------------------------------------------------------------

interface ContractRow {
  id: string
  client_id: string
  monthly_rate: number | null
  start_date: string
  end_date: string | null
  status: 'active' | 'suspended' | 'terminated'
  updated_at: string
  client_name: string
  client_phone: string
}

interface InvoiceRow {
  contract_id: string
  invoice_period: string | null
  paid_amount: number
}

interface ContractDefaulter {
  client_id: string
  client_name: string
  client_phone: string
  contract_id: string
  monthly_rate: number
  contract_status: 'active' | 'suspended' | 'terminated'
  end_date: string | null
  updated_at: string
  expected_total: number
  amount_paid: number
  outstanding_balance: number
  months_unpaid: number
  defaulter_category: 'active' | 'ended'
  month_breakdown: MonthBreakdown[]
}

// ---------------------------------------------------------------------------
// Helper: mirrors the transformation logic in useContractDefaulters queryFn
// ---------------------------------------------------------------------------

function computeDefaulters(
  contracts: ContractRow[],
  invoices: InvoiceRow[],
  today: Date = new Date()
): ContractDefaulter[] {
  const defaulters: ContractDefaulter[] = []

  for (const row of contracts) {
    const monthlyRate = row.monthly_rate ?? 0

    // Skip contracts with no monthly rate
    if (!monthlyRate) continue

    const contractMonths = computeContractMonths(row.start_date, row.end_date)
    const contractInvoices = invoices.filter((inv) => inv.contract_id === row.id)

    const expectedTotal = computeExpectedTotal(contractMonths, monthlyRate)
    const amountPaid = contractInvoices.reduce((sum, inv) => sum + (inv.paid_amount ?? 0), 0)
    const outstandingBalance = computeOutstandingBalance(expectedTotal, amountPaid)

    // Skip clients with no outstanding balance
    if (outstandingBalance <= 0) continue

    const monthBreakdown = computeMonthBreakdown(contractMonths, monthlyRate, contractInvoices)
    const monthsUnpaid = monthBreakdown.filter((b) => b.status !== 'paid').length

    const effectiveStatus = computeEffectiveStatus(row.status, row.end_date, today)
    const defaulterCategory: 'active' | 'ended' =
      effectiveStatus === 'active' ? 'active' : 'ended'

    defaulters.push({
      client_id: row.client_id,
      client_name: row.client_name,
      client_phone: row.client_phone,
      contract_id: row.id,
      monthly_rate: monthlyRate,
      contract_status: row.status,
      end_date: row.end_date,
      updated_at: row.updated_at,
      expected_total: expectedTotal,
      amount_paid: amountPaid,
      outstanding_balance: outstandingBalance,
      months_unpaid: monthsUnpaid,
      defaulter_category: defaulterCategory,
      month_breakdown: monthBreakdown,
    })
  }

  return defaulters.sort((a, b) => b.outstanding_balance - a.outstanding_balance)
}

// ---------------------------------------------------------------------------
// Test data helpers
// ---------------------------------------------------------------------------

const TODAY = new Date('2025-07-01')

function makeContract(overrides: Partial<ContractRow> = {}): ContractRow {
  return {
    id: 'contract-1',
    client_id: 'client-1',
    client_name: 'Test Client',
    client_phone: '+256700000000',
    monthly_rate: 50000,
    start_date: '2025-01',
    end_date: null,
    status: 'active',
    updated_at: '2025-01-01T00:00:00Z',
    ...overrides,
  }
}

function makeInvoice(overrides: Partial<InvoiceRow> = {}): InvoiceRow {
  return {
    contract_id: 'contract-1',
    invoice_period: '2025-01',
    paid_amount: 0,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Property-based tests
// ---------------------------------------------------------------------------

// Feature: billing-contract-defaulters, Property 3: defaulter_category is mutually exclusive
describe('Property 3: Defaulter category assignment is mutually exclusive', () => {
  it('every defaulter has defaulter_category of exactly "active" or "ended", never both', () => {
    const validStatuses = ['active', 'suspended', 'terminated'] as const

    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.uuid(),
            client_id: fc.uuid(),
            client_name: fc.string({ minLength: 1, maxLength: 20 }),
            client_phone: fc.string({ minLength: 1, maxLength: 15 }),
            monthly_rate: fc.integer({ min: 1000, max: 500000 }),
            // start_date: 2020-01 to 2024-12
            start_date: fc
              .tuple(
                fc.integer({ min: 2020, max: 2024 }),
                fc.integer({ min: 1, max: 12 })
              )
              .map(([y, m]) => `${y}-${String(m).padStart(2, '0')}`),
            // end_date: null, past (before 2025-07-01), or future
            end_date: fc.oneof(
              fc.constant(null),
              // Past end_date
              fc
                .tuple(
                  fc.integer({ min: 2020, max: 2025 }),
                  fc.integer({ min: 1, max: 6 })
                )
                .map(([y, m]) => `${y}-${String(m).padStart(2, '0')}`),
              // Future end_date
              fc
                .tuple(
                  fc.integer({ min: 2025, max: 2030 }),
                  fc.integer({ min: 8, max: 12 })
                )
                .map(([y, m]) => `${y}-${String(m).padStart(2, '0')}`)
            ),
            status: fc.constantFrom(...validStatuses),
            updated_at: fc.constant('2025-01-01T00:00:00Z'),
          }),
          { minLength: 1, maxLength: 10 }
        ),
        (contracts) => {
          // No invoices → all contracts will have outstanding balance > 0
          const defaulters = computeDefaulters(contracts, [], TODAY)

          return defaulters.every(
            (d) =>
              (d.defaulter_category === 'active' || d.defaulter_category === 'ended') &&
              // Verify mutual exclusivity: category is exactly one value
              !(d.defaulter_category === 'active' && d.defaulter_category === 'ended')
          )
        }
      ),
      { numRuns: 100 }
    )
  })

  it('defaulter_category is "active" iff effective_status is "active"', () => {
    const validStatuses = ['active', 'suspended', 'terminated'] as const

    fc.assert(
      fc.property(
        fc.constantFrom(...validStatuses),
        fc.oneof(
          fc.constant(null),
          // Past end_date
          fc
            .tuple(fc.integer({ min: 2020, max: 2025 }), fc.integer({ min: 1, max: 6 }))
            .map(([y, m]) => `${y}-${String(m).padStart(2, '0')}`),
          // Future end_date
          fc
            .tuple(fc.integer({ min: 2025, max: 2030 }), fc.integer({ min: 8, max: 12 }))
            .map(([y, m]) => `${y}-${String(m).padStart(2, '0')}`)
        ),
        (status, endDate) => {
          const contract = makeContract({ status, end_date: endDate, start_date: '2025-01' })
          const defaulters = computeDefaulters([contract], [], TODAY)

          if (defaulters.length === 0) return true // no outstanding balance, skip

          const effectiveStatus = computeEffectiveStatus(status, endDate, TODAY)
          const expectedCategory = effectiveStatus === 'active' ? 'active' : 'ended'

          return defaulters[0].defaulter_category === expectedCategory
        }
      ),
      { numRuns: 100 }
    )
  })
})

// Feature: billing-contract-defaulters, Property 6: zero_balance_excluded
describe('Property 6: Zero-balance clients are excluded from defaulters', () => {
  it('clients with amount_paid >= expected_total do not appear in defaulters', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 1_000_000 }),  // monthly_rate
        fc.integer({ min: 1, max: 12 }),           // number of months
        (monthlyRate, numMonths) => {
          // Build a contract spanning numMonths months starting from 2024-01
          const startYear = 2024
          const startMonth = 1
          const endMonthTotal = startMonth + numMonths - 1
          const endYear = startYear + Math.floor((endMonthTotal - 1) / 12)
          const endMonth = ((endMonthTotal - 1) % 12) + 1
          const startDate = `${startYear}-${String(startMonth).padStart(2, '0')}`
          const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}`

          const contract = makeContract({
            id: 'contract-zero',
            client_id: 'client-zero',
            monthly_rate: monthlyRate,
            start_date: startDate,
            end_date: endDate,
          })

          const contractMonths = computeContractMonths(startDate, endDate)
          const expectedTotal = computeExpectedTotal(contractMonths, monthlyRate)

          // Create invoices that fully cover the expected total
          // Distribute payment evenly across months
          const invoices: InvoiceRow[] = contractMonths.map((month) => ({
            contract_id: 'contract-zero',
            invoice_period: month,
            paid_amount: monthlyRate, // fully paid each month
          }))

          const defaulters = computeDefaulters([contract], invoices, TODAY)

          // The fully-paid client should NOT appear in defaulters
          return !defaulters.some((d) => d.client_id === 'client-zero')
        }
      ),
      { numRuns: 100 }
    )
  })

  it('clients with amount_paid > expected_total (overpaid) are also excluded', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100_000 }),  // monthly_rate
        fc.integer({ min: 1, max: 6 }),          // number of months
        fc.integer({ min: 1, max: 100_000 }),   // extra payment
        (monthlyRate, numMonths, extraPayment) => {
          const startDate = '2024-01'
          const endMonthTotal = numMonths
          const endYear = 2024 + Math.floor((endMonthTotal - 1) / 12)
          const endMonth = ((endMonthTotal - 1) % 12) + 1
          const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}`

          const contract = makeContract({
            id: 'contract-overpaid',
            client_id: 'client-overpaid',
            monthly_rate: monthlyRate,
            start_date: startDate,
            end_date: endDate,
          })

          const contractMonths = computeContractMonths(startDate, endDate)
          const expectedTotal = computeExpectedTotal(contractMonths, monthlyRate)

          // One invoice that pays more than expected total
          const invoices: InvoiceRow[] = [
            {
              contract_id: 'contract-overpaid',
              invoice_period: contractMonths[0],
              paid_amount: expectedTotal + extraPayment,
            },
          ]

          const defaulters = computeDefaulters([contract], invoices, TODAY)

          return !defaulters.some((d) => d.client_id === 'client-overpaid')
        }
      ),
      { numRuns: 100 }
    )
  })
})

// ---------------------------------------------------------------------------
// Unit tests (4.3)
// ---------------------------------------------------------------------------

describe('useContractDefaulters logic', () => {
  // -------------------------------------------------------------------------
  // Requirement 6.6: clients with outstanding_balance <= 0 are excluded
  // -------------------------------------------------------------------------

  describe('zero-balance exclusion', () => {
    // Validates: Requirement 6.6
    it('excludes clients with outstanding_balance === 0 (fully paid)', () => {
      const contract = makeContract({
        id: 'c1',
        client_id: 'client-1',
        monthly_rate: 50000,
        start_date: '2025-01',
        end_date: '2025-03',
      })

      // Fully paid: 3 months × 50,000 = 150,000
      const invoices: InvoiceRow[] = [
        makeInvoice({ contract_id: 'c1', invoice_period: '2025-01', paid_amount: 50000 }),
        makeInvoice({ contract_id: 'c1', invoice_period: '2025-02', paid_amount: 50000 }),
        makeInvoice({ contract_id: 'c1', invoice_period: '2025-03', paid_amount: 50000 }),
      ]

      const defaulters = computeDefaulters([contract], invoices, TODAY)
      expect(defaulters).toHaveLength(0)
    })

    it('excludes clients with outstanding_balance < 0 (overpaid)', () => {
      const contract = makeContract({
        id: 'c1',
        client_id: 'client-1',
        monthly_rate: 50000,
        start_date: '2025-01',
        end_date: '2025-01',
      })

      // Overpaid: paid 60,000 for a 50,000 contract
      const invoices: InvoiceRow[] = [
        makeInvoice({ contract_id: 'c1', invoice_period: '2025-01', paid_amount: 60000 }),
      ]

      const defaulters = computeDefaulters([contract], invoices, TODAY)
      expect(defaulters).toHaveLength(0)
    })

    it('includes clients with outstanding_balance > 0', () => {
      const contract = makeContract({
        id: 'c1',
        client_id: 'client-1',
        monthly_rate: 50000,
        start_date: '2025-01',
        end_date: '2025-03',
      })

      // Partially paid: only 1 of 3 months paid
      const invoices: InvoiceRow[] = [
        makeInvoice({ contract_id: 'c1', invoice_period: '2025-01', paid_amount: 50000 }),
      ]

      const defaulters = computeDefaulters([contract], invoices, TODAY)
      expect(defaulters).toHaveLength(1)
      expect(defaulters[0].outstanding_balance).toBe(100000)
    })

    it('excludes contracts with null monthly_rate', () => {
      const contract = makeContract({
        id: 'c1',
        client_id: 'client-1',
        monthly_rate: null as unknown as number,
      })

      const defaulters = computeDefaulters([contract], [], TODAY)
      expect(defaulters).toHaveLength(0)
    })

    it('excludes contracts with monthly_rate of 0', () => {
      const contract = makeContract({
        id: 'c1',
        client_id: 'client-1',
        monthly_rate: 0,
      })

      const defaulters = computeDefaulters([contract], [], TODAY)
      expect(defaulters).toHaveLength(0)
    })
  })

  // -------------------------------------------------------------------------
  // Requirement 7.1 / 8.1: defaulter_category assignment
  // -------------------------------------------------------------------------

  describe('defaulter_category assignment', () => {
    // Validates: Requirements 7.1, 8.1
    it('assigns "active" category for active contracts with no end_date', () => {
      const contract = makeContract({
        id: 'c1',
        client_id: 'client-1',
        status: 'active',
        end_date: null,
        monthly_rate: 50000,
        start_date: '2025-01',
      })

      const defaulters = computeDefaulters([contract], [], TODAY)
      expect(defaulters).toHaveLength(1)
      expect(defaulters[0].defaulter_category).toBe('active')
    })

    it('assigns "active" category for active contracts with future end_date', () => {
      const contract = makeContract({
        id: 'c1',
        client_id: 'client-1',
        status: 'active',
        end_date: '2025-12',
        monthly_rate: 50000,
        start_date: '2025-01',
      })

      const defaulters = computeDefaulters([contract], [], TODAY)
      expect(defaulters).toHaveLength(1)
      expect(defaulters[0].defaulter_category).toBe('active')
    })

    it('assigns "ended" category for terminated contracts', () => {
      // Validates: Requirement 8.1
      const contract = makeContract({
        id: 'c1',
        client_id: 'client-1',
        status: 'terminated',
        end_date: null,
        monthly_rate: 50000,
        start_date: '2025-01',
      })

      const defaulters = computeDefaulters([contract], [], TODAY)
      expect(defaulters).toHaveLength(1)
      expect(defaulters[0].defaulter_category).toBe('ended')
    })

    it('assigns "ended" category for suspended contracts', () => {
      const contract = makeContract({
        id: 'c1',
        client_id: 'client-1',
        status: 'suspended',
        end_date: null,
        monthly_rate: 50000,
        start_date: '2025-01',
      })

      const defaulters = computeDefaulters([contract], [], TODAY)
      expect(defaulters).toHaveLength(1)
      expect(defaulters[0].defaulter_category).toBe('ended')
    })

    it('assigns "ended" category for active contracts with past end_date', () => {
      const contract = makeContract({
        id: 'c1',
        client_id: 'client-1',
        status: 'active',
        end_date: '2025-03',  // past relative to TODAY (2025-07-01)
        monthly_rate: 50000,
        start_date: '2025-01',
      })

      const defaulters = computeDefaulters([contract], [], TODAY)
      expect(defaulters).toHaveLength(1)
      expect(defaulters[0].defaulter_category).toBe('ended')
    })
  })

  // -------------------------------------------------------------------------
  // Requirement 10.5: month_breakdown is in chronological order
  // -------------------------------------------------------------------------

  describe('month_breakdown chronological order', () => {
    // Validates: Requirement 10.5
    it('month_breakdown is in chronological order from oldest to newest', () => {
      const contract = makeContract({
        id: 'c1',
        client_id: 'client-1',
        monthly_rate: 50000,
        start_date: '2025-01',
        end_date: '2025-06',
      })

      const defaulters = computeDefaulters([contract], [], TODAY)
      expect(defaulters).toHaveLength(1)

      const breakdown = defaulters[0].month_breakdown
      expect(breakdown.length).toBeGreaterThan(0)

      // Verify chronological order
      for (let i = 1; i < breakdown.length; i++) {
        expect(breakdown[i].month >= breakdown[i - 1].month).toBe(true)
      }
    })

    it('month_breakdown starts with the contract start month', () => {
      const contract = makeContract({
        id: 'c1',
        client_id: 'client-1',
        monthly_rate: 50000,
        start_date: '2025-01',
        end_date: '2025-03',
      })

      const defaulters = computeDefaulters([contract], [], TODAY)
      expect(defaulters[0].month_breakdown[0].month).toBe('2025-01')
    })

    it('month_breakdown ends with the contract end month (when in the past)', () => {
      const contract = makeContract({
        id: 'c1',
        client_id: 'client-1',
        monthly_rate: 50000,
        start_date: '2025-01',
        end_date: '2025-03',
      })

      const defaulters = computeDefaulters([contract], [], TODAY)
      const breakdown = defaulters[0].month_breakdown
      expect(breakdown[breakdown.length - 1].month).toBe('2025-03')
    })
  })

  // -------------------------------------------------------------------------
  // Sorting: outstanding_balance descending
  // -------------------------------------------------------------------------

  describe('sorting by outstanding_balance descending', () => {
    it('sorts defaulters by outstanding_balance descending', () => {
      const contracts: ContractRow[] = [
        makeContract({
          id: 'c1',
          client_id: 'client-1',
          monthly_rate: 10000,
          start_date: '2025-01',
          end_date: '2025-01',
        }),
        makeContract({
          id: 'c2',
          client_id: 'client-2',
          monthly_rate: 50000,
          start_date: '2025-01',
          end_date: '2025-01',
        }),
        makeContract({
          id: 'c3',
          client_id: 'client-3',
          monthly_rate: 30000,
          start_date: '2025-01',
          end_date: '2025-01',
        }),
      ]

      const defaulters = computeDefaulters(contracts, [], TODAY)
      expect(defaulters).toHaveLength(3)
      expect(defaulters[0].outstanding_balance).toBe(50000)
      expect(defaulters[1].outstanding_balance).toBe(30000)
      expect(defaulters[2].outstanding_balance).toBe(10000)
    })
  })

  // -------------------------------------------------------------------------
  // months_unpaid calculation
  // -------------------------------------------------------------------------

  describe('months_unpaid calculation', () => {
    it('counts months where status is not "paid"', () => {
      const contract = makeContract({
        id: 'c1',
        client_id: 'client-1',
        monthly_rate: 50000,
        start_date: '2025-01',
        end_date: '2025-03',
      })

      // Pay only January fully
      const invoices: InvoiceRow[] = [
        makeInvoice({ contract_id: 'c1', invoice_period: '2025-01', paid_amount: 50000 }),
        makeInvoice({ contract_id: 'c1', invoice_period: '2025-02', paid_amount: 20000 }), // partial
        // March: no invoice → unpaid
      ]

      const defaulters = computeDefaulters([contract], invoices, TODAY)
      expect(defaulters).toHaveLength(1)
      // Feb (partial) + Mar (unpaid) = 2 months unpaid
      expect(defaulters[0].months_unpaid).toBe(2)
    })
  })
})
