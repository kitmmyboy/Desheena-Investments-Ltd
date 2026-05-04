import 'package:drift/drift.dart';
import '../app_database.dart';
import '../tables/session_cache_table.dart';

part 'session_dao.g.dart';

@DriftAccessor(tables: [SessionCache])
class SessionDao extends DatabaseAccessor<AppDatabase>
    with _$SessionDaoMixin {
  SessionDao(super.db);

  static const _sessionKey = 'current_session';

  Future<SessionCacheData?> getSession() =>
      (select(sessionCache)..where((t) => t.id.equals(_sessionKey)))
          .getSingleOrNull();

  Future<void> saveSession(SessionCacheCompanion entry) =>
      into(sessionCache).insertOnConflictUpdate(
        entry.copyWith(id: const Value(_sessionKey)),
      );

  Future<void> clearSession() =>
      (delete(sessionCache)..where((t) => t.id.equals(_sessionKey))).go();
}
