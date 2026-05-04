import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../db/database_provider.dart';
import 'sync_engine.dart';

// ---------------------------------------------------------------------------
// SyncEngine provider
// ---------------------------------------------------------------------------

/// Provides the singleton [SyncEngine] instance, initialized with the
/// local database and kept alive for the lifetime of the app.
///
/// Implements Requirement 5.1 — continuous background connectivity monitoring.
final syncEngineProvider = Provider<SyncEngine>((ref) {
  final db = ref.watch(appDatabaseProvider);
  final engine = SyncEngine(db: db);

  // Keep the engine alive so it is not recreated on widget rebuilds.
  ref.keepAlive();

  // Start monitoring connectivity immediately.
  engine.start();

  ref.onDispose(engine.dispose);

  return engine;
});

// ---------------------------------------------------------------------------
// SyncStatus stream provider
// ---------------------------------------------------------------------------

/// StreamProvider that emits [SyncStatus] updates from the [SyncEngine].
///
/// Implements Requirement 5.7 — sync status indicator for the UI.
final syncStatusProvider = StreamProvider<SyncStatus>((ref) {
  final engine = ref.watch(syncEngineProvider);
  return engine.statusStream;
});

// ---------------------------------------------------------------------------
// Pending count provider
// ---------------------------------------------------------------------------

/// Derived provider that returns just the pending record count from the
/// current [SyncStatus].
///
/// Returns 0 when the status stream has not yet emitted a value.
final pendingCountProvider = Provider<int>((ref) {
  final statusAsync = ref.watch(syncStatusProvider);
  return statusAsync.when(
    data: (status) => status.pendingCount,
    loading: () => 0,
    error: (_, __) => 0,
  );
});
