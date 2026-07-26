import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:primefit_mobile/core/config/app_config.dart';
import 'package:primefit_mobile/core/network/api_client.dart';

/// Stream Chat client adapter — env-gated.
/// Fetches a token from the API; plugs into stream_chat_flutter when enabled.
class StreamClientAdapter {
  StreamClientAdapter(this._dio);

  final Dio _dio;
  Map<String, dynamic>? lastToken;

  bool get sdkEnabled => AppConfig.streamClientEnabled;

  Future<Map<String, dynamic>> fetchToken() async {
    final res = await _dio.get<Map<String, dynamic>>('/chat/stream-token');
    lastToken = res.data ?? {'mode': 'postgres', 'token': null};
    if (sdkEnabled && lastToken?['mode'] == 'stream') {
      // Real StreamChat client connects here with apiKey + token.
      if (kDebugMode) {
        // ignore: avoid_print
        print('[stream] token ready — attach stream_chat_flutter client');
      }
    }
    return lastToken!;
  }
}

final streamClientProvider = Provider<StreamClientAdapter>((ref) {
  return StreamClientAdapter(ref.watch(dioProvider));
});
