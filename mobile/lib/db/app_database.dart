import 'package:drift/drift.dart';
import 'package:drift_flutter/drift_flutter.dart';
import 'tables/collections_local_table.dart';
import 'tables/sync_queue_table.dart';
import 'tables/routes_local_table.dart';
import 'tables/route_clients_local_table.dart';
import 'tables/session_cache_table.dart';
import 'daos/collections_dao.dart';
import 'daos/sync_queue_dao.dart';
import 'daos/routes_dao.dart';
import 'daos/session_dao.dart';

part 'app_database.g.dart';

@DriftDatabase(
  tables: [
    CollectionsLocal,
    SyncQueue,
    RoutesLocal,
    RouteClientsLocal,
    SessionCache,
  ],
  daos: [
    CollectionsDao,
    SyncQueueDao,
    RoutesDao,
    SessionDao,
  ],
)
class AppDatabase extends _$AppDatabase {
  AppDatabase() : super(_openConnection());

  @override
  int get schemaVersion => 1;

  static QueryExecutor _openConnection() {
    return driftDatabase(name: 'desheena_waste_db');
  }
}
