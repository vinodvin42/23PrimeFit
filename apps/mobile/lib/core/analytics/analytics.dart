import 'package:firebase_analytics/firebase_analytics.dart';
import 'package:flutter/foundation.dart';
import 'package:primefit_mobile/core/config/app_config.dart';
import 'package:primefit_mobile/core/firebase/firebase_bootstrap.dart';

/// Funnel analytics — no-op unless ANALYTICS_ENABLED=true.
class Analytics {
  static FirebaseAnalytics? get _fa =>
      AppConfig.analyticsEnabled && FirebaseBootstrap.ready
          ? FirebaseAnalytics.instance
          : null;

  static Future<void> event(String name, [Map<String, Object?>? params]) async {
    if (!AppConfig.analyticsEnabled) return;
    final cleaned = <String, Object>{};
    params?.forEach((k, v) {
      if (v != null) cleaned[k] = v;
    });
    try {
      await _fa?.logEvent(name: name, parameters: cleaned);
    } catch (_) {}
    if (kDebugMode) {
      // ignore: avoid_print
      print('[analytics] $name $cleaned');
    }
  }

  static Future<void> signup() => event('signup');
  static Future<void> onboardingComplete() => event('onboarding_complete');
  static Future<void> firstWorkout() => event('first_workout');
  static Future<void> foodLogged() => event('food_logged');
}
