import 'package:drift/drift.dart';
import '../app_database.dart';
import '../tables/collections_local_table.dart';

part 'collections_dao.g.dart';

@DriftAccessor(tables: [CollectionsLocal])
class CollectionsDao extends DatabaseAccessor<AppDatabase>
    with _$CollectionsDaoMixin {
  CollectionsDao(super.db);

  Future<void> insertCollection(CollectionsLocalCompanion entry) =>
      into(collectionsLocal).insert(entry);

  Future<void> upsertCollection(CollectionsLocalCompanion entry) =>
      into(collectionsLocal).insertOnConflictUpdate(entry);

  Future<void> updateSyncStatus(String id, String status) =>
      (update(collectionsLocal)..where((t) => t.id.equals(id)))
          .write(CollectionsLocalCompanion(syncStatus: Value(status)));

  Future<List<CollectionsLocalData>> getPendingCollections() =>
      (select(collectionsLocal)
            ..where((t) => t.syncStatus.equals('pending')))
          .get();

  /// Paginated query — max 200 records per page
  Future<List<CollectionsLocalData>> getCollectionsPaginated({
    int limit = 200,
    int offset = 0,
  }) =>
      (select(collectionsLocal)
            ..orderBy([(t) => OrderingTerm.desc(t.createdAt)])
            ..limit(limit, offset: offset))
          .get();

  Future<void> deleteCollection(String id) =>
      (delete(collectionsLocal)..where((t) => t.id.equals(id))).go();
}
