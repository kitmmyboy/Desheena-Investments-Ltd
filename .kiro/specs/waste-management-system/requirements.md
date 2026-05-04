# Requirements Document

## Introduction

This document defines the requirements for the Desheena Investments Ltd Waste Management System — a production-grade, offline-first platform for managing waste collection operations across multiple zones in Uganda. The system serves five user roles (Admin, Operations Manager, Driver, Finance, Customer) across two distinct frontends:

- **Mobile App (Flutter)**: Used by Drivers and Customers on Android (primary) and iOS. Offline-first with SQLite (Drift) and a queue-based sync engine.
- **Admin Dashboard (React)**: Used by Admin, Operations Manager, and Finance roles via web browser. Built with React + Vite, TypeScript, Tailwind CSS, TanStack Table, React Query, Recharts, and Leaflet.

The backend is powered by Supabase (PostgreSQL, Auth, Realtime, Storage) with Row-Level Security enforced per role. All driver operations must function fully offline using a local SQLite database, with a queue-based sync engine that pushes data to Supabase when connectivity is restored. The system must support 50,000+ clients and operate reliably on low-end Android devices (2GB RAM) common in Uganda.

---

## Glossary

- **System**: The Desheena Investments Ltd Waste Management System as a whole.
- **Mobile_App**: The Flutter mobile application used by Drivers and Customers on Android and iOS.
- **Driver_App**: The Driver-role view within the Mobile_App, providing offline route management and collection recording.
- **Customer_Portal**: The Customer-role view within the Mobile_App, providing invoice viewing, payment, and complaint submission.
- **Admin_Dashboard**: The React web application used by Admin, Operations Manager, and Finance roles, accessed via browser.
- **Sync_Engine**: The background worker responsible for detecting internet connectivity and pushing locally queued records to Supabase.
- **Supabase**: The cloud backend providing PostgreSQL database, authentication, realtime subscriptions, and file storage.
- **Local_DB**: The on-device SQLite database managed via Drift or Isar, serving as the offline source of truth for the Driver_App.
- **Sync_Queue**: A table in the Local_DB that holds records pending upload to Supabase.
- **Client**: A waste collection customer of Desheena Investments Ltd (e.g., a business or household).
- **Route**: A named geographic zone containing an ordered list of Clients assigned to one or more Drivers.
- **Collection**: A single waste pickup event recorded by a Driver for a specific Client.
- **Invoice**: A billing document generated for a Client covering a billing period.
- **Payment**: A financial transaction linked to an Invoice, processed via Pesapal or recorded manually.
- **Contract**: A service agreement between Desheena Investments Ltd and a Client specifying rate, frequency, and billing cycle.
- **Pesapal**: The East African payment gateway used to process online payments in UGX.
- **Africa's_Talking**: The SMS gateway used to send notifications to Clients and Drivers.
- **RBAC**: Role-Based Access Control — the mechanism restricting system features by user role.
- **RLS**: Row-Level Security — Supabase PostgreSQL policies enforcing data access at the row level.
- **JWT**: JSON Web Token issued by Supabase Auth to authenticate and authorize users.
- **UUID**: Universally Unique Identifier used as the primary key for all records to prevent duplicates during sync.
- **UGX**: Ugandan Shilling, the currency used for all financial transactions.
- **VAT**: Value Added Tax applicable to invoices as required by Ugandan tax law.
- **KPI**: Key Performance Indicator displayed on the Admin_Dashboard home screen.
- **GPS**: Global Positioning System coordinates (latitude and longitude) recorded at collection time.
- **Waste_Type**: A categorized classification of collected waste (e.g., general, organic, recyclable, hazardous).
- **Billing_Cycle**: The recurring period (monthly) for which an Invoice is generated.
- **Service_Frequency**: The number of collections per week specified in a Client's Contract (e.g., twice per week).
- **Defaulter**: A Client with one or more unpaid Invoices past their due date.
- **Complaint**: A logged issue raised by a Client or staff member regarding service delivery.
- **CSV**: Comma-Separated Values file format used for data export.
- **PDF**: Portable Document Format used for invoice and report export.

---

## Requirements

### Requirement 1: User Authentication and Session Management

**User Story:** As a user of any role, I want to log in securely and have my session cached, so that I can access the system without re-authenticating on every launch.

#### Acceptance Criteria

1. THE System SHALL authenticate users via Supabase Auth using email and password, issuing a JWT upon successful login.
2. WHEN a Driver logs in successfully on the Driver_App, THE Driver_App SHALL cache the session JWT and user profile in the Local_DB so that the Driver remains authenticated during subsequent offline launches.
3. WHEN a cached session exists and the device is offline, THE Driver_App SHALL allow the Driver to access all offline-capable features without requiring re-authentication.
4. WHEN a cached JWT expires and the device is online, THE Driver_App SHALL silently refresh the token using the stored refresh token before allowing access.
5. IF authentication fails due to invalid credentials, THEN THE System SHALL display a descriptive error message and SHALL NOT grant access.
6. IF authentication fails due to network unavailability and no cached session exists, THEN THE Driver_App SHALL display an offline login error and SHALL NOT grant access.
7. THE System SHALL enforce RBAC by assigning each user exactly one role (Admin, Operations_Manager, Driver, Finance, Customer) stored in the Supabase user metadata.
8. WHEN a user logs out, THE System SHALL invalidate the local session cache and redirect the user to the login screen.

---

### Requirement 2: Role-Based Access Control (RBAC)

**User Story:** As an Admin, I want each user role to access only the features relevant to their responsibilities, so that data integrity and security are maintained.

#### Acceptance Criteria

1. THE Admin_Dashboard (React) SHALL restrict navigation menu items and data views based on the authenticated user's role.
2. WHILE a user is authenticated as Driver, THE Mobile_App SHALL display only the Driver_App view: route list, collection recording, sync status, and profile.
3. WHILE a user is authenticated as Customer, THE Mobile_App SHALL display only the Customer_Portal view: invoices, payment history, Pesapal payment, and complaint submission.
4. WHILE a user is authenticated as Finance, THE Admin_Dashboard SHALL grant access to billing, invoices, payments, and financial reports only.
5. WHILE a user is authenticated as Operations_Manager, THE Admin_Dashboard SHALL grant access to route management, driver management, collection monitoring, and client management.
6. WHILE a user is authenticated as Admin, THE Admin_Dashboard SHALL grant access to all modules including user management and system configuration.
7. THE Supabase RLS policies SHALL enforce data access restrictions at the database row level for all tables, ensuring users can only read or write records permitted by their role.
8. IF a user attempts to access a resource outside their role's permissions, THEN THE System SHALL return an authorization error and SHALL NOT expose the requested data.
9. THE Mobile_App SHALL redirect a user to the correct role view (Driver or Customer) immediately after login based on the role stored in Supabase user metadata.

---

### Requirement 3: Driver App — Route and Pickup Management

**User Story:** As a Driver, I want to download my assigned route and view my daily pickups offline, so that I can complete collections without requiring internet connectivity.

#### Acceptance Criteria

1. WHEN a Driver opens the Driver_App while online, THE Driver_App SHALL download the Driver's assigned Route including all Client details, GPS coordinates, and scheduled pickup times into the Local_DB.
2. WHEN a Driver opens the Driver_App while offline and a previously downloaded Route exists in the Local_DB, THE Driver_App SHALL display the Route and daily pickup list from the Local_DB without requiring network access.
3. THE Driver_App SHALL display each pickup in the daily list with the Client name, location address, waste type, and a large tap-to-record button.
4. WHEN a Driver taps a Client entry on the route list, THE Driver_App SHALL open a collection recording screen pre-populated with the Client's name and waste type.
5. THE Driver_App SHALL display a persistent offline/online status indicator visible on all screens.
6. WHEN the device transitions from offline to online, THE Driver_App SHALL automatically trigger the Sync_Engine without requiring Driver action.

---

### Requirement 4: Driver App — Collection Recording

**User Story:** As a Driver, I want to record waste collection details at each stop, so that accurate data is captured even without internet access.

#### Acceptance Criteria

1. WHEN a Driver records a collection, THE Driver_App SHALL capture: Client UUID, Driver UUID, waste type (selected from a predefined list), weight in kilograms (numeric input), timestamp (device local time in ISO 8601 format), and GPS coordinates (latitude and longitude from device GPS).
2. THE Driver_App SHALL use large input controls and minimal text entry to accommodate drivers operating in field conditions.
3. WHEN a Driver submits a collection record, THE Driver_App SHALL store the record in the Local_DB collections_local table with a UUID primary key and a sync_status of "pending".
4. WHEN a Driver submits a collection record, THE Driver_App SHALL simultaneously insert a corresponding entry into the Sync_Queue table in the Local_DB.
5. IF the device GPS is unavailable at collection time, THEN THE Driver_App SHALL allow the Driver to submit the record without GPS coordinates and SHALL flag the record with a missing_gps indicator.
6. THE Driver_App SHALL display a confirmation message after each successful local save, indicating the record is saved and pending sync.
7. WHEN a Driver views a previously recorded collection, THE Driver_App SHALL display the sync_status as either "pending" or "synced".

---

### Requirement 5: Offline-First Sync Engine

**User Story:** As a Driver, I want my locally recorded collections to automatically sync to the server when internet is available, so that the office has up-to-date data without manual intervention.

#### Acceptance Criteria

1. THE Sync_Engine SHALL monitor network connectivity continuously while the Driver_App is running.
2. WHEN internet connectivity is detected, THE Sync_Engine SHALL process all records in the Sync_Queue with sync_status "pending" and upload them to the Supabase collections table.
3. WHEN a record is successfully uploaded to Supabase, THE Sync_Engine SHALL update the corresponding Local_DB record's sync_status to "synced" and remove the entry from the Sync_Queue.
4. IF a record upload fails due to a network error, THEN THE Sync_Engine SHALL retain the record in the Sync_Queue and retry on the next connectivity event.
5. IF a record upload fails due to a duplicate UUID conflict on the server, THEN THE Sync_Engine SHALL mark the local record as "synced" and remove it from the Sync_Queue, treating the server copy as authoritative.
6. THE Sync_Engine SHALL process Sync_Queue records in chronological order of their local creation timestamp.
7. THE Driver_App SHALL display a sync status indicator showing the count of pending records and the timestamp of the last successful sync.
8. WHEN the Driver manually taps the sync button, THE Driver_App SHALL immediately trigger the Sync_Engine regardless of the automatic sync schedule.
9. THE Sync_Engine SHALL operate as a background worker and SHALL NOT block the Driver_App UI during sync operations.
10. THE System SHALL use UUID v4 as the primary key for all collection records to prevent duplicate insertions during sync retries.

---

### Requirement 6: Client Management

**User Story:** As an Admin or Operations Manager, I want to create, view, edit, and manage client records, so that the system maintains an accurate and up-to-date client base.

#### Acceptance Criteria

1. THE Admin_Dashboard SHALL provide a client list view displaying all Clients with columns: name, phone, email, location, service frequency, monthly rate, and contract status.
2. WHEN an Admin or Operations_Manager creates a new Client, THE System SHALL require: name, phone number, location text, GPS coordinates, service frequency, and monthly rate in UGX.
3. WHEN an Admin or Operations_Manager saves a new Client record, THE System SHALL store the record in the Supabase clients table with a UUID primary key and a created_at timestamp.
4. THE Admin_Dashboard SHALL provide a map view using OpenStreetMap displaying all Client locations as pins, with a tap-to-view detail popup.
5. WHEN an Admin or Operations_Manager edits a Client record, THE System SHALL update the record in Supabase and log the change with the editor's user ID and timestamp.
6. THE System SHALL support bulk import of Clients from a CSV file containing columns: name, phone, email, location_text, gps_lat, gps_lng, service_frequency, monthly_rate.
7. WHEN a CSV import is initiated, THE System SHALL validate each row for required fields and SHALL report a list of rows that failed validation without aborting the entire import.
8. THE Admin_Dashboard SHALL provide a search and filter interface for the client list, supporting filter by zone, service frequency, contract status, and payment status.

---

### Requirement 7: Contract Management

**User Story:** As an Admin or Finance user, I want to create and manage service contracts for each client, so that billing is accurately tied to agreed service terms.

#### Acceptance Criteria

1. THE System SHALL associate each Client with one active Contract specifying: start date, billing cycle (monthly), rate in UGX, and status (active/suspended/terminated).
2. WHEN a Contract is created for a Client, THE System SHALL store it in the Supabase contracts table linked by client_id.
3. THE Admin_Dashboard SHALL display the Contract details on the Client detail screen including rate, start date, and status.
4. WHEN a Contract status is changed to "suspended" or "terminated", THE System SHALL stop generating new Invoices for that Client from the effective date.
5. THE System SHALL support a flat monthly billing model where the Invoice amount equals the Contract rate regardless of collection count.
6. THE System SHALL support a frequency-based billing model where the Invoice amount is calculated based on the number of scheduled collections in the billing period multiplied by a per-collection rate.

---

### Requirement 8: Route Management

**User Story:** As an Operations Manager, I want to create routes, assign clients to routes, and assign drivers and trucks to routes, so that collections are organized efficiently by zone.

#### Acceptance Criteria

1. THE Admin_Dashboard SHALL provide a route management screen listing all Routes with their assigned zone, driver, and client count.
2. WHEN an Operations_Manager creates a Route, THE System SHALL require a route name and zone, and SHALL store the record in the Supabase routes table.
3. WHEN an Operations_Manager assigns a Client to a Route, THE System SHALL create a route_clients association record linking the client_id and route_id with an optional sequence order.
4. WHEN an Operations_Manager assigns a Driver to a Route, THE System SHALL store the driver_id and route_id association in the Supabase route_drivers table.
5. THE Admin_Dashboard SHALL display a Route detail screen showing the ordered list of Clients on the route with their GPS pins on an OpenStreetMap view.
6. WHEN a Driver's assigned Route is updated in Supabase, THE Driver_App SHALL download the updated Route on the next sync while online.

---

### Requirement 9: Collections Monitoring

**User Story:** As an Admin or Operations Manager, I want to monitor collection activity in real time, so that I can track operational performance and identify issues.

#### Acceptance Criteria

1. THE Admin_Dashboard SHALL display a collections log screen showing all collection records with columns: client name, driver name, waste type, weight (kg), GPS location, collected_at timestamp, and sync_status.
2. WHEN a new collection record is synced to Supabase, THE Admin_Dashboard SHALL update the collections log in real time using Supabase Realtime subscriptions without requiring a page refresh.
3. THE Admin_Dashboard SHALL display a map view using OpenStreetMap showing collection events as pins, with color coding by waste type.
4. THE Admin_Dashboard SHALL provide filters on the collections log for: date range, driver, route, zone, waste type, and sync status.
5. THE Admin_Dashboard SHALL display a KPI panel on the home screen showing: total collections today, total weight collected today, active clients, pending sync records, and revenue collected today.

---

### Requirement 10: Billing and Invoice Generation

**User Story:** As a Finance user, I want the system to automatically generate monthly invoices for all active clients, so that billing is consistent and requires minimal manual effort.

#### Acceptance Criteria

1. THE System SHALL automatically generate Invoices for all Clients with active Contracts on the first day of each calendar month.
2. WHEN an Invoice is generated, THE System SHALL set: client_id, amount (from Contract rate), due_date (14 days after generation date), status ("unpaid"), and a UUID.
3. WHEN an Invoice is generated for a Contract using flat monthly billing, THE System SHALL set the Invoice amount equal to the Contract monthly rate in UGX.
4. WHEN an Invoice is generated for a Contract using frequency-based billing, THE System SHALL calculate the Invoice amount as the per-collection rate multiplied by the number of scheduled collections in the billing month.
5. THE Admin_Dashboard SHALL display an invoice list screen with columns: client name, invoice period, amount (UGX), due date, and status (paid/unpaid/overdue).
6. WHEN an Invoice due_date passes and the Invoice status remains "unpaid", THE System SHALL automatically update the Invoice status to "overdue".
7. THE Admin_Dashboard SHALL provide a defaulters report listing all Clients with one or more overdue Invoices, showing total outstanding balance.
8. THE Admin_Dashboard SHALL allow a Finance user to manually generate an Invoice for a specific Client outside the automatic cycle.
9. THE System SHALL generate Invoice documents in PDF format including: Desheena Investments Ltd header, client details, itemized services, amount (UGX), VAT line (if applicable), due date, and payment instructions.
10. THE Admin_Dashboard SHALL allow export of the invoice list to CSV format.

---

### Requirement 11: Pesapal Payment Integration

**User Story:** As a Finance user or Customer, I want to process payments via Pesapal, so that clients can pay invoices online using East African payment methods.

#### Acceptance Criteria

1. WHEN a Finance user or Customer initiates payment for an Invoice, THE System SHALL submit a payment request to the Pesapal API with: amount in UGX, currency code "UGX", customer phone number, customer email, and a unique transaction reference derived from the Invoice UUID.
2. WHEN the Pesapal payment request is accepted, THE System SHALL redirect the user to the Pesapal-hosted payment page or display the Pesapal payment popup within the application.
3. WHEN Pesapal sends a payment callback or webhook to the System's callback endpoint, THE System SHALL validate the callback signature and update the corresponding Invoice status to "paid" and create a Payment record.
4. WHEN a Payment record is created, THE System SHALL store: invoice_id, amount, currency ("UGX"), payment method ("pesapal"), transaction_ref from Pesapal, payment timestamp, and status ("completed").
5. IF the Pesapal callback indicates a failed or cancelled payment, THEN THE System SHALL retain the Invoice status as "unpaid" and log the failed attempt with the Pesapal error code.
6. THE System SHALL expose a secure HTTPS webhook endpoint for receiving Pesapal payment notifications, protected by signature verification.
7. WHEN a payment is confirmed, THE System SHALL send an SMS confirmation to the Client's registered phone number via Africa's_Talking containing the Invoice reference, amount paid, and payment date.

---

### Requirement 12: Africa's Talking SMS Integration

**User Story:** As an Admin or Finance user, I want the system to send SMS notifications to clients and drivers, so that they receive timely updates without needing the app.

#### Acceptance Criteria

1. WHEN a new Invoice is generated for a Client, THE System SHALL send an SMS to the Client's registered phone number via Africa's_Talking containing the Invoice amount in UGX, due date, and a payment reference.
2. WHEN an Invoice status changes to "overdue", THE System SHALL send an SMS reminder to the Client's registered phone number via Africa's_Talking.
3. WHEN a payment is confirmed via Pesapal, THE System SHALL send an SMS receipt to the Client's registered phone number via Africa's_Talking.
4. THE System SHALL log all outbound SMS messages with: recipient phone number, message content, timestamp, Africa's_Talking message ID, and delivery status.
5. IF an SMS delivery fails, THEN THE System SHALL log the failure with the Africa's_Talking error code and SHALL NOT retry automatically more than 3 times within 24 hours.
6. THE Admin_Dashboard SHALL display the SMS log with filters by date, recipient, and delivery status.

---

### Requirement 13: Complaint Management

**User Story:** As a Client or Admin, I want to log and track service complaints, so that issues are recorded and resolved in a timely manner.

#### Acceptance Criteria

1. THE System SHALL allow a Client (via the Customer portal) or an Admin to log a Complaint with: client_id, message text (maximum 1000 characters), and category (missed collection, billing dispute, service quality, other).
2. WHEN a Complaint is submitted, THE System SHALL store it in the Supabase complaints table with: UUID, client_id, message, category, status ("open"), and created_at timestamp.
3. THE Admin_Dashboard SHALL display a complaints list screen with columns: client name, category, message preview, status, and created_at.
4. WHEN an Admin or Operations_Manager updates a Complaint status to "resolved", THE System SHALL record the resolver's user ID, resolution notes, and resolved_at timestamp.
5. THE Admin_Dashboard SHALL provide filters on the complaints list for: status (open/in-progress/resolved), category, and date range.
6. WHEN a Complaint status changes, THE System SHALL send an SMS notification to the Client via Africa's_Talking informing them of the status update.

---

### Requirement 14: Admin Dashboard KPIs and Reporting

**User Story:** As an Admin or Operations Manager, I want a dashboard with key performance indicators and exportable reports, so that I can make informed operational and financial decisions.

#### Acceptance Criteria

1. THE Admin_Dashboard home screen SHALL display the following KPIs updated in real time: total collections today (count), total weight collected today (kg), total revenue collected today (UGX), number of active clients, number of pending sync records, and number of open complaints.
2. THE Admin_Dashboard SHALL provide a collections report exportable to CSV and PDF, filterable by date range, driver, route, and zone.
3. THE Admin_Dashboard SHALL provide a financial report showing: total invoiced amount per month, total collected amount per month, outstanding balance, and defaulter count.
4. THE Admin_Dashboard SHALL provide a driver performance report showing: collections per driver per day, total weight per driver, and routes completed.
5. THE Admin_Dashboard SHALL allow export of any tabular report to CSV format with a single button action.
6. THE Admin_Dashboard SHALL allow export of Invoice documents and financial summaries to PDF format.

---

### Requirement 15: Data Import — Existing Client Base

**User Story:** As an Admin, I want to import the existing client base from the Desheena system Excel/CSV file, so that the system is pre-populated with hundreds of real clients across all zones without manual data entry.

#### Acceptance Criteria

1. THE Admin_Dashboard SHALL provide a data import screen accepting CSV files with the following columns: name, phone, email, location_text, gps_lat, gps_lng, service_frequency, monthly_rate, zone.
2. WHEN a CSV import file is uploaded, THE System SHALL parse each row and validate that name, location_text, service_frequency, and monthly_rate are present and non-empty.
3. WHEN a CSV import is processed, THE System SHALL insert valid rows into the Supabase clients table and create corresponding active Contracts with the provided monthly_rate.
4. WHEN a CSV import completes, THE System SHALL display a summary report showing: total rows processed, rows successfully imported, rows skipped due to validation errors, and a list of error details per skipped row.
5. IF a CSV row contains a client name and phone number that already exist in the clients table, THEN THE System SHALL skip the row and include it in the duplicate report rather than creating a duplicate record.
6. THE System SHALL support importing clients from zones including but not limited to: Kito, Nsasa, Naalya, Mbuya, Mbalwa, Sonde, Kimbejja, Buwate, Nabusigwe, Janda, and Mulawa.
7. THE System SHALL support monthly_rate values ranging from 3,000 UGX to 750,000 UGX inclusive.

---

### Requirement 16: Security and Data Protection

**User Story:** As an Admin, I want the system to enforce strong security controls, so that client data and financial records are protected from unauthorized access.

#### Acceptance Criteria

1. THE System SHALL enforce Supabase RLS policies on all database tables so that each user role can only access rows permitted by their role definition.
2. THE System SHALL transmit all data between the client applications and Supabase over HTTPS/TLS.
3. THE System SHALL store all passwords using Supabase Auth's built-in bcrypt hashing and SHALL NOT store plaintext passwords anywhere.
4. WHEN a JWT expires, THE System SHALL require re-authentication or silent token refresh before allowing further API calls.
5. THE System SHALL validate and sanitize all user-supplied input on both the client and server side before persisting to the database.
6. THE Pesapal webhook endpoint SHALL verify the Pesapal callback signature before processing any payment status update.
7. THE System SHALL log all authentication events (login, logout, failed login) with user ID, timestamp, and IP address in a Supabase audit_log table.

---

### Requirement 17: OpenStreetMap Integration

**User Story:** As an Operations Manager or Admin, I want to view client locations and collection events on a map, so that I can plan routes and monitor field operations geographically.

#### Acceptance Criteria

1. THE Admin_Dashboard SHALL render an interactive map using Leaflet with OpenStreetMap tiles displaying all Client GPS pins.
2. THE Mobile_App (Driver view) SHALL render a route map using the flutter_map package with OpenStreetMap tiles showing the Driver's assigned Client stops in sequence.
3. WHEN a user clicks a Client pin on the Admin_Dashboard map, THE Admin_Dashboard SHALL display a popup with the Client name, location text, and last collection date.
4. THE Admin_Dashboard SHALL display collection event pins on the map with color coding: green for synced collections, yellow for pending sync, red for missed scheduled collections.
5. WHEN the Mobile_App is offline, THE Driver_App view SHALL render the route map using cached tile data stored in the Local_DB, without requiring network access.
6. THE Mobile_App SHALL display the Driver's current GPS position on the route map as a distinct marker updated every 30 seconds while the app is in the foreground.
7. THE Admin_Dashboard map SHALL support clustering of Client pins when zoomed out to handle 50,000+ client markers without performance degradation.

---

### Requirement 18: Notifications and Alerts

**User Story:** As an Admin or Operations Manager, I want to receive in-app alerts for critical events, so that I can respond quickly to operational issues.

#### Acceptance Criteria

1. THE Admin_Dashboard SHALL display an in-app notification when a Driver has not recorded any collections for a scheduled route by 14:00 local time.
2. THE Admin_Dashboard SHALL display an in-app notification when the Sync_Engine reports more than 50 pending records across all drivers.
3. THE Admin_Dashboard SHALL display an in-app notification when a new Complaint is submitted.
4. WHEN a notification is displayed, THE Admin_Dashboard SHALL allow the user to dismiss it or navigate directly to the relevant record.
5. THE System SHALL retain notification history for 30 days in the Supabase notifications table.

---

### Requirement 19: React Admin Dashboard — Technology and Performance

**User Story:** As an Admin or Operations Manager, I want the admin dashboard to handle large datasets and complex views without performance issues, so that I can manage hundreds of drivers and thousands of clients efficiently.

#### Acceptance Criteria

1. THE Admin_Dashboard SHALL be built with React (Vite), TypeScript, and Tailwind CSS as the core technology stack.
2. THE Admin_Dashboard SHALL use TanStack Table for all data tables, with server-side pagination, sorting, and filtering to support 50,000+ client records without browser performance degradation.
3. THE Admin_Dashboard SHALL use React Query for all server state management, providing automatic caching, background refetching, and optimistic updates.
4. THE Admin_Dashboard SHALL use the Supabase JavaScript client for all database operations and Realtime subscriptions.
5. THE Admin_Dashboard SHALL use Recharts for all analytics charts and KPI visualizations.
6. THE Admin_Dashboard SHALL use Leaflet with OpenStreetMap for all map views, with marker clustering enabled for large datasets.
7. THE Admin_Dashboard SHALL load the initial dashboard view in under 3 seconds on a standard broadband connection.
8. THE Admin_Dashboard SHALL implement virtualized rendering for all tables displaying more than 100 rows to maintain smooth scrolling performance.

---

### Requirement 20: Customer Portal — Mobile App

**User Story:** As a Customer, I want to view my invoices, make payments, and submit complaints from my phone, so that I can manage my waste collection account without visiting the office.

#### Acceptance Criteria

1. THE Mobile_App SHALL display a Customer_Portal view when a user with the Customer role logs in, showing: current invoice status, payment history, and a complaint submission form.
2. THE Customer_Portal SHALL display the Customer's active invoices with: invoice period, amount in UGX, due date, and payment status (paid/unpaid/overdue).
3. WHEN a Customer taps "Pay Now" on an unpaid invoice, THE Mobile_App SHALL initiate a Pesapal payment flow and redirect to the Pesapal-hosted payment page.
4. WHEN a Pesapal payment is confirmed, THE Mobile_App SHALL update the invoice status to "paid" and display a payment confirmation screen.
5. THE Customer_Portal SHALL allow a Customer to submit a Complaint with a message (maximum 1000 characters) and a category selection.
6. THE Customer_Portal SHALL display the status of previously submitted Complaints (open/in-progress/resolved).
7. THE Customer_Portal SHALL cache the Customer's invoices and complaint history in the Local_DB for offline viewing.
8. THE Customer_Portal SHALL display a notification badge when a new invoice is generated or a complaint status changes.

---

### Requirement 21: Mobile App — Low-End Device Compatibility

**User Story:** As a Driver using a low-cost Android phone, I want the app to run smoothly on my device, so that I can complete my collections without the app crashing or freezing.

#### Acceptance Criteria

1. THE Mobile_App SHALL be optimized to run on Android devices with a minimum of 2GB RAM and Android 8.0 (API level 26) or higher.
2. THE Mobile_App SHALL NOT load more than 200 collection records into memory at one time; older records SHALL be paginated from the Local_DB.
3. THE Mobile_App SHALL compress GPS coordinates and collection data before storing in the Local_DB to minimize storage usage.
4. THE Sync_Engine SHALL batch upload records in groups of 50 to avoid memory spikes during sync on low-end devices.
5. THE Mobile_App SHALL display a low-storage warning when the device has less than 100MB of free storage remaining.
6. THE Mobile_App APK size SHALL NOT exceed 30MB to accommodate users with limited data plans for initial download.

---

### Requirement 22: Phased Delivery — MVP Definition

**User Story:** As a project stakeholder, I want the system delivered in phases so that core operations can begin while advanced features are completed, reducing risk and enabling early feedback.

#### Acceptance Criteria

1. Phase 1 (Core MVP) SHALL include: Supabase schema with RLS, Flutter Driver App with offline collection recording and sync engine, and basic collections logging.
2. Phase 2 SHALL include: React Admin Dashboard with collections view, client management, and route management.
3. Phase 3 SHALL include: billing and invoice generation, Pesapal payment integration, and defaulters reporting.
4. Phase 4 SHALL include: Customer portal in Flutter, Africa's Talking SMS integration, and complaint management.
5. EACH phase SHALL be independently deployable and testable without requiring subsequent phases to be complete.
6. THE Supabase schema created in Phase 1 SHALL be designed to support all four phases without requiring destructive migrations in later phases.
