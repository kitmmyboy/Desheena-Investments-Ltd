# Phase 1 Checkpoint — Desheena Waste Management App

## File Structure Verification

### ✅ Supabase Migrations (`supabase/migrations/`)

| File | Status | Description |
|------|--------|-------------|
| `20260504073222_create_waste_management_schema.sql` | ✅ Present | All 13 tables: `users`, `clients`, `contracts`, `routes`, `route_clients`, `route_drivers`, `collections`, `invoices`, `payments`, `complaints`, `sms_log`, `notifications`, `audit_log` |
| `20260504073304_add_client_id_to_users.sql` | ✅ Present | Adds `client_id` FK to `users` table |
| `20260504073333_enable_rls_and_policies.sql` | ✅ Present | RLS policies for all tables |
| `20260504073408_fix_advisor_warnings.sql` | ✅ Present | Advisor warning fixes |
| `20260504073500_auth_user_sync_trigger_and_audit.sql` | ✅ Present | Auth trigger and audit logging |

Schema includes:
- ✅ UUID primary keys on all tables
- ✅ `created_at` / `updated_at` timestamps on all tables
- ✅ Foreign key constraints (e.g. `collections.client_id → clients.id`)
- ✅ `sync_status` column (`pending` | `synced`) on `collections`
- ✅ `missing_gps` boolean on `collections`
- ✅ `updated_at` trigger function applied to all tables
- ✅ Performance indexes on all FK and filter columns

---

### ✅ Flutter Project Structure (`mobile/lib/`)

#### `lib/core/`
| File | Status |
|------|--------|
| `constants.dart` | ✅ Supabase URL + anon key |
| `storage_monitor.dart` | ✅ 100 MB probe-write check (Req 21.5) |
| `storage_warning_widget.dart` | ✅ One-shot dialog wrapper widget |
| `index.dart` | ✅ Exports all 3 files |

#### `lib/db/`
| File | Status |
|------|--------|
| `app_database.dart` | ✅ Drift `@DriftDatabase` with all 5 tables + 4 DAOs |
| `database_provider.dart` | ✅ Riverpod `Provider<AppDatabase>` |
| `tables/collections_local_table.dart` | ✅ `sync_status`, `missing_gps`, UUID PK |
| `tables/sync_queue_table.dart` | ✅ `created_at` for chronological ordering |
| `tables/routes_local_table.dart` | ✅ Route fields |
| `tables/route_clients_local_table.dart` | ✅ Client stop fields with GPS |
| `tables/session_cache_table.dart` | ✅ JWT + refresh token + role cache |
| `daos/collections_dao.dart` | ✅ Insert, upsert, update sync status, paginated query (LIMIT 200) |
| `daos/sync_queue_dao.dart` | ✅ Enqueue, dequeue, ordered fetch, count |
| `daos/routes_dao.dart` | ✅ Upsert route + clients, ordered client fetch |
| `daos/session_dao.dart` | ✅ Save, get, clear session |
| `index.dart` | ✅ Exports all tables and DAOs |

#### `lib/features/auth/`
| File | Status |
|------|--------|
| `auth_repository.dart` | ✅ Sign-in, sign-out, offline session, token refresh, role resolution |
| `auth_provider.dart` | ✅ `authRepositoryProvider`, `authStateProvider`, `currentUserRoleProvider` |
| `app_router.dart` | ✅ Startup route resolution (offline cache, token refresh, role routing) |
| `login_screen.dart` | ✅ Email/password form, error messages, offline-with-cache flow |
| `index.dart` | ✅ Exports all 4 files |

#### `lib/features/driver/`
| File | Status |
|------|--------|
| `driver_home_screen.dart` | ✅ Thin wrapper delegating to `RouteListScreen` |
| `route_repository.dart` | ✅ Supabase download + Local_DB upsert |
| `route_provider.dart` | ✅ `driverRouteProvider`, `connectivityStatusProvider`, `connectivitySyncListenerProvider` |
| `route_list_screen.dart` | ✅ Client list with Record button, offline banner, storage warning |
| `route_map_screen.dart` | ✅ `flutter_map` + OSM tiles, numbered client pins, driver GPS marker (30s refresh) |
| `collection_repository.dart` | ✅ UUID v4 generation, insert to `collections_local` + `sync_queue` |
| `collection_provider.dart` | ✅ `collectionRepositoryProvider`, `collectionsHistoryProvider` (limit 200) |
| `collection_recording_screen.dart` | ✅ Pre-populated form, GPS capture, `missing_gps` flag, "Saved — pending sync" |
| `collections_history_screen.dart` | ✅ Paginated history with sync status badge |
| `connectivity_indicator.dart` | ✅ Online/Offline chip visible on all driver screens |
| `sync_status_widget.dart` | ✅ Pending count + last sync time + "Sync Now" button |
| `index.dart` | ✅ Exports all 11 files |

#### `lib/features/sync/`
| File | Status |
|------|--------|
| `sync_engine.dart` | ✅ Connectivity monitoring, batch upload (50), duplicate UUID handling, retry on error |
| `sync_provider.dart` | ✅ `syncEngineProvider` (keepAlive), `syncStatusProvider`, `pendingCountProvider` |
| `index.dart` | ✅ Exports both files |

#### `lib/features/customer/`
| File | Status |
|------|--------|
| `customer_home_screen.dart` | ✅ Placeholder (full portal in Task 34) |
| `index.dart` | ✅ Exports `customer_home_screen.dart` |

#### `lib/`
| File | Status |
|------|--------|
| `main.dart` | ✅ Supabase init, `ProviderScope`, eager sync engine + connectivity listener init |

---

### ✅ Android Configuration

| Item | Status |
|------|--------|
| `minSdkVersion 26` in `android/app/build.gradle` | ✅ Confirmed |
| Package name `com.desheena.desheena_waste` | ✅ Confirmed |

---

### ✅ `pubspec.yaml` Dependencies

| Dependency | Version | Purpose |
|------------|---------|---------|
| `drift` | `^2.18.0` | SQLite ORM |
| `drift_flutter` | `^0.2.0` | Flutter-specific Drift integration |
| `connectivity_plus` | `^6.0.3` | Network connectivity monitoring |
| `geolocator` | `^13.0.1` | GPS capture |
| `flutter_map` | `^7.0.2` | OpenStreetMap map widget |
| `latlong2` | `^0.9.1` | LatLng coordinate type |
| `supabase_flutter` | `^2.5.6` | Supabase client |
| `uuid` | `^4.4.0` | UUID v4 generation |
| `flutter_riverpod` | `^2.5.1` | State management |
| `riverpod_annotation` | `^2.3.5` | Riverpod code generation |
| `path_provider` | `^2.1.3` | App documents directory |
| `path` | `^1.9.0` | Path utilities |
| `cached_network_image` | `^3.3.1` | Image caching |
| `intl` | `^0.19.0` | Date formatting |
| `build_runner` | `^2.4.11` | Code generation runner |
| `drift_dev` | `^2.18.0` | Drift code generator |
| `riverpod_generator` | `^2.4.3` | Riverpod code generator |

---

## ⚠️ Items Requiring Manual Verification

The following cannot be verified without running the Flutter toolchain or a physical device:

### 1. Code Generation (Required before building)
Run these commands in the `mobile/` directory:

```bash
flutter pub get
dart run build_runner build --delete-conflicting-outputs
```

This generates the `.g.dart` files required by Drift and Riverpod:
- `mobile/lib/db/app_database.g.dart`
- `mobile/lib/db/daos/collections_dao.g.dart`
- `mobile/lib/db/daos/sync_queue_dao.g.dart`
- `mobile/lib/db/daos/routes_dao.g.dart`
- `mobile/lib/db/daos/session_dao.g.dart`

These files are excluded from source control (`.gitignore`) and must be generated locally.

### 2. End-to-End Offline Collection Recording
Test on a physical Android device (API 26+):
- [ ] Sign in with a Driver account
- [ ] Disable network connectivity
- [ ] Verify route loads from Local_DB cache
- [ ] Record a collection — confirm "Saved — pending sync" message appears
- [ ] Verify record appears in Collection History with "Pending" badge
- [ ] Re-enable network — verify sync engine uploads the record automatically
- [ ] Verify record shows "Synced" badge after upload

### 3. Sync Engine Upload Verification
- [ ] Confirm pending records upload to Supabase `collections` table when connectivity is restored
- [ ] Confirm duplicate UUID conflict (HTTP 409 / Postgres error 23505) marks record as synced without error
- [ ] Confirm network error retains record in `sync_queue` for next retry

### 4. GPS Behaviour
- [ ] Confirm GPS coordinates are captured and stored correctly
- [ ] Confirm `missing_gps = true` is set when GPS is unavailable
- [ ] Confirm collection can be submitted without GPS

### 5. Route Map
- [ ] Confirm OpenStreetMap tiles load when online
- [ ] Confirm numbered client stop pins render correctly
- [ ] Confirm driver position marker updates every 30 seconds

### 6. APK Size
Run in `mobile/` directory:
```bash
flutter build apk --release --split-per-abi
```
- [ ] Verify each ABI split APK is under 30 MB (Requirement 21.6)

### 7. Low Storage Warning
- [ ] Simulate low storage condition and verify warning dialog appears on Driver screens

---

## Notes

- The `.g.dart` generated files are not committed to source control. They must be regenerated after every `pubspec.yaml` change or Drift/Riverpod schema change.
- The Supabase URL and anon key in `lib/core/constants.dart` are the project credentials. Do not rotate them without updating this file.
- Phase 2 (React Admin Dashboard) can begin once the above manual verifications pass on a physical device.
