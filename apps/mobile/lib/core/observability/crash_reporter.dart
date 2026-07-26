import 'package:flutter/foundation.dart';
import 'package:primefit_mobile/core/config/app_config.dart';
import 'package:sentry_flutter/sentry_flutter.dart';

/// Sentry wrapper — no-op when SENTRY_DSN is empty.
class CrashReporter {
  static bool _ready = false;

  static Future<void> init() async {
    if (AppConfig.sentryDsn.isEmpty) return;
    await SentryFlutter.init((options) {
      options.dsn = AppConfig.sentryDsn;
      options.environment = kReleaseMode ? 'production' : 'development';
      options.tracesSampleRate = kReleaseMode ? 0.2 : 1.0;
      options.debug = kDebugMode;
    });
    _ready = true;
  }

  /// Wraps [appRunner] with Sentry when DSN is set; otherwise runs directly.
  static Future<void> runApp(Future<void> Function() appRunner) async {
    if (AppConfig.sentryDsn.isEmpty) {
      await appRunner();
      return;
    }
    await SentryFlutter.init(
      (options) {
        options.dsn = AppConfig.sentryDsn;
        options.environment = kReleaseMode ? 'production' : 'development';
        options.tracesSampleRate = kReleaseMode ? 0.2 : 1.0;
        options.debug = kDebugMode;
      },
      appRunner: appRunner,
    );
    _ready = true;
  }

  static Future<void> captureException(Object error, [StackTrace? stack]) async {
    if (!_ready) {
      if (kDebugMode) {
        // ignore: avoid_print
        print('[sentry:offline] $error\n$stack');
      }
      return;
    }
    await Sentry.captureException(error, stackTrace: stack);
  }
}
