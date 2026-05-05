/**
 * Unit tests for useContracts hook filter logic and effective_status derivation.
 * Validates: Requirements 5.3, 5.4, 5.5
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { computeEffectiveStatus, computeDurationMonths } from './contractCalculations'

// ---------------------------------------------------------------------------
// Types mirroring ContractWithClient
// ---------------------------------------------------------------------------

interface ContractRow {
  id: string
  client_id: string
  monthly_rate: number
  start_date: string
  end_date: string | null
  status: 'active' | 'suspended' | 'terminated'
  updated_at: string
  client_name: string
}

interface ContractWithClient extends ContractRow {
  effective_status: 'active' | 'suspended' | 'terminated' | 'ended'
  duration_months: number
}

type ContractStatusFilter = 'all' | 'active' | 'inactive'

// ---------------------------------------------------------------------------
// Helper: mirrors the transformation logic in useContracts queryFn
// ---------------------------------------------------------------------------

function transformAndFilter(
  rows: ContractRow[],
  filter: ContractStatusFilter,
  today: Date = new Date()
): ContractWithClient[] {
  const contracts: ContractWithClient[] = rows.map((row) => ({
    ...row,
    effective_status: computeEffectiveStatus(row.status, row.end_date, today),
    duration_months: computeDurationMonths(row.start_date, row.end_date),
  }))

  if (filter === 'active') {
    return contracts.filter((c) => c.effective_status === 'active')
  }

  if (filter === 'inactive') {
    return contracts.filter(
      (c) =>
        c.effective_status === 'suspended' ||
        c.effective_status === 'terminated' ||
        c.effective_status === 'ended'
    )
  }

  return contracts
}

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const TODAY = new Date('2025-07-01')

const baseContract = (overrides: Partial<ContractRow>): ContractRow => ({
  id: 'contract-1',
  client_id: 'client-1',
  client_name: 'Test Client',
  monthly_rate: 50000,
  start_date: '2025-01-01',
  end_date: null,
  status: 'active',
  updated_at: '2025-01-01T00:00:00Z',
  ...overrides,
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useContracts filter logic', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  // -------------------------------------------------------------------------
  // Filter: 'all'
  // -------------------------------------------------------------------------

  describe("filter: 'all'", () => {
    // Validates: Requirements 5.3
    it('returns all contracts regardless of effective_status', () => {
      const rows: ContractRow[] = [
        baseContract({ id: '1', status: 'active', end_date: null }),
        baseContract({ id: '2', status: 'suspended', end_date: null }),
        baseContract({ id: '3', status: 'terminated', end_date: null }),
        baseContract({ id: '4', status: 'active', end_date: '2025-06-01' }), // past end_date → 'ended'
      ]

      const result = transformAndFilter(rows, 'all', TODAY)
      expect(result).toHaveLength(4)
    })

    it('returns an empty array when there are no contracts', () => {
      const result = transformAndFilter([], 'all', TODAY)
      expect(result).toHaveLength(0)
    })
  })

  // -------------------------------------------------------------------------
  // Filter: 'active'
  // -------------------------------------------------------------------------

  describe("filter: 'active'", () => {
    // Validates: Requirements 5.4
    it('returns only contracts with effective_status === active', () => {
      const rows: ContractRow[] = [
        baseContract({ id: '1', status: 'active', end_date: null }),
        baseContract({ id: '2', status: 'active', end_date: '2025-12-31' }), // future end_date → still active
        baseContract({ id: '3', status: 'suspended', end_date: null }),
        baseContract({ id: '4', status: 'terminated', end_date: null }),
        baseContract({ id: '5', status: 'active', end_date: '2025-06-01' }), // past end_date → 'ended'
      ]

      const result = transformAndFilter(rows, 'active', TODAY)
      expect(result).toHaveLength(2)
      expect(result.every((c) => c.effective_status === 'active')).toBe(true)
      expect(result.map((c) => c.id)).toEqual(expect.arrayContaining(['1', '2']))
    })

    it('returns empty array when no active contracts exist', () => {
      const rows: ContractRow[] = [
        baseContract({ id: '1', status: 'suspended', end_date: null }),
        baseContract({ id: '2', status: 'terminated', end_date: null }),
      ]

      const result = transformAndFilter(rows, 'active', TODAY)
      expect(result).toHaveLength(0)
    })

    it('excludes contracts with past end_date even if stored status is active', () => {
      const rows: ContractRow[] = [
        baseContract({ id: '1', status: 'active', end_date: '2025-06-01' }), // past → 'ended'
      ]

      const result = transformAndFilter(rows, 'active', TODAY)
      expect(result).toHaveLength(0)
    })
  })

  // -------------------------------------------------------------------------
  // Filter: 'inactive'
  // -------------------------------------------------------------------------

  describe("filter: 'inactive'", () => {
    // Validates: Requirements 5.5
    it('returns contracts with effective_status of suspended, terminated, or ended', () => {
      const rows: ContractRow[] = [
        baseContract({ id: '1', status: 'active', end_date: null }),
        baseContract({ id: '2', status: 'suspended', end_date: null }),
        baseContract({ id: '3', status: 'terminated', end_date: null }),
        baseContract({ id: '4', status: 'active', end_date: '2025-06-01' }), // past end_date → 'ended'
      ]

      const result = transformAndFilter(rows, 'inactive', TODAY)
      expect(result).toHaveLength(3)
      expect(result.map((c) => c.id)).toEqual(expect.arrayContaining(['2', '3', '4']))
    })

    it('excludes contracts with effective_status === active', () => {
      const rows: ContractRow[] = [
        baseContract({ id: '1', status: 'active', end_date: null }),
        baseContract({ id: '2', status: 'active', end_date: '2025-12-31' }),
      ]

      const result = transformAndFilter(rows, 'inactive', TODAY)
      expect(result).toHaveLength(0)
    })

    it('includes contracts with past end_date as ended', () => {
      const rows: ContractRow[] = [
        baseContract({ id: '1', status: 'active', end_date: '2024-12-31' }), // past → 'ended'
      ]

      const result = transformAndFilter(rows, 'inactive', TODAY)
      expect(result).toHaveLength(1)
      expect(result[0].effective_status).toBe('ended')
    })
  })

  // -------------------------------------------------------------------------
  // effective_status derivation
  // -------------------------------------------------------------------------

  describe('effective_status derivation', () => {
    // Validates: Requirements 5.3, 5.4, 5.5
    it('derives ended for a contract with a past end_date', () => {
      const rows: ContractRow[] = [
        baseContract({ id: '1', status: 'active', end_date: '2025-06-01' }),
      ]

      const result = transformAndFilter(rows, 'all', TODAY)
      expect(result[0].effective_status).toBe('ended')
    })

    it('preserves stored status when end_date is null', () => {
      const statuses: Array<'active' | 'suspended' | 'terminated'> = [
        'active',
        'suspended',
        'terminated',
      ]

      for (const status of statuses) {
        const rows: ContractRow[] = [baseContract({ id: '1', status, end_date: null })]
        const result = transformAndFilter(rows, 'all', TODAY)
        expect(result[0].effective_status).toBe(status)
      }
    })

    it('preserves stored status when end_date is today or in the future', () => {
      const rows: ContractRow[] = [
        baseContract({ id: '1', status: 'active', end_date: '2025-07-01' }), // today
        baseContract({ id: '2', status: 'active', end_date: '2025-12-31' }), // future
      ]

      const result = transformAndFilter(rows, 'all', TODAY)
      expect(result[0].effective_status).toBe('active')
      expect(result[1].effective_status).toBe('active')
    })

    it('derives ended for a terminated contract with a past end_date', () => {
      const rows: ContractRow[] = [
        baseContract({ id: '1', status: 'terminated', end_date: '2025-03-01' }),
      ]

      const result = transformAndFilter(rows, 'all', TODAY)
      expect(result[0].effective_status).toBe('ended')
    })
  })

  // -------------------------------------------------------------------------
  // duration_months computation
  // -------------------------------------------------------------------------

  describe('duration_months computation', () => {
    it('computes duration for a contract with a defined end_date', () => {
      const rows: ContractRow[] = [
        baseContract({ id: '1', start_date: '2025-01-01', end_date: '2025-03-31' }),
      ]

      const result = transformAndFilter(rows, 'all', TODAY)
      // Jan, Feb, Mar = 3 months
      expect(result[0].duration_months).toBe(3)
    })

    it('computes duration for an open-ended contract up to current month', () => {
      const rows: ContractRow[] = [
        baseContract({ id: '1', start_date: '2025-01-01', end_date: null }),
      ]

      const result = transformAndFilter(rows, 'all', TODAY)
      // For an open-ended contract, duration is from start_date to the actual current month.
      // We just verify it is at least 1 and is a positive integer.
      expect(result[0].duration_months).toBeGreaterThanOrEqual(1)
      expect(Number.isInteger(result[0].duration_months)).toBe(true)
    })

    it('returns at least 1 for a single-month contract', () => {
      const rows: ContractRow[] = [
        baseContract({ id: '1', start_date: '2025-07-01', end_date: '2025-07-31' }),
      ]

      const result = transformAndFilter(rows, 'all', TODAY)
      expect(result[0].duration_months).toBeGreaterThanOrEqual(1)
    })
  })
})
