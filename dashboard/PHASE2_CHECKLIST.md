# Phase 2 Checkpoint Checklist

## Dashboard Project Structure

### ✅ Confirmed Implemented

#### Task 13 — React Admin Dashboard Setup
- ✅ `dashboard/package.json` — Vite + React + TypeScript project configured
- ✅ `dashboard/tailwind.config.js` — Tailwind CSS configured
- ✅ `dashboard/vite.config.ts` — Vite config with Vitest test environment (jsdom)
- ✅ `dashboard/src/lib/supabase.ts` — Supabase JS client initialised
- ✅ `dashboard/src/lib/queryClient.ts` — React Query client with sensible defaults
- ✅ `dashboard/src/lib/index.ts` — barrel export
- ✅ All required dependencies present: `@tanstack/react-table`, `@tanstack/react-query`, `@supabase/supabase-js`, `recharts`, `leaflet`, `react-leaflet`, `leaflet.markercluster`
- ✅ Folder structure: `src/features/auth`, `src/features/clients`, `src/features/routes`, `src/features/collections`, `src/features/billing`, `src/features/complaints`, `src/features/reports`, `src/components`, `src/hooks`, `src/lib`

#### Task 14 — Authentication and RBAC Routing
- ✅ `dashboard/src/features/auth/LoginPage.tsx` — email/password login form
- ✅ `dashboard/src/features/auth/AuthContext.tsx` — role stored in React context from Supabase user metadata
- ✅ `dashboard/src/features/auth/ProtectedRoute.tsx` — redirects unauthenticated users to `/login`; shows `UnauthorizedPage` for wrong role
- ✅ `dashboard/src/features/auth/UnauthorizedPage.tsx` — 403 page, no data exposed
- ✅ `dashboard/src/components/Sidebar.tsx` — role-based nav: Admin sees all; Finance sees billing/reports/sms-log; Operations_Manager sees collections/clients/routes/complaints
- ✅ `dashboard/src/App.tsx` — all routes protected with correct `allowedRoles`
- ✅ `dashboard/src/features/auth/ProtectedRoute.test.tsx` — unit tests for RBAC routing (Task 14.1)
- ✅ `dashboard/src/features/auth/index.ts` — barrel export

#### Task 15 — Collections Log Screen with Realtime
- ✅ `dashboard/src/features/collections/CollectionsPage.tsx` — TanStack Table with server-side pagination, sorting, filtering; Supabase Realtime subscription on `collections` table; virtualized rendering via `max-h-[600px] overflow-y-auto`
- ✅ `dashboard/src/features/collections/CollectionsFilters.tsx` — date range, driver, route, zone, waste type, sync_status filters
- ✅ `dashboard/src/features/collections/useCollections.ts` — React Query hook with all filter params
- ✅ `dashboard/src/features/collections/index.ts` — barrel export

#### Task 16 — Collections Map View
- ✅ `dashboard/src/features/collections/CollectionsMapView.tsx` — Leaflet + OpenStreetMap; pins color-coded by waste type; marker clustering via `leaflet.markercluster`

#### Task 17 — KPI Dashboard Panel
- ✅ `dashboard/src/features/collections/KpiPanel.tsx` — 6 KPI cards: collections today, weight today, revenue today, active clients, pending sync, open complaints; Recharts mini bar chart; Supabase Realtime updates
- ✅ `dashboard/src/features/collections/useKpiData.ts` — React Query hook for KPI data

#### Task 18 — Client Management (List, Create, Edit)
- ✅ `dashboard/src/features/clients/ClientsPage.tsx` — TanStack Table with server-side pagination; search, zone, service frequency, contract status filters
- ✅ `dashboard/src/features/clients/ClientForm.tsx` — create/edit form with required field validation; edit logs change with user_id and timestamp
- ✅ `dashboard/src/features/clients/useClients.ts` — React Query hooks for CRUD
- ✅ `dashboard/src/features/clients/index.ts` — barrel export

#### Task 19 — Client Map View
- ✅ `dashboard/src/features/clients/ClientMapView.tsx` — Leaflet + OpenStreetMap; marker clustering for 50,000+ pins; popup with client name, location, last collection date

#### Task 20 — CSV Bulk Client Import
- ✅ `dashboard/src/features/clients/CsvImportPage.tsx` — CSV file upload; parses all 9 columns; validates required fields; checks monthly_rate 3,000–750,000 UGX; duplicate detection (name + phone); inserts clients + active contracts; import summary with per-row error details

#### Task 21 — Contract Management
- ✅ `dashboard/src/features/clients/ContractPanel.tsx` — contract detail view; create form with start date, billing cycle, rate, billing model, status; status change updates Supabase `contracts` table

#### Task 22 — Route Management
- ✅ `dashboard/src/features/routes/RoutesPage.tsx` — route list with name, zone, assigned driver, client count; create route form
- ✅ `dashboard/src/features/routes/RouteDetailPage.tsx` — ordered client list; assign-client form with search + sequence order; assign-driver form; remove client; OpenStreetMap with numbered client pins
- ✅ `dashboard/src/features/routes/useRoutes.ts` — hooks: `useRoutes`, `useRouteDetail`, `useCreateRoute`, `useAssignClientToRoute`, `useAssignDriverToRoute`, `useRemoveClientFromRoute`
- ✅ `dashboard/src/features/routes/index.ts` — barrel export

#### Task 23 — Performance Optimizations
- ✅ All TanStack Tables use `manualPagination: true` and `manualSorting: true` (server-side)
- ✅ Virtualized rendering via CSS overflow scroll on all tables (`max-h-[600px] overflow-y-auto`)
- ✅ Heavy components (maps, charts) are lazy-loaded via `React.lazy` + `Suspense` in `App.tsx`
- ✅ `dashboard/PERFORMANCE.md` — performance notes documented

#### Supabase Schema (Phase 1 prerequisite)
- ✅ `supabase/migrations/20260504073222_create_waste_management_schema.sql`
- ✅ `supabase/migrations/20260504073304_add_client_id_to_users.sql`
- ✅ `supabase/migrations/20260504073333_enable_rls_and_policies.sql`
- ✅ `supabase/migrations/20260504073408_fix_advisor_warnings.sql`
- ✅ `supabase/migrations/20260504073500_auth_user_sync_trigger_and_audit.sql`

---

## ⚠️ Items Requiring Manual Testing

The following items cannot be verified statically and require a running dev server:

### Setup
1. Run `npm install` in the `dashboard/` directory to install all dependencies
2. Run `npm run dev` to start the Vite dev server (default: http://localhost:5173)
3. Ensure `.env.local` has valid Supabase credentials (already pre-configured in `src/lib/supabase.ts`)

### RBAC Navigation
- [ ] Log in as **Admin** — verify all 9 nav items are visible (Dashboard, Collections, Clients, Routes, Billing, Reports, Complaints, SMS Log, Users)
- [ ] Log in as **Operations_Manager** — verify only 5 items visible (Dashboard, Collections, Clients, Routes, Complaints); Billing/Reports/SMS Log/Users are hidden
- [ ] Log in as **Finance** — verify only 4 items visible (Dashboard, Billing, Reports, SMS Log); Collections/Clients/Routes/Complaints/Users are hidden
- [ ] Attempt to navigate to `/dashboard/routes` as Finance — verify "Access Denied" (403) page appears with no route data exposed
- [ ] Attempt to navigate to `/dashboard/billing` as Operations_Manager — verify "Access Denied" page

### Realtime Collections Updates
- [ ] Open the Collections page in the browser
- [ ] Insert a new record into the `collections` table in Supabase (via SQL editor or mobile app)
- [ ] Verify the new row appears in the table **without a page refresh**

### Client Map
- [ ] Navigate to Clients → Map View
- [ ] Verify client pins appear on the OpenStreetMap centered on Kampala
- [ ] Click a pin — verify popup shows client name, location text, and last collection date
- [ ] Verify marker clustering works when zoomed out (multiple pins merge into cluster badges)

### CSV Import
- [ ] Navigate to Clients → Import CSV
- [ ] Upload a test CSV with columns: `name, phone, email, location_text, gps_lat, gps_lng, service_frequency, monthly_rate, zone`
- [ ] Verify preview table shows first 5 rows
- [ ] Verify import summary shows correct counts (imported, validation errors, duplicates)
- [ ] Re-import the same file — verify duplicates are detected and skipped
- [ ] Test a row with `monthly_rate` outside 3,000–750,000 — verify validation error is reported

### Route Management
- [ ] Navigate to Routes → Create a new route (name + zone)
- [ ] Click the route name → verify Route Detail page loads
- [ ] Use the "Assign client" search to find and add a client with GPS coordinates
- [ ] Verify the client appears in the ordered list and on the OpenStreetMap
- [ ] Use the "Assign driver" form to assign a driver by email
- [ ] Verify the driver email appears in the "Assigned driver" section
- [ ] Remove a client from the route — verify it disappears from the list and map

### Unit Tests
- [ ] Run `npm test` in `dashboard/` — verify all tests in `ProtectedRoute.test.tsx` pass (9 test cases covering RBAC requirements 2.4 and 2.8)

---

## Notes

- Billing, Reports, Complaints, and SMS Log pages are placeholder stubs — full implementation is in Phase 3 and Phase 4
- The `dashboard/src/hooks/index.ts` and `dashboard/src/features/billing/index.ts`, `complaints/index.ts`, `reports/index.ts` are intentionally empty stubs for future phases
- Driver and Customer roles are mobile-only and have no dashboard access by design (Requirements 2.4, 2.5)
