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

final routeRepositoryProvider = Provider<RouteRepository>((ref) {
  final db = ref.watch(appDatabaseProvider);
  return RouteRepository(db: db);
});

// ---------------------------------------------------------------------------
// Connectivity provider
// ---------------------------------------------------------------------------

final connectivityStatusProvider = StreamProvider<bool>((ref) {
  return Connectivity().onConnectivityChanged.map(
        (results) => results.any((r) => r != ConnectivityResult.none),
      );
});

// ---------------------------------------------------------------------------
// Connectivity-triggered sync
// ---------------------------------------------------------------------------

final connectivitySyncListenerProvider = Provider<void>((ref) {
  ref.listen<AsyncValue<bool>>(connectivityStatusProvider, (previous, next) {
    final isOnline = next.valueOrNull ?? false;
    final wasOnline = previous?.valueOrNull ?? false;
    if (isOnline && !wasOnline) {
      final engine = ref.read(syncEngineProvider);
      engine.syncNow();
      ref.invalidate(driverRouteProvider);
    }
  });
});

// ---------------------------------------------------------------------------
// Schedule helpers
// ---------------------------------------------------------------------------

bool _isIntervalDueToday(String startDate, int intervalDays) {
  final start = DateTime.parse(startDate);
  final today = DateTime.now();
  final startNorm = DateTime(start.year, start.month, start.day);
  final todayNorm = DateTime(today.year, today.month, today.day);
  if (todayNorm.isBefore(startNorm)) return false;
  final diff = todayNorm.difference(startNorm).inDays;
  return diff % intervalDays == 0;
}

/// Returns true if any of the client's cached schedules are due today.
bool isClientDueToday(List<ClientSchedulesLocalData> schedules) {
  final todayDow = DateTime.now().weekday % 7; // Dart: Mon=1…Sun=7 → 0=Sun
  final todayStr =
      DateTime.now().toIso8601String().split('T')[0]; // "YYYY-MM-DD"

  for (final s in schedules) {
    if (s.dayOfWeek != null && s.dayOfWeek == todayDow) return true;
    if (s.specificDate != null && s.specificDate == todayStr) return true;
    if (s.intervalDays != null &&
        s.intervalStartDate != null &&
        _isIntervalDueToday(s.intervalStartDate!, s.intervalDays!)) {
      return true;
    }
  }
  return false;
}

/// Returns a human-readable schedule summary for a client.
String scheduleLabel(List<ClientSchedulesLocalData> schedules) {
  if (schedules.isEmpty) return '';
  final parts = <String>[];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  final weeklyDays = schedules
      .where((s) => s.dayOfWeek != null)
      .map((s) => dayNames[s.dayOfWeek!])
      .toList();
  if (weeklyDays.isNotEmpty) parts.add(weeklyDays.join('/'));

  for (final s in schedules.where((s) => s.intervalDays != null)) {
    parts.add('Every ${s.intervalDays}d');
  }

  final specificCount =
      schedules.where((s) => s.specificDate != null).length;
  if (specificCount > 0) parts.add('$specificCount one-off');

  return parts.join(' · ');
}

// ---------------------------------------------------------------------------
// Route data model
// ---------------------------------------------------------------------------

class DriverRouteData {
  const DriverRouteData({
    required this.route,
    required this.clients,
    required this.schedulesByClient,
    required this.isFromCache,
  });

  final RoutesLocalData route;
  final List<RouteClientsLocalData> clients;

  /// Map of clientId → list of schedule entries (cached locally).
  final Map<String, List<ClientSchedulesLocalData>> schedulesByClient;

  final bool isFromCache;
}

// ---------------------------------------------------------------------------
// Driver route provider
// ---------------------------------------------------------------------------

final driverRouteProvider = FutureProvider<DriverRouteData?>((ref) async {
  final repo = ref.watch(routeRepositoryProvider);
  final authRepo = ref.read(authRepositoryProvider);

  final session = await authRepo.getOfflineSession();
  final driverId = session?.userId;
  if (driverId == null) return null;

  final connectivityResults = await Connectivity().checkConnectivity();
  final isOnline = connectivityResults.any((r) => r != ConnectivityResult.none);

  String? routeId;

  if (isOnline) {
    routeId = await repo.downloadAndCacheRoute(driverId);
  }

  final localRoute = await repo.getLocalRoute(driverId);
  if (localRoute == null) return null;

  routeId ??= localRoute.id;

  final clients = await repo.getLocalRouteClients(routeId);
  final clientIds = clients.map((c) => c.clientId).toList();
  final schedulesByClient =
      await repo.getLocalSchedulesForClients(clientIds);

  return DriverRouteData(
    route: localRoute,
    clients: clients,
    schedulesByClient: schedulesByClient,
    isFromCache: !isOnline,
  );
});
