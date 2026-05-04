import 'package:drift/drift.dart';

class RoutesLocal extends Table {
  TextColumn get id => text()();
  TextColumn get name => text()();
  TextColumn get zone => text()();
  DateTimeColumn get updatedAt => dateTime().withDefault(currentDateAndTime)();

  @override
  Set<Column> get primaryKey => {id};
}
