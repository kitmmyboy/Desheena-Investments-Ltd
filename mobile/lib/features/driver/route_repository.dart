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

  SupabaseClient get _client => Supabase.instance.client;

  // ---------------------------------------------------------------------------
  // Online: download and cache
  // ---------------------------------------------------------------------------

  /// Fetches the driver's assigned route from Supabase and upserts all data
  /// into Local_DB via [RoutesDao].
  ///
  /// Steps:
  /// 1. Query `route_drivers` to get the `route_id` for this driver.
  /// 2. Query `routes` for route details.
  /// 3. Query `route_clients` joined with `clients` for all clients on the route.
  /// 4. Upsert everything into Local_DB.
  ///
  /// Returns the route id on success, or null if the driver has no assigned route.
  Future<String?> downloadAndCacheRoute(String driverId) async {
    // 1. Get the route_id assigned to this driver.
    final routeDriverRow = await _client
        .from('route_drivers')
        .select('route_id')
        .eq('driver_id', driverId)
        .maybeSingle();

    if (routeDriverRow == null) {
      // Driver has no assigned route — nothing to cache.
      return null;
    }

    final routeId = routeDriverRow['route_id'] as String;

    // 2. Fetch route details.
    final routeRow = await _client
        .from('routes')
        .select('id, name, zone, updated_at')
        .eq('id', routeId)
        .single();

    // Upsert route into Local_DB.
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

    // 4. Upsert each route client into Local_DB.
    for (final row in clientRows as List<dynamic>) {
      final client = row['clients'] as Map<String, dynamic>? ?? {};
      final id = row['id'] as String? ?? '';
      if (id.isEmpty) continue;

      await _routesDao.upsertRouteClient(
        RouteClientsLocalCompanion(
          id: Value(id),
          routeId: Value(routeId),
          clientId: Value(row['client_id'] as String? ?? ''),
          clientName: Value(client['name'] as String? ?? 'Unknown'),
          locationText: Value(
            client['location_text'] as String? ?? '',
          ),
          gpsLat: Value(
            (client['gps_lat'] as num?)?.toDouble(),
          ),
          gpsLng: Value(
            (client['gps_lng'] as num?)?.toDouble(),
          ),
          wasteType: Value(
            client['waste_type'] as String? ??
                row['waste_type'] as String? ??
                'general',
          ),
          sequenceOrder: Value(row['sequence_order'] as int?),
        ),
      );
    }

    return routeId;
  }

  // ---------------------------------------------------------------------------
  // Offline: read from Local_DB
  // ---------------------------------------------------------------------------

  /// Returns the route assigned to [driverId] from Local_DB.
  ///
  /// Because Local_DB stores routes by id (not driver_id), we return the first
  /// available route. In practice a driver has exactly one route.
  Future<RoutesLocalData?> getLocalRoute(String driverId) async {
    final routes = await _routesDao.getAllRoutes();
    return routes.isEmpty ? null : routes.first;
  }

  /// Returns the ordered list of clients for [routeId] from Local_DB.
  Future<List<RouteClientsLocalData>> getLocalRouteClients(
    String routeId,
  ) =>
      _routesDao.getClientsForRoute(routeId);
}
