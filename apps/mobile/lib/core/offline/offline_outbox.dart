import 'dart:convert';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:primefit_mobile/core/network/api_client.dart';
import 'package:primefit_mobile/core/offline/app_database.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Offline outbox for nutrition/workout writes.
/// Persists pending ops in Drift SQLite; flushes on reconnect.
/// One-time migrates any legacy SharedPreferences queue.
class OfflineOutbox {
  OfflineOutbox(this._dio, this._db);

  final Dio _dio;
  final AppDatabase _db;
  static const _legacyKey = 'pf_offline_outbox_v1';
  bool _migrated = false;
  bool _flushing = false;

  Future<void> _migrateLegacyIfNeeded() async {
    if (_migrated) return;
    _migrated = true;
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_legacyKey);
    if (raw == null || raw.isEmpty) return;
    try {
      final list = jsonDecode(raw) as List;
      for (final item in list.whereType<Map>()) {
        final map = Map<String, dynamic>.from(item);
        final id = map['id']?.toString() ??
            DateTime.now().microsecondsSinceEpoch.toString();
        await _db.addEntry(
          id: id,
          type: map['type']?.toString() ?? 'unknown',
          path: map['path']?.toString() ?? '',
          bodyJson: _encodeEntry(map['body'] ?? {}),
        );
      }
      await prefs.remove(_legacyKey);
    } catch (_) {
      // Leave legacy key; next flush still works from Drift.
    }
  }

  Future<int> pendingCount() async {
    await _migrateLegacyIfNeeded();
    return _db.pendingCount();
  }

  Future<void> enqueue({
    required String type,
    required String path,
    required Map<String, dynamic> body,
  }) async {
    await _migrateLegacyIfNeeded();
    await _db.addEntry(
      id: DateTime.now().microsecondsSinceEpoch.toString(),
      type: type,
      path: path,
      bodyJson: _encodeEntry(body),
    );
  }

  Future<int> flush() async {
    if (_flushing) return 0;
    _flushing = true;
    try {
      return await _flushPending();
    } finally {
      _flushing = false;
    }
  }

  Future<int> _flushPending() async {
    await _migrateLegacyIfNeeded();
    final online = await Connectivity().checkConnectivity();
    if (online.contains(ConnectivityResult.none)) return 0;

    final now = DateTime.now().toUtc();
    final items = (await _db.allPending())
        .where((item) => _entryFor(item.bodyJson).nextRetryAt.isBefore(now))
        .toList();
    if (items.isEmpty) return 0;

    var flushed = 0;
    for (final item in items) {
      try {
        final entry = _entryFor(item.bodyJson);
        await _dio.post<Map<String, dynamic>>(
          item.path,
          data: entry.payload,
        );
        await _db.removeEntry(item.id);
        flushed++;
      } catch (error) {
        final entry = _entryFor(item.bodyJson);
        final attempts = entry.attempts + 1;
        await _db.replaceBody(
          item.id,
          _encodeEntry(
            entry.payload,
            attempts: attempts,
            nextRetryAt: DateTime.now().toUtc().add(_retryDelay(attempts)),
            error: _safeError(error),
          ),
        );
      }
    }
    return flushed;
  }

  Duration _retryDelay(int attempts) {
    // 5s, 10s, 20s … capped at one hour. Attempt state survives restarts.
    final exponent = attempts.clamp(1, 10) as int;
    final seconds = 5 * (1 << (exponent - 1));
    return Duration(seconds: seconds.clamp(5, 3600) as int);
  }

  String _safeError(Object error) {
    final message = error is DioException
        ? '${error.type}: ${error.response?.statusCode ?? ''}'
        : error.runtimeType.toString();
    return message.substring(0, message.length.clamp(0, 240) as int);
  }

  String _encodeEntry(
    Object? payload, {
    int attempts = 0,
    DateTime? nextRetryAt,
    String? error,
  }) {
    return jsonEncode({
      'payload': payload is Map ? payload : <String, dynamic>{},
      '_outbox': {
        'attempts': attempts,
        'nextRetryAt': nextRetryAt?.toIso8601String(),
        'lastError': error,
      },
    });
  }

  _OutboxPayload _entryFor(String bodyJson) {
    try {
      final decoded = jsonDecode(bodyJson);
      if (decoded is! Map) return _emptyEntry();
      final map = Map<String, dynamic>.from(decoded);
      final payload = map['payload'];
      final metadata = map['_outbox'];
      if (payload is! Map || metadata is! Map) {
        return _OutboxPayload(
          payload: map,
          attempts: 0,
          nextRetryAt: DateTime.fromMillisecondsSinceEpoch(0, isUtc: true),
        );
      }
      final retryAt = DateTime.tryParse(metadata['nextRetryAt']?.toString() ?? '');
      return _OutboxPayload(
        payload: Map<String, dynamic>.from(payload),
        attempts: int.tryParse(metadata['attempts']?.toString() ?? '') ?? 0,
        nextRetryAt: retryAt?.toUtc() ??
            DateTime.fromMillisecondsSinceEpoch(0, isUtc: true),
      );
    } catch (_) {
      return _emptyEntry();
    }
  }

  _OutboxPayload _emptyEntry() {
    return _OutboxPayload(
      payload: const <String, dynamic>{},
      attempts: 0,
      nextRetryAt: DateTime.fromMillisecondsSinceEpoch(0, isUtc: true),
    );
  }
}

class _OutboxPayload {
  const _OutboxPayload({
    required this.payload,
    required this.attempts,
    required this.nextRetryAt,
  });

  final Map<String, dynamic> payload;
  final int attempts;
  final DateTime nextRetryAt;
}

final appDatabaseProvider = Provider<AppDatabase>((ref) {
  final db = AppDatabase();
  ref.onDispose(db.close);
  return db;
});

final offlineOutboxProvider = Provider<OfflineOutbox>((ref) {
  return OfflineOutbox(
    ref.watch(dioProvider),
    ref.watch(appDatabaseProvider),
  );
});

final pendingSyncCountProvider = FutureProvider.autoDispose<int>((ref) async {
  return ref.watch(offlineOutboxProvider).pendingCount();
});
