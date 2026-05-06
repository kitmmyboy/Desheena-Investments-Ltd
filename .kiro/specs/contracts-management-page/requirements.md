# Requirements Document

## Introduction

This feature introduces a dedicated Contracts page to the Desheena Waste Management dashboard. Currently, contracts are only visible as a read-only tab inside the Billing page and can only be created or status-changed through the client detail panel. Staff need a central place to view all contracts across clients, create new ones, edit existing ones (monthly rate, dates), and manage contract lifecycle (suspend, resume, terminate). The page will live at `/dashboard/contracts` and be accessible to Admin and Finance roles.

The system enforces a clear separation of concerns: the ContractPanel inside the Client Detail view is a **quick-actions panel only** (view current contract, view history, create, suspend, terminate). The dedicated Contracts page is the **source of truth** for full management — advanced editing, filtering, reporting, and bulk operations.

## Glossary

- **Contracts_Page**: The new dedicated page at `/dashboard/contracts` that provides full contract management.
- **Contract**: A record in the `contracts` table linking a client to a service agreement with fields: `id`, `client_id`, `start_date`, `end_date` (nullable), `monthly_rate`, `status` (`active | suspended | terminated`), `updated_at`.
- **Effective_Status**: The derived display status of a contract — `ended` when `end_date` is in the past, otherwise the stored `status` value (`active`, `suspended`, or `terminated`).
- **Contract_Form**: The modal form used to create or edit a contract.
- **ContractsPage_Component**: The React component that renders the Contracts_Page.
- **ContractPanel_Component**: The quick-actions panel embedded in the Client Detail view (Contracts tab). Provides view, history, and quick status actions only — not full editing.
- **useContracts_Hook**: The TanStack Query hook that fetches and caches contract data from Supabase.
- **Contract_Timeline**: A chronological display of status changes for a contract (e.g. Active → Suspended → Resumed → Terminated).
- **Terminate_Effective_Date**: The date on which a termination takes effect, defaulting to the current date but optionally set by the user.
- **Staff**: An authenticated user with the Admin or Finance role.
- **Admin**: A user with the `Admin` role who has full access to all features.
- **Finance**: A user with the `Finance` role who has access to billing and contract management.

---

## Requirements

### Requirement 1: Dedicated Contracts Page with Navigation

**User Story:** As a staff member, I want a dedicated Contracts page in the sidebar navigation, so that I can access contract management without going through the Billing page.

#### Acceptance Criteria

1. THE Contracts_Page SHALL be accessible at the route `/dashboard/contracts`.
2. WHEN a user with the Admin role is authenticated, THE Sidebar SHALL display a "Contracts" navigation link pointing to `/dashboard/contracts`.
3. WHEN a user with the Finance role is authenticated, THE Sidebar SHALL display a "Contracts" navigation link pointing to `/dashboard/contracts`.
4. WHEN a user with the Operations_Manager role is authenticated, THE Sidebar SHALL NOT display a "Contracts" navigation link.
5. WHEN an unauthenticated user navigates to `/dashboard/contracts`, THE ProtectedRoute SHALL redirect the user to `/login`.
6. WHEN a user without the Admin or Finance role navigates to `/dashboard/contracts`, THE ProtectedRoute SHALL redirect the user to the unauthorized page.

---

### Requirement 2: Contract List View

**User Story:** As a staff member, I want to see all contracts in a paginated, filterable table, so that I can quickly find and review any contract.

#### Acceptance Criteria

1. WHEN the Contracts_Page loads, THE ContractsPage_Component SHALL display a table of all contracts fetched via the useContracts_Hook, showing columns: Client Name, Monthly Rate (UGX), Start Date, End Date, Effective Status.
2. WHEN contracts are loading, THE ContractsPage_Component SHALL display a loading skeleton in place of the table rows.
3. WHEN the useContracts_Hook returns an error, THE ContractsPage_Component SHALL display an error message describing the failure.
4. WHEN no contracts match the active filters, THE ContractsPage_Component SHALL display an empty-state message in the table body.
5. THE ContractsPage_Component SHALL support filtering contracts by Effective_Status using a dropdown with options: All, Active, Suspended, Terminated, Ended.
6. THE ContractsPage_Component SHALL support a text search input that filters contracts by client name, with a debounce of no more than 300 milliseconds.
7. THE ContractsPage_Component SHALL support server-side pagination with configurable page sizes of 25, 50, and 100 rows.
8. WHEN the total contract count exceeds the current page size, THE ContractsPage_Component SHALL display pagination controls (previous page, next page, current page indicator).

---

### Requirement 3: Create Contract

**User Story:** As a staff member, I want to create a new contract for a client, so that I can register a new service agreement.

#### Acceptance Criteria

1. WHEN a user with the Admin or Finance role views the Contracts_Page, THE ContractsPage_Component SHALL display a "+ New Contract" button.
2. WHEN the "+ New Contract" button is clicked, THE ContractsPage_Component SHALL open the Contract_Form in a modal overlay.
3. THE Contract_Form SHALL include the following fields: Client (required, searchable dropdown of existing clients), Start Date (required, date picker), End Date (optional, date picker), Monthly Rate in UGX (required, positive integer).
4. WHEN the Contract_Form is submitted with a missing required field, THE Contract_Form SHALL display an inline validation error for each missing field and SHALL NOT submit to Supabase.
5. WHEN the Contract_Form is submitted with an End Date earlier than the Start Date, THE Contract_Form SHALL display a validation error on the End Date field and SHALL NOT submit to Supabase.
6. WHEN the Contract_Form is submitted with a Monthly Rate that is not a positive integer, THE Contract_Form SHALL display a validation error on the Monthly Rate field and SHALL NOT submit to Supabase.
7. WHEN the Contract_Form is submitted for a client that already has an active contract, THE Contract_Form SHALL display a validation error stating that the client already has an active contract and SHALL NOT submit to Supabase.
8. WHEN a valid Contract_Form is submitted, THE Contract_Form SHALL insert a new record into the `contracts` table with `status` set to `active` and SHALL invalidate the contracts query cache.
9. WHEN the contract is successfully created, THE Contract_Form SHALL close the modal and THE ContractsPage_Component SHALL display the new contract in the table.
10. WHEN the Supabase insert fails, THE Contract_Form SHALL display the error message returned by Supabase and SHALL remain open.
11. WHEN the modal is open and the user presses the Escape key, THE ContractsPage_Component SHALL close the modal without saving.

---

### Requirement 4: Edit Contract

**User Story:** As a staff member, I want to edit an existing contract's details, so that I can correct or update the monthly rate or contract dates.

#### Acceptance Criteria

1. WHEN a user with the Admin or Finance role views the contract table, THE ContractsPage_Component SHALL display an "Edit" action for each contract row whose Effective_Status is NOT `terminated`.
2. WHEN the "Edit" action is clicked for a contract, THE ContractsPage_Component SHALL open the Contract_Form pre-populated with the selected contract's current values.
3. WHEN the Contract_Form is in edit mode, THE Contract_Form SHALL allow updating: Start Date, End Date, and Monthly Rate.
4. WHEN the Contract_Form is in edit mode, THE Contract_Form SHALL NOT allow changing the associated Client.
5. WHEN a contract's Effective_Status is `terminated`, THE ContractsPage_Component SHALL NOT display an "Edit" action for that contract.
6. WHEN a valid edited Contract_Form is submitted, THE Contract_Form SHALL update the existing `contracts` record in Supabase and SHALL invalidate the contracts query cache.
7. WHEN the Supabase update fails, THE Contract_Form SHALL display the error message returned by Supabase and SHALL remain open.
8. WHEN the contract is successfully updated, THE Contract_Form SHALL close the modal and THE ContractsPage_Component SHALL reflect the updated values in the table.

---

### Requirement 5: Contract Status Lifecycle

**User Story:** As a staff member, I want to suspend, resume, or terminate a contract following defined lifecycle rules, so that the system accurately reflects the current state of each client's service agreement.

#### Acceptance Criteria

1. WHEN a user with the Admin or Finance role views the contract table, THE ContractsPage_Component SHALL display a "Change Status" action for each contract whose Effective_Status is `active` or `suspended`.
2. WHEN the "Change Status" action is clicked for an `active` contract, THE ContractsPage_Component SHALL offer the following transitions: `suspended` or `terminated`.
3. WHEN the "Change Status" action is clicked for a `suspended` contract, THE ContractsPage_Component SHALL offer the following transitions: `active` (resume) or `terminated`.
4. WHEN a contract's Effective_Status is `terminated` or `ended`, THE ContractsPage_Component SHALL NOT display a "Change Status" action for that contract.
5. THE ContractsPage_Component SHALL NOT allow transitioning a `terminated` contract to any other status.
6. WHEN a new status is confirmed, THE ContractsPage_Component SHALL update the `status` field of the contract in Supabase and SHALL invalidate the contracts query cache.
7. WHEN the Supabase status update fails, THE ContractsPage_Component SHALL display an error message and SHALL retain the contract's previous status in the UI.

---

### Requirement 6: Contract Termination Behavior

**User Story:** As a staff member, I want termination to automatically set the contract end date and lock the record, so that terminated contracts are permanently closed and cannot be accidentally modified.

#### Acceptance Criteria

1. WHEN a user initiates termination of a contract, THE ContractsPage_Component SHALL display a confirmation dialog that includes an optional "Terminate Effective Date" date picker, defaulting to the current date.
2. WHEN the termination is confirmed, THE ContractsPage_Component SHALL update the contract's `status` to `terminated` and set `end_date` to the selected Terminate_Effective_Date in Supabase.
3. WHEN a contract's `status` is `terminated`, THE ContractsPage_Component SHALL render the contract row as read-only and SHALL NOT display Edit or Change Status actions for that contract.
4. WHEN a contract is terminated, THE System SHALL immediately exclude that contract from invoice generation.
5. WHEN a user attempts to resume service for a client whose contract is `terminated`, THE ContractsPage_Component SHALL display a message indicating that a new contract must be created, and SHALL provide a shortcut to the "+ New Contract" flow pre-filled with the client.

---

### Requirement 7: One Active Contract Per Client

**User Story:** As a staff member, I want the system to prevent creating a second active contract for a client that already has one, so that double billing and conflicting agreements are avoided.

#### Acceptance Criteria

1. WHEN the Contract_Form is submitted with a selected client that already has a contract with `status = active`, THE Contract_Form SHALL display a validation error: "This client already has an active contract. Suspend or terminate the existing contract before creating a new one."
2. THE Contract_Form SHALL perform this validation before submitting to Supabase.
3. WHEN a client's existing contract has `status = suspended` or `status = terminated`, THE Contract_Form SHALL allow creating a new contract for that client.
4. WHEN a client's existing contract has `status = terminated`, THE Contract_Form SHALL allow creating a new contract for that client (terminated contracts are final and do not block new contracts).

---

### Requirement 8: Billing Rules by Contract Status

**User Story:** As a finance staff member, I want the billing system to respect contract status, so that only active contracts generate invoices and suspended or terminated contracts are excluded.

#### Acceptance Criteria

1. WHILE a contract's `status` is `active`, THE Billing_System SHALL include that contract in monthly invoice generation.
2. WHILE a contract's `status` is `suspended`, THE Billing_System SHALL exclude that contract from invoice generation for the duration of the suspension.
3. WHEN a contract's `status` is set to `terminated`, THE Billing_System SHALL permanently exclude that contract from all future invoice generation.
4. WHEN a suspended contract's `status` is changed back to `active`, THE Billing_System SHALL resume including that contract in invoice generation from the next billing cycle.

---

### Requirement 9: ContractPanel Quick Actions (Client Detail)

**User Story:** As a staff member viewing a client's detail page, I want a quick-actions panel for contracts, so that I can perform common contract operations without navigating away to the full Contracts page.

#### Acceptance Criteria

1. WHEN a user views the Contracts tab of a client detail view, THE ContractPanel_Component SHALL display the client's current contract details (status, monthly rate, start date, end date).
2. WHEN a client has no active or suspended contract, THE ContractPanel_Component SHALL display a "Create Contract" button that opens the Contract_Form pre-filled with the client.
3. WHEN a client has an `active` contract, THE ContractPanel_Component SHALL display quick-action buttons: "Suspend" and "Terminate".
4. WHEN a client has a `suspended` contract, THE ContractPanel_Component SHALL display quick-action buttons: "Resume" and "Terminate".
5. WHEN a client has a `terminated` contract, THE ContractPanel_Component SHALL display the contract as read-only with no action buttons, and SHALL display a "Create New Contract" button.
6. THE ContractPanel_Component SHALL display a "View Contract History" link that navigates to the Contracts_Page filtered to that client's contracts.
7. THE ContractPanel_Component SHALL NOT provide advanced editing (monthly rate, dates) — those actions SHALL be performed on the Contracts_Page.
8. WHEN a quick action (Suspend, Resume, Terminate) is performed via the ContractPanel_Component, THE ContractPanel_Component SHALL apply the same lifecycle rules defined in Requirement 5 and Requirement 6.

---

### Requirement 10: Contract History View

**User Story:** As a staff member, I want to view the full contract history for a client, so that I can understand the timeline of their service agreements.

#### Acceptance Criteria

1. WHEN the Contracts_Page is filtered to a specific client, THE ContractsPage_Component SHALL display all contracts for that client (active, suspended, terminated, and ended), ordered by start date descending.
2. WHEN a contract detail view or history view is displayed, THE ContractsPage_Component SHALL show a Contract_Timeline for each contract, listing status change events in chronological order with their dates (e.g. Jan 2025 — Active, Mar 2025 — Suspended, Apr 2025 — Resumed, Aug 2025 — Terminated).
3. THE Contract_Timeline SHALL be read-only and SHALL NOT provide editing controls.

---

### Requirement 11: Export Contracts

**User Story:** As a staff member, I want to export the current filtered contract list to CSV, so that I can use the data in external reports.

#### Acceptance Criteria

1. THE ContractsPage_Component SHALL display an "Export CSV" button in the page toolbar.
2. WHEN the "Export CSV" button is clicked, THE ContractsPage_Component SHALL download a CSV file containing the currently filtered and visible contracts with columns: Client Name, Monthly Rate (UGX), Start Date, End Date, Status.
3. WHEN no contracts are visible (empty table), THE ContractsPage_Component SHALL disable the "Export CSV" button.

---

### Requirement 12: Link to Client

**User Story:** As a staff member, I want to navigate from a contract to its associated client, so that I can quickly view the client's full profile.

#### Acceptance Criteria

1. WHEN a contract row is displayed in the table, THE ContractsPage_Component SHALL render the Client Name as a navigable link.
2. WHEN the Client Name link is clicked, THE ContractsPage_Component SHALL navigate the user to the Clients page filtered to that client, or to the client detail view if one exists.
