import 'package:drift/drift.dart';

/// Stores collection schedule entries for route clients, cached locally
/// so the driver can see which clients are due today even when offline.
class ClientSchedulesLocal extends Table {
  TextColumn get id => text()();
  TextColumn get clientId => text()();

  /// Day of week (0=Sun … 6=Sat) for weekly recurring schedules.
  IntColumn get dayOfWeek => integer().nullable()();

  /// Specific one-off date (ISO 8601 date string, e.g. "2026-05-10").
  TextColumn get specificDate => text().nullable()();

  /// Interval in days (e.g. 3 = every 3 days).
  IntColumn get intervalDays => integer().nullable()();

  /// The anchor date for interval calculations (ISO 8601 date string).
  TextColumn get intervalStartDate => text().nullable()();

  @override
  Set<Column> get primaryKey => {id};
}
