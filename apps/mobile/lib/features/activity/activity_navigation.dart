import 'package:flutter/widgets.dart';
import 'package:go_router/go_router.dart';

/// Opens run tracker or interval timer from schedule / home Start actions.
void startActivity(
  BuildContext context, {
  required String title,
  required String subtitle,
  bool isCardio = false,
}) {
  final path = isCardio ? '/activity/run' : '/activity/timer';
  context.push(path, extra: {'title': title, 'subtitle': subtitle});
}

bool looksLikeCardio(String title, String detail) {
  final hay = '${title.toLowerCase()} ${detail.toLowerCase()}';
  return hay.contains('run') ||
      hay.contains('warmup') ||
      hay.contains('warm up') ||
      hay.contains('walk') ||
      hay.contains('cardio') ||
      hay.contains('km');
}
