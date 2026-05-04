import 'dart:async';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../db/app_database.dart';

// ---------------------------------------------------------------------------
// SyncStatus model
// ---------------------------------------------------------------------------

/// Snapshot of the sync engine's current state, emitted on the status stream.
///
/// Implements Requirements 5.7 — pending count and last sync timestamp.
class SyncStatus {
  const SyncStatus({
    required this.pendingCount,
    this.lastSyncTime,
    required this.isSyncing,
    this.lastError,
  });

  /// Number of records still waiting to be uploaded.
  final int pendingCount;

  /// Timestamp of the last successful sync batch, or null if never synced.
  final DateTime? lastSyncTime;

  /// True while a sync operation is actively running.
  final bool isSyncing;

  /// Human-readable description of the last error, or null if no error.
  final String? lastError;

  SyncStatus copyWith({
    int? pendingCount,
    DateTime? lastSyncTime,
    bool? isSyncing,
    String? lastError,
    bool clearError = false,
  }) {
    return SyncStatus(
      pendingCount: pendingCount ?? this.pendingCount,
      lastSyncTime: lastSyncTime ?? this.lastSyncTime,
      isSyncing: isSyncing ?? this.isSyncing,
      lastError: clearError ? null : (lastError ?? this.lastError),
    );
  }

  @override
  String toString() =>
      'SyncStatus(pending=$pendingCount, syncing=$isSyncing, '
      'lastSync=$lastSyncTime, error=$lastError)';
}

// ---------------------------------------------------------------------------
// SyncEngine
// ---------------------------------------------------------------------------

/// Background sync worker that monitors connectivity and uploads pending
/// collection records to Supabase.
///
/// Implements Requirements 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.9, 21.4.
///
/// Design notes:
/// - Uses Flutter's async/await model which is inherently non-blocking on the
///   UI thread (Requirement 5.9 / 21.4).
/// - Processes [SyncQueue] records in chronological order (Requirement 5.6).
/// - Batches uploads in groups of [_batchSize] to avoid memory spikes on
///   low-end devices (Requirement 21.4).
/// - Duplicate UUID conflicts (PostgreSQL error 23505) are treated as
///   authoritative server copies — local record is marked synced and removed
///   from the queue (Requirement 5.5).
/// - Network errors retain the record in the queue for retry on the next
///   connectivity event (Requirement 5.4).
class SyncEngine {
  SyncEngine({required AppDatabase db}) : _db = db;

  final AppDatabase _db;

  /// Number of records uploaded per batch.
  static const int _batchSize = 50;

  // Internal status stream controller.
  final _statusController = StreamController<SyncStatus>.broadcast();

  SyncStatus _currentStatus = const SyncStatus(
    pendingCount: 0,
    isSyncing: false,
  );

  StreamSubscription<List<ConnectivityResult>>? _connectivitySubscription;

  bool _disposed = false;

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /// Stream of [SyncStatus] updates for the UI to observe.
  ///
  /// Implements Requirement 5.7 — sync status indicator.
  Stream<SyncStatus> get statusStream => _statusController.stream;

  /// The most recently emitted [SyncStatus].
  SyncStatus get currentStatus => _currentStatus;

  /// Starts monitoring connectivity and triggers sync when online.
  ///
  /// Implements Requirement 5.1 — continuous connectivity monitoring.
  void start() {
    _connectivitySubscription = Connectivity()
        .onConnectivityChanged
        .listen(_onConnectivityChanged);

    // Perform an immediate connectivity check so that if the app starts
    // while already online, sync begins without waiting for a state change.
    _checkAndSync();
  }

  /// Manually triggers a sync cycle regardless of the automatic schedule.
  ///
  /// Implements Requirement 5.8 — manual sync trigger.
  Future<void> syncNow() => _runSync();

  /// Releases resources. Call when the engine is no longer needed.
  void dispose() {
    _disposed = true;
    _connectivitySubscription?.cancel();
    _statusController.close();
  }

  // ---------------------------------------------------------------------------
  // Connectivity handling
  // ---------------------------------------------------------------------------

  void _onConnectivityChanged(List<ConnectivityResult> results) {
    final isOnline = results.any((r) => r != ConnectivityResult.none);
    if (isOnline) {
      // Requirement 3.6 / 5.1 — auto-trigger sync when connectivity restored.
      _runSync();
    }
  }

  Future<void> _checkAndSync() async {
    final results = await Connectivity().checkConnectivity();
    final isOnline = results.any((r) => r != ConnectivityResult.none);
    if (isOnline) {
      await _runSync();
    } else {
      // Update pending count even when offline so the UI shows correct state.
      await _refreshPendingCount();
    }
  }

  // ---------------------------------------------------------------------------
  // Core sync logic
  // ---------------------------------------------------------------------------

  /// Runs a full sync cycle: fetches the queue, uploads in batches, and
  /// updates local state.
  ///
  /// This method is async and non-blocking — it does not use Isolate.run()
  /// because Flutter's event loop already keeps async work off the UI thread.
  Future<void> _runSync() async {
    if (_disposed) return;

    // Prevent concurrent sync runs.
    if (_currentStatus.isSyncing) return;

    _emit(_currentStatus.copyWith(isSyncing: true, clearError: true));

    try {
      await _processSyncQueue();
    } catch (e) {
      _emit(_currentStatus.copyWith(
        isSyncing: false,
        lastError: e.toString(),
      ));
      return;
    }

    _emit(_currentStatus.copyWith(isSyncing: false));
  }

  /// Fetches all pending queue entries in chronological order and uploads
  /// them to Supabase in batches of [_batchSize].
  ///
  /// Implements Requirements 5.2, 5.3, 5.4, 5.5, 5.6.
  Future<void> _processSyncQueue() async {
    // Requirement 5.6 — chronological order (createdAt ASC).
    final pending = await _db.syncQueueDao.getPendingOrdered();

    if (pending.isEmpty) {
      await _refreshPendingCount();
      return;
    }

    final supabase = Supabase.instance.client;
    int successCount = 0;

    // Process in batches of _batchSize.
    for (int i = 0; i < pending.length; i += _batchSize) {
      if (_disposed) break;

      final batch = pending.skip(i).take(_batchSize).toList();

      for (final queueEntry in batch) {
        if (_disposed) break;

        // Fetch the full collection record from Local_DB.
        final collections = await _db.collectionsDao.getPendingCollections();
        final collection = collections
            .where((c) => c.id == queueEntry.collectionId)
            .firstOrNull;

        if (collection == null) {
          // Record no longer exists locally — remove orphaned queue entry.
          await _db.syncQueueDao.dequeue(queueEntry.id);
          continue;
        }

        // Build the Supabase payload.
        final payload = {
          'id': collection.id,
          'client_id': collection.clientId,
          'driver_id': collection.driverId,
          'waste_type': collection.wasteType,
          'weight_kg': collection.weightKg,
          'collected_at': collection.collectedAt, // ISO 8601 → timestamptz
          'gps_lat': collection.gpsLat,
          'gps_lng': collection.gpsLng,
          'missing_gps': collection.missingGps,
          'sync_status': 'synced',
        };

        try {
          // Requirement 5.2 — upload to Supabase collections table.
          await supabase.from('collections').insert(payload);

          // Requirement 5.3 — mark local record as synced and dequeue.
          await _db.collectionsDao.updateSyncStatus(collection.id, 'synced');
          await _db.syncQueueDao.dequeue(queueEntry.id);
          successCount++;
        } on PostgrestException catch (e) {
          if (e.code == '23505') {
            // Requirement 5.5 — duplicate UUID conflict: treat server as
            // authoritative, mark local as synced, remove from queue.
            await _db.collectionsDao.updateSyncStatus(collection.id, 'synced');
            await _db.syncQueueDao.dequeue(queueEntry.id);
            successCount++;
          } else {
            // Other Supabase errors — retain in queue for retry.
            // Requirement 5.4 — network/server errors keep record in queue.
            _emit(_currentStatus.copyWith(
              lastError: 'Upload error (${e.code}): ${e.message}',
            ));
          }
        } catch (e) {
          // Requirement 5.4 — network error: retain in queue for retry.
          _emit(_currentStatus.copyWith(
            lastError: 'Network error: $e',
          ));
          // Stop processing this batch on network failure; retry next time.
          break;
        }
      }
    }

    // Update status after processing.
    final remaining = await _db.syncQueueDao.getPendingCount();
    _emit(_currentStatus.copyWith(
      pendingCount: remaining,
      lastSyncTime: successCount > 0 ? DateTime.now() : null,
      clearError: successCount > 0,
    ));
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  Future<void> _refreshPendingCount() async {
    final count = await _db.syncQueueDao.getPendingCount();
    _emit(_currentStatus.copyWith(pendingCount: count));
  }

  void _emit(SyncStatus status) {
    if (_disposed) return;
    _currentStatus = status;
    _statusController.add(status);
  }
}
