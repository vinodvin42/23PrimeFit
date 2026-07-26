import 'package:flutter/foundation.dart';
import 'package:primefit_mobile/core/config/app_config.dart';

/// Agora RTC client adapter — env-gated.
/// Uses meeting payload from consultations API; joins channel when SDK enabled.
class AgoraClientAdapter {
  bool get sdkEnabled => AppConfig.agoraClientEnabled;

  Future<void> joinMeeting(Map<String, dynamic>? agora) async {
    if (agora == null) return;
    final channel = agora['channel'] ?? agora['channelName'];
    final token = agora['token'];
    final meetingUrl = agora['meetingUrl'];

    if (!sdkEnabled) {
      if (kDebugMode) {
        // ignore: avoid_print
        print(
          '[agora] stub — open $meetingUrl (channel=$channel). '
          'Set AGORA_CLIENT_ENABLED=true + agora_rtc_engine to join natively.',
        );
      }
      return;
    }

    if (kDebugMode) {
      // ignore: avoid_print
      print('[agora] join channel=$channel token=${token != null}');
    }
    // AgoraRtcEngine.create + joinChannel plugs in when package is wired.
  }
}
