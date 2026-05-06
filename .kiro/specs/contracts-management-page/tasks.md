# Implementation Plan: Contracts Management Page

## Overview

Implement a dedicated `/dashboard/contracts` page for Admin and Finance roles, providing full contract lifecycle management (create, edit, suspend, resume, terminate). The feature lives in `dashboard/src/features/contracts/`, reuses `computeEffectiveStatus` from `contractCalculations.ts`, and follows the same layered architecture (TanStack Query + TanStack Table + TailwindCSS) used throughout the dashboard. The existing `ContractPanel` in the Client Detail view is refactored to a quick-actions panel. No schema migrations are required.

---

## Tasks

- [x] 1. Create the `contracts` feature directory and core TypeScript types
  - Create `dashboard/src/features/contracts/` directory with an `index.ts` barrel file
  - Define the `ContractRow` interface (id, client_id, client_name, monthly_rate, start_date, end_date, status, effective_status, updated_at) and all mutation input types (`CreateContractInput`, `UpdateContractInput`, `UpdateStatusInput`, `TerminateInput`) in a shared `types.ts` file
  - Import and re-export `computeEffectiveStatus` from `../../features/billing/contractCalculations` — do not duplicate it
  - _Requirements: 2.1, 3.8, 4.6, 5.6, 6.2_

- [x] 2. Implement `useContractsPage` hook
  - [x] 2.1 Write `useContractsPage.ts` with server-side pagination and filters
    - Accept `ContractsPageFilters` (page, pageSize, search, status, clientId)
    - Fetch from `contracts` joined with `clients(name)` using `.range()` and `{ count: 'exact' }`
    - Apply `.ilike('clients.name', '%term%')` for search; `.eq('status', …)` for active/suspended/terminated; compute `ended` client-side via `computeEffectiveStatus`
    - Compute `effective_status` on each row using `computeEffectiveStatus(row.status, row.end_date, new Date())`
    - Use query key `['contracts-page', filters]`
    - Return `{ data: ContractRow[], count: number, isLoading: boolean, error: Error | null }`
    - _Requirements: 2.1, 2.5, 2.6, 2.7, 10.1_

  - [x] 2.2 Write property test for status filter (Property 1)
    - **Property 1: Status filter returns only matching contracts**
    - **Validates: Requirements 2.5**
    - File: `useContractsPage.test.ts`
    - Use `fc.array(fc.record({...}))` and `fc.constantFrom('active','suspended','terminated','ended')`
    - Mock Supabase; assert every returned row's `effective_status` equals the filter value

  - [x] 2.3 Write property test for client name search (Property 2)
    - **Property 2: Client name search returns only matching contracts**
    - **Validates: Requirements 2.6**
    - File: `useContractsPage.test.ts`
    - Use `fc.string()` for search term and `fc.array(fc.record({ client_name: fc.string() }))` for data
    - Assert every returned row's `client_name` contains the search string (case-insensitive)

- [x] 3. Implement `useContractHistory` hook
  - [x] 3.1 Write `useContractHistory.ts`
    - Accept `clientId: string`
    - Fetch all contracts for the client ordered by `start_date DESC`
    - Compute `effective_status` on each row
    - Use query key `['contract-history', clientId]`
    - Return `{ data: ContractRow[], isLoading: boolean, error: Error | null }`
    - _Requirements: 10.1_

  - [x] 3.2 Write property test for client filter and ordering (Property 12)
    - **Property 12: Client-filtered view returns only that client's contracts in descending order**
    - **Validates: Requirements 10.1**
    - File: `useContractHistory.test.ts`
    - Use `fc.uuid()` for clientId and `fc.array(fc.record({ client_id: fc.uuid(), start_date: fc.date() }))`
    - Assert all returned rows have `client_id === filter value` and are ordered by `start_date` descending

- [x] 4. Implement `useContractMutations` hook
  - [x] 4.1 Write `useContractMutations.ts` with all four mutations
    - `createContract`: pre-flight query for existing active contract; if found, throw validation error without inserting; on success invalidate `['contracts-page']`, `['contracts']`, `['clients']`
    - `updateContract`: update start_date, end_date, monthly_rate; same cache invalidation
    - `updateStatus`: update status to `active` or `suspended`; same cache invalidation
    - `terminateContract`: set `status = 'terminated'` and `end_date = effective_date` in a single `.update()` call; same cache invalidation
    - _Requirements: 3.7, 3.8, 4.6, 5.6, 6.2, 7.1, 7.2, 7.3, 7.4_

  - [x] 4.2 Write property test for active contract blocking duplicate creation (Property 6)
    - **Property 6: Active contract blocks duplicate creation**
    - **Validates: Requirements 3.7, 7.1, 7.2**
    - File: `useContractMutations.test.ts`
    - Use `fc.uuid()` for client_id; mock Supabase to return an active contract on the pre-flight query
    - Assert `createContract` throws the "already has an active contract" error and does not call insert

  - [x] 4.3 Write property test for non-active contract allowing new creation (Property 7)
    - **Property 7: Non-active contract allows new contract creation**
    - **Validates: Requirements 7.3, 7.4**
    - File: `useContractMutations.test.ts`
    - Use `fc.constantFrom('suspended', 'terminated')` for existing contract status; mock Supabase accordingly
    - Assert `createContract` does not throw the duplicate-active error

  - [x] 4.4 Write property test for termination atomicity (Property 10)
    - **Property 10: Termination sets status and end_date atomically**
    - **Validates: Requirements 6.2**
    - File: `useContractMutations.test.ts`
    - Use `fc.date()` for effective_date; mock Supabase `.update()` and capture the payload
    - Assert the update payload contains both `status: 'terminated'` and `end_date: effective_date`

- [x] 5. Checkpoint — data layer complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Implement `ContractForm` modal component
  - [x] 6.1 Write `ContractForm.tsx` with create and edit modes
    - Accept props: `contract?: ContractRow | null`, `defaultClientId?: string`, `onClose: () => void`
    - Create mode: searchable `<select>` for Client populated from `useClients({ pageSize: 500 })`; all fields editable
    - Edit mode: Client shown as read-only text; Start Date, End Date, Monthly Rate editable
    - Fields: Client (required), Start Date (required), End Date (optional, must be ≥ Start Date), Monthly Rate UGX (required, positive integer)
    - Run validation on blur for touched fields and on submit; display inline errors below each field
    - Display Supabase mutation error in a red alert box below the fields; keep modal open on error
    - Close on Escape key via `useEffect` + `document.addEventListener('keydown', …)`
    - Call `createContract` or `updateContract` from `useContractMutations` on valid submit; close modal on success
    - _Requirements: 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10, 3.11, 4.2, 4.3, 4.4, 4.6, 4.7, 4.8_

  - [x] 6.2 Write property test for required field validation (Property 3)
    - **Property 3: Required field validation blocks submission**
    - **Validates: Requirements 3.4**
    - File: `ContractForm.test.tsx`
    - Use `fc.subarray(['client', 'start_date', 'monthly_rate'])` to generate subsets of missing fields
    - Assert a validation error is shown for each missing field and Supabase insert is not called

  - [x] 6.3 Write property test for end date before start date (Property 4)
    - **Property 4: End date before start date is rejected**
    - **Validates: Requirements 3.5**
    - File: `ContractForm.test.tsx`
    - Use `fc.date()` pairs constrained so end < start
    - Assert end_date validation error is shown and Supabase insert is not called

  - [x] 6.4 Write property test for non-positive monthly rate (Property 5)
    - **Property 5: Non-positive monthly rate is rejected**
    - **Validates: Requirements 3.6**
    - File: `ContractForm.test.tsx`
    - Use `fc.oneof(fc.integer({ max: 0 }), fc.float({ max: 0 }), fc.string())` for monthly_rate
    - Assert monthly_rate validation error is shown and Supabase insert is not called

- [x] 7. Implement `TerminateDialog` modal component
  - Write `TerminateDialog.tsx`
  - Accept props: `contract: ContractRow`, `onConfirm: (effectiveDate: string) => void`, `onCancel: () => void`, `isLoading: boolean`
  - Render warning text explaining termination is permanent
  - Include optional date picker for "Terminate Effective Date" defaulting to today (`new Date().toISOString().split('T')[0]`)
  - "Confirm Termination" button (red/destructive) calls `onConfirm(effectiveDate)`; "Cancel" calls `onCancel()`
  - Display inline error when `terminateContract.error` is non-null; keep dialog open
  - Close on Escape key
  - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [x] 8. Implement `ContractTimeline` read-only component
  - Write `ContractTimeline.tsx`
  - Accept props: `contracts: ContractRow[]` (all contracts for a client, ordered by start_date DESC)
  - Render a vertical timeline; each entry shows: Start Date → End Date (or "Present"), Effective Status badge, `updated_at` as last-changed date
  - No interactive controls — display only
  - _Requirements: 10.2, 10.3_

- [x] 9. Implement `ContractsPage` component
  - [x] 9.1 Write `ContractsPage.tsx` with table, toolbar, and modal orchestration
    - State: `pagination` (pageIndex 0, pageSize 25), `statusFilter` ('all'), `searchInput`, `search` (debounced 300 ms via `useEffect` + `setTimeout`), `modalMode` ('create' | 'edit' | 'terminate' | null), `selectedContract`
    - Use `useContractsPage` hook with current filters; show `TableSkeleton` while loading; show red error banner on error; show empty-state message when no rows
    - TanStack Table columns: Client Name (as `<Link to="/dashboard/clients">`), Monthly Rate (right-aligned, `toLocaleString()`), Start Date, End Date (or "Open-ended"), Effective Status badge, Actions (Edit, Change Status)
    - Edit action: visible when `effective_status !== 'terminated'`; opens `ContractForm` in edit mode
    - Change Status action: visible when `effective_status === 'active' || effective_status === 'suspended'`; for active contracts offers Suspend + Terminate; for suspended offers Resume + Terminate; Terminate opens `TerminateDialog`
    - Toolbar: search input, status filter dropdown (All/Active/Suspended/Terminated/Ended), page size selector, "Export CSV" button (disabled when empty), "+ New Contract" button
    - Export CSV: calls `downloadCsv` with currently visible rows; columns: Client Name, Monthly Rate (UGX), Start Date, End Date, Status
    - Render `ContractForm` modal when `modalMode === 'create' || modalMode === 'edit'`
    - Render `TerminateDialog` modal when `modalMode === 'terminate'`
    - Pagination controls: previous/next buttons, current page indicator
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 3.1, 3.2, 3.9, 3.11, 4.1, 4.2, 4.5, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 6.1, 6.3, 6.5, 11.1, 11.2, 11.3, 12.1, 12.2_

  - [x] 9.2 Write property test for Edit action visibility (Property 8)
    - **Property 8: Edit action visibility matches effective status**
    - **Validates: Requirements 4.1, 4.5, 6.3**
    - File: `ContractsPage.test.tsx`
    - Use `fc.record({ effective_status: fc.constantFrom('active', 'suspended', 'terminated', 'ended') })`
    - Assert Edit button is present iff `effective_status !== 'terminated'`

  - [x] 9.3 Write property test for Change Status action visibility (Property 9)
    - **Property 9: Change Status action visibility matches effective status**
    - **Validates: Requirements 5.1, 5.4, 5.5, 6.3**
    - File: `ContractsPage.test.tsx`
    - Use same arbitrary as P8
    - Assert Change Status button is present iff `effective_status === 'active' || effective_status === 'suspended'`

  - [x] 9.4 Write property test for CSV export matching visible data (Property 13)
    - **Property 13: CSV export contains exactly the visible contracts**
    - **Validates: Requirements 11.2**
    - File: `ContractsPage.test.tsx`
    - Use `fc.array(fc.record({ client_name: fc.string(), monthly_rate: fc.integer({ min: 1 }), start_date: fc.string(), end_date: fc.option(fc.string()), effective_status: fc.constantFrom('active','suspended','terminated','ended') }))`
    - Capture the argument passed to `downloadCsv`; assert row count and client names match the input array

- [x] 10. Checkpoint — UI components complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Extend billing property test for billing filter exclusion
  - [x] 11.1 Add Property 11 to `contractCalculations.test.ts`
    - **Property 11: Billing filter excludes non-active contracts**
    - **Validates: Requirements 8.1, 8.2, 8.3, 8.4**
    - File: `dashboard/src/features/billing/contractCalculations.test.ts` (extend existing file)
    - Use `fc.array(fc.record({ status: fc.constantFrom('active', 'suspended', 'terminated') }))`
    - Assert that filtering the array to `status === 'active'` includes all active contracts and excludes all others

- [x] 12. Refactor `ContractPanel` to quick-actions panel
  - Update `dashboard/src/features/clients/ContractPanel.tsx` in-place
  - Remove the full `CreateContractForm` inline form and the `ContractDetail` status-dropdown form
  - Import `useContractMutations` from `../../features/contracts/useContractMutations` for Suspend/Resume/Terminate actions
  - Import `ContractForm` from `../../features/contracts/ContractForm` for the "Create Contract" modal
  - Display current contract details (status, monthly rate, start date, end date) as read-only
  - Show quick-action buttons based on current status:
    - `active` → "Suspend" button + "Terminate" button (opens `TerminateDialog`)
    - `suspended` → "Resume" button + "Terminate" button (opens `TerminateDialog`)
    - `terminated` → read-only display + "Create New Contract" button (opens `ContractForm` with `defaultClientId`)
    - no contract → "Create Contract" button (opens `ContractForm` with `defaultClientId`)
  - Add "View Contract History" link navigating to `/dashboard/contracts?clientId=<id>`
  - Keep `useClientContract` hook in place (still needed for the panel's own data fetch)
  - Invalidate `['contracts-page']`, `['contracts']`, `['clients']` on all mutations (via `useContractMutations`)
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8_

- [x] 13. Wire up routing and navigation
  - [x] 13.1 Add the `/dashboard/contracts` route to `App.tsx`
    - Add lazy import for `ContractsPage` from `./features/contracts`
    - Add `<Route path="contracts" element={<ProtectedRoute allowedRoles={[ADMIN, FINANCE]}><Suspense fallback={<PageLoader />}><ContractsPage /></Suspense></ProtectedRoute>} />` inside the dashboard routes
    - _Requirements: 1.1, 1.5, 1.6_

  - [x] 13.2 Add "Contracts" nav item to `Sidebar.tsx`
    - Add `{ label: 'Contracts', to: '/dashboard/contracts' }` to the `Admin` nav items list (after "Billing")
    - Add `{ label: 'Contracts', to: '/dashboard/contracts' }` to the `Finance` nav items list (after "Billing")
    - Do NOT add it to `Operations_Manager`
    - _Requirements: 1.2, 1.3, 1.4_

  - [x] 13.3 Export `ContractsPage` from `index.ts`
    - Add `export { default as ContractsPage } from './ContractsPage'` to `dashboard/src/features/contracts/index.ts`
    - _Requirements: 1.1_

- [x] 14. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

---

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at the data layer and UI layer boundaries
- Property tests use **fast-check** (already installed); each is tagged with `// Feature: contracts-management-page, Property N: <property_text>`
- All Supabase calls are mocked in unit/property tests using `vi.mock('../../lib/supabase')`
- `computeEffectiveStatus` is already covered by `contractCalculations.test.ts` — no duplication needed
- Property 11 extends the existing `contractCalculations.test.ts` rather than creating a new file
- All mutations must invalidate `['contracts-page']`, `['contracts']`, and `['clients']` query keys
