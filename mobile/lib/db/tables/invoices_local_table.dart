import 'package:drift/drift.dart';

/// Local cache of invoices fetched from Supabase.
class InvoicesLocal extends Table {
  TextColumn get id => text()(); // UUID from Supabase
  TextColumn get clientId => text()();
  RealColumn get amount => real()();
  TextColumn get dueDate => text()(); // ISO 8601 date string
  TextColumn get status => text()(); // 'paid' | 'unpaid' | 'overdue'
  TextColumn get invoicePeriod => text()(); // e.g. "2024-01"
  DateTimeColumn get createdAt => dateTime()();

  @override
  Set<Column> get primaryKey => {id};
}
