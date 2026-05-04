import 'package:drift/drift.dart';

/// Local cache of payments fetched from Supabase.
class PaymentsLocal extends Table {
  TextColumn get id => text()(); // UUID from Supabase
  TextColumn get invoiceId => text()();
  TextColumn get clientId => text()();
  RealColumn get amount => real()();
  TextColumn get currency => text().withDefault(const Constant('UGX'))();
  TextColumn get paymentMethod => text()();
  TextColumn get transactionRef => text().nullable()();
  TextColumn get paidAt => text().nullable()(); // ISO 8601 datetime string
  TextColumn get status => text()(); // 'completed' | 'failed' | 'pending'
  DateTimeColumn get createdAt => dateTime()();

  @override
  Set<Column> get primaryKey => {id};
}
