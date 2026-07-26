import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:primefit_mobile/core/config/app_config.dart';

/// Initializes Firebase only when FIREBASE_ENABLED=true.
/// Safe no-op when platform config files are missing.
class FirebaseBootstrap {
  static bool ready = false;

  static Future<void> init() async {
    if (!AppConfig.firebaseEnabled) return;
    try {
      await Firebase.initializeApp();
      ready = true;
      if (AppConfig.analyticsEnabled) {
        // Analytics is used via Analytics helper; FCM token best-effort.
        try {
          await FirebaseMessaging.instance.requestPermission();
          final token = await FirebaseMessaging.instance.getToken();
          if (kDebugMode && token != null) {
            // ignore: avoid_print
            print('[fcm] token acquired (${token.substring(0, 12)}…)');
          }
        } catch (e) {
          if (kDebugMode) {
            // ignore: avoid_print
            print('[fcm] skipped: $e');
          }
        }
      }
    } catch (e) {
      ready = false;
      if (kDebugMode) {
        // ignore: avoid_print
        print(
          '[firebase] init failed — keep AUTH_DEV_MODE=true or add '
          'google-services.json / GoogleService-Info.plist. ($e)',
        );
      }
    }
  }
}
