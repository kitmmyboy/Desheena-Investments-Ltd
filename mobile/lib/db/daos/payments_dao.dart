import 'package:drift/drift.dart';
import '../app_database.dart';
import '../tables/payments_local_table.dart';

part 'payments_dao.g.dart';

@DriftAccessor(tables: [PaymentsLocal])
class PaymentsDao extends DatabaseAccessor<AppDatabase>
    with _$PaymentsDaoMixin {
  PaymentsDao(super.db);

  /// Upsert a single payment.
  Future<void> upsertPayment(PaymentsLocalCompanion entry) =>
      into(paymentsLocal).insertOnConflictUpdate(entry);

  /// Upsert a batch of payments.
  Future<void> upsertPayments(List<PaymentsLocalCompanion> entries) =>
      batch((b) => b.insertAllOnConflictUpdate(paymentsLocal, entries));

  /// Get all payments for a given client, newest first.
  Future<List<PaymentsLocalData>> getPaymentsForClient(String clientId) =>
      (select(paymentsLocal)
            ..where((t) => t.clientId.equals(clientId))
            ..orderBy([(t) => OrderingTerm.desc(t.createdAt)]))
          .get();

  /// Get all payments linked to a specific invoice.
  Future<List<PaymentsLocalData>> getPaymentsForInvoice(String invoiceId) =>
      (select(paymentsLocal)
            ..where((t) => t.invoiceId.equals(invoiceId))
            ..orderBy([(t) => OrderingTerm.desc(t.createdAt)]))
          .get();
}
