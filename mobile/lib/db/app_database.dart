import 'package:drift/drift.dart';
import 'package:drift_flutter/drift_flutter.dart';
import 'tables/collections_local_table.dart';
import 'tables/sync_queue_table.dart';
import 'tables/routes_local_table.dart';
import 'tables/route_clients_local_table.dart';
import 'tables/session_cache_table.dart';
import 'tables/invoices_local_table.dart';
import 'tables/payments_local_table.dart';
import 'tables/complaints_local_table.dart';
import 'daos/collections_dao.dart';
import 'daos/sync_queue_dao.dart';
import 'daos/routes_dao.dart';
import 'daos/session_dao.dart';
import 'daos/invoices_dao.dart';
import 'daos/payments_dao.dart';
import 'daos/complaints_dao.dart';

part 'app_database.g.dart';

@DriftDatabase(
  tables: [
    CollectionsLocal,
    SyncQueue,
    RoutesLocal,
    RouteClientsLocal,
    SessionCache,
    InvoicesLocal,
    PaymentsLocal,
    ComplaintsLocal,
  ],
  daos: [
    CollectionsDao,
    SyncQueueDao,
    RoutesDao,
    SessionDao,
    InvoicesDao,
    PaymentsDao,
    ComplaintsDao,
  ],
)
class AppDatabase extends _$AppDatabase {
  AppDatabase() : super(_openConnection());

  @override
  int get schemaVersion => 2;

  @override
  MigrationStrategy get migration => MigrationStrategy(
        onUpgrade: (migrator, from, to) async {
          if (from < 2) {
            // Add Customer Portal tables introduced in schema version 2.
            await migrator.createTable(invoicesLocal);
            await migrator.createTable(paymentsLocal);
            await migrator.createTable(complaintsLocal);
          }
        },
      );

  static QueryExecutor _openConnection() {
    return driftDatabase(name: 'desheena_waste_db');
  }
}
