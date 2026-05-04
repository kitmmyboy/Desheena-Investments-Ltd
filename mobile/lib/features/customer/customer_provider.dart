import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../db/index.dart';
import 'customer_repository.dart';

// ---------------------------------------------------------------------------
// Current client ID
// ---------------------------------------------------------------------------

/// Resolves the current user's client ID from the Supabase session.
/// The client_id is the same as the user's UUID in Supabase Auth.
final currentClientIdProvider = Provider<String?>((ref) {
  final user = Supabase.instance.client.auth.currentUser;
  return user?.id;
});

// ---------------------------------------------------------------------------
// Notification badge count
// ---------------------------------------------------------------------------

/// Tracks the number of unread notifications for the badge.
final notificationBadgeCountProvider =
    StateProvider<int>((ref) => 0);

// ---------------------------------------------------------------------------
// Invoices
// ---------------------------------------------------------------------------

/// Fetches invoices from Supabase (with local cache fallback) and returns
/// the cached list.
final customerInvoicesProvider =
    FutureProvider<List<InvoicesLocalData>>((ref) async {
  final repo = ref.watch(customerRepositoryProvider);
  final clientId = ref.watch(currentClientIdProvider);

  if (clientId == null) return [];

  // Try to refresh from Supabase; fall back to cache on error.
  try {
    await repo.fetchAndCacheInvoices(clientId);
  } catch (_) {
    // Network unavailable — serve from cache.
  }

  return repo.getLocalInvoices(clientId);
});

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------

/// Initiates a Pesapal payment for the given invoice.
///
/// Returns a map with `redirect_url` and `order_tracking_id` on success.
/// Throws on error.
final paymentInitiationProvider = FutureProvider.family<
    Map<String, dynamic>,
    ({
      String invoiceId,
      double amount,
      String currency,
      String customerPhone,
      String customerEmail,
    })>((ref, params) async {
  final repo = ref.watch(customerRepositoryProvider);
  return repo.initiatePayment(
    invoiceId: params.invoiceId,
    amount: params.amount,
    currency: params.currency,
    customerPhone: params.customerPhone,
    customerEmail: params.customerEmail,
  );
});

/// Refreshes the invoice status from Supabase and updates Local_DB.
/// Returns the latest status string.
final invoiceStatusRefreshProvider =
    FutureProvider.family<String, String>((ref, invoiceId) async {
  final repo = ref.watch(customerRepositoryProvider);
  return repo.refreshInvoiceStatus(invoiceId);
});

/// Fetches payment history from Supabase (with local cache fallback).
final customerPaymentsProvider =
    FutureProvider<List<PaymentsLocalData>>((ref) async {
  final repo = ref.watch(customerRepositoryProvider);
  final clientId = ref.watch(currentClientIdProvider);

  if (clientId == null) return [];

  try {
    await repo.fetchAndCachePayments(clientId);
  } catch (_) {
    // Network unavailable — serve from cache.
  }

  return repo.getLocalPayments(clientId);
});

// ---------------------------------------------------------------------------
// Complaints
// ---------------------------------------------------------------------------

/// Fetches complaint history from Supabase (with local cache fallback).
final customerComplaintsProvider =
    FutureProvider<List<ComplaintsLocalData>>((ref) async {
  final repo = ref.watch(customerRepositoryProvider);
  final clientId = ref.watch(currentClientIdProvider);

  if (clientId == null) return [];

  try {
    await repo.fetchAndCacheComplaints(clientId);
  } catch (_) {
    // Network unavailable — serve from cache.
  }

  return repo.getLocalComplaints(clientId);
});

/// Submits a new complaint to Supabase.
///
/// Usage: call `ref.read(submitComplaintProvider(...).future)` with the
/// required parameters.
final submitComplaintProvider = FutureProvider.family<
    String,
    ({String clientId, String message, String category})>((ref, params) async {
  final repo = ref.watch(customerRepositoryProvider);
  return repo.submitComplaint(
    clientId: params.clientId,
    message: params.message,
    category: params.category,
  );
});

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

/// Fetches unread notification count and updates the badge provider.
final customerNotificationsProvider = FutureProvider<int>((ref) async {
  final repo = ref.watch(customerRepositoryProvider);
  final user = Supabase.instance.client.auth.currentUser;

  if (user == null) return 0;

  try {
    final notifications = await repo.fetchUnreadNotifications(user.id);
    final count = notifications.length;
    ref.read(notificationBadgeCountProvider.notifier).state = count;
    return count;
  } catch (_) {
    return ref.read(notificationBadgeCountProvider);
  }
});
