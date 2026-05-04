import 'package:drift/drift.dart';

class SessionCache extends Table {
  TextColumn get id => text()(); // always 'current_session'
  TextColumn get userId => text()();
  TextColumn get email => text()();
  TextColumn get role => text()();
  TextColumn get accessToken => text()();
  TextColumn get refreshToken => text()();
  DateTimeColumn get expiresAt => dateTime()();
  DateTimeColumn get cachedAt => dateTime().withDefault(currentDateAndTime)();

  @override
  Set<Column> get primaryKey => {id};
}
