import 'package:drift/drift.dart';
import '../app_database.dart';
import '../tables/invoices_local_table.dart';

part 'invoices_dao.g.dart';

@DriftAccessor(tables: [InvoicesLocal])
class InvoicesDao extends DatabaseAccessor<AppDatabase>
    with _$InvoicesDaoMixin {
  InvoicesDao(super.db);

  /// Upsert a single invoice (insert or replace on conflict).
  Future<void> upsertInvoice(InvoicesLocalCompanion entry) =>
      into(invoicesLocal).insertOnConflictUpdate(entry);

  /// Upsert a batch of invoices.
  Future<void> upsertInvoices(List<InvoicesLocalCompanion> entries) =>
      batch((b) => b.insertAllOnConflictUpdate(invoicesLocal, entries));

  /// Get all invoices for a given client, newest first.
  Future<List<InvoicesLocalData>> getInvoicesForClient(String clientId) =>
      (select(invoicesLocal)
            ..where((t) => t.clientId.equals(clientId))
            ..orderBy([(t) => OrderingTerm.desc(t.createdAt)]))
          .get();

  /// Get active (unpaid / overdue) invoices for a client.
  Future<List<InvoicesLocalData>> getActiveInvoicesForClient(
      String clientId) =>
      (select(invoicesLocal)
            ..where((t) =>
                t.clientId.equals(clientId) &
                t.status.isIn(['unpaid', 'overdue']))
            ..orderBy([(t) => OrderingTerm.desc(t.createdAt)]))
          .get();

  /// Update the status of a single invoice by its ID.
  Future<void> updateInvoiceStatus(String invoiceId, String status) =>
      (update(invoicesLocal)..where((t) => t.id.equals(invoiceId)))
          .write(InvoicesLocalCompanion(status: Value(status)));

  /// Delete all invoices for a client (used before a full refresh).
  Future<void> deleteInvoicesForClient(String clientId) =>
      (delete(invoicesLocal)..where((t) => t.clientId.equals(clientId))).go();
}
