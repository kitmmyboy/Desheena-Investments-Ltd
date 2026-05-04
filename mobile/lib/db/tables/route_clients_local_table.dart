import 'package:drift/drift.dart';

class RouteClientsLocal extends Table {
  TextColumn get id => text()();
  TextColumn get routeId => text()();
  TextColumn get clientId => text()();
  TextColumn get clientName => text()();
  TextColumn get locationText => text()();
  RealColumn get gpsLat => real().nullable()();
  RealColumn get gpsLng => real().nullable()();
  TextColumn get wasteType => text()();
  IntColumn get sequenceOrder => integer().nullable()();

  @override
  Set<Column> get primaryKey => {id};
}
