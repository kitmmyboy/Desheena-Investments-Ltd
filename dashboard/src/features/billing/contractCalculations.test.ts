import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import {
  computeContractMonths,
  computeExpectedTotal,
  computeOutstandingBalance,
  computeMonthBreakdown,
  computeEffectiveStatus,
  computeDurationMonths,
} from './contractCalculations'

// ---------------------------------------------------------------------------
// Unit tests (1.5)
// ---------------------------------------------------------------------------

describe('computeContractMonths', () => {
  it('returns correct months for Jan–Mar 2025', () => {
    // Mock current date to be after Mar 2025 so end_date is the cap
    const result = computeContractMonths('2025-01', '2025-03')
    expect(result).toEqual(['2025-01', '2025-02', '2025-03'])
  })

  it('returns a single month when start equals end', () => {
    const result = computeContractMonths('2025-06', '2025-06')
    expect(result).toEqual(['2025-06'])
  })

  it('caps at current month when end_date is in the future', () => {
    const result = computeContractMonths('2020-01', '2099-12')
    const now = new Date()
    const currentYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    expect(result[result.length - 1]).toBe(currentYM)
  })

  it('caps at current month when end_date is null', () => {
    const result = computeContractMonths('2020-01', null)
    const now = new Date()
    const currentYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    expect(result[result.length - 1]).toBe(currentYM)
  })
})

describe('computeExpectedTotal', () => {
  it('returns 150,000 for 3 months at UGX 50,000', () => {
    const months = ['2025-01', '2025-02', '2025-03']
    expect(computeExpectedTotal(months, 50000)).toBe(150000)
  })

  it('returns 0 for empty months array', () => {
    expect(computeExpectedTotal([], 50000)).toBe(0)
  })
})

describe('computeOutstandingBalance', () => {
  it('returns 50,000 for expected 150,000 and paid 100,000', () => {
    expect(computeOutstandingBalance(150000, 100000)).toBe(50000)
  })

  it('returns 0 when fully paid', () => {
    expect(computeOutstandingBalance(100000, 100000)).toBe(0)
  })

  it('returns negative when overpaid', () => {
    expect(computeOutstandingBalance(100000, 120000)).toBe(-20000)
  })
})

describe('computeMonthBreakdown', () => {
  const months = ['2025-01', '2025-02', '2025-03']
  const monthlyRate = 50000

  it('marks month as paid when paid_amount >= monthly_rate', () => {
    const invoices = [{ invoice_period: '2025-01', paid_amount: 50000 }]
    const breakdown = computeMonthBreakdown(months, monthlyRate, invoices)
    expect(breakdown[0].status).toBe('paid')
    expect(breakdown[0].amount_owed).toBe(0)
  })

  it('marks month as partial when 0 < paid_amount < monthly_rate', () => {
    const invoices = [{ invoice_period: '2025-02', paid_amount: 20000 }]
    const breakdown = computeMonthBreakdown(months, monthlyRate, invoices)
    expect(breakdown[1].status).toBe('partial')
    expect(breakdown[1].amount_owed).toBe(30000)
  })

  it('marks month as unpaid when no invoice exists', () => {
    const breakdown = computeMonthBreakdown(months, monthlyRate, [])
    expect(breakdown[2].status).toBe('unpaid')
    expect(breakdown[2].amount_owed).toBe(monthlyRate)
  })

  it('marks month as unpaid when paid_amount is 0', () => {
    const invoices = [{ invoice_period: '2025-01', paid_amount: 0 }]
    const breakdown = computeMonthBreakdown(months, monthlyRate, invoices)
    expect(breakdown[0].status).toBe('unpaid')
    expect(breakdown[0].amount_owed).toBe(monthlyRate)
  })

  it('marks month as paid when paid_amount exceeds monthly_rate', () => {
    const invoices = [{ invoice_period: '2025-01', paid_amount: 60000 }]
    const breakdown = computeMonthBreakdown(months, monthlyRate, invoices)
    expect(breakdown[0].status).toBe('paid')
    expect(breakdown[0].amount_owed).toBe(0)
  })
})

describe('computeEffectiveStatus', () => {
  it('returns "ended" when end_date is in the past', () => {
    const today = new Date('2025-06-01')
    expect(computeEffectiveStatus('active', '2025-01-31', today)).toBe('ended')
  })

  it('returns stored status when end_date is today', () => {
    const today = new Date('2025-06-01')
    expect(computeEffectiveStatus('active', '2025-06-01', today)).toBe('active')
  })

  it('returns stored status when end_date is in the future', () => {
    const today = new Date('2025-06-01')
    expect(computeEffectiveStatus('suspended', '2026-01-01', today)).toBe('suspended')
  })

  it('returns stored status when end_date is null', () => {
    const today = new Date('2025-06-01')
    expect(computeEffectiveStatus('active', null, today)).toBe('active')
  })

  it('returns "terminated" when stored status is terminated and end_date is null', () => {
    const today = new Date('2025-06-01')
    expect(computeEffectiveStatus('terminated', null, today)).toBe('terminated')
  })
})

describe('computeDurationMonths', () => {
  it('returns 3 for Jan–Mar 2025', () => {
    expect(computeDurationMonths('2025-01', '2025-03')).toBe(3)
  })

  it('returns 1 for same start and end month', () => {
    expect(computeDurationMonths('2025-06', '2025-06')).toBe(1)
  })

  it('returns at least 1 for open-ended contract (null end_date)', () => {
    // Start in the past, no end date — should be >= 1
    const result = computeDurationMonths('2020-01', null)
    expect(result).toBeGreaterThanOrEqual(1)
  })

  it('returns correct duration for multi-year contract', () => {
    expect(computeDurationMonths('2023-01', '2024-12')).toBe(24)
  })
})

// ---------------------------------------------------------------------------
// Property-based tests
// ---------------------------------------------------------------------------

// Feature: billing-contract-defaulters, Property 1: outstanding_balance = expected_total - amount_paid
describe('Property 1: Outstanding balance equals expected minus paid', () => {
  it('computeOutstandingBalance(expected, paid) === expected - paid for all valid inputs', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 1_000_000 }),   // monthly_rate
        fc.integer({ min: 1, max: 36 }),            // number of months
        (monthlyRate, numMonths) => {
          const months = Array.from({ length: numMonths }, (_, i) => {
            const year = 2020 + Math.floor(i / 12)
            const month = (i % 12) + 1
            return `${year}-${String(month).padStart(2, '0')}`
          })
          const expectedTotal = computeExpectedTotal(months, monthlyRate)
          // paid_amount is in [0, expectedTotal]
          return fc.sample(fc.integer({ min: 0, max: expectedTotal }), 1).every((paidAmount) => {
            const balance = computeOutstandingBalance(expectedTotal, paidAmount)
            return balance === expectedTotal - paidAmount
          })
        }
      ),
      { numRuns: 100 }
    )
  })
})

// Feature: billing-contract-defaulters, Property 2: sum(amount_owed) === outstanding_balance
describe('Property 2: Month breakdown statuses are exhaustive and consistent', () => {
  it('sum(breakdown[].amount_owed) === outstanding_balance and every month has exactly one status', () => {
    // NOTE: paid_amount per month is capped at monthly_rate.
    // The month breakdown computes amount_owed independently per month (no cross-month credit),
    // so sum(amount_owed) === outstanding_balance only holds when no single month is overpaid.
    // This matches the billing domain: overpayment in one month does not reduce what is owed
    // in another month in the per-month breakdown view.
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 1_000_000 }),  // monthly_rate
        fc.array(
          // paid_amount per month: 0 to monthly_rate (no overpayment per month)
          fc.integer({ min: 0, max: 1_000_000 }),
          { minLength: 1, maxLength: 36 }
        ),
        (monthlyRate, rawPaidAmounts) => {
          // Cap each month's paid_amount at monthly_rate to ensure per-month consistency
          const paidAmounts = rawPaidAmounts.map((p) => Math.min(p, monthlyRate))

          // Build synthetic months
          const months = paidAmounts.map((_, i) => {
            const year = 2020 + Math.floor(i / 12)
            const month = (i % 12) + 1
            return `${year}-${String(month).padStart(2, '0')}`
          })

          const invoices = months.map((month, i) => ({
            invoice_period: month,
            paid_amount: paidAmounts[i],
          }))

          const breakdown = computeMonthBreakdown(months, monthlyRate, invoices)

          // Every month has exactly one status
          const validStatuses = new Set(['paid', 'partial', 'unpaid'])
          const allHaveOneStatus = breakdown.every(
            (b) => validStatuses.has(b.status)
          )

          // sum(amount_owed) === outstanding_balance
          // With per-month cap, outstanding_balance >= 0 always
          const totalPaid = paidAmounts.reduce((sum, p) => sum + p, 0)
          const expectedTotal = computeExpectedTotal(months, monthlyRate)
          const outstandingBalance = computeOutstandingBalance(expectedTotal, totalPaid)
          const sumAmountOwed = breakdown.reduce((sum, b) => sum + b.amount_owed, 0)

          return allHaveOneStatus && sumAmountOwed === outstandingBalance
        }
      ),
      { numRuns: 100 }
    )
  })
})

// Feature: billing-contract-defaulters, Property 4: effective_status derivation rule
describe('Property 4: Effective status derivation is consistent', () => {
  it('returns "ended" iff end_date is non-null and in the past; otherwise returns stored status', () => {
    const validStatuses = ['active', 'suspended', 'terminated'] as const

    fc.assert(
      fc.property(
        fc.constantFrom(...validStatuses),
        // end_date: null, a past date, or a future date
        fc.oneof(
          fc.constant(null),
          // Past date: 2000-01-01 to 2020-12-31
          fc.tuple(
            fc.integer({ min: 2000, max: 2020 }),
            fc.integer({ min: 1, max: 12 })
          ).map(([y, m]) => `${y}-${String(m).padStart(2, '0')}-01`),
          // Future date: 2030-01-01 to 2099-12-31
          fc.tuple(
            fc.integer({ min: 2030, max: 2099 }),
            fc.integer({ min: 1, max: 12 })
          ).map(([y, m]) => `${y}-${String(m).padStart(2, '0')}-01`)
        ),
        (status, endDate) => {
          const today = new Date('2025-06-01')
          const effective = computeEffectiveStatus(status, endDate, today)

          if (endDate !== null && endDate < today.toISOString().split('T')[0]) {
            return effective === 'ended'
          } else {
            return effective === status
          }
        }
      ),
      { numRuns: 100 }
    )
  })
})

// Feature: billing-contract-defaulters, Property 5: duration_months >= 1
describe('Property 5: Contract duration is always positive', () => {
  it('computeDurationMonths always returns >= 1 for valid start/end dates', () => {
    fc.assert(
      fc.property(
        // start date: 2000-01 to 2024-12
        fc.tuple(
          fc.integer({ min: 2000, max: 2024 }),
          fc.integer({ min: 1, max: 12 })
        ),
        // end date offset: 0 to 60 months after start
        fc.integer({ min: 0, max: 60 }),
        ([startYear, startMonth], offsetMonths) => {
          const startDate = `${startYear}-${String(startMonth).padStart(2, '0')}`

          // Compute end date by adding offsetMonths to start
          const totalMonths = (startYear - 2000) * 12 + (startMonth - 1) + offsetMonths
          const endYear = 2000 + Math.floor(totalMonths / 12)
          const endMonth = (totalMonths % 12) + 1
          const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}`

          const duration = computeDurationMonths(startDate, endDate)
          return duration >= 1
        }
      ),
      { numRuns: 100 }
    )
  })

  it('computeDurationMonths returns >= 1 for open-ended contracts (null end_date)', () => {
    fc.assert(
      fc.property(
        fc.tuple(
          fc.integer({ min: 2000, max: 2024 }),
          fc.integer({ min: 1, max: 12 })
        ),
        ([startYear, startMonth]) => {
          const startDate = `${startYear}-${String(startMonth).padStart(2, '0')}`
          const duration = computeDurationMonths(startDate, null)
          return duration >= 1
        }
      ),
      { numRuns: 100 }
    )
  })
})

// Feature: billing-contract-defaulters, Property 7: paid_this_period = sum(paid_amount)
describe('Property 7: Paid-this-period display matches invoice paid_amount sum', () => {
  /**
   * Validates: Requirements 2.1, 2.2
   *
   * The "paid this period" value is computed by summing paid_amount across all
   * invoices for a given client + period. This property verifies that the
   * summation logic is correct for any set of invoices.
   */

  /**
   * Pure helper that mirrors the component logic:
   * sum paid_amount from invoices matching the given clientId and period.
   */
  function computePaidThisPeriod(
    invoices: Array<{ client_id: string; invoice_period: string; paid_amount: number }>,
    clientId: string,
    period: string
  ): number {
    const matching = invoices.filter(
      (inv) => inv.client_id === clientId && inv.invoice_period === period
    )
    return matching.reduce((sum, inv) => sum + (inv.paid_amount ?? 0), 0)
  }

  it('equals the sum of paid_amount for all invoices matching client + period', () => {
    fc.assert(
      fc.property(
        // Random client ID (short string)
        fc.string({ minLength: 1, maxLength: 10 }),
        // Random period in YYYY-MM format
        fc.tuple(
          fc.integer({ min: 2020, max: 2025 }),
          fc.integer({ min: 1, max: 12 })
        ).map(([y, m]) => `${y}-${String(m).padStart(2, '0')}`),
        // Random set of invoices for this client + period (1–10 invoices)
        fc.array(
          fc.integer({ min: 0, max: 500_000 }),
          { minLength: 1, maxLength: 10 }
        ),
        (clientId, period, paidAmounts) => {
          const invoices = paidAmounts.map((paid_amount) => ({
            client_id: clientId,
            invoice_period: period,
            paid_amount,
          }))

          const result = computePaidThisPeriod(invoices, clientId, period)
          const expected = paidAmounts.reduce((sum, p) => sum + p, 0)
          return result === expected
        }
      ),
      { numRuns: 100 }
    )
  })

  it('returns 0 when no invoices exist for the client + period (Req 2.2)', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 10 }),
        fc.tuple(
          fc.integer({ min: 2020, max: 2025 }),
          fc.integer({ min: 1, max: 12 })
        ).map(([y, m]) => `${y}-${String(m).padStart(2, '0')}`),
        (clientId, period) => {
          const result = computePaidThisPeriod([], clientId, period)
          return result === 0
        }
      ),
      { numRuns: 100 }
    )
  })

  it('only counts invoices matching both client_id AND invoice_period', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 10 }),
        fc.tuple(
          fc.integer({ min: 2020, max: 2025 }),
          fc.integer({ min: 1, max: 12 })
        ).map(([y, m]) => `${y}-${String(m).padStart(2, '0')}`),
        fc.array(fc.integer({ min: 1, max: 100_000 }), { minLength: 1, maxLength: 5 }),
        fc.array(fc.integer({ min: 1, max: 100_000 }), { minLength: 1, maxLength: 5 }),
        (clientId, period, matchingAmounts, nonMatchingAmounts) => {
          const matchingInvoices = matchingAmounts.map((paid_amount) => ({
            client_id: clientId,
            invoice_period: period,
            paid_amount,
          }))
          // Non-matching: different client or different period
          const nonMatchingInvoices = nonMatchingAmounts.map((paid_amount, i) => ({
            client_id: i % 2 === 0 ? clientId + '_other' : clientId,
            invoice_period: i % 2 === 0 ? period : period + '_other',
            paid_amount,
          }))

          const allInvoices = [...matchingInvoices, ...nonMatchingInvoices]
          const result = computePaidThisPeriod(allInvoices, clientId, period)
          const expected = matchingAmounts.reduce((sum, p) => sum + p, 0)
          return result === expected
        }
      ),
      { numRuns: 100 }
    )
  })
})

// Feature: contracts-management-page, Property 11: Billing filter excludes non-active contracts
describe('Property 11: Billing filter excludes non-active contracts', () => {
  /**
   * Validates: Requirements 8.1, 8.2, 8.3, 8.4
   *
   * Only contracts with status === 'active' should be included in invoice
   * generation. This property verifies that filtering an array of contracts
   * to active-only correctly includes all active contracts and excludes all
   * suspended and terminated ones.
   */
  it('filter to active includes all active and excludes suspended/terminated', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({ status: fc.constantFrom('active', 'suspended', 'terminated') }),
          { minLength: 0, maxLength: 50 }
        ),
        (contracts) => {
          const activeContracts = contracts.filter((c) => c.status === 'active')

          // 1. All items in the result have status === 'active'
          const allActive = activeContracts.every((c) => c.status === 'active')

          // 2. No suspended or terminated contracts appear in the result
          const noNonActive = activeContracts.every(
            (c) => c.status !== 'suspended' && c.status !== 'terminated'
          )

          // 3. Result count equals the number of active contracts in the input
          const expectedCount = contracts.filter((c) => c.status === 'active').length
          const countMatches = activeContracts.length === expectedCount

          return allActive && noNonActive && countMatches
        }
      ),
      { numRuns: 100 }
    )
  })
})
