/**
 * Property-based tests for useContractHistory hook.
 * Validates: Requirements 10.1
 */

// Feature: contracts-management-page, Property 12: Client-filtered view returns only that client's contracts in descending order

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import * as fc from 'fast-check'
import React from 'react'
import { useContractHistory } from './useContractHistory'

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
// Helper: build a chainable Supabase query mock that resolves to { data, error }
// ---------------------------------------------------------------------------

function buildSupabaseMock(rows: RawContractRow[]) {
  const result = { data: rows, error: null }
  const builder: Record<string, unknown> = {}
  const chainMethods = ['select', 'eq', 'order']
  for (const method of chainMethods) {
    builder[method] = vi.fn().mockReturnValue(builder)
  }
  // Make the builder thenable so `await query` resolves to result
  builder.then = (resolve: (v: typeof result) => void) => Promise.resolve(result).then(resolve)
  return builder
}

// ---------------------------------------------------------------------------
// Helper: create a fresh QueryClient wrapper for each test
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
// Helper: format a Date as YYYY-MM-DD string
// ---------------------------------------------------------------------------

function formatDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// ---------------------------------------------------------------------------
// Property 12: Client-filtered view returns only that client's contracts in descending order
// ---------------------------------------------------------------------------

describe('Property 12: Client-filtered view returns only that client\'s contracts in descending order', () => {
  // Feature: contracts-management-page, Property 12: Client-filtered view returns only that client's contracts in descending order
  // Validates: Requirements 10.1

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('all returned rows have client_id === the requested clientId', async () => {
    await fc.assert(
      fc.asyncProperty(
        // The clientId we are filtering by
        fc.uuid(),
        // An array of rows with mixed client_ids
        fc.array(
          fc.record({
            id: fc.uuid(),
            client_id: fc.uuid(),
            monthly_rate: fc.integer({ min: 1000, max: 500_000 }),
            start_date: fc.date({ min: new Date('2018-01-01'), max: new Date('2025-12-31') })
              .map(formatDate),
            end_date: fc.oneof(
              fc.constant(null),
              fc.date({ min: new Date('2026-01-01'), max: new Date('2030-12-31') }).map(formatDate)
            ),
            status: fc.constantFrom('active' as const, 'suspended' as const, 'terminated' as const),
            updated_at: fc.constant('2025-01-01T00:00:00Z'),
            clients: fc.record({ name: fc.string({ minLength: 1, maxLength: 30 }) }),
          }),
          { minLength: 0, maxLength: 10 }
        ),
        async (clientId, allRows) => {
          // The hook applies .eq('client_id', clientId) server-side.
          // Simulate server-side filter: only return rows matching clientId.
          const matchingRows = allRows
            .filter((r) => r.client_id === clientId)
            // Sort descending by start_date to simulate .order('start_date', { ascending: false })
            .sort((a, b) => b.start_date.localeCompare(a.start_date))

          const mockBuilder = buildSupabaseMock(matchingRows)
          vi.mocked(supabase.from).mockReturnValue(mockBuilder as ReturnType<typeof supabase.from>)

          const wrapper = createWrapper()
          const { result } = renderHook(() => useContractHistory(clientId), { wrapper })

          await waitFor(() => expect(result.current.isLoading).toBe(false))

          // Every returned row must have client_id === clientId
          for (const row of result.current.data) {
            expect(row.client_id).toBe(clientId)
          }
        }
      ),
      { numRuns: 50 }
    )
  })

  it('returned rows are ordered by start_date descending', async () => {
    await fc.assert(
      fc.asyncProperty(
        // The clientId we are filtering by
        fc.uuid(),
        // Generate rows with distinct start_dates for the target client
        fc.array(
          fc.date({ min: new Date('2018-01-01'), max: new Date('2025-12-31') }),
          { minLength: 2, maxLength: 8 }
        ).chain((dates) => {
          // Deduplicate dates to ensure distinct start_dates for reliable ordering
          const uniqueDates = Array.from(
            new Map(dates.map((d) => [formatDate(d), d])).values()
          )
          return fc.constant(uniqueDates)
        }),
        async (clientId, uniqueDates) => {
          // Build rows for the target clientId with distinct start_dates
          const rows: RawContractRow[] = uniqueDates.map((d, i) => ({
            id: `id-${i}`,
            client_id: clientId,
            monthly_rate: 10000,
            start_date: formatDate(d),
            end_date: null,
            status: 'active' as const,
            updated_at: '2025-01-01T00:00:00Z',
            clients: { name: 'Test Client' },
          }))

          // Sort descending by start_date (simulating server-side ORDER BY start_date DESC)
          const sortedRows = [...rows].sort((a, b) =>
            b.start_date.localeCompare(a.start_date)
          )

          const mockBuilder = buildSupabaseMock(sortedRows)
          vi.mocked(supabase.from).mockReturnValue(mockBuilder as ReturnType<typeof supabase.from>)

          const wrapper = createWrapper()
          const { result } = renderHook(() => useContractHistory(clientId), { wrapper })

          await waitFor(() => expect(result.current.isLoading).toBe(false))

          const returnedData = result.current.data

          // Must have the same number of rows as we provided
          expect(returnedData).toHaveLength(sortedRows.length)

          // Adjacent rows must be in descending order by start_date
          for (let i = 0; i < returnedData.length - 1; i++) {
            expect(returnedData[i].start_date >= returnedData[i + 1].start_date).toBe(true)
          }
        }
      ),
      { numRuns: 50 }
    )
  })

  it('returns empty array when no contracts exist for the clientId', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        async (clientId) => {
          // Mock returns empty array (no contracts for this client)
          const mockBuilder = buildSupabaseMock([])
          vi.mocked(supabase.from).mockReturnValue(mockBuilder as ReturnType<typeof supabase.from>)

          const wrapper = createWrapper()
          const { result } = renderHook(() => useContractHistory(clientId), { wrapper })

          await waitFor(() => expect(result.current.isLoading).toBe(false))

          expect(result.current.data).toHaveLength(0)
          expect(result.current.error).toBeNull()
        }
      ),
      { numRuns: 20 }
    )
  })
})
