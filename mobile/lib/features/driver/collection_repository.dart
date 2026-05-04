import 'package:drift/drift.dart';
import 'package:uuid/uuid.dart';

import '../../db/app_database.dart';
import '../../db/daos/collections_dao.dart';
import '../../db/daos/sync_queue_dao.dart';

/// Handles all collection recording logic.
///
/// Implements Requirements 4.1, 4.2, 4.3, 4.4, 4.5, 5.10.
class CollectionRepository {
  CollectionRepository({required AppDatabase db}) : _db = db;

  final AppDatabase _db;

  CollectionsDao get _collectionsDao => _db.collectionsDao;
  SyncQueueDao get _syncQueueDao => _db.syncQueueDao;

  // ---------------------------------------------------------------------------
  // Record a collection
  // ---------------------------------------------------------------------------

  /// Records a new waste collection in Local_DB.
  ///
  /// - Generates a UUID v4 primary key (Requirement 5.10).
  /// - Inserts into [collections_local] with `sync_status = 'pending'`
  ///   (Requirement 4.3).
  /// - Simultaneously inserts into [sync_queue] (Requirement 4.4).
  /// - Sets [missingGps] = true when [gpsLat] / [gpsLng] are null
  ///   (Requirement 4.5).
  ///
  /// Returns the UUID of the created record.
  Future<String> recordCollection({
    required String clientId,
    required String driverId,
    required String wasteType,
    required double weightKg,
    double? gpsLat,
    double? gpsLng,
  }) async {
    final uuid = const Uuid().v4();
    final now = DateTime.now();
    final collectedAt = now.toIso8601String();
    final missingGps = gpsLat == null;

    // Insert into collections_local.
    await _collectionsDao.insertCollection(
      CollectionsLocalCompanion(
        id: Value(uuid),
        clientId: Value(clientId),
        driverId: Value(driverId),
        wasteType: Value(wasteType),
        weightKg: Value(weightKg),
        collectedAt: Value(collectedAt),
        gpsLat: Value(gpsLat),
        gpsLng: Value(gpsLng),
        missingGps: Value(missingGps),
        syncStatus: const Value('pending'),
        createdAt: Value(now),
        updatedAt: Value(now),
      ),
    );

    // Insert into sync_queue with the same UUID.
    await _syncQueueDao.enqueue(
      SyncQueueCompanion(
        id: Value(uuid),
        collectionId: Value(uuid),
        createdAt: Value(now),
      ),
    );

    return uuid;
  }

  // ---------------------------------------------------------------------------
  // Paginated history
  // ---------------------------------------------------------------------------

  /// Returns a paginated list of collections from Local_DB.
  ///
  /// Defaults to max 200 records per page (Requirement 5.10).
  Future<List<CollectionsLocalData>> getCollectionsPaginated({
    int limit = 200,
    int offset = 0,
  }) =>
      _collectionsDao.getCollectionsPaginated(limit: limit, offset: offset);
}
