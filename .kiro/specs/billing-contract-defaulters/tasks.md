# Implementation Plan: Billing Contract Defaulters

## Overview

Enhance the billing module with three interconnected capabilities: invoice form enhancements (contract rate auto-population, paid-this-period display, outstanding balance), a new Contracts tab, and a contract-powered Defaulters tab with month-by-month breakdown. All implementation is front-end TypeScript using the existing React + Supabase + TanStack Query stack.

## Tasks

- [x] 1. Extract and implement pure computation functions
  - Create `dashboard/src/features/billing/contractCalculations.ts` with the following exported pure functions:
    - `computeContractMonths(startDate: string, endDate: string | null): string[]` — returns array of `YYYY-MM` strings from start to min(end, current month)
    - `computeExpectedTotal(months: string[], monthlyRate: number): number`
    - `computeOutstandingBalance(expectedTotal: number, amountPaid: number): number`
    - `computeMonthBreakdown(months: string[], monthlyRate: number, invoices: Array<{ invoice_period: string | null; paid_amount: number }>): MonthBreakdown[]`
    - `computeEffectiveStatus(status: string, endDate: string | null, today: Date): 'active' | 'suspended' | 'terminated' | 'ended'`
    - `computeDurationMonths(startDate: string, endDate: string | null): number`
  - Export the `MonthBreakdown` interface from this file
  - _Requirements: 4.2, 4.3, 4.4, 4.5, 6.2, 6.3, 6.4, 6.5, 10.2, 10.3, 10.4_

  - [x] 1.1 Write property test for outstanding balance calculation (Property 1)
    - Install `fast-check` as a dev dependency: `npm install --save-dev fast-check`
    - Create `dashboard/src/features/billing/contractCalculations.test.ts`
    - **Property 1: Outstanding balance equals expected minus paid**
    - **Validates: Requirements 6.2, 6.3, 6.4**
    - Tag: `// Feature: billing-contract-defaulters, Property 1: outstanding_balance = expected_total - amount_paid`
    - Generate random `monthly_rate` (positive integer 1–1,000,000), random number of months (1–36), random `paid_amount` (0 to expected_total). Assert `computeOutstandingBalance(expected, paid) === expected - paid`.

  - [x] 1.2 Write property test for month breakdown consistency (Property 2)
    - **Property 2: Month breakdown statuses are exhaustive and consistent**
    - **Validates: Requirements 10.2, 10.3, 10.4**
    - Tag: `// Feature: billing-contract-defaulters, Property 2: sum(amount_owed) === outstanding_balance`
    - Generate random contract months and random invoice paid_amounts per month. Assert `sum(breakdown[].amount_owed) === outstanding_balance` and every month has exactly one status.

  - [x] 1.3 Write property test for effective status derivation (Property 4)
    - **Property 4: Effective status derivation is consistent**
    - **Validates: Requirements 4.2, 4.3, 4.4**
    - Tag: `// Feature: billing-contract-defaulters, Property 4: effective_status derivation rule`
    - Generate random `status` values and random `end_date` (null, past, future). Assert: if `end_date` is non-null and in the past → `'ended'`; otherwise → stored status.

  - [x] 1.4 Write property test for contract duration (Property 5)
    - **Property 5: Contract duration is always positive**
    - **Validates: Requirements 4.5**
    - Tag: `// Feature: billing-contract-defaulters, Property 5: duration_months >= 1`
    - Generate random valid `start_date` and `end_date` where `end_date >= start_date`. Assert `computeDurationMonths` always returns ≥ 1.

  - [x] 1.5 Write unit tests for computation functions
    - Test `computeContractMonths` for Jan–Mar 2025 → `['2025-01', '2025-02', '2025-03']`
    - Test `computeExpectedTotal` for 3 months at UGX 50,000 → 150,000
    - Test `computeOutstandingBalance` for expected 150,000, paid 100,000 → 50,000
    - Test `computeMonthBreakdown` for paid/partial/unpaid month statuses
    - Test `computeEffectiveStatus` for past end_date → `'ended'`
    - Test `computeDurationMonths` for open-ended contract (null end_date)
    - _Requirements: 4.2, 4.3, 4.5, 6.2, 6.3, 6.4, 10.2, 10.3, 10.4_

- [x] 2. Checkpoint — Ensure all computation tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Create `useContracts.ts` hook
  - Create `dashboard/src/features/billing/useContracts.ts`
  - Define and export `ContractWithClient` interface and `ContractStatusFilter` type as specified in the design
  - Implement `useContracts(filter: ContractStatusFilter)` using TanStack Query:
    - Query key: `['contracts', filter]`
    - Fetch from `contracts` table with join to `clients(name)`
    - Apply `computeEffectiveStatus` to each row to derive `effective_status`
    - Apply `computeDurationMonths` to each row to derive `duration_months`
    - Filter results client-side based on `filter` param: `'active'` → effective_status is `'active'`; `'inactive'` → effective_status is `'suspended'`, `'terminated'`, or `'ended'`
  - _Requirements: 4.2, 4.3, 4.4, 4.5, 5.3, 5.4, 5.5_

  - [x] 3.1 Write unit tests for `useContracts` hook
    - Mock Supabase client and test filter logic for `'active'`, `'inactive'`, and `'all'` filters
    - Test that `effective_status` is correctly derived for contracts with past `end_date`
    - _Requirements: 5.3, 5.4, 5.5_

- [x] 4. Create `useContractDefaulters.ts` hook
  - Create `dashboard/src/features/billing/useContractDefaulters.ts`
  - Define and export `MonthBreakdown`, `ContractDefaulter` interfaces as specified in the design
  - Implement `useContractDefaulters()` using TanStack Query:
    - Query key: `['contractDefaulters']`
    - Fetch all contracts with client join (`client_id`, `client_name`, `client_phone`, `monthly_rate`, `start_date`, `end_date`, `status`, `updated_at`)
    - Fetch all invoices with `contract_id`, `invoice_period`, `paid_amount`
    - For each contract: compute `contract_months`, `expected_total`, `amount_paid`, `outstanding_balance`, `month_breakdown`, `months_unpaid`, `defaulter_category` using functions from `contractCalculations.ts`
    - Exclude contracts where `monthly_rate` is null (treat as 0, skip)
    - Exclude clients where `outstanding_balance <= 0`
    - Assign `defaulter_category`: `'active'` if `effective_status === 'active'`; `'ended'` otherwise
    - Sort result by `outstanding_balance` descending
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 7.1, 8.1, 8.4_

  - [x] 4.1 Write property test for defaulter category mutual exclusivity (Property 3)
    - **Property 3: Defaulter category assignment is mutually exclusive**
    - **Validates: Requirements 7.1, 8.1**
    - Tag: `// Feature: billing-contract-defaulters, Property 3: defaulter_category is mutually exclusive`
    - Generate random contracts with varying statuses and end_dates. Assert every defaulter has `defaulter_category` of exactly `'active'` or `'ended'`, never both.

  - [x] 4.2 Write property test for zero-balance exclusion (Property 6)
    - **Property 6: Zero-balance clients are excluded from defaulters**
    - **Validates: Requirements 6.6**
    - Tag: `// Feature: billing-contract-defaulters, Property 6: zero_balance_excluded`
    - Generate contracts and invoices where `amount_paid >= expected_total` for some clients. Assert none of those clients appear in the defaulters output.

  - [x] 4.3 Write unit tests for `useContractDefaulters` hook
    - Mock Supabase and test that clients with `outstanding_balance <= 0` are excluded
    - Test that `defaulter_category` is `'ended'` for terminated contracts
    - Test that `month_breakdown` is in chronological order
    - _Requirements: 6.6, 7.1, 8.1, 10.5_

- [x] 5. Checkpoint — Ensure all hook tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Add Contracts tab to BillingPage
  - Modify `dashboard/src/features/billing/BillingPage.tsx`:
    - Extend `Tab` type to `'invoices' | 'defaulters' | 'contracts'`
    - Add "Contracts" tab button in the tab list (order: Invoices | Defaulters | Contracts)
    - Add `tabpanel-contracts` panel div
  - Implement `ContractsTab` component inside `BillingPage.tsx`:
    - Add filter control with options: "All", "Active", "Inactive / Ended" (maps to `ContractStatusFilter`)
    - Use `useContracts(filter)` hook for data
    - Build TanStack Table with columns: Client Name, Monthly Rate (UGX), Start Date, End Date ("Open-ended" when null), Duration ("{N} months"), Status
    - Display contract count: "{N} contracts"
    - Add "Export CSV" button using `downloadCsv` from `dashboard/src/lib/exportCsv.ts`
    - Show loading skeleton and error banner following existing patterns
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_

  - [x] 6.1 Write unit tests for ContractsTab rendering
    - Test that filter control renders with correct options
    - Test that "Open-ended" is displayed when `end_date` is null
    - Test that contract count is displayed correctly
    - _Requirements: 5.2, 5.3, 5.6_

- [x] 7. Replace DefaultersTab with contract-powered implementation
  - Modify `dashboard/src/features/billing/BillingPage.tsx`:
    - Replace the existing `DefaultersTab` component with a new implementation using `useContractDefaulters()`
    - Add filter control with options: "All Defaulters", "Active Contract Defaulters", "Ended Contract Defaulters"
    - Filter the `data` array client-side based on selected filter (no re-fetch needed)
    - Build TanStack Table with columns per requirements:
      - Active view: Client Name, Phone, Monthly Rate (UGX), Months Unpaid, Outstanding Balance (UGX), Contract End Date
      - Ended view: Client Name, Phone, Monthly Rate (UGX), Contract End Date, Months Unpaid, Outstanding Balance (UGX)
      - All view: show all columns
    - Display "Open-ended" in Contract End Date column when `end_date` is null (Req 7.3)
    - Display count: "{N} client(s) with outstanding balance"
    - Add "Export CSV" button using `downloadCsv` for currently filtered data
    - Remove the old `useDefaulters` import and `defaulterColumns` definition
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 8.1, 8.2, 8.3, 8.4, 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_

  - [x] 7.1 Write unit tests for DefaultersTab filter logic
    - Test that "Active Contract Defaulters" filter shows only `defaulter_category === 'active'` rows
    - Test that "Ended Contract Defaulters" filter shows only `defaulter_category === 'ended'` rows
    - Test that "All Defaulters" shows all rows
    - _Requirements: 9.2, 9.3, 9.4_

- [x] 8. Implement expandable month breakdown in DefaultersTab
  - Add row expansion to the DefaultersTab TanStack Table:
    - Add an expand/collapse toggle column (chevron icon) as the first column
    - When a row is expanded, render a sub-row panel below it showing `month_breakdown` data
    - Month breakdown panel columns: Month (formatted as "Month YYYY"), Amount Owed (UGX), Status badge ("Paid" / "Partial" / "Unpaid")
    - Display months in chronological order (oldest first)
    - Use colour-coded status badges: green for Paid, yellow for Partial, red for Unpaid
  - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

  - [x] 8.1 Write unit tests for month breakdown panel
    - Test that months are displayed in chronological order
    - Test that "Partial" status shows remaining amount owed
    - Test that "Unpaid" status shows full monthly_rate as amount owed
    - _Requirements: 10.3, 10.4, 10.5_

- [x] 9. Enhance ManualInvoiceForm with contract rate auto-population
  - Modify `dashboard/src/features/billing/ManualInvoiceForm.tsx`:
    - Add internal state: `contractRate`, `loadingContractRate`, `paidThisPeriod`, `loadingPaidAmount`
    - When a client is selected, fetch the most recent active contract from `contracts` table and set `contractRate`; auto-populate the `amount` field with `contractRate`
    - Display read-only hint below Amount field: "Contract rate: UGX {amount}" when `contractRate` is set
    - Display "No active contract found — enter amount manually." when no active contract exists
    - When client changes, clear and re-populate Amount field (Req 1.5)
    - Allow the user to override the auto-populated amount by editing the Amount field directly (Req 1.4)
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [x] 9.1 Write unit tests for contract rate auto-population
    - Test that Amount field is populated when client with active contract is selected
    - Test that "No active contract found" message is shown when no contract exists
    - Test that Amount field is cleared when client changes
    - _Requirements: 1.1, 1.2, 1.5_

- [x] 10. Add paid-this-period and outstanding balance display to ManualInvoiceForm
  - Continue modifying `dashboard/src/features/billing/ManualInvoiceForm.tsx`:
    - When both client and invoice period are selected, query `invoices` table for that client + period and sum `paid_amount`; display as "Paid this period: UGX {amount}" (show UGX 0 when no invoices exist)
    - Compute and display Outstanding_Balance = Amount field value − Paid this period as "Outstanding: UGX {amount}"
    - Recalculate Outstanding_Balance in real time when Amount field or Invoice_Period changes
    - When Outstanding_Balance ≤ 0, display yellow warning: "This client has no outstanding balance for the selected period."
    - Display due date preview: "Due: {date}" computed as today + 14 days, always visible
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 3.3_

  - [x] 10.1 Write property test for paid-this-period sum (Property 7)
    - **Property 7: Paid-this-period display matches invoice paid_amount sum**
    - **Validates: Requirements 2.1, 2.2**
    - Tag: `// Feature: billing-contract-defaulters, Property 7: paid_this_period = sum(paid_amount)`
    - Generate random client ID, period, and set of invoices with random `paid_amount` values. Assert displayed "paid this period" equals the sum of all `paid_amount` values. When no invoices exist, assert value is 0.

  - [x] 10.2 Write unit tests for outstanding balance display
    - Test that Outstanding_Balance updates in real time when Amount field changes
    - Test that warning is shown when Outstanding_Balance ≤ 0
    - Test that "Paid this period: UGX 0" is shown when no prior invoices exist
    - _Requirements: 2.3, 2.4, 2.5_

- [x] 11. Add invoice generation confirmation message
  - Modify `dashboard/src/features/billing/ManualInvoiceForm.tsx`:
    - After successful invoice creation, display a confirmation message including: client name, invoice period (human-readable month name e.g. "July 2025"), and total amount
    - Format the invoice period for display using the existing `formatPeriod` pattern (YYYY-MM → "Month YYYY")
  - _Requirements: 3.1, 3.2, 3.4_

  - [x] 11.1 Write unit tests for confirmation message
    - Test that confirmation includes client name, human-readable period, and amount
    - Test that `invoice_period` is stored in `YYYY-MM` format
    - _Requirements: 3.2, 3.4_

- [x] 12. Final checkpoint — Ensure all tests pass
  - Run `npm run test` in the `dashboard` directory
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- All computation logic is in `contractCalculations.ts` to keep hooks and components thin and testable
- Property-based tests use `fast-check` (install as dev dependency in step 1.1)
- Each property test runs a minimum of 100 iterations
- The existing `useDefaulters` hook in `useInvoices.ts` is superseded by `useContractDefaulters.ts` but can remain for backward compatibility until the DefaultersTab is fully replaced in task 7
- CSV export uses the existing `downloadCsv` utility from `dashboard/src/lib/exportCsv.ts`
- All currency formatting follows the existing `formatCurrency` pattern (UGX, no decimals)
