import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:health/health.dart';
import 'package:primefit_mobile/core/config/app_config.dart';

/// Native wearable read adapter (Health Connect / HealthKit).
/// Returns null when unavailable so callers fall back to demo sync.
class WearableNativeSync {
  final Health _health = Health();

  static final _types = <HealthDataType>[
    HealthDataType.STEPS,
    HealthDataType.SLEEP_ASLEEP,
    HealthDataType.HEART_RATE,
    HealthDataType.RESTING_HEART_RATE,
    HealthDataType.HEART_RATE_VARIABILITY_SDNN,
    HealthDataType.ACTIVE_ENERGY_BURNED,
    HealthDataType.BLOOD_OXYGEN,
  ];

  Future<Map<String, dynamic>?> readToday({required String provider}) async {
    if (kIsWeb) return null;
    if (AppConfig.wearableDemo) return null;
    if (!Platform.isAndroid && !Platform.isIOS) return null;

    final wantsAndroid = provider == 'health_connect' && Platform.isAndroid;
    final wantsIos = provider == 'apple_health' && Platform.isIOS;
    if (!wantsAndroid && !wantsIos) return null;

    try {
      await _health.configure();

      if (Platform.isAndroid) {
        final available = await _health.isHealthConnectAvailable();
        if (available != true) return null;
      }

      final granted = await _health.requestAuthorization(_types);
      if (!granted) return null;

      final now = DateTime.now();
      final start = DateTime(now.year, now.month, now.day);
      final points = await _health.getHealthDataFromTypes(
        types: _types,
        startTime: start,
        endTime: now,
      );

      if (points.isEmpty) return null;

      double sum(HealthDataType type) {
        var total = 0.0;
        for (final p in points) {
          if (p.type != type) continue;
          final v = p.value;
          if (v is NumericHealthValue) total += v.numericValue.toDouble();
        }
        return total;
      }

      double? latest(HealthDataType type) {
        HealthDataPoint? last;
        for (final p in points) {
          if (p.type != type) continue;
          if (last == null || p.dateTo.isAfter(last.dateTo)) last = p;
        }
        final v = last?.value;
        if (v is NumericHealthValue) return v.numericValue.toDouble();
        return null;
      }

      final steps = await _health.getTotalStepsInInterval(start, now) ??
          sum(HealthDataType.STEPS).round();

      // Sleep points are often minutes or hours depending on platform; treat
      // large values as minutes.
      final sleepRaw = sum(HealthDataType.SLEEP_ASLEEP);
      final sleepHours =
          sleepRaw > 24 ? sleepRaw / 60.0 : (sleepRaw > 0 ? sleepRaw : 0);

      return {
        'provider': provider,
        'deviceLabel':
            Platform.isIOS ? 'Apple Health' : 'Health Connect',
        'steps': steps,
        'sleepHours': double.parse(sleepHours.toStringAsFixed(1)),
        'restingHr': latest(HealthDataType.RESTING_HEART_RATE)?.round() ??
            latest(HealthDataType.HEART_RATE)?.round(),
        'hrvMs': latest(HealthDataType.HEART_RATE_VARIABILITY_SDNN)?.round(),
        'activeKcal': sum(HealthDataType.ACTIVE_ENERGY_BURNED).round(),
        'spo2': latest(HealthDataType.BLOOD_OXYGEN)?.round(),
        'vo2Max': null,
        'stressScore': null,
        'trainingLoad': null,
      };
    } catch (e) {
      if (kDebugMode) {
        // ignore: avoid_print
        print('[wearable] native read failed: $e');
      }
      return null;
    }
  }
}
