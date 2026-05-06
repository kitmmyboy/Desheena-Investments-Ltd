# Technical Design: Contracts Management Page

## Overview

This document describes the technical design for the dedicated Contracts Management page (`/dashboard/contracts`) and the refactored `ContractPanel` quick-actions component. The feature gives Admin and Finance staff a central place to create, edit, and manage the full lifecycle of client contracts, while keeping the existing `ContractPanel` in the Client Detail view as a lightweight quick-actions panel.

The implementation is entirely client-side: React + TypeScript + TailwindCSS, Supabase Postgres as the data store, TanStack Query for data fetching/caching, and TanStack Table for the tabular view. No new Edge Functions are required.

---

## Architecture

The feature follows the same layered architecture used throughout the dashboard:

```
┌─────────────────────────────────────────────────────────────┐
│  Routing (App.tsx)                                          │
│  /dashboard/contracts → ProtectedRoute [Admin, Finance]     │
│                       → ContractsPage (lazy)                │
└────────────────────────────┬────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────┐
│  ContractsPage (features/contracts/)                        │
│  ┌──────────────────┐  ┌──────────────────────────────────┐ │
│  │  Toolbar         │  │  ContractTable (TanStack Table)  │ │
│  │  - Search input  │  │  - Client Name (link)            │ │
│  │  - Status filter │  │  - Monthly Rate                  │ │
│  │  - Export CSV    │  │  - Start / End Date              │ │
│  │  - New Contract  │  │  - Effective Status badge        │ │
│  └──────────────────┘  │  - Edit action                   │ │
│                        │  - Change Status action          │ │
│  ┌──────────────────┐  └──────────────────────────────────┘ │
│  │  ContractForm    │                                        │
│  │  (modal)         │  ┌──────────────────────────────────┐ │
│  └──────────────────┘  │  ContractTimeline (read-only)    │ │
│                        └──────────────────────────────────┘ │
│  ┌──────────────────┐                                        │
│  │  TerminateDialog │                                        │
│  │  (modal)         │                                        │
│  └──────────────────┘                                        │
└────────────────────────────┬────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────┐
│  Data Layer                                                 │
│  useContractsPage hook  (new — server-side pagination +     │
│                          full status filter)                │
│  useContractMutations hook  (new — create / update / status)│
│  useContractHistory hook    (new — per-client timeline)     │
│  contractCalculations.ts    (existing — computeEffective…)  │
└────────────────────────────┬────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────┐
│  Supabase Postgres                                          │
│  contracts table  (existing)                                │
│  clients table    (existing, joined for name)               │
└─────────────────────────────────────────────────────────────┘
```

### Key architectural decisions

**New feature directory.** All new files live in `dashboard/src/features/contracts/`. This keeps the billing feature untouched and avoids polluting the existing `useContracts` hook (which is used by `BillingPage` with its own filter shape).

**New `useContractsPage` hook.** The existing `useContracts` hook in `billing/` uses a simple `'all' | 'active' | 'inactive'` filter and fetches all rows client-side. The new page needs server-side pagination, a richer status filter (including `ended`), and a client-name search. A new hook avoids breaking the billing page.

**`computeEffectiveStatus` reused.** The existing pure function in `contractCalculations.ts` is imported directly — no duplication.

**ContractPanel refactored in-place.** The existing `ContractPanel.tsx` is updated to remove the full create form and replace it with quick-action buttons (Suspend, Resume, Terminate, Create New Contract). The internal `useCreateContract` / `useUpdateContractStatus` hooks it owns are kept but simplified.

---

## Components and Interfaces

### New files

```
dashboard/src/features/contracts/
  index.ts
  ContractsPage.tsx          — page component
  ContractForm.tsx           — create/edit modal form
  TerminateDialog.tsx        — termination confirmation with date picker
  ContractTimeline.tsx       — read-only chronological status events
  useContractsPage.ts        — TanStack Query hook (list + pagination)
  useContractMutations.ts    — create / update / status-change mutations
  useContractHistory.ts      — per-client contract history query
```

### Modified files

```
dashboard/src/features/clients/ContractPanel.tsx  — refactored to quick-actions only
dashboard/src/components/Sidebar.tsx              — add Contracts nav item for Admin + Finance
dashboard/src/App.tsx                             — add /dashboard/contracts route
```

---

### `useContractsPage` hook

```typescript
interface ContractsPageFilters {
  page: number           // 0-indexed
  pageSize: number       // 25 | 50 | 100
  search?: string        // client name search (ilike)
  status?: 'all' | 'active' | 'suspended' | 'terminated' | 'ended'
  clientId?: string      // for client-filtered history view
}

interface ContractRow {
  id: string
  client_id: string
  client_name: string
  monthly_rate: number
  start_date: string
  end_date: string | null
  status: 'active' | 'suspended' | 'terminated'
  effective_status: 'active' | 'suspended' | 'terminated' | 'ended'
  updated_at: string
}

function useContractsPage(filters: ContractsPageFilters): {
  data: ContractRow[]
  count: number
  isLoading: boolean
  error: Error | null
}
```

**Implementation notes:**
- Fetches from `contracts` table with a join on `clients(name)`.
- `search` maps to `.ilike('clients.name', '%term%')` — requires a Supabase join filter.
- `status` filter: `active | suspended | terminated` are server-side `.eq('status', …)` filters. `ended` is computed client-side after fetch (end_date < today). `all` fetches without a status filter.
- Server-side pagination via `.range(from, to)` with `{ count: 'exact' }`.
- Query key: `['contracts-page', filters]`.

### `useContractMutations` hook

```typescript
function useContractMutations(): {
  createContract: UseMutationResult<ContractRow, Error, CreateContractInput>
  updateContract: UseMutationResult<ContractRow, Error, UpdateContractInput>
  updateStatus: UseMutationResult<ContractRow, Error, UpdateStatusInput>
  terminateContract: UseMutationResult<ContractRow, Error, TerminateInput>
}

interface CreateContractInput {
  client_id: string
  start_date: string
  end_date?: string | null
  monthly_rate: number
}

interface UpdateContractInput {
  id: string
  start_date: string
  end_date?: string | null
  monthly_rate: number
}

interface UpdateStatusInput {
  id: string
  status: 'active' | 'suspended'   // terminated goes through terminateContract
}

interface TerminateInput {
  id: string
  effective_date: string   // YYYY-MM-DD, defaults to today
}
```

**On success:** all mutations call `queryClient.invalidateQueries({ queryKey: ['contracts-page'] })` and `queryClient.invalidateQueries({ queryKey: ['contracts'] })` (to keep BillingPage in sync) and `queryClient.invalidateQueries({ queryKey: ['clients'] })`.

**`terminateContract`** sets `status = 'terminated'` and `end_date = effective_date` in a single Supabase `.update()` call.

**One-active-contract validation** is performed in `createContract` before the Supabase insert: query `contracts` for `client_id = X AND status = 'active'`; if a row exists, throw a validation error without hitting the insert endpoint.

### `useContractHistory` hook

```typescript
function useContractHistory(clientId: string): {
  data: ContractRow[]
  isLoading: boolean
  error: Error | null
}
```

Fetches all contracts for a client ordered by `start_date DESC`. Used by `ContractTimeline` and by the client-filtered view on `ContractsPage`.

### `ContractForm` component

Props:
```typescript
interface ContractFormProps {
  contract?: ContractRow | null   // null = create mode, defined = edit mode
  defaultClientId?: string        // pre-fills client when opened from ContractPanel
  onClose: () => void
}
```

Fields:
- **Client** (create mode only): searchable `<select>` populated from `useClients({ pageSize: 500 })`. Disabled in edit mode, showing client name as read-only text.
- **Start Date**: `<input type="date">`, required.
- **End Date**: `<input type="date">`, optional. Must be ≥ Start Date if provided.
- **Monthly Rate (UGX)**: `<input type="number" min="1" step="1">`, required, positive integer.

Validation runs on submit (and on blur for touched fields). All validation is client-side before any Supabase call.

### `TerminateDialog` component

Props:
```typescript
interface TerminateDialogProps {
  contract: ContractRow
  onConfirm: (effectiveDate: string) => void
  onCancel: () => void
  isLoading: boolean
}
```

Renders a confirmation modal with:
- Warning text explaining termination is permanent.
- Optional date picker for "Terminate Effective Date", defaulting to today (`new Date().toISOString().split('T')[0]`).
- "Confirm Termination" (destructive, red) and "Cancel" buttons.

### `ContractTimeline` component

Props:
```typescript
interface ContractTimelineProps {
  contracts: ContractRow[]   // all contracts for a client, ordered by start_date DESC
}
```

Renders a vertical timeline. Each contract is a timeline entry showing:
- Start date → End date (or "Present")
- Status badge
- `updated_at` as the last-changed date

This is a read-only display component with no interactive controls.

### `ContractsPage` component

State:
```typescript
const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 25 })
const [statusFilter, setStatusFilter] = useState<string>('all')
const [searchInput, setSearchInput] = useState('')
const [search, setSearch] = useState('')          // debounced from searchInput
const [modalMode, setModalMode] = useState<'create' | 'edit' | 'terminate' | null>(null)
const [selectedContract, setSelectedContract] = useState<ContractRow | null>(null)
```

Search debounce: 300 ms via `useEffect` + `setTimeout`, same pattern as `ClientsPage`.

TanStack Table columns:
1. Client Name — rendered as `<Link to="/dashboard/clients">` (navigates to Clients page; see Requirement 12)
2. Monthly Rate (UGX) — right-aligned, `toLocaleString()`
3. Start Date — formatted `en-UG` locale
4. End Date — formatted or "Open-ended"
5. Effective Status — badge (green/yellow/red/gray)
6. Actions — Edit button (hidden for terminated), Change Status dropdown/button (hidden for terminated/ended)

### Refactored `ContractPanel` component

The existing `ContractPanel` is simplified to:
- Display current contract details (status, rate, start/end date) — read-only.
- Show quick-action buttons based on current status:
  - `active` → "Suspend" + "Terminate"
  - `suspended` → "Resume" + "Terminate"
  - `terminated` → read-only display + "Create New Contract" button
  - no contract → "Create Contract" button
- "View Contract History" link → navigates to `/dashboard/contracts?clientId=<id>`.
- Suspend/Resume/Terminate use the same `useContractMutations` hook from the contracts feature.
- The full create/edit form is removed; "Create Contract" opens `ContractForm` in a modal (or navigates to the Contracts page with `?clientId=<id>` pre-filled).

---

## Data Models

### `contracts` table (existing, no schema changes required)

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | Primary key |
| `client_id` | `uuid` | FK → `clients.id` |
| `start_date` | `date` | Required |
| `end_date` | `date` | Nullable; set on termination |
| `monthly_rate` | `integer` | Positive integer, UGX |
| `status` | `text` | `active \| suspended \| terminated` |
| `updated_at` | `timestamptz` | Auto-updated by Supabase trigger or explicit set |
| `billing_cycle` | `text` | Existing field, kept as-is |
| `billing_model` | `text` | Existing field, kept as-is |
| `rate_per_collection` | `integer` | Existing field, nullable |
| `created_at` | `timestamptz` | Existing field |

No migrations are needed. The existing schema supports all required operations.

### Derived: `ContractRow` (client-side type)

```typescript
interface ContractRow {
  id: string
  client_id: string
  client_name: string                                          // joined from clients
  monthly_rate: number
  start_date: string                                           // YYYY-MM-DD
  end_date: string | null                                      // YYYY-MM-DD or null
  status: 'active' | 'suspended' | 'terminated'               // stored value
  effective_status: 'active' | 'suspended' | 'terminated' | 'ended'  // computed
  updated_at: string
}
```

`effective_status` is computed using the existing `computeEffectiveStatus(status, end_date, new Date())` from `contractCalculations.ts`.

### Status transition rules (enforced in UI)

```
active ──→ suspended
active ──→ terminated
suspended ──→ active   (resume)
suspended ──→ terminated
terminated ──→ (no transitions — final state)
ended ──→ (no transitions — display only)
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Status filter returns only matching contracts

*For any* set of contracts with mixed effective statuses and any specific status filter value (active, suspended, terminated, ended), all contracts returned by `useContractsPage` with that filter applied should have an `effective_status` equal to the filter value.

**Validates: Requirements 2.5**

---

### Property 2: Client name search returns only matching contracts

*For any* non-empty search string and any set of contracts, all contracts returned by `useContractsPage` with that search applied should have a `client_name` that contains the search string (case-insensitive).

**Validates: Requirements 2.6**

---

### Property 3: Required field validation blocks submission

*For any* combination of missing required fields (client, start_date, monthly_rate), submitting `ContractForm` should display a validation error for each missing field and should not invoke the Supabase insert.

**Validates: Requirements 3.4**

---

### Property 4: End date before start date is rejected

*For any* start date and any end date that is strictly earlier than the start date, submitting `ContractForm` should display a validation error on the end_date field and should not invoke the Supabase insert.

**Validates: Requirements 3.5**

---

### Property 5: Non-positive monthly rate is rejected

*For any* value for monthly_rate that is zero, negative, non-numeric, or non-integer, submitting `ContractForm` should display a validation error on the monthly_rate field and should not invoke the Supabase insert.

**Validates: Requirements 3.6**

---

### Property 6: Active contract blocks duplicate creation

*For any* client that currently has a contract with `status = 'active'`, submitting `ContractForm` for that client should display the "already has an active contract" validation error and should not invoke the Supabase insert.

**Validates: Requirements 3.7, 7.1, 7.2**

---

### Property 7: Non-active contract allows new contract creation

*For any* client whose most recent contract has `status = 'suspended'` or `status = 'terminated'` (or has no contract), submitting a valid `ContractForm` for that client should not display the "already has an active contract" error.

**Validates: Requirements 7.3, 7.4**

---

### Property 8: Edit action visibility matches effective status

*For any* contract row rendered in the table, the Edit action should be visible if and only if the contract's `effective_status` is not `'terminated'`.

**Validates: Requirements 4.1, 4.5, 6.3**

---

### Property 9: Change Status action visibility matches effective status

*For any* contract row rendered in the table, the Change Status action should be visible if and only if the contract's `effective_status` is `'active'` or `'suspended'`.

**Validates: Requirements 5.1, 5.4, 5.5, 6.3**

---

### Property 10: Termination sets status and end_date atomically

*For any* valid termination effective date, calling `terminateContract` on a contract should result in the contract having `status = 'terminated'` and `end_date = effective_date` in Supabase.

**Validates: Requirements 6.2**

---

### Property 11: Billing filter excludes non-active contracts

*For any* set of contracts, the billing invoice generation filter (which queries `status = 'active'`) should include contracts with `status = 'active'` and exclude contracts with `status = 'suspended'` or `status = 'terminated'`.

**Validates: Requirements 8.1, 8.2, 8.3, 8.4**

---

### Property 12: Client-filtered view returns only that client's contracts in descending order

*For any* `clientId` filter applied to `useContractHistory`, all returned contracts should have `client_id` equal to the filter value, and the results should be ordered by `start_date` descending.

**Validates: Requirements 10.1**

---

### Property 13: CSV export contains exactly the visible contracts

*For any* filtered set of contracts visible in the table, the CSV produced by `downloadCsv` should contain exactly those contracts (same count, same client names, same rates) with the correct column headers.

**Validates: Requirements 11.2**

---

## Error Handling

### Data fetching errors
- `useContractsPage` surfaces Supabase query errors as `Error | null`. `ContractsPage` renders a red alert banner with the error message when `error` is non-null.
- Loading state shows a `TableSkeleton` (same pattern as `ClientsPage` and `BillingPage`).

### Mutation errors
- `ContractForm` displays a red alert box below the form fields when `createContract.error` or `updateContract.error` is non-null. The modal stays open.
- `TerminateDialog` displays an inline error when `terminateContract.error` is non-null. The dialog stays open.
- Status change errors (suspend/resume) are shown as an inline error message near the action button. The contract's previous status is retained in the UI (TanStack Query does not optimistically update status changes).

### Validation errors
- All validation is synchronous and runs before any Supabase call.
- Errors are displayed inline below the relevant field.
- The "one active contract per client" check is an async pre-flight query (`supabase.from('contracts').select('id').eq('client_id', X).eq('status', 'active').maybeSingle()`). If this query itself fails, the error is surfaced as a generic form error.

### Escape / cancel
- All modals close on Escape key (via `useEffect` + `document.addEventListener('keydown', …)`, same pattern as existing modals).
- Closing a modal discards unsaved changes without confirmation (consistent with existing behavior in `ClientsPage`).

---

## Testing Strategy

### Unit tests (example-based)

Located in `dashboard/src/features/contracts/`:

- `ContractForm.test.tsx` — render tests for create/edit modes, field presence, read-only client field in edit mode, Escape key closes modal.
- `TerminateDialog.test.tsx` — default date is today, confirm/cancel callbacks fire correctly.
- `ContractTimeline.test.tsx` — renders events in chronological order for a given set of contracts.
- `ContractsPage.test.tsx` — loading skeleton, error banner, empty state, pagination controls visibility, Export CSV button disabled when empty.
- `Sidebar.test.tsx` (update existing) — Contracts link present for Admin and Finance, absent for Operations_Manager.

### Property-based tests

The project uses Vitest. Property-based tests use **fast-check** (`npm install --save-dev fast-check`), configured to run a minimum of 100 iterations per property.

Each property test is tagged with a comment in the format:
`// Feature: contracts-management-page, Property N: <property_text>`

**Properties to implement:**

| Property | Test file | fast-check arbitraries |
|---|---|---|
| P1: Status filter | `useContractsPage.test.ts` | `fc.array(fc.record({...}))`, `fc.constantFrom('active','suspended','terminated','ended')` |
| P2: Client name search | `useContractsPage.test.ts` | `fc.string()`, `fc.array(fc.record({client_name: fc.string()}))` |
| P3: Required field validation | `ContractForm.test.tsx` | `fc.subarray(['client','start_date','monthly_rate'])` |
| P4: End date before start date | `ContractForm.test.tsx` | `fc.date()`, `fc.date()` (constrained so end < start) |
| P5: Non-positive monthly rate | `ContractForm.test.tsx` | `fc.oneof(fc.integer({max: 0}), fc.float({max: 0}), fc.string())` |
| P6: Active contract blocks duplicate | `useContractMutations.test.ts` | `fc.uuid()` (client_id), mock Supabase returning active contract |
| P7: Non-active allows new contract | `useContractMutations.test.ts` | `fc.constantFrom('suspended','terminated')`, mock Supabase |
| P8: Edit action visibility | `ContractsPage.test.tsx` | `fc.record({effective_status: fc.constantFrom(...)})` |
| P9: Change Status visibility | `ContractsPage.test.tsx` | same as P8 |
| P10: Termination sets status + end_date | `useContractMutations.test.ts` | `fc.date()` for effective_date, mock Supabase update |
| P11: Billing filter excludes non-active | `contractCalculations.test.ts` (extend existing) | `fc.array(fc.record({status: fc.constantFrom(...)}))` |
| P12: Client filter + ordering | `useContractHistory.test.ts` | `fc.uuid()`, `fc.array(fc.record({client_id: fc.uuid(), start_date: fc.date()}))` |
| P13: CSV export matches visible data | `ContractsPage.test.tsx` | `fc.array(fc.record({client_name: fc.string(), monthly_rate: fc.integer({min:1}), ...}))` |

### Integration considerations

- All Supabase calls are mocked in unit/property tests using `vi.mock('../../lib/supabase')`.
- The `computeEffectiveStatus` function is already covered by `contractCalculations.test.ts`; no duplication needed.
- The billing exclusion property (P11) extends the existing `contractCalculations.test.ts` file rather than creating a new one.
