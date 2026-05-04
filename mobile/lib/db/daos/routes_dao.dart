import 'package:drift/drift.dart';
import '../app_database.dart';
import '../tables/routes_local_table.dart';
import '../tables/route_clients_local_table.dart';

part 'routes_dao.g.dart';

@DriftAccessor(tables: [RoutesLocal, RouteClientsLocal])
class RoutesDao extends DatabaseAccessor<AppDatabase> with _$RoutesDaoMixin {
  RoutesDao(super.db);

  Future<void> upsertRoute(RoutesLocalCompanion entry) =>
      into(routesLocal).insertOnConflictUpdate(entry);

  Future<void> upsertRouteClient(RouteClientsLocalCompanion entry) =>
      into(routeClientsLocal).insertOnConflictUpdate(entry);

  Future<List<RoutesLocalData>> getAllRoutes() => select(routesLocal).get();

  Future<List<RouteClientsLocalData>> getClientsForRoute(String routeId) =>
      (select(routeClientsLocal)
            ..where((t) => t.routeId.equals(routeId))
            ..orderBy([(t) => OrderingTerm.asc(t.sequenceOrder)]))
          .get();
}
