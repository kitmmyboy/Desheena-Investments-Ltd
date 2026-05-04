# Implementation Plan: Desheena Investments Ltd Waste Management System

## Overview

This plan delivers the system in four independently deployable phases as defined in Requirement 22. Each phase builds on the previous one without requiring destructive migrations. The tech stack is: Supabase (PostgreSQL + Auth + Realtime + Storage) for the backend, Flutter + Drift for the mobile app, and React + Vite + TypeScript + Tailwind CSS for the admin dashboard.

---

## Phase 1: Core MVP — Supabase Schema, Driver App, Offline Sync

### Goal
Establish the full Supabase schema (designed to support all four phases), implement the Flutter Driver App with offline-first collection recording, and wire up the sync engine.

---

- [x] 1. Set up Supabase schema and Row-Level Security policies
  - Create all database tables with UUID primary keys: `users`, `clients`, `contracts`, `routes`, `route_clients`, `route_drivers`, `collections`, `invoices`, `payments`, `complaints`, `sms_log`, `notifications`, `audit_log`
  - Add `created_at`, `updated_at` timestamps to all tables
  - Define foreign key constraints between tables (e.g., `collections.client_id → clients.id`, `collections.driver_id → users.id`)
  - Add `sync_status` column (`pending` | `synced`) to the `collections` table
  - Add `missing_gps` boolean flag to the `collections` table
  - Design schema to support all four phases without destructive future migrations
  - _Requirements: 22.1, 22.6_

  - [x] 1.1 Write RLS policies for all tables
    - Enforce per-role read/write access: Admin (all), Operations_Manager (routes, clients, collections), Finance (invoices, payments, contracts), Driver (own collections only), Customer (own invoices, payments, complaints)
    - Write policies for `clients`, `contracts`, `routes`, `route_clients`, `route_drivers`, `collections`, `invoices`, `payments`, `complaints`, `sms_log`, `notifications`, `audit_log`
    - _Requirements: 2.7, 16.1_

  - [ ]* 1.2 Write integration tests for RLS policies
    - Test that each role can only access permitted rows
    - Test that cross-role access is denied with an authorization error
    - _Requirements: 2.7, 2.8, 16.1_

- [x] 2. Implement Supabase Auth and audit logging
  - Configure Supabase Auth for email/password authentication
  - Store user role (`Admin`, `Operations_Manager`, `Driver`, `Finance`, `Customer`) in Supabase user metadata
  - Create `audit_log` table and write a Supabase database trigger (or Edge Function) to insert a row on every login, logout, and failed login event with: user_id, event_type, timestamp, ip_address
  - _Requirements: 1.1, 1.7, 16.3, 16.7_

- [x] 3. Set up Flutter project structure and dependencies
  - Initialize Flutter project with support for Android (min API 26) and iOS
  - Add dependencies: `drift` (SQLite ORM), `connectivity_plus`, `geolocator`, `flutter_map`, `latlong2`, `supabase_flutter`, `uuid`, `provider` or `riverpod` for state management
  - Configure Android `minSdkVersion` to 26 in `build.gradle`
  - Set up folder structure: `lib/core`, `lib/features/auth`, `lib/features/driver`, `lib/features/customer`, `lib/features/sync`, `lib/db`
  - _Requirements: 21.1, 21.6_

- [x] 4. Implement Local SQLite database with Drift
  - Define Drift table schemas: `collections_local`, `sync_queue`, `routes_local`, `route_clients_local`, `session_cache`
  - Add `sync_status` (`pending` | `synced`) and `missing_gps` columns to `collections_local`
  - Add `created_at` timestamp to `sync_queue` for chronological ordering
  - Generate Drift DAOs for CRUD operations on each table
  - Implement pagination query on `collections_local` returning max 200 records at a time
  - _Requirements: 4.3, 4.4, 5.6, 5.10, 21.2_

  - [ ]* 4.1 Write unit tests for Drift DAOs
    - Test insert, update, delete, and paginated query on `collections_local`
    - Test `sync_queue` ordering by `created_at`
    - _Requirements: 4.3, 5.6_

- [x] 5. Implement Flutter authentication flow
  - Build login screen with email and password fields and a submit button
  - On successful login, call Supabase Auth and cache the JWT + refresh token + user profile in `session_cache` table in Local_DB
  - On app launch, check `session_cache`; if offline and cache exists, allow access without re-authentication
  - If online and JWT is expired, silently refresh using the stored refresh token before proceeding
  - On failed login (invalid credentials), display a descriptive error message
  - On failed login (no network, no cache), display an offline login error
  - On logout, clear `session_cache` and navigate to login screen
  - After login, read role from user metadata and navigate to Driver view or Customer view accordingly
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.8, 2.9_

  - [ ]* 5.1 Write unit tests for authentication flow
    - Test offline login with valid cache
    - Test silent token refresh
    - Test error messages for invalid credentials and no-network scenarios
    - _Requirements: 1.2, 1.3, 1.4, 1.5, 1.6_

- [x] 6. Implement Driver App — Route download and display
  - On Driver app launch while online, fetch the Driver's assigned route (including all client details, GPS coordinates, and scheduled pickup times) from Supabase and upsert into `routes_local` and `route_clients_local`
  - On Driver app launch while offline, read route and daily pickup list from Local_DB
  - Build route list screen displaying each pickup with: client name, location address, waste type, and a large tap-to-record button
  - Build persistent offline/online status indicator widget visible on all Driver screens
  - _Requirements: 3.1, 3.2, 3.3, 3.5_

- [x] 7. Implement Driver App — Collection recording screen
  - Build collection recording screen pre-populated with client name and waste type when a Driver taps a client entry
  - Use large input controls: waste type dropdown, weight numeric input (kg), GPS auto-capture
  - On submit, generate a UUID v4 for the record and insert into `collections_local` with `sync_status = "pending"`
  - Simultaneously insert a corresponding entry into `sync_queue` with the record's UUID and `created_at` timestamp
  - If device GPS is unavailable, allow submission without coordinates and set `missing_gps = true`
  - Display a confirmation message after each successful local save: "Saved — pending sync"
  - Build previously-recorded collections view showing `sync_status` per record
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 5.10_

  - [ ]* 7.1 Write unit tests for collection recording
    - Test UUID generation uniqueness
    - Test `sync_queue` insertion on collection submit
    - Test `missing_gps` flag when GPS is unavailable
    - _Requirements: 4.3, 4.4, 4.5, 5.10_

- [x] 8. Implement Sync Engine
  - Create a background isolate/service (`SyncEngine`) that monitors network connectivity using `connectivity_plus`
  - When connectivity is detected, fetch all `sync_queue` records ordered by `created_at` ascending
  - Upload each record to Supabase `collections` table via the Supabase Flutter client
  - On successful upload: update `collections_local.sync_status` to `"synced"` and delete the entry from `sync_queue`
  - On network error: retain the record in `sync_queue` for retry on next connectivity event
  - On duplicate UUID conflict (HTTP 409 / unique constraint): mark local record as `"synced"` and remove from `sync_queue`
  - Batch uploads in groups of 50 records to avoid memory spikes on low-end devices
  - Expose a manual sync trigger callable from the Driver App UI
  - Ensure sync runs as a background worker and does NOT block the UI thread
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.9, 21.4_

  - [ ]* 8.1 Write unit tests for Sync Engine
    - Test chronological ordering of sync queue processing
    - Test duplicate UUID conflict handling (mark synced, remove from queue)
    - Test network error retry behavior (record retained in queue)
    - Test batch size of 50
    - _Requirements: 5.2, 5.3, 5.4, 5.5, 5.6, 21.4_

- [x] 9. Implement sync status UI and manual sync trigger
  - Build sync status widget showing: count of pending records and timestamp of last successful sync
  - Wire the manual sync button to immediately trigger `SyncEngine`
  - When device transitions from offline to online, automatically trigger `SyncEngine`
  - _Requirements: 5.7, 5.8, 3.6_

- [x] 10. Implement Driver App — Route map with OpenStreetMap
  - Integrate `flutter_map` with OpenStreetMap tiles on the Driver route screen
  - Display the Driver's assigned client stops as ordered pins on the map
  - Display the Driver's current GPS position as a distinct marker, updated every 30 seconds while the app is in the foreground
  - Cache map tiles in Local_DB for offline rendering
  - When offline, render the route map using cached tile data without network access
  - _Requirements: 17.2, 17.5, 17.6_

- [x] 11. Implement low-end device optimizations in Flutter
  - Enforce max 200 collection records loaded into memory at once; paginate older records from Local_DB
  - Compress GPS coordinates and collection data before storing in Local_DB
  - Display a low-storage warning dialog when device free storage drops below 100MB
  - Verify APK size does not exceed 30MB; apply Flutter build optimizations (tree-shaking, deferred loading) if needed
  - _Requirements: 21.2, 21.3, 21.5, 21.6_

- [x] 12. Phase 1 Checkpoint — Ensure all tests pass
  - Ensure all unit and integration tests pass
  - Verify offline collection recording works end-to-end on a physical Android device (API 26+)
  - Verify sync engine uploads pending records to Supabase when connectivity is restored
  - Ask the user if questions arise before proceeding to Phase 2.

---

## Phase 2: React Admin Dashboard — Collections, Clients, Routes

### Goal
Build the React Admin Dashboard with authentication, RBAC navigation, collections monitoring, client management, and route management.

---

- [x] 13. Set up React Admin Dashboard project
  - Initialize Vite + React + TypeScript project
  - Install and configure: Tailwind CSS, TanStack Table, React Query, Supabase JS client, Recharts, Leaflet + react-leaflet, leaflet.markercluster
  - Set up folder structure: `src/features/auth`, `src/features/clients`, `src/features/routes`, `src/features/collections`, `src/features/billing`, `src/features/complaints`, `src/features/reports`, `src/components`, `src/hooks`, `src/lib`
  - Configure React Query client with sensible defaults (stale time, retry)
  - _Requirements: 19.1, 19.3, 19.4_

- [x] 14. Implement Admin Dashboard authentication and RBAC routing
  - Build login page with email/password form calling Supabase Auth
  - On login, read role from user metadata and store in React context/state
  - Implement protected route wrapper that redirects unauthenticated users to login
  - Build role-based navigation sidebar: show/hide menu items based on role (Admin sees all; Finance sees billing/invoices/payments/reports; Operations_Manager sees routes/drivers/collections/clients; Driver and Customer roles are mobile-only)
  - On unauthorized route access, return an authorization error page and do not expose data
  - _Requirements: 1.1, 2.1, 2.4, 2.5, 2.6, 2.8_

  - [ ]* 14.1 Write unit tests for RBAC routing
    - Test that Finance role cannot access route management pages
    - Test that unauthorized access returns error page without data
    - _Requirements: 2.4, 2.8_

- [x] 15. Implement collections log screen with Realtime
  - Build collections log table using TanStack Table with server-side pagination, sorting, and filtering
  - Columns: client name, driver name, waste type, weight (kg), GPS location, collected_at, sync_status
  - Implement filters: date range, driver, route, zone, waste type, sync_status
  - Subscribe to Supabase Realtime on the `collections` table; update the table in real time when new records arrive without page refresh
  - Implement virtualized rendering for tables with more than 100 rows
  - _Requirements: 9.1, 9.2, 9.4, 19.2, 19.8_

  - [ ]* 15.1 Write unit tests for collections table filtering
    - Test each filter parameter produces correct query
    - Test Realtime subscription updates table state
    - _Requirements: 9.2, 9.4_

- [x] 16. Implement collections map view
  - Build a Leaflet + OpenStreetMap map view for collections
  - Display collection event pins color-coded by waste type
  - Color code: green = synced, yellow = pending sync, red = missed scheduled collection
  - Enable marker clustering for large datasets (50,000+ markers)
  - _Requirements: 9.3, 17.1, 17.4, 17.7_

- [x] 17. Implement KPI dashboard panel
  - Build KPI panel on the home screen displaying: total collections today, total weight collected today (kg), total revenue collected today (UGX), active clients count, pending sync records count, open complaints count
  - Use Supabase Realtime subscriptions to update KPI values in real time
  - Use Recharts for KPI visualizations where applicable
  - _Requirements: 9.5, 14.1, 19.5_

- [x] 18. Implement client management — list, create, edit
  - Build client list screen using TanStack Table with server-side pagination
  - Columns: name, phone, email, location, service frequency, monthly rate, contract status
  - Implement search and filter: zone, service frequency, contract status, payment status
  - Build client create/edit form requiring: name, phone, location text, GPS coordinates, service frequency, monthly rate (UGX)
  - On save, insert/update record in Supabase `clients` table with UUID and `created_at`; on edit, log change with editor user_id and timestamp
  - _Requirements: 6.1, 6.2, 6.3, 6.5, 6.8_

  - [ ]* 18.1 Write unit tests for client form validation
    - Test required field validation (name, phone, location, GPS, service_frequency, monthly_rate)
    - Test edit audit log entry is created with correct user_id and timestamp
    - _Requirements: 6.2, 6.5_

- [x] 19. Implement client map view
  - Build Leaflet + OpenStreetMap map displaying all client GPS pins
  - Enable marker clustering for 50,000+ client markers
  - On pin click, display popup with: client name, location text, last collection date
  - _Requirements: 6.4, 17.1, 17.3, 17.7_

- [x] 20. Implement CSV bulk client import
  - Build data import screen accepting CSV file upload
  - Parse CSV columns: name, phone, email, location_text, gps_lat, gps_lng, service_frequency, monthly_rate, zone
  - Validate each row: name, location_text, service_frequency, monthly_rate must be present and non-empty
  - Check for duplicate client (same name + phone) and skip duplicates, adding them to a duplicate report
  - Insert valid rows into Supabase `clients` table and create corresponding active `contracts` records
  - Display import summary: total rows processed, successfully imported, skipped (validation errors), skipped (duplicates), with per-row error details
  - Support monthly_rate values from 3,000 to 750,000 UGX
  - _Requirements: 6.6, 6.7, 15.1, 15.2, 15.3, 15.4, 15.5, 15.6, 15.7_

  - [ ]* 20.1 Write unit tests for CSV import validation
    - Test missing required field detection
    - Test duplicate detection (same name + phone)
    - Test monthly_rate boundary values (3,000 and 750,000 UGX)
    - Test import summary counts are accurate
    - _Requirements: 15.2, 15.4, 15.5, 15.7_

- [x] 21. Implement contract management
  - Build contract detail view on the client detail screen showing: rate, start date, billing cycle, status
  - Implement contract create form: start date, billing cycle (monthly), rate (UGX), billing model (flat or frequency-based), status
  - On contract status change to "suspended" or "terminated", update Supabase `contracts` table; invoice generation logic must check contract status before generating
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

- [x] 22. Implement route management
  - Build route list screen: route name, zone, assigned driver, client count
  - Build route create form: route name, zone
  - Build route detail screen with ordered client list and OpenStreetMap view showing client GPS pins
  - Implement assign-client-to-route: create `route_clients` record with client_id, route_id, optional sequence order
  - Implement assign-driver-to-route: create `route_drivers` record with driver_id, route_id
  - When a route is updated in Supabase, the Driver App will download the updated route on next sync (no additional dashboard work needed beyond saving to Supabase)
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

- [x] 23. Implement Admin Dashboard performance optimizations
  - Verify TanStack Table uses server-side pagination, sorting, and filtering for all tables
  - Verify virtualized rendering is active for tables with more than 100 rows
  - Measure initial dashboard load time; optimize React Query cache settings and lazy-load heavy components (map, charts) to achieve under 3 seconds on broadband
  - _Requirements: 19.2, 19.7, 19.8_

- [x] 24. Phase 2 Checkpoint — Ensure all tests pass
  - Ensure all unit and integration tests pass
  - Verify RBAC navigation hides/shows correct menu items per role
  - Verify Realtime collections updates appear without page refresh
  - Ask the user if questions arise before proceeding to Phase 3.

---

## Phase 3: Billing, Invoices, Pesapal Payments, and Reporting

### Goal
Implement automated monthly invoice generation, Pesapal payment integration, PDF invoice export, financial reporting, and Africa's Talking SMS for billing events.

---

- [x] 25. Implement automated monthly invoice generation
  - Create a Supabase Edge Function (or scheduled PostgreSQL function via `pg_cron`) that runs on the first day of each calendar month
  - Query all clients with active contracts; for each, generate an invoice record in the `invoices` table with: client_id, amount, due_date (14 days after generation), status ("unpaid"), UUID
  - For flat billing contracts: set amount = contract monthly_rate
  - For frequency-based billing contracts: calculate amount = per_collection_rate × scheduled_collections_in_month
  - After generating each invoice, trigger SMS notification to the client (see task 30)
  - _Requirements: 10.1, 10.2, 10.3, 10.4, 12.1_

  - [ ]* 25.1 Write unit tests for invoice amount calculation
    - Test flat billing: invoice amount equals contract monthly_rate
    - Test frequency-based billing: invoice amount = per_collection_rate × collection_count
    - Test due_date is exactly 14 days after generation date
    - _Requirements: 10.2, 10.3, 10.4_

- [x] 26. Implement overdue invoice status update
  - Create a Supabase Edge Function (or `pg_cron` job) that runs daily and updates invoice status to "overdue" for all invoices where `due_date < now()` and `status = "unpaid"`
  - After marking an invoice overdue, trigger SMS reminder to the client (see task 30)
  - _Requirements: 10.6, 12.2_

- [x] 27. Implement invoice list and manual invoice generation in Admin Dashboard
  - Build invoice list screen using TanStack Table: client name, invoice period, amount (UGX), due date, status (paid/unpaid/overdue)
  - Build manual invoice generation form for Finance users: select client, set period and amount
  - Build defaulters report: list all clients with one or more overdue invoices, showing total outstanding balance
  - Implement CSV export of invoice list
  - _Requirements: 10.5, 10.7, 10.8, 10.10_

- [x] 28. Implement PDF invoice generation
  - Implement PDF generation (using a Supabase Edge Function with a PDF library, or a client-side library) producing invoices with: Desheena Investments Ltd header, client details, itemized services, amount (UGX), VAT line (if applicable), due date, payment instructions
  - Expose a download endpoint or button in the Admin Dashboard invoice detail view
  - _Requirements: 10.9, 14.6_

  - [ ]* 28.1 Write unit tests for PDF invoice content
    - Test that generated PDF contains client name, amount, due date, and VAT line
    - _Requirements: 10.9_

- [x] 29. Implement Pesapal payment integration
  - Create a Supabase Edge Function as the Pesapal webhook endpoint (HTTPS, signature-verified)
  - On payment initiation (Finance user or Customer): submit payment request to Pesapal API with amount (UGX), currency "UGX", customer phone, customer email, transaction_ref derived from invoice UUID
  - Redirect user to Pesapal-hosted payment page or display Pesapal popup
  - On Pesapal callback: validate signature, update invoice status to "paid", create payment record with: invoice_id, amount, currency "UGX", payment_method "pesapal", transaction_ref, payment timestamp, status "completed"
  - On failed/cancelled callback: retain invoice status as "unpaid", log failed attempt with Pesapal error code
  - After confirmed payment, trigger SMS receipt to client (see task 30)
  - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 12.3_

  - [ ]* 29.1 Write unit tests for Pesapal webhook handler
    - Test valid signature verification accepts callback
    - Test invalid signature rejects callback without updating invoice
    - Test failed payment retains invoice status as "unpaid"
    - _Requirements: 11.3, 11.5, 11.6_

- [x] 30. Implement Africa's Talking SMS integration
  - Create a reusable SMS service (Supabase Edge Function or server-side module) that calls the Africa's Talking API
  - Implement SMS triggers for: new invoice generated (amount, due date, payment reference), invoice overdue reminder, payment confirmed receipt
  - Log all outbound SMS in `sms_log` table: recipient phone, message content, timestamp, Africa's Talking message ID, delivery status
  - On SMS delivery failure: log failure with Africa's Talking error code; implement retry logic with max 3 retries within 24 hours
  - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_

  - [ ]* 30.1 Write unit tests for SMS service
    - Test SMS log entry is created for each outbound message
    - Test retry logic stops after 3 attempts within 24 hours
    - _Requirements: 12.4, 12.5_

- [x] 31. Implement SMS log screen in Admin Dashboard
  - Build SMS log screen with TanStack Table: recipient phone, message content, timestamp, delivery status
  - Implement filters: date range, recipient, delivery status
  - _Requirements: 12.6_

- [x] 32. Implement financial and driver performance reports
  - Build financial report screen: total invoiced per month, total collected per month, outstanding balance, defaulter count (use Recharts for charts)
  - Build driver performance report: collections per driver per day, total weight per driver, routes completed
  - Build collections report with CSV and PDF export, filterable by date range, driver, route, zone
  - Implement single-button CSV export for all tabular reports
  - _Requirements: 14.2, 14.3, 14.4, 14.5, 14.6_

- [x] 33. Phase 3 Checkpoint — Ensure all tests pass
  - Ensure all unit and integration tests pass
  - Verify automated invoice generation creates correct records on the first of the month
  - Verify Pesapal webhook correctly updates invoice status and creates payment record
  - Verify SMS messages are logged in `sms_log` with correct fields
  - Ask the user if questions arise before proceeding to Phase 4.

---

## Phase 4: Customer Portal, Complaint Management, and In-App Notifications

### Goal
Implement the Flutter Customer Portal, complaint management in both mobile and dashboard, Africa's Talking SMS for complaints, and Admin Dashboard in-app notification alerts.

---

- [x] 34. Implement Flutter Customer Portal
  - Build Customer Portal view (shown when user role = Customer after login)
  - Display active invoices list: invoice period, amount (UGX), due date, payment status (paid/unpaid/overdue)
  - Display payment history
  - Cache invoices and complaint history in Local_DB for offline viewing
  - Display notification badge when a new invoice is generated or a complaint status changes
  - _Requirements: 20.1, 20.2, 20.7, 20.8_

- [x] 35. Implement Pesapal payment flow in Customer Portal
  - Build "Pay Now" button on unpaid invoices in the Customer Portal
  - On tap, initiate Pesapal payment flow and redirect to Pesapal-hosted payment page
  - On payment confirmation callback, update invoice status to "paid" in Local_DB and display a payment confirmation screen
  - _Requirements: 20.3, 20.4, 11.1, 11.2_

- [x] 36. Implement complaint submission and tracking in Flutter
  - Build complaint submission form in Customer Portal: message text (max 1000 characters), category dropdown (missed collection, billing dispute, service quality, other)
  - On submit, insert complaint into Supabase `complaints` table with: UUID, client_id, message, category, status "open", created_at
  - Build complaint history view showing status per complaint (open/in-progress/resolved)
  - _Requirements: 13.1, 13.2, 20.5, 20.6_

  - [ ]* 36.1 Write unit tests for complaint submission
    - Test message length validation (max 1000 characters)
    - Test complaint record is inserted with status "open"
    - _Requirements: 13.1, 13.2_

- [x] 37. Implement complaint management in Admin Dashboard
  - Build complaints list screen using TanStack Table: client name, category, message preview, status, created_at
  - Implement filters: status (open/in-progress/resolved), category, date range
  - Build complaint detail view with status update form: set status to "resolved", enter resolution notes; on save, record resolver user_id, resolution_notes, resolved_at
  - _Requirements: 13.3, 13.4, 13.5_

- [x] 38. Implement SMS notifications for complaint status changes
  - When a complaint status changes (any transition), send an SMS to the client's registered phone via Africa's Talking informing them of the status update
  - Reuse the SMS service implemented in task 30
  - _Requirements: 13.6_

- [x] 39. Implement Admin Dashboard in-app notifications
  - Build notification bell/panel component in the Admin Dashboard header
  - Subscribe to Supabase Realtime on the `notifications` table
  - Trigger in-app notification when: a Driver has no collections recorded for a scheduled route by 14:00 local time (implement a scheduled check via Edge Function or `pg_cron`), pending sync records across all drivers exceed 50, a new complaint is submitted
  - Allow user to dismiss a notification or click through to the relevant record
  - Store notification history in Supabase `notifications` table; retain for 30 days
  - _Requirements: 18.1, 18.2, 18.3, 18.4, 18.5_

  - [ ]* 39.1 Write unit tests for notification triggers
    - Test that a notification is created when pending sync count exceeds 50
    - Test that a notification is created when a new complaint is submitted
    - _Requirements: 18.2, 18.3_

- [x] 40. Final Checkpoint — Ensure all tests pass
  - Ensure all unit and integration tests pass across all four phases
  - Verify Customer Portal displays invoices and complaint history offline
  - Verify complaint status change triggers SMS notification to client
  - Verify Admin Dashboard in-app notifications appear for all three trigger conditions
  - Ask the user if questions arise.

---

## Notes


 Tasks marked with `*` are optional and can be skipped for a faster MVP delivery
- Each phase is independently deployable and testable per Requirement 22.5
- The Supabase schema created in Phase 1 (task 1) is designed to support all four phases without destructive migrations
- All UUID primary keys use UUID v4 to prevent duplicate insertions during offline sync retries
- RLS policies must be applied before any client application connects to Supabase
- Africa's Talking SMS integration is shared across Phase 3 (billing) and Phase 4 (complaints); the SMS service built in task 30 is reused in task 38
