import 'package:drift/drift.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../db/index.dart';

/// Handles downloading route data from Supabase and reading it from Local_DB.
///
/// Implements Requirements 3.1 and 3.2 — online download + offline read.
class RouteRepository {
  RouteRepository({required AppDatabase db}) : _db = db;

  final AppDatabase _db;

  RoutesDao get _routesDao => _db.routesDao;
  ClientSchedulesDao get _schedulesDao => _db.clientSchedulesDao;

  SupabaseClient get _client => Supabase.instance.client;

  // ---------------------------------------------------------------------------
  // Online: download and cache
  // ---------------------------------------------------------------------------

  /// Fetches the driver's assigned route from Supabase and upserts all data
  /// into Local_DB via [RoutesDao].
  Future<String?> downloadAndCacheRoute(String driverId) async {
    // 1. Get the route_id assigned to this driver.
    final routeDriverRow = await _client
        .from('route_drivers')
        .select('route_id')
        .eq('driver_id', driverId)
        .maybeSingle();

    if (routeDriverRow == null) return null;

    final routeId = routeDriverRow['route_id'] as String;

    // 2. Fetch route details.
    final routeRow = await _client
        .from('routes')
        .select('id, name, zone, updated_at')
        .eq('id', routeId)
        .single();

    await _routesDao.upsertRoute(
      RoutesLocalCompanion(
        id: Value(routeRow['id'] as String),
        name: Value(routeRow['name'] as String),
        zone: Value(routeRow['zone'] as String? ?? ''),
        updatedAt: Value(
          routeRow['updated_at'] != null
              ? DateTime.parse(routeRow['updated_at'] as String)
              : DateTime.now(),
        ),
      ),
    );

    // 3. Fetch all clients on the route, joined with client details.
    final clientRows = await _client
        .from('route_clients')
        .select('*, clients(*)')
        .eq('route_id', routeId)
        .order('sequence_order');

    // Collect client IDs for schedule download
    final clientIds = <String>[];

    for (final row in clientRows as List<dynamic>) {
      final client = row['clients'] as Map<String, dynamic>? ?? {};
      final id = row['id'] as String? ?? '';
      if (id.isEmpty) continue;

      final clientId = row['client_id'] as String? ?? '';
      if (clientId.isNotEmpty) clientIds.add(clientId);

      await _routesDao.upsertRouteClient(
        RouteClientsLocalCompanion(
          id: Value(id),
          routeId: Value(routeId),
          clientId: Value(clientId),
          clientName: Value(client['name'] as String? ?? 'Unknown'),
          locationText: Value(client['location_text'] as String? ?? ''),
          gpsLat: Value((client['gps_lat'] as num?)?.toDouble()),
          gpsLng: Value((client['gps_lng'] as num?)?.toDouble()),
          wasteType: Value(
            client['waste_type'] as String? ??
                row['waste_type'] as String? ??
                'general',
          ),
          sequenceOrder: Value(row['sequence_order'] as int?),
        ),
      );
    }

    // 4. Download and cache collection schedules for all route clients.
    if (clientIds.isNotEmpty) {
      await _downloadAndCacheSchedules(clientIds);
    }

    return routeId;
  }

  /// Downloads collection schedules for the given client IDs and caches them.
  Future<void> _downloadAndCacheSchedules(List<String> clientIds) async {
    try {
      final scheduleRows = await _client
          .from('collection_schedules')
          .select(
              'id, client_id, day_of_week, specific_date, interval_days, interval_start_date')
          .inFilter('client_id', clientIds);

      // Group by client_id and replace
      final byClient = <String, List<ClientSchedulesLocalCompanion>>{};
      for (final row in scheduleRows as List<dynamic>) {
        final clientId = row['client_id'] as String? ?? '';
        if (clientId.isEmpty) continue;
        byClient.putIfAbsent(clientId, () => []).add(
              ClientSchedulesLocalCompanion(
                id: Value(row['id'] as String),
                clientId: Value(clientId),
                dayOfWeek: Value(row['day_of_week'] as int?),
                specificDate: Value(row['specific_date'] as String?),
                intervalDays: Value(row['interval_days'] as int?),
                intervalStartDate:
                    Value(row['interval_start_date'] as String?),
              ),
            );
      }

      for (final entry in byClient.entries) {
        await _schedulesDao.replaceSchedulesForClient(
            entry.key, entry.value);
      }
    } catch (e) {
      // Silently fail — schedules are best-effort
      print('Failed to download schedules: $e');
    }
  }

  // ---------------------------------------------------------------------------
  // Offline: read from Local_DB
  // ---------------------------------------------------------------------------

  Future<RoutesLocalData?> getLocalRoute(String driverId) async {
    final routes = await _routesDao.getAllRoutes();
    return routes.isEmpty ? null : routes.first;
  }

  Future<List<RouteClientsLocalData>> getLocalRouteClients(String routeId) =>
      _routesDao.getClientsForRoute(routeId);

  /// Returns all cached schedules for a list of client IDs.
  Future<Map<String, List<ClientSchedulesLocalData>>>
      getLocalSchedulesForClients(List<String> clientIds) async {
    final all = await _schedulesDao.getAllSchedules();
    final result = <String, List<ClientSchedulesLocalData>>{};
    for (final s in all) {
      if (clientIds.contains(s.clientId)) {
        result.putIfAbsent(s.clientId, () => []).add(s);
      }
    }
    return result;
  }

  // ---------------------------------------------------------------------------
  // Real-time tracking
  // ---------------------------------------------------------------------------

  Future<void> updateDriverLocation({
    required String driverId,
    required double lat,
    required double lng,
    double? heading,
    double? speed,
  }) async {
    try {
      await _client.from('driver_locations').upsert({
        'driver_id': driverId,
        'lat': lat,
        'lng': lng,
        'heading': heading,
        'speed': speed,
        'updated_at': DateTime.now().toIso8601String(),
      });
    } catch (e) {
      print('Failed to update driver location: $e');
    }
  }
}
