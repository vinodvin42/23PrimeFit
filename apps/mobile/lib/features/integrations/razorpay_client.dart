import 'package:flutter/foundation.dart';
import 'package:primefit_mobile/core/config/app_config.dart';

/// Razorpay Checkout adapter — env-gated.
/// When disabled (default), API demo mode marks payment paid server-side.
class RazorpayClientAdapter {
  bool get sdkEnabled => AppConfig.razorpayClientEnabled;

  /// Returns true if checkout was presented (or demo mode should treat as done).
  Future<bool> presentCheckout(Map<String, dynamic>? order) async {
    if (order == null) return false;
    final mode = order['mode']?.toString() ?? 'demo';
    if (mode == 'demo' || !sdkEnabled) {
      if (kDebugMode) {
        // ignore: avoid_print
        print(
          '[razorpay] ${mode == 'demo' ? 'demo capture' : 'stub'} '
          'order=${order['orderId']}',
        );
      }
      return mode == 'demo';
    }

    if (kDebugMode) {
      // ignore: avoid_print
      print(
        '[razorpay] present Checkout with key=${order['keyId']} '
        'order=${order['orderId']}',
      );
    }
    // RazorpayFlutter.open(...) plugs in when package + key are live.
    return false;
  }
}
