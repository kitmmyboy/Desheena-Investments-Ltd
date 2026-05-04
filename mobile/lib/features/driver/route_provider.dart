import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../db/database_provider.dart';
import '../../db/index.dart';
import '../auth/auth_provider.dart';
import '../sync/sync_provider.dart';
import 'route_repository.dart';

// ---------------------------------------------------------------------------
// Repository provider
// ---------------------------------------------------------------------------

/// Provides the singleton [RouteRepository] instance.
final routeRepositoryProvider = Provider<RouteRepository>((ref) {
  final db = ref.watch(appDatabaseProvider);
  return RouteRepository(db: db);
});

// ---------------------------------------------------------------------------
// Connectivity provider
// ---------------------------------------------------------------------------

/// StreamProvider that emits `true` when the device is online and `false`
/// when offline.
///
/// Implements Requirement 3.5 — persistent offline/online status indicator.
final connectivityStatusProvider = StreamProvider<bool>((ref) {
  return Connectivity().onConnectivityChanged.map(
        (results) => results.any(
          (r) => r != ConnectivityResult.none,
        ),
      );
});

// ---------------------------------------------------------------------------
// Connectivity-triggered sync
// ---------------------------------------------------------------------------

/// Listens to [connectivityStatusProvider] and automatically triggers
/// [SyncEngine.syncNow] whenever the device comes online.
///
/// Implements Requirement 3.6 — auto-trigger sync on connectivity restore.
final connectivitySyncListenerProvider = Provider<void>((ref) {
  ref.listen<AsyncValue<bool>>(connectivityStatusProvider, (previous, next) {
    final isOnline = next.valueOrNull ?? false;
    final wasOnline = previous?.valueOrNull ?? false;

    // Only trigger when transitioning from offline → online.
    if (isOnline && !wasOnline) {
      final engine = ref.read(syncEngineProvider);
      engine.syncNow();
    }
  });
});

// ---------------------------------------------------------------------------
// Route data model
// ---------------------------------------------------------------------------

/// Holds the resolved route and its ordered client list.
class DriverRouteData {
  const DriverRouteData({
    required this.route,
    required this.clients,
    required this.isFromCache,
  });

  final RoutesLocalData route;
  final List<RouteClientsLocalData> clients;

  /// True when the data was served from Local_DB without a fresh download.
  final bool isFromCache;
}

// ---------------------------------------------------------------------------
// Driver route provider
// ---------------------------------------------------------------------------

/// FutureProvider that:
/// 1. Checks connectivity.
/// 2. If online: calls [RouteRepository.downloadAndCacheRoute] then reads
///    local data (Requirement 3.1).
/// 3. If offline: reads local data directly (Requirement 3.2).
///
/// Returns null when no route is assigned to the driver.
final driverRouteProvider = FutureProvider<DriverRouteData?>((ref) async {
  final repo = ref.watch(routeRepositoryProvider);
  final authRepo = ref.read(authRepositoryProvider);

  // Resolve the current driver's user id.
  final session = await authRepo.getOfflineSession();
  final driverId = session?.userId;
  if (driverId == null) return null;

  // Check current connectivity (one-shot check).
  final connectivityResults = await Connectivity().checkConnectivity();
  final isOnline = connectivityResults.any((r) => r != ConnectivityResult.none);

  String? routeId;

  if (isOnline) {
    // Download fresh data from Supabase and cache it locally.
    routeId = await repo.downloadAndCacheRoute(driverId);
  }

  // Read from Local_DB (works for both online and offline paths).
  final localRoute = await repo.getLocalRoute(driverId);
  if (localRoute == null) return null;

  routeId ??= localRoute.id;

  final clients = await repo.getLocalRouteClients(routeId);

  return DriverRouteData(
    route: localRoute,
    clients: clients,
    isFromCache: !isOnline,
  );
});
