import 'package:drift/drift.dart';

class SyncQueue extends Table {
  TextColumn get id => text()(); // UUID v4 — matches collections_local.id
  TextColumn get collectionId => text()();
  DateTimeColumn get createdAt => dateTime().withDefault(currentDateAndTime)();

  @override
  Set<Column> get primaryKey => {id};
}
