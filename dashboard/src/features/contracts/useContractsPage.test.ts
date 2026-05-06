/**
 * Property-based tests for useContractsPage hook.
 * Validates: Requirements 2.5, 2.6
 */

// Feature: contracts-management-page, Property 1: Status filter returns only matching contracts

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import * as fc from 'fast-check'
import React from 'react'
import { useContractsPage } from './useContractsPage'
import { computeEffectiveStatus } from '../billing/contractCalculations'

// ---------------------------------------------------------------------------
// Mock Supabase
// ---------------------------------------------------------------------------

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}))

import { supabase } from '../../lib/supabase'

// ---------------------------------------------------------------------------
// Types for raw Supabase rows (before transformation)
// ---------------------------------------------------------------------------

interface RawContractRow {
  id: string
  client_id: string
  monthly_rate: number
  start_date: string
  end_date: string | null
  status: 'active' | 'suspended' | 'terminated'
  updated_at: string
  clients: { name: string } | null
}

// ---------------------------------------------------------------------------
// Helper: build a chainable Supabase query mock that resolves to { data, error, count }
// ---------------------------------------------------------------------------

function buildSupabaseMock(rows: RawContractRow[], count: number) {
  const result = { data: rows, error: null, count }
  // Each chained method returns the same builder; the final awaited value is result
  const builder: Record<string, unknown> = {}
  const chainMethods = ['select', 'ilike', 'eq', 'range', 'order']
  for (const method of chainMethods) {
    builder[method] = vi.fn().mockReturnValue(builder)
  }
  // Make the builder thenable so `await query` resolves to result
  builder.then = (resolve: (v: typeof result) => void) => Promise.resolve(result).then(resolve)
  return builder
}

// ---------------------------------------------------------------------------
// Helper: create a fresh QueryClient for each test
// ---------------------------------------------------------------------------

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  })
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children)
}

// ---------------------------------------------------------------------------
// Arbitrary: generate a raw contract row with a specific stored status
// ---------------------------------------------------------------------------

const rawContractArb = (status: 'active' | 'suspended' | 'terminated') =>
  fc.record({
    id: fc.uuid(),
    client_id: fc.uuid(),
    monthly_rate: fc.integer({ min: 1000, max: 500_000 }),
    start_date: fc
      .tuple(fc.integer({ min: 2020, max: 2024 }), fc.integer({ min: 1, max: 12 }))
      .map(([y, m]) => `${y}-${String(m).padStart(2, '0')}-01`),
    // end_date: null or a future date (so effective_status stays as stored status)
    end_date: fc.oneof(
      fc.constant(null),
      fc
        .tuple(fc.integer({ min: 2030, max: 2099 }), fc.integer({ min: 1, max: 12 }))
        .map(([y, m]) => `${y}-${String(m).padStart(2, '0')}-01`)
    ),
    status: fc.constant(status),
    updated_at: fc.constant('2025-01-01T00:00:00Z'),
    clients: fc.record({ name: fc.string({ minLength: 1, maxLength: 30 }) }),
  })

// Arbitrary for a row that will have effective_status === 'ended':
// stored status is 'active' but end_date is in the past
const endedContractArb = () =>
  fc.record({
    id: fc.uuid(),
    client_id: fc.uuid(),
    monthly_rate: fc.integer({ min: 1000, max: 500_000 }),
    start_date: fc.constant('2020-01-01'),
    end_date: fc
      .tuple(fc.integer({ min: 2000, max: 2020 }), fc.integer({ min: 1, max: 12 }))
      .map(([y, m]) => `${y}-${String(m).padStart(2, '0')}-01`),
    status: fc.constant('active' as const),
    updated_at: fc.constant('2025-01-01T00:00:00Z'),
    clients: fc.record({ name: fc.string({ minLength: 1, maxLength: 30 }) }),
  })

// ---------------------------------------------------------------------------
// Property 1: Status filter returns only matching contracts
// ---------------------------------------------------------------------------

describe('Property 1: Status filter returns only matching contracts', () => {
  // Feature: contracts-management-page, Property 1: Status filter returns only matching contracts

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('all returned rows have effective_status === filterValue for active/suspended/terminated filters', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate a filter value (not 'ended' — those are handled separately)
        fc.constantFrom('active' as const, 'suspended' as const, 'terminated' as const),
        // Generate an array of rows whose stored status matches the filter
        fc.array(
          fc.record({
            id: fc.uuid(),
            client_id: fc.uuid(),
            monthly_rate: fc.integer({ min: 1000, max: 500_000 }),
            start_date: fc.constant('2020-01-01'),
            // Future end_date ensures effective_status === stored status
            end_date: fc.oneof(
              fc.constant(null),
              fc
                .tuple(fc.integer({ min: 2030, max: 2099 }), fc.integer({ min: 1, max: 12 }))
                .map(([y, m]) => `${y}-${String(m).padStart(2, '0')}-01`)
            ),
            status: fc.constantFrom('active' as const, 'suspended' as const, 'terminated' as const),
            updated_at: fc.constant('2025-01-01T00:00:00Z'),
            clients: fc.record({ name: fc.string({ minLength: 1, maxLength: 30 }) }),
          }),
          { minLength: 0, maxLength: 10 }
        ),
        async (filterValue, allRows) => {
          // The hook applies server-side .eq('status', filterValue) for non-ended filters,
          // so Supabase returns only rows matching the stored status.
          // We simulate this by filtering the rows to match the stored status.
          const matchingRows = allRows.filter((r) => r.status === filterValue)

          // Set up the Supabase mock to return only matching rows
          const mockBuilder = buildSupabaseMock(matchingRows, matchingRows.length)
          vi.mocked(supabase.from).mockReturnValue(mockBuilder as ReturnType<typeof supabase.from>)

          const wrapper = createWrapper()
          const { result } = renderHook(
            () =>
              useContractsPage({
                page: 0,
                pageSize: 25,
                status: filterValue,
              }),
            { wrapper }
          )

          await waitFor(() => expect(result.current.isLoading).toBe(false))

          // Every returned row must have effective_status === filterValue
          for (const row of result.current.data) {
            expect(row.effective_status).toBe(filterValue)
          }
        }
      ),
      { numRuns: 50 }
    )
  })

  it('all returned rows have effective_status === "ended" when filter is "ended"', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate a mix of rows: some ended (past end_date), some not
        fc.array(
          fc.oneof(
            // Rows that will be 'ended': active status with past end_date
            endedContractArb(),
            // Rows that will NOT be 'ended': active status with future end_date
            rawContractArb('active')
          ),
          { minLength: 1, maxLength: 10 }
        ),
        async (allRows) => {
          // For 'ended' filter, the hook fetches all rows (no server-side status filter)
          // then filters client-side to effective_status === 'ended'
          const mockBuilder = buildSupabaseMock(allRows, allRows.length)
          vi.mocked(supabase.from).mockReturnValue(mockBuilder as ReturnType<typeof supabase.from>)

          const wrapper = createWrapper()
          const { result } = renderHook(
            () =>
              useContractsPage({
                page: 0,
                pageSize: 25,
                status: 'ended',
              }),
            { wrapper }
          )

          await waitFor(() => expect(result.current.isLoading).toBe(false))

          // Every returned row must have effective_status === 'ended'
          for (const row of result.current.data) {
            expect(row.effective_status).toBe('ended')
          }

          // Verify: the number of returned rows equals the number of rows
          // that actually have effective_status === 'ended' in the input
          const today = new Date()
          const expectedEndedCount = allRows.filter(
            (r) => computeEffectiveStatus(r.status, r.end_date, today) === 'ended'
          ).length
          expect(result.current.data.length).toBe(expectedEndedCount)
        }
      ),
      { numRuns: 50 }
    )
  })

  it('returns empty array when no rows match the filter', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('active' as const, 'suspended' as const, 'terminated' as const),
        async (filterValue) => {
          // Mock returns empty array (server-side filter found nothing)
          const mockBuilder = buildSupabaseMock([], 0)
          vi.mocked(supabase.from).mockReturnValue(mockBuilder as ReturnType<typeof supabase.from>)

          const wrapper = createWrapper()
          const { result } = renderHook(
            () =>
              useContractsPage({
                page: 0,
                pageSize: 25,
                status: filterValue,
              }),
            { wrapper }
          )

          await waitFor(() => expect(result.current.isLoading).toBe(false))

          expect(result.current.data).toHaveLength(0)
          expect(result.current.count).toBe(0)
        }
      ),
      { numRuns: 20 }
    )
  })
})

// Feature: contracts-management-page, Property 2: Client name search returns only matching contracts

// ---------------------------------------------------------------------------
// Property 2: Client name search returns only matching contracts
// ---------------------------------------------------------------------------

describe('Property 2: Client name search returns only matching contracts', () => {
  // Feature: contracts-management-page, Property 2: Client name search returns only matching contracts
  // Validates: Requirements 2.6

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('all returned rows have client_name containing the search term (case-insensitive)', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Search term: non-empty string to avoid trivial matches
        fc.string({ minLength: 1, maxLength: 20 }),
        // Array of raw rows with arbitrary client names
        fc.array(
          fc.record({
            id: fc.uuid(),
            client_id: fc.uuid(),
            monthly_rate: fc.integer({ min: 1000, max: 500_000 }),
            start_date: fc.constant('2020-01-01'),
            end_date: fc.oneof(
              fc.constant(null),
              fc
                .tuple(fc.integer({ min: 2030, max: 2099 }), fc.integer({ min: 1, max: 12 }))
                .map(([y, m]) => `${y}-${String(m).padStart(2, '0')}-01`)
            ),
            status: fc.constantFrom('active' as const, 'suspended' as const, 'terminated' as const),
            updated_at: fc.constant('2025-01-01T00:00:00Z'),
            clients: fc.record({ name: fc.string({ minLength: 1, maxLength: 30 }) }),
          }),
          { minLength: 0, maxLength: 10 }
        ),
        async (searchTerm, allRows) => {
          // The hook applies .ilike('clients.name', '%term%') server-side, so Supabase
          // returns only rows whose clients.name contains the search term (case-insensitive).
          // We simulate this by filtering the rows before passing them to the mock.
          const matchingRows = allRows.filter(
            (r) =>
              r.clients !== null &&
              r.clients.name.toLowerCase().includes(searchTerm.toLowerCase())
          )

          const mockBuilder = buildSupabaseMock(matchingRows, matchingRows.length)
          vi.mocked(supabase.from).mockReturnValue(mockBuilder as ReturnType<typeof supabase.from>)

          const wrapper = createWrapper()
          const { result } = renderHook(
            () =>
              useContractsPage({
                page: 0,
                pageSize: 25,
                search: searchTerm,
              }),
            { wrapper }
          )

          await waitFor(() => expect(result.current.isLoading).toBe(false))

          // Every returned row's client_name must contain the search term (case-insensitive)
          for (const row of result.current.data) {
            expect(row.client_name.toLowerCase()).toContain(searchTerm.toLowerCase())
          }
        }
      ),
      { numRuns: 50 }
    )
  })

  it('returns empty array when no rows match the search term', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 20 }),
        async (searchTerm) => {
          // Mock returns empty array (server-side ilike filter found nothing)
          const mockBuilder = buildSupabaseMock([], 0)
          vi.mocked(supabase.from).mockReturnValue(mockBuilder as ReturnType<typeof supabase.from>)

          const wrapper = createWrapper()
          const { result } = renderHook(
            () =>
              useContractsPage({
                page: 0,
                pageSize: 25,
                search: searchTerm,
              }),
            { wrapper }
          )

          await waitFor(() => expect(result.current.isLoading).toBe(false))

          expect(result.current.data).toHaveLength(0)
          expect(result.current.count).toBe(0)
        }
      ),
      { numRuns: 20 }
    )
  })

  it('returns all rows when search term matches all client names', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Use a fixed common substring that all generated names will contain
        fc.string({ minLength: 1, maxLength: 5 }),
        fc.array(
          fc.record({
            id: fc.uuid(),
            client_id: fc.uuid(),
            monthly_rate: fc.integer({ min: 1000, max: 500_000 }),
            start_date: fc.constant('2020-01-01'),
            end_date: fc.constant(null),
            status: fc.constantFrom('active' as const, 'suspended' as const, 'terminated' as const),
            updated_at: fc.constant('2025-01-01T00:00:00Z'),
            clients: fc.record({ name: fc.string({ minLength: 1, maxLength: 30 }) }),
          }),
          { minLength: 1, maxLength: 10 }
        ),
        async (prefix, allRows) => {
          // Force all rows to have client names that contain the prefix
          const rowsWithMatchingNames = allRows.map((r) => ({
            ...r,
            clients: { name: prefix + r.clients!.name },
          }))

          const mockBuilder = buildSupabaseMock(rowsWithMatchingNames, rowsWithMatchingNames.length)
          vi.mocked(supabase.from).mockReturnValue(mockBuilder as ReturnType<typeof supabase.from>)

          const wrapper = createWrapper()
          const { result } = renderHook(
            () =>
              useContractsPage({
                page: 0,
                pageSize: 25,
                search: prefix,
              }),
            { wrapper }
          )

          await waitFor(() => expect(result.current.isLoading).toBe(false))

          // All rows should be returned and each must contain the prefix
          expect(result.current.data).toHaveLength(rowsWithMatchingNames.length)
          for (const row of result.current.data) {
            expect(row.client_name.toLowerCase()).toContain(prefix.toLowerCase())
          }
        }
      ),
      { numRuns: 30 }
    )
  })
})
