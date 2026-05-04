import 'package:drift/drift.dart';
import '../app_database.dart';
import '../tables/complaints_local_table.dart';

part 'complaints_dao.g.dart';

@DriftAccessor(tables: [ComplaintsLocal])
class ComplaintsDao extends DatabaseAccessor<AppDatabase>
    with _$ComplaintsDaoMixin {
  ComplaintsDao(super.db);

  /// Upsert a single complaint.
  Future<void> upsertComplaint(ComplaintsLocalCompanion entry) =>
      into(complaintsLocal).insertOnConflictUpdate(entry);

  /// Upsert a batch of complaints.
  Future<void> upsertComplaints(List<ComplaintsLocalCompanion> entries) =>
      batch((b) => b.insertAllOnConflictUpdate(complaintsLocal, entries));

  /// Get all complaints for a given client, newest first.
  Future<List<ComplaintsLocalData>> getComplaintsForClient(String clientId) =>
      (select(complaintsLocal)
            ..where((t) => t.clientId.equals(clientId))
            ..orderBy([(t) => OrderingTerm.desc(t.createdAt)]))
          .get();
}
