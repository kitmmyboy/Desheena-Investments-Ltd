import 'package:drift/drift.dart';
import '../app_database.dart';
import '../tables/client_schedules_local_table.dart';

part 'client_schedules_dao.g.dart';

@DriftAccessor(tables: [ClientSchedulesLocal])
class ClientSchedulesDao extends DatabaseAccessor<AppDatabase>
    with _$ClientSchedulesDaoMixin {
  ClientSchedulesDao(super.db);

  Future<void> upsertSchedule(ClientSchedulesLocalCompanion entry) =>
      into(clientSchedulesLocal).insertOnConflictUpdate(entry);

  /// Replaces all schedules for a client with the freshly downloaded set.
  Future<void> replaceSchedulesForClient(
    String clientId,
    List<ClientSchedulesLocalCompanion> entries,
  ) async {
    await (delete(clientSchedulesLocal)
          ..where((t) => t.clientId.equals(clientId)))
        .go();
    for (final entry in entries) {
      await into(clientSchedulesLocal).insert(entry);
    }
  }

  Future<List<ClientSchedulesLocalData>> getSchedulesForClient(
          String clientId) =>
      (select(clientSchedulesLocal)
            ..where((t) => t.clientId.equals(clientId)))
          .get();

  Future<List<ClientSchedulesLocalData>> getAllSchedules() =>
      select(clientSchedulesLocal).get();
}
