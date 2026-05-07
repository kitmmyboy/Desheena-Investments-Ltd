# System Audit Report - Desheena Waste Management System

**Date:** May 7, 2026  
**Audit Scope:** Clients, Contracts, KPI calculations, and related features

---

## Executive Summary

The audit revealed several issues in the waste management system, including a critical bug in the KPI calculation (now fixed), missing database fields in the UI, and hardcoded values that prevent proper data entry. The database was recently cleared by a migration, which explains why the audit showed zero data.

---

## Critical Issues (High Priority)

### 1. ✅ KPI Active Clients Count Bug - FIXED
**File:** `dashboard/src/features/collections/useKpiData.ts`  
**Issue:** The "Active Clients" KPI was counting total contracts instead of unique clients. If a client had multiple active contracts, they were counted multiple times.  
**Impact:** Users were seeing incorrect client counts (e.g., 109 instead of actual number).  
**Fix Applied:** Changed query to fetch client_id data and count unique IDs using a Set.  
**Status:** ✅ FIXED

### 2. GPS Coordinates Hardcoded to 0
**File:** `dashboard/src/features/clients/ClientForm.tsx` (lines 168-169)  
**Issue:** When creating or editing a client, GPS coordinates (gps_lat, gps_lng) are hardcoded to 0, making all clients appear at the same location (0,0).  
**Impact:** Map views and location-based features will not work correctly.  
**Recommended Fix:** 
- Add GPS coordinate input fields to the form
- Or integrate with a map picker to allow users to select location
- Or make these fields optional and validate properly when provided

---

## Missing Features (Medium Priority)

### 3. Missing Contract Fields in ContractForm
**File:** `dashboard/src/features/contracts/ContractForm.tsx`  
**Database Schema:** The contracts table has these columns that are NOT in the form:
- `billing_model` ('flat' | 'frequency') - Used to determine billing method
- `per_collection_rate` - Rate per collection for frequency-based billing
- `registration_fee` - One-time registration fee
- `notes` - Additional notes about the contract
- `billing_cycle` - Currently only supports 'monthly'

**Impact:** Users cannot set up frequency-based billing or add important contract details.  
**Recommended Fix:** Add these fields to ContractForm with proper validation.

### 4. Division Office Field Not in ClientForm
**File:** `dashboard/src/features/clients/ClientForm.tsx`  
**Database Schema:** The clients table has a `division_office` column (added in migration 20260505125229).  
**Current State:** Only used in CSV import, not in the main client form or clients page table.  
**Impact:** Users cannot set division office through the UI, only via CSV import.  
**Recommended Fix:** Add division_office field to ClientForm and display it in the clients page table.

### 5. Service Frequency as Text Input
**File:** `dashboard/src/features/clients/ClientForm.tsx` (lines 258-269)  
**Issue:** Service frequency is a free-text input, which can lead to inconsistent data entry.  
**Current Options:** "monthly", "weekly", "twice per week", "three times per week", "daily"  
**Impact:** Data inconsistency, difficult to filter and report.  
**Recommended Fix:** Convert to dropdown with predefined options matching the clients page filter.

---

## Database Schema Issues (Low Priority)

### 6. Notes Column Missing from Clients Table
**File:** `dashboard/src/features/clients/CsvImportPage.tsx`  
**Issue:** The CSV import includes a "notes" field for clients, but the database schema doesn't have a notes column in the clients table.  
**Impact:** Notes data from CSV import is lost or causes errors.  
**Recommended Fix:** Add migration to add notes column to clients table.

---

## Database State

### Data Cleared by Migration
**Migration:** `20260507100000_clear_all_data_except_drivers.sql`  
**Impact:** All clients, contracts, invoices, collections, and other data were deleted (except drivers).  
**Action Required:** Data needs to be re-imported or restored from backup.

---

## Orphaned Records Check

The code includes logic to handle:
- Clients without contracts (handled via "No contract" filter)
- Contracts without clients (protected by foreign key constraint with CASCADE)

**Status:** ✅ Properly handled in code

---

## Clients Page Filters

**File:** `dashboard/src/features/clients/ClientsPage.tsx`  
**Status:** ✅ Working correctly

Available filters:
- Search by name or phone
- Zone filter (Kito, Nsasa, Naalya, Mbuya, Mbalwa, Sonde, Kimbejja, Buwate, Nabusigwe, Janda, Mulawa)
- Service frequency filter
- Contract status filter (Active, Suspended, Ended, Terminated, No contract)
- Show inactive clients toggle

---

## KPI Calculations Audit

**File:** `dashboard/src/features/collections/useKpiData.ts`

| KPI Metric | Calculation Method | Status |
|-----------|-------------------|--------|
| Collections Today | Count collections with collected_at >= today | ✅ Correct |
| Weight Today | Sum weight_kg from collections today | ✅ Correct |
| Revenue Today | Sum paid_amount from invoices updated today | ✅ Correct |
| Active Clients | Unique clients with active contracts (status='active' AND end_date >= today OR null) | ✅ Fixed |
| Pending Sync | Count collections with sync_status='pending' | ✅ Correct |
| Open Complaints | Count complaints with status='open' | ✅ Correct |

---

## Recommended Action Plan

### Phase 1: Critical Fixes (Immediate)
1. ✅ Fix KPI active clients count - COMPLETED
2. Fix GPS coordinates in ClientForm
   - Add map picker or coordinate input fields
   - Validate coordinates when provided
   - Make GPS optional but warn if missing for map features

### Phase 2: Missing Contract Fields (High Priority)
3. Add missing fields to ContractForm:
   - billing_model (dropdown: flat / frequency)
   - per_collection_rate (numeric, shown when billing_model=frequency)
   - registration_fee (numeric)
   - notes (textarea)
   - billing_cycle (dropdown, currently only monthly)

### Phase 3: Client Form Improvements (Medium Priority)
4. Add division_office field to ClientForm and clients page table
5. Convert service_frequency to dropdown with predefined options
6. Add notes column to clients table (migration) and include in form

### Phase 4: Data Recovery (If Needed)
7. Restore or re-import client and contract data after clearing migration

---

## Files Modified During Audit

1. `dashboard/src/features/collections/useKpiData.ts` - Fixed active clients count
2. `dashboard/audit-system.ts` - Created audit script (can be deleted)

---

## Conclusion

The system has a solid foundation with proper foreign key constraints and RLS policies. The main issues are:
- Missing UI fields for database columns
- Hardcoded GPS coordinates preventing location features
- Data cleared by recent migration

All issues are fixable with straightforward UI improvements and database migrations. The KPI calculation bug has been resolved.
