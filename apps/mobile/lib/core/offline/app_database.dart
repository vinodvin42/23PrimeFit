import 'dart:io';

import 'package:drift/drift.dart';
import 'package:drift/native.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';

part 'app_database.g.dart';

class OutboxEntries extends Table {
  TextColumn get id => text()();
  TextColumn get type => text()();
  TextColumn get path => text()();
  TextColumn get bodyJson => text()();
  DateTimeColumn get createdAt => dateTime()();

  @override
  Set<Column> get primaryKey => {id};
}

@DriftDatabase(tables: [OutboxEntries])
class AppDatabase extends _$AppDatabase {
  AppDatabase() : super(_openConnection());

  AppDatabase.forTesting(super.e);

  @override
  int get schemaVersion => 1;

  Future<List<OutboxEntry>> allPending() => select(outboxEntries).get();

  Future<void> addEntry({
    required String id,
    required String type,
    required String path,
    required String bodyJson,
  }) {
    return into(outboxEntries).insert(
      OutboxEntriesCompanion.insert(
        id: id,
        type: type,
        path: path,
        bodyJson: bodyJson,
        createdAt: DateTime.now().toUtc(),
      ),
    );
  }

  Future<void> removeEntry(String id) {
    return (delete(outboxEntries)..where((t) => t.id.equals(id))).go();
  }

  Future<void> replaceBody(String id, String bodyJson) {
    return (update(outboxEntries)..where((entry) => entry.id.equals(id))).write(
      OutboxEntriesCompanion(bodyJson: Value(bodyJson)),
    );
  }

  Future<int> pendingCount() async {
    final count = countAll();
    final query = selectOnly(outboxEntries)..addColumns([count]);
    final row = await query.getSingle();
    return row.read(count) ?? 0;
  }

}

LazyDatabase _openConnection() {
  return LazyDatabase(() async {
    final dir = await getApplicationDocumentsDirectory();
    final file = File(p.join(dir.path, 'primefit_outbox.sqlite'));
    return NativeDatabase.createInBackground(file);
  });
}
