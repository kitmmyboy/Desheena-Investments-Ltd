import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../db/database_provider.dart';
import '../../db/index.dart';
import 'collection_repository.dart';

// ---------------------------------------------------------------------------
// Repository provider
// ---------------------------------------------------------------------------

/// Provides the singleton [CollectionRepository] instance.
final collectionRepositoryProvider = Provider<CollectionRepository>((ref) {
  final db = ref.watch(appDatabaseProvider);
  return CollectionRepository(db: db);
});

// ---------------------------------------------------------------------------
// Collections history provider
// ---------------------------------------------------------------------------

/// FutureProvider returning a paginated list of collections (max 200) from
/// Local_DB, ordered by most recent first.
///
/// Implements Requirement 5.10 and Requirement 21.2 — no more than 200
/// collection records are loaded into memory at one time.  The hard cap is
/// enforced at two layers:
///   1. [CollectionsDao.getCollectionsPaginated] applies a SQL `LIMIT 200`
///      clause, so the database never returns more than 200 rows per call.
///   2. This provider always passes `limit: 200` to the repository, making
///      the intent explicit at the application layer.
/// Older records can be fetched by incrementing the `offset` parameter.
final collectionsHistoryProvider =
    FutureProvider<List<CollectionsLocalData>>((ref) async {
  final repo = ref.read(collectionRepositoryProvider);
  // limit: 200 satisfies Requirement 21.2 (max 200 records in memory at once).
  return repo.getCollectionsPaginated(limit: 200, offset: 0);
});
