import 'dart:io';

import 'package:dio/dio.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:primefit_mobile/core/config/app_config.dart';
import 'package:primefit_mobile/core/firebase/firebase_bootstrap.dart';
import 'package:primefit_mobile/core/network/api_client.dart';

/// Registers FCM token with the API when Firebase is ready.
class PushRegistration {
  PushRegistration(this._dio);

  final Dio _dio;

  Future<void> registerIfReady() async {
    if (!AppConfig.firebaseEnabled || !FirebaseBootstrap.ready) return;
    try {
      final messaging = FirebaseMessaging.instance;
      await messaging.requestPermission();
      final token = await messaging.getToken();
      if (token == null || token.isEmpty) return;
      final platform = kIsWeb
          ? 'web'
          : Platform.isIOS
              ? 'ios'
              : 'android';
      await _dio.post(
        '/notifications/device',
        data: {'token': token, 'platform': platform},
      );
      if (kDebugMode) {
        // ignore: avoid_print
        print('[fcm] registered device token');
      }
    } catch (e) {
      if (kDebugMode) {
        // ignore: avoid_print
        print('[fcm] register skipped: $e');
      }
    }
  }
}

final pushRegistrationProvider = Provider<PushRegistration>((ref) {
  return PushRegistration(ref.watch(dioProvider));
});
