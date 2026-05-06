/**
 * Property-based tests for useContractMutations hook.
 * Validates: Requirements 3.7, 7.1, 7.2
 */

// Feature: contracts-management-page, Property 6: Active contract blocks duplicate creation

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import * as fc from 'fast-check'
import React from 'react'
import { useContractMutations } from './useContractMutations'

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
// Helper: build a Supabase builder mock for the pre-flight check path.
//
// The pre-flight query chain is:
//   supabase.from('contracts').select('id').eq(...).eq(...).maybeSingle()
//
// We need `.maybeSingle()` to return the active-contract result, and we need
// to assert that `.single()` (used by the insert path) is never called.
// ---------------------------------------------------------------------------

function buildPreflightBlockingMock() {
  const singleFn = vi.fn()

  // The builder returned by supabase.from('contracts')
  const builder: Record<string, unknown> = {}

  // Chain methods that return the same builder
  const chainMethods = ['select', 'eq', 'insert', 'order']
  for (const method of chainMethods) {
    builder[method] = vi.fn().mockReturnValue(builder)
  }

  // maybeSingle() resolves with an existing active contract → triggers the guard
  builder.maybeSingle = vi.fn().mockResolvedValue({
    data: { id: 'existing-active-contract-id' },
    error: null,
  })

  // single() should NOT be called when the guard fires
  builder.single = singleFn

  return { builder, singleFn }
}

// ---------------------------------------------------------------------------
// Property 6: Active contract blocks duplicate creation
// ---------------------------------------------------------------------------

describe('Property 6: Active contract blocks duplicate creation', () => {
  // Feature: contracts-management-page, Property 6: Active contract blocks duplicate creation
  // Validates: Requirements 3.7, 7.1, 7.2

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('createContract throws "already has an active contract" and does not call insert for any client_id', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate arbitrary client_id values
        fc.uuid(),
        // Generate arbitrary contract input fields
        fc.record({
          start_date: fc.string({ minLength: 1 }),
          monthly_rate: fc.integer({ min: 1 }),
        }),
        async (clientId, inputFields) => {
          const { builder, singleFn } = buildPreflightBlockingMock()

          vi.mocked(supabase.from).mockReturnValue(builder as ReturnType<typeof supabase.from>)

          const wrapper = createWrapper()
          const { result } = renderHook(() => useContractMutations(), { wrapper })

          // Wait for the hook to be ready (mutations are available synchronously,
          // but we wait to ensure the hook has fully initialised)
          await waitFor(() => expect(result.current).not.toBeNull())

          const input = {
            client_id: clientId,
            start_date: inputFields.start_date,
            monthly_rate: inputFields.monthly_rate,
          }

          // createContract.mutateAsync should throw with the duplicate-active error
          let thrownError: unknown
          await act(async () => {
            try {
              await result.current.createContract.mutateAsync(input)
            } catch (err) {
              thrownError = err
            }
          })

          expect(thrownError).toBeInstanceOf(Error)
          expect((thrownError as Error).message).toContain('already has an active contract')

          // The insert path (.single()) must never have been called
          expect(singleFn).not.toHaveBeenCalled()
        }
      ),
      { numRuns: 50 }
    )
  })
})

// ---------------------------------------------------------------------------
// Property 7: Non-active contract allows new contract creation
// ---------------------------------------------------------------------------

// Feature: contracts-management-page, Property 7: Non-active contract allows new contract creation

/**
 * Validates: Requirements 7.3, 7.4
 *
 * When a client's existing contract has status = 'suspended' or 'terminated',
 * createContract should NOT throw the "already has an active contract" error.
 * The pre-flight check finds no active contract (maybeSingle returns null),
 * so the insert proceeds successfully.
 */
describe('Property 7: Non-active contract allows new contract creation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('createContract does not throw the duplicate-active error when existing contract is non-active', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate arbitrary client_id values
        fc.uuid(),
        // Existing contract has a non-active status (suspended or terminated)
        fc.constantFrom('suspended', 'terminated'),
        // Generate arbitrary contract input fields
        fc.record({
          start_date: fc.string({ minLength: 1 }),
          monthly_rate: fc.integer({ min: 1 }),
        }),
        async (clientId, _existingStatus, inputFields) => {
          // Build a mock where the pre-flight check finds NO active contract
          // (maybeSingle returns null — no active contract for this client)
          const insertSingleResult = {
            data: {
              id: 'new-id',
              client_id: clientId,
              monthly_rate: 10000,
              start_date: '2025-01-01',
              end_date: null,
              status: 'active',
              updated_at: '2025-01-01T00:00:00Z',
              clients: { name: 'Test Client' },
            },
            error: null,
          }

          // We need two separate builder chains:
          // 1. The pre-flight SELECT chain → .maybeSingle() returns null (no active contract)
          // 2. The INSERT chain → .single() returns the new contract row
          //
          // Since supabase.from() is called twice (once for select, once for insert),
          // we use mockReturnValueOnce to return different builders per call.

          const preflightBuilder: Record<string, unknown> = {}
          const preflightChainMethods = ['select', 'eq']
          for (const method of preflightChainMethods) {
            preflightBuilder[method] = vi.fn().mockReturnValue(preflightBuilder)
          }
          preflightBuilder.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null })

          const insertBuilder: Record<string, unknown> = {}
          const insertChainMethods = ['insert', 'select']
          for (const method of insertChainMethods) {
            insertBuilder[method] = vi.fn().mockReturnValue(insertBuilder)
          }
          insertBuilder.single = vi.fn().mockResolvedValue(insertSingleResult)

          // First call to supabase.from() → pre-flight select builder
          // Second call to supabase.from() → insert builder
          vi.mocked(supabase.from)
            .mockReturnValueOnce(preflightBuilder as ReturnType<typeof supabase.from>)
            .mockReturnValueOnce(insertBuilder as ReturnType<typeof supabase.from>)

          const wrapper = createWrapper()
          const { result } = renderHook(() => useContractMutations(), { wrapper })

          await waitFor(() => expect(result.current).not.toBeNull())

          const input = {
            client_id: clientId,
            start_date: inputFields.start_date,
            monthly_rate: inputFields.monthly_rate,
          }

          let thrownError: unknown = undefined
          let returnedValue: unknown = undefined

          await act(async () => {
            try {
              returnedValue = await result.current.createContract.mutateAsync(input)
            } catch (err) {
              thrownError = err
            }
          })

          // Should NOT throw the duplicate-active error
          if (thrownError instanceof Error) {
            expect((thrownError as Error).message).not.toContain('already has an active contract')
          }

          // The mutation should have succeeded (no error thrown)
          expect(thrownError).toBeUndefined()
          expect(returnedValue).toBeDefined()
        }
      ),
      { numRuns: 50 }
    )
  })
})

// ---------------------------------------------------------------------------
// Property 10: Termination sets status and end_date atomically
// ---------------------------------------------------------------------------

// Feature: contracts-management-page, Property 10: Termination sets status and end_date atomically

/**
 * Validates: Requirements 6.2
 *
 * When terminateContract is called with any (id, effective_date) pair,
 * the single `.update()` call to Supabase must contain BOTH
 * `status: 'terminated'` and `end_date: effective_date` in the same payload.
 * This ensures the two fields are written atomically in one DB round-trip.
 */
describe('Property 10: Termination sets status and end_date atomically', () => {
  // Feature: contracts-management-page, Property 10: Termination sets status and end_date atomically
  // Validates: Requirements 6.2

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('terminateContract sends status and end_date together in a single update payload for any effective_date', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate arbitrary contract id
        fc.uuid(),
        // Generate arbitrary effective_date as a Date, then format as YYYY-MM-DD
        fc.date({ min: new Date('2000-01-01'), max: new Date('2099-12-31') }),
        async (contractId, effectiveDateObj) => {
          // Format the Date as YYYY-MM-DD (the shape TerminateInput expects)
          const effectiveDateString = effectiveDateObj.toISOString().split('T')[0]

          // Capture the payload passed to .update()
          let capturedUpdatePayload: unknown = undefined

          // Build a fluent builder mock for the terminateContract chain:
          //   supabase.from('contracts').update({...}).eq('id', id).select(...).single()
          const builder: Record<string, unknown> = {}

          builder.update = vi.fn().mockImplementation((payload: unknown) => {
            capturedUpdatePayload = payload
            return builder
          })

          const chainMethods = ['eq', 'select']
          for (const method of chainMethods) {
            builder[method] = vi.fn().mockReturnValue(builder)
          }

          // .single() returns a valid contract row so the mutation succeeds
          builder.single = vi.fn().mockResolvedValue({
            data: {
              id: contractId,
              client_id: 'client-uuid',
              monthly_rate: 50000,
              start_date: '2024-01-01',
              end_date: effectiveDateString,
              status: 'terminated',
              updated_at: new Date().toISOString(),
              clients: { name: 'Test Client' },
            },
            error: null,
          })

          vi.mocked(supabase.from).mockReturnValue(builder as ReturnType<typeof supabase.from>)

          const wrapper = createWrapper()
          const { result } = renderHook(() => useContractMutations(), { wrapper })

          await waitFor(() => expect(result.current).not.toBeNull())

          await act(async () => {
            await result.current.terminateContract.mutateAsync({
              id: contractId,
              effective_date: effectiveDateString,
            })
          })

          // The update payload must contain both fields atomically
          expect(capturedUpdatePayload).toEqual({
            status: 'terminated',
            end_date: effectiveDateString,
          })
        }
      ),
      { numRuns: 50 }
    )
  })
})
