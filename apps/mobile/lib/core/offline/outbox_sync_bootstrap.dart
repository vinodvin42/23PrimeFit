import 'dart:async';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:primefit_mobile/core/offline/offline_outbox.dart';

/// Flushes the Drift outbox when connectivity returns (and once at start).
class OutboxSyncBootstrap {
  OutboxSyncBootstrap(this._outbox);

  final OfflineOutbox _outbox;
  StreamSubscription<List<ConnectivityResult>>? _sub;

  Future<void> start() async {
    try {
      await _outbox.flush();
    } catch (e) {
      if (kDebugMode) {
        // ignore: avoid_print
        print('[outbox] initial flush: $e');
      }
    }
    _sub = Connectivity().onConnectivityChanged.listen((results) async {
      if (results.contains(ConnectivityResult.none)) return;
      try {
        final n = await _outbox.flush();
        if (kDebugMode && n > 0) {
          // ignore: avoid_print
          print('[outbox] flushed $n pending ops');
        }
      } catch (_) {}
    });
  }

  Future<void> dispose() async {
    await _sub?.cancel();
  }
}

final outboxSyncBootstrapProvider = Provider<OutboxSyncBootstrap>((ref) {
  final bootstrap = OutboxSyncBootstrap(ref.watch(offlineOutboxProvider));
  ref.onDispose(() {
    unawaited(bootstrap.dispose());
  });
  return bootstrap;
});
