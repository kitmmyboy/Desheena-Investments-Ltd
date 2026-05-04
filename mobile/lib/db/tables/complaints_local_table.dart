import 'package:drift/drift.dart';

/// Local cache of complaints fetched from Supabase.
class ComplaintsLocal extends Table {
  TextColumn get id => text()(); // UUID from Supabase
  TextColumn get clientId => text()();
  TextColumn get message => text()();
  TextColumn get category => text()();
  TextColumn get status => text()(); // 'open' | 'in-progress' | 'resolved'
  DateTimeColumn get createdAt => dateTime()();
  DateTimeColumn get updatedAt => dateTime()();

  @override
  Set<Column> get primaryKey => {id};
}
