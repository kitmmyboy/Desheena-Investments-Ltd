import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:drift/drift.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:uuid/uuid.dart';

import '../../db/index.dart';
import '../../db/database_provider.dart';

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

final customerRepositoryProvider = Provider<CustomerRepository>((ref) {
  final db = ref.watch(appDatabaseProvider);
  return CustomerRepository(db: db);
});

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------

/// Handles fetching Customer Portal data from Supabase and caching it locally.
class CustomerRepository {
  CustomerRepository({required AppDatabase db}) : _db = db;

  final AppDatabase _db;

  SupabaseClient get _client => Supabase.instance.client;

  /// Returns the currently authenticated Supabase user, or null.
  User? get currentUser => _client.auth.currentUser;

  // -------------------------------------------------------------------------
  // Invoices
  // -------------------------------------------------------------------------

  /// Fetches invoices for [clientId] from Supabase and upserts them into the
  /// local [InvoicesLocal] table.
  ///
  /// Throws on network error so callers can fall back to cached data.
  Future<void> fetchAndCacheInvoices(String clientId) async {
    final rows = await _client
        .from('invoices')
        .select()
        .eq('client_id', clientId)
        .order('created_at', ascending: false);

    final companions = (rows as List<dynamic>).map((row) {
      final m = row as Map<String, dynamic>;
      return InvoicesLocalCompanion(
        id: Value(m['id'] as String),
        clientId: Value(m['client_id'] as String),
        amount: Value((m['amount'] as num).toDouble()),
        dueDate: Value(m['due_date'] as String),
        status: Value(m['status'] as String),
        invoicePeriod: Value(m['invoice_period'] as String),
        createdAt: Value(DateTime.parse(m['created_at'] as String)),
      );
    }).toList();

    await _db.invoicesDao.upsertInvoices(companions);
  }

  /// Returns cached invoices for [clientId] from Local_DB.
  Future<List<InvoicesLocalData>> getLocalInvoices(String clientId) =>
      _db.invoicesDao.getInvoicesForClient(clientId);

  /// Returns cached active (unpaid/overdue) invoices for [clientId].
  Future<List<InvoicesLocalData>> getLocalActiveInvoices(String clientId) =>
      _db.invoicesDao.getActiveInvoicesForClient(clientId);

  /// Initiates a Pesapal payment for [invoiceId] by calling the
  /// `initiate-pesapal-payment` Edge Function.
  ///
  /// Returns a map with `redirect_url` and `order_tracking_id`.
  /// Throws on error.
  Future<Map<String, dynamic>> initiatePayment({
    required String invoiceId,
    required double amount,
    required String currency,
    required String customerPhone,
    required String customerEmail,
  }) async {
    final response = await _client.functions.invoke(
      'initiate-pesapal-payment',
      body: {
        'invoice_id': invoiceId,
        'amount': amount,
        'currency': currency,
        'customer_phone': customerPhone,
        'customer_email': customerEmail,
      },
    );

    if (response.data == null) {
      throw Exception('No response from payment service');
    }

    final data = response.data as Map<String, dynamic>;
    if (data['error'] != null) {
      throw Exception(data['error'].toString());
    }

    return data;
  }

  /// Fetches the latest status of [invoiceId] from Supabase and updates
  /// the local cache. Returns the updated status string.
  Future<String> refreshInvoiceStatus(String invoiceId) async {
    final rows = await _client
        .from('invoices')
        .select('id, status')
        .eq('id', invoiceId)
        .limit(1);

    final list = rows as List<dynamic>;
    if (list.isEmpty) {
      throw Exception('Invoice not found on server');
    }

    final status = (list.first as Map<String, dynamic>)['status'] as String;
    await _db.invoicesDao.updateInvoiceStatus(invoiceId, status);
    return status;
  }

  // -------------------------------------------------------------------------
  // Payments
  // -------------------------------------------------------------------------

  /// Fetches payments for [clientId] from Supabase and upserts them locally.
  Future<void> fetchAndCachePayments(String clientId) async {
    final rows = await _client
        .from('payments')
        .select()
        .eq('client_id', clientId)
        .order('created_at', ascending: false);

    final companions = (rows as List<dynamic>).map((row) {
      final m = row as Map<String, dynamic>;
      return PaymentsLocalCompanion(
        id: Value(m['id'] as String),
        invoiceId: Value(m['invoice_id'] as String),
        clientId: Value(m['client_id'] as String),
        amount: Value((m['amount'] as num).toDouble()),
        currency: Value((m['currency'] as String?) ?? 'UGX'),
        paymentMethod: Value(m['payment_method'] as String),
        transactionRef: Value(m['transaction_ref'] as String?),
        paidAt: Value(m['paid_at'] as String?),
        status: Value(m['status'] as String),
        createdAt: Value(DateTime.parse(m['created_at'] as String)),
      );
    }).toList();

    await _db.paymentsDao.upsertPayments(companions);
  }

  /// Returns cached payments for [clientId] from Local_DB.
  Future<List<PaymentsLocalData>> getLocalPayments(String clientId) =>
      _db.paymentsDao.getPaymentsForClient(clientId);

  // -------------------------------------------------------------------------
  // Complaints
  // -------------------------------------------------------------------------

  /// Fetches complaints for [clientId] from Supabase and upserts them locally.
  Future<void> fetchAndCacheComplaints(String clientId) async {
    final rows = await _client
        .from('complaints')
        .select()
        .eq('client_id', clientId)
        .order('created_at', ascending: false);

    final companions = (rows as List<dynamic>).map((row) {
      final m = row as Map<String, dynamic>;
      return ComplaintsLocalCompanion(
        id: Value(m['id'] as String),
        clientId: Value(m['client_id'] as String),
        message: Value(m['message'] as String),
        category: Value(m['category'] as String),
        status: Value(m['status'] as String),
        createdAt: Value(DateTime.parse(m['created_at'] as String)),
        updatedAt: Value(
          m['updated_at'] != null
              ? DateTime.parse(m['updated_at'] as String)
              : DateTime.parse(m['created_at'] as String),
        ),
      );
    }).toList();

    await _db.complaintsDao.upsertComplaints(companions);
  }

  /// Returns cached complaints for [clientId] from Local_DB.
  Future<List<ComplaintsLocalData>> getLocalComplaints(String clientId) =>
      _db.complaintsDao.getComplaintsForClient(clientId);

  /// Submits a new complaint directly to Supabase and caches it locally.
  ///
  /// Checks connectivity first — throws [OfflineException] if offline.
  /// Returns the UUID of the created complaint.
  Future<String> submitComplaint({
    required String clientId,
    required String message,
    required String category,
  }) async {
    // Check connectivity before attempting submission.
    final connectivity = await Connectivity().checkConnectivity();
    if (connectivity.contains(ConnectivityResult.none) ||
        connectivity.isEmpty) {
      throw OfflineException(
          'Cannot submit complaint — no internet connection');
    }

    final id = const Uuid().v4();
    final now = DateTime.now().toUtc();

    // Insert into Supabase.
    await _client.from('complaints').insert({
      'id': id,
      'client_id': clientId,
      'message': message,
      'category': category,
      'status': 'open',
      'created_at': now.toIso8601String(),
      'updated_at': now.toIso8601String(),
    });

    // Upsert into local cache for immediate offline display.
    await _db.complaintsDao.upsertComplaint(
      ComplaintsLocalCompanion(
        id: Value(id),
        clientId: Value(clientId),
        message: Value(message),
        category: Value(category),
        status: const Value('open'),
        createdAt: Value(now),
        updatedAt: Value(now),
      ),
    );

    return id;
  }

  // -------------------------------------------------------------------------
  // Notifications
  // -------------------------------------------------------------------------

  /// Fetches unread notifications for [userId] from Supabase.
  Future<List<Map<String, dynamic>>> fetchUnreadNotifications(
      String userId) async {
    final rows = await _client
        .from('notifications')
        .select()
        .eq('is_read', false)
        .order('created_at', ascending: false)
        .limit(50);
    return List<Map<String, dynamic>>.from(rows as List);
  }

  // -------------------------------------------------------------------------
  // Dashboard & Scheduling
  // -------------------------------------------------------------------------

  /// Fetches the assigned driver info for the client.
  Future<DriverInfo?> getAssignedDriver(String clientId) async {
    try {
      // Logic: A client is linked to a route via route_clients. 
      // A route is linked to a driver via route_drivers.
      final response = await _client
          .from('route_clients')
          .select('route_id, routes(id, route_drivers(users(full_name, phone)))')
          .eq('client_id', clientId)
          .maybeSingle();

      if (response == null) return null;

      final route = response['routes'] as Map<String, dynamic>?;
      if (route == null) return null;

      final drivers = route['route_drivers'] as List<dynamic>?;
      if (drivers == null || drivers.isEmpty) return null;

      final user = drivers.first['users'] as Map<String, dynamic>?;
      if (user == null) return null;

      return DriverInfo(
        name: user['full_name'] as String,
        phone: user['phone'] as String?,
      );
    } catch (e) {
      return null;
    }
  }

  /// Fetches the next scheduled collection date for the client.
  Future<String?> getNextCollection(String clientId) async {
    try {
      final response = await _client
          .from('collection_schedules')
          .select('day_of_week, specific_date')
          .eq('client_id', clientId)
          .order('specific_date', ascending: true)
          .limit(1)
          .maybeSingle();

      if (response == null) return "TBD (Contact Admin)";

      if (response['specific_date'] != null) {
        return response['specific_date'] as String;
      }

      if (response['day_of_week'] != null) {
        final days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        return "Weekly on ${days[response['day_of_week'] as int]}";
      }

      return null;
    } catch (e) {
      return null;
    }
  }
}

class CustomerDashboardData {
  final List<InvoicesLocalData> invoices;
  final List<PaymentsLocalData> payments;
  final DriverInfo? driver;
  final String? nextCollection;

  CustomerDashboardData({
    required this.invoices,
    required this.payments,
    this.driver,
    this.nextCollection,
  });
}

class DriverInfo {
  final String name;
  final String? phone;
  DriverInfo({required this.name, this.phone});
}

/// Thrown when a network-required operation is attempted while offline.
class OfflineException implements Exception {
  OfflineException(this.message);
  final String message;

  @override
  String toString() => message;
}
