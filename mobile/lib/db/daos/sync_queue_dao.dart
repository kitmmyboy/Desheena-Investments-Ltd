import 'package:drift/drift.dart';
import '../app_database.dart';
import '../tables/sync_queue_table.dart';

part 'sync_queue_dao.g.dart';

@DriftAccessor(tables: [SyncQueue])
class SyncQueueDao extends DatabaseAccessor<AppDatabase>
    with _$SyncQueueDaoMixin {
  SyncQueueDao(super.db);

  Future<void> enqueue(SyncQueueCompanion entry) =>
      into(syncQueue).insertOnConflictUpdate(entry);

  /// Returns all pending records in chronological order (oldest first)
  Future<List<SyncQueueData>> getPendingOrdered() =>
      (select(syncQueue)
            ..orderBy([(t) => OrderingTerm.asc(t.createdAt)]))
          .get();

  Future<void> dequeue(String id) =>
      (delete(syncQueue)..where((t) => t.id.equals(id))).go();

  Future<int> getPendingCount() async {
    final count = syncQueue.id.count();
    final query = selectOnly(syncQueue)..addColumns([count]);
    final result = await query.getSingle();
    return result.read(count) ?? 0;
  }
}
