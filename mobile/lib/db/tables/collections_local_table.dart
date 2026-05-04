import 'package:drift/drift.dart';

class CollectionsLocal extends Table {
  TextColumn get id => text()(); // UUID v4
  TextColumn get clientId => text()();
  TextColumn get driverId => text()();
  TextColumn get wasteType => text()();
  RealColumn get weightKg => real()();
  TextColumn get collectedAt => text()(); // ISO 8601
  RealColumn get gpsLat => real().nullable()();
  RealColumn get gpsLng => real().nullable()();
  BoolColumn get missingGps => boolean().withDefault(const Constant(false))();
  TextColumn get syncStatus => text().withDefault(const Constant('pending'))(); // 'pending' | 'synced'
  DateTimeColumn get createdAt => dateTime().withDefault(currentDateAndTime)();
  DateTimeColumn get updatedAt => dateTime().withDefault(currentDateAndTime)();

  @override
  Set<Column> get primaryKey => {id};
}
