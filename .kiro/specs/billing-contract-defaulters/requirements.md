# Requirements Document

## Introduction

This feature enhances the waste management dashboard's billing module with three interconnected capabilities:

1. **Invoice enhancements** — When generating an invoice, the system auto-populates the contract rate, shows how much the client has already paid for the selected period, and displays the outstanding balance. The invoice form makes the billing month and due amount explicit.

2. **Contract management** — A dedicated Contracts tab on the Billing page lets staff view all client contracts, filter by status (Active / Inactive/Ended), and see key contract details (duration, monthly rate, start/end date, status).

3. **Contract-powered Defaulters** — The existing Defaulters tab is re-powered by contract data. A defaulter is a client who has a contract but has not paid for all months covered by that contract. Defaulters are split into two categories: those whose contract is still active but are behind on payments, and those whose contract has ended but still carry an outstanding balance.

The app is a React + TypeScript + Supabase dashboard (Vite, TailwindCSS, React Query). The existing `contracts` table has `start_date`, `end_date`, `monthly_rate`, `status` (`active | suspended | terminated`), and a foreign key to `clients`. The existing `invoices` table has `contract_id`, `invoice_period`, `amount`, `paid_amount`, `status`, and `due_date`. The existing `payments` table records individual payment transactions.

---

## Glossary

- **Billing_Page**: The `/billing` route in the dashboard, containing the Invoices, Defaulters, and (new) Contracts tabs.
- **Invoice_Form**: The "Generate Invoice" modal form accessed from the Invoices tab.
- **Contract**: A record in the `contracts` table linking a client to a service agreement with a `monthly_rate`, `start_date`, optional `end_date`, and `status`.
- **Contract_Duration**: The number of calendar months between a contract's `start_date` and `end_date` (inclusive). For open-ended contracts with no `end_date`, duration is calculated up to the current month.
- **Expected_Total**: The sum of all monthly charges a client should have paid under their contract from `start_date` to the lesser of `end_date` or the current month.
- **Amount_Paid**: The sum of all `paid_amount` values on invoices linked to a client's contract.
- **Outstanding_Balance**: `Expected_Total` minus `Amount_Paid`. A positive value means the client owes money.
- **Months_Unpaid**: The number of contract months for which no invoice has been marked `paid` or for which the `paid_amount` is less than the `monthly_rate`.
- **Active_Contract_Defaulter**: A client whose contract `status` is `active` and whose `Outstanding_Balance` is greater than zero.
- **Ended_Contract_Defaulter**: A client whose contract `status` is `terminated` or whose `end_date` is in the past, and whose `Outstanding_Balance` is greater than zero.
- **Defaulter_Category**: Either `active` (Active Contract Defaulter) or `ended` (Ended Contract Defaulter).
- **Contracts_Tab**: A new tab on the Billing_Page that lists all contracts with filtering by status.
- **Invoice_Period**: A calendar month expressed as `YYYY-MM`, representing the month an invoice covers.
- **System**: The waste management dashboard web application.

---

## Requirements

### Requirement 1: Contract Rate Auto-Population on Invoice Form

**User Story:** As a Finance staff member, I want the invoice form to automatically show the client's contracted monthly rate when I select a client, so that I don't have to look up the rate manually and can avoid billing errors.

#### Acceptance Criteria

1. WHEN a client is selected in the Invoice_Form, THE System SHALL fetch the client's most recent active Contract and populate the Amount field with the Contract's `monthly_rate`.
2. WHEN a client is selected and no active Contract exists for that client, THE System SHALL leave the Amount field empty and display the message "No active contract found — enter amount manually."
3. WHEN a client is selected and an active Contract exists, THE System SHALL display the contract rate as a read-only hint below the Amount field in the format "Contract rate: UGX {amount}".
4. THE Invoice_Form SHALL allow the Finance staff member to override the auto-populated amount by editing the Amount field directly.
5. WHEN the selected client changes, THE System SHALL clear and re-populate the Amount field based on the newly selected client's contract.

---

### Requirement 2: Paid Amount and Outstanding Balance Display on Invoice Form

**User Story:** As a Finance staff member, I want to see how much a client has already paid for the selected invoice period and what their outstanding balance is, so that I can issue accurate invoices and avoid double-billing.

#### Acceptance Criteria

1. WHEN a client and Invoice_Period are both selected in the Invoice_Form, THE System SHALL query existing invoices for that client and period and display the total `paid_amount` as "Paid this period: UGX {amount}".
2. WHEN a client and Invoice_Period are both selected and no prior invoices exist for that period, THE System SHALL display "Paid this period: UGX 0".
3. WHEN a client and Invoice_Period are both selected, THE System SHALL compute and display the Outstanding_Balance as "Outstanding: UGX {amount}" where Outstanding_Balance = Amount field value − Paid this period.
4. WHEN the Amount field value or the Invoice_Period changes, THE System SHALL recalculate and update the Outstanding_Balance display in real time.
5. WHEN the Outstanding_Balance is zero or negative, THE System SHALL display a warning: "This client has no outstanding balance for the selected period."

---

### Requirement 3: Invoice Period Label Clarity

**User Story:** As a Finance staff member, I want the invoice to clearly show which month it covers and the due amount, so that clients and staff can immediately understand what is being billed.

#### Acceptance Criteria

1. THE Invoice_Form SHALL display the Invoice_Period selector as a month picker (YYYY-MM) with a human-readable label such as "July 2025".
2. WHEN an invoice is generated, THE System SHALL store the `invoice_period` in `YYYY-MM` format in the `invoices` table.
3. THE Invoice_Form SHALL display the due date as "Due: {date}" computed as 14 days from the generation date, visible before the user submits.
4. WHEN an invoice is successfully generated, THE System SHALL display a confirmation message that includes the client name, invoice period (human-readable month name), and total amount.

---

### Requirement 4: Contract Duration and End Date

**User Story:** As a Finance staff member, I want contracts to have a defined duration and end date, so that I can track when a contract expires and identify clients who have not fulfilled their payment obligations.

#### Acceptance Criteria

1. THE System SHALL support an optional `end_date` field on each Contract, representing the last month of service covered by the contract.
2. WHEN a Contract has an `end_date` that is earlier than today's date, THE System SHALL display the contract status as "Ended" in the Contracts_Tab, regardless of the stored `status` value.
3. WHEN a Contract has an `end_date` that is today or in the future, THE System SHALL display the contract status using the stored `status` value (`active`, `suspended`, or `terminated`).
4. WHEN a Contract has no `end_date`, THE System SHALL treat the contract as open-ended and display the stored `status` value.
5. THE System SHALL display the Contract_Duration in the Contracts_Tab as the number of months between `start_date` and `end_date` (or current month if no `end_date`), formatted as "{N} months".

---

### Requirement 5: Contracts Tab on Billing Page

**User Story:** As a Finance staff member or Admin, I want a dedicated Contracts tab on the Billing page, so that I can view and manage all client contracts in one place.

#### Acceptance Criteria

1. THE Billing_Page SHALL include a "Contracts" tab alongside the existing "Invoices" and "Defaulters" tabs.
2. THE Contracts_Tab SHALL display a table with the following columns: Client Name, Monthly Rate (UGX), Start Date, End Date, Duration, Status.
3. THE Contracts_Tab SHALL provide a filter control with options: "All", "Active", "Inactive / Ended" to filter contracts by their effective status.
4. WHEN the "Active" filter is selected, THE Contracts_Tab SHALL display only contracts whose stored `status` is `active` AND whose `end_date` is either null or in the future.
5. WHEN the "Inactive / Ended" filter is selected, THE Contracts_Tab SHALL display contracts whose stored `status` is `terminated` or `suspended`, OR whose `end_date` is in the past.
6. THE Contracts_Tab SHALL display the total count of contracts matching the current filter.
7. THE Contracts_Tab SHALL support exporting the filtered contract list as a CSV file.

---

### Requirement 6: Contract-Powered Defaulters Calculation

**User Story:** As a Finance staff member, I want the Defaulters tab to identify clients who have not paid all months of their contract, so that I can follow up on genuine payment gaps rather than just overdue invoice statuses.

#### Acceptance Criteria

1. THE System SHALL define a defaulter as a client who has a Contract and whose Outstanding_Balance is greater than zero.
2. WHEN computing Outstanding_Balance for a client, THE System SHALL sum the `monthly_rate` for each contract month from `start_date` to the lesser of `end_date` or the current month to produce Expected_Total.
3. WHEN computing Outstanding_Balance for a client, THE System SHALL sum all `paid_amount` values on invoices linked to that client's contract to produce Amount_Paid.
4. THE System SHALL compute Outstanding_Balance as Expected_Total minus Amount_Paid.
5. THE System SHALL compute Months_Unpaid as the number of contract months for which the cumulative paid amount does not cover the monthly rate.
6. WHEN a client's Outstanding_Balance is zero or negative, THE System SHALL NOT include that client in the defaulters list.

---

### Requirement 7: Active Contract Defaulters Category

**User Story:** As a Finance staff member, I want to see clients who are behind on payments while their contract is still running, so that I can proactively collect payments before the contract ends.

#### Acceptance Criteria

1. THE Defaulters tab SHALL display an "Active Contract Defaulters" sub-view showing clients whose contract `status` is `active`, whose `end_date` is null or in the future, and whose Outstanding_Balance is greater than zero.
2. THE Active_Contract_Defaulters view SHALL display the following columns: Client Name, Phone, Monthly Rate (UGX), Months Unpaid, Outstanding Balance (UGX), Contract End Date.
3. WHEN a client has no `end_date` on their contract, THE System SHALL display "Open-ended" in the Contract End Date column.
4. THE Active_Contract_Defaulters view SHALL sort clients by Outstanding_Balance descending by default.

---

### Requirement 8: Ended Contract Defaulters Category

**User Story:** As a Finance staff member, I want to see clients whose contracts have ended but who still owe money, so that I can pursue final collections on expired agreements.

#### Acceptance Criteria

1. THE Defaulters tab SHALL display an "Ended Contract Defaulters" sub-view showing clients whose contract `end_date` is in the past OR whose contract `status` is `terminated`, and whose Outstanding_Balance is greater than zero.
2. THE Ended_Contract_Defaulters view SHALL display the following columns: Client Name, Phone, Monthly Rate (UGX), Contract End Date, Months Unpaid, Outstanding Balance (UGX).
3. THE Ended_Contract_Defaulters view SHALL sort clients by Outstanding_Balance descending by default.
4. WHEN a contract's `status` is `terminated` but has no `end_date`, THE System SHALL use the contract's `updated_at` date as the effective end date for display purposes.

---

### Requirement 9: Defaulters Tab Filter Controls

**User Story:** As a Finance staff member, I want to switch between viewing active-contract defaulters and ended-contract defaulters, so that I can focus my collection efforts on the right group.

#### Acceptance Criteria

1. THE Defaulters tab SHALL provide a filter control with options: "All Defaulters", "Active Contract Defaulters", "Ended Contract Defaulters".
2. WHEN "All Defaulters" is selected, THE Defaulters tab SHALL display all clients with an Outstanding_Balance greater than zero, regardless of contract status.
3. WHEN "Active Contract Defaulters" is selected, THE Defaulters tab SHALL display only Active_Contract_Defaulters.
4. WHEN "Ended Contract Defaulters" is selected, THE Defaulters tab SHALL display only Ended_Contract_Defaulters.
5. THE Defaulters tab SHALL display the count of defaulters matching the current filter in the format "{N} client(s) with outstanding balance".
6. THE Defaulters tab SHALL support exporting the currently filtered defaulters list as a CSV file including all visible columns.

---

### Requirement 10: Defaulter Detail — Unpaid Months Breakdown

**User Story:** As a Finance staff member, I want to see which specific months a defaulting client has not paid, so that I can communicate clearly with the client about what is owed.

#### Acceptance Criteria

1. WHEN a defaulter row is expanded or selected in the Defaulters tab, THE System SHALL display a breakdown of each contract month with its payment status: "Paid", "Partial", or "Unpaid".
2. WHEN a contract month has a corresponding invoice with `paid_amount` equal to or greater than `monthly_rate`, THE System SHALL display that month as "Paid".
3. WHEN a contract month has a corresponding invoice with `paid_amount` greater than zero but less than `monthly_rate`, THE System SHALL display that month as "Partial" and show the remaining amount.
4. WHEN a contract month has no corresponding invoice or an invoice with `paid_amount` of zero, THE System SHALL display that month as "Unpaid" and show the full `monthly_rate` as the amount owed.
5. THE System SHALL display the month breakdown in chronological order from oldest to newest.
