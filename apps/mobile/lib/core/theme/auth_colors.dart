import 'package:flutter/material.dart';

/// Auth palette — mirrors `packages/ui-tokens/tokens.css` (coach-web + mobile).
class AuthColors {
  static const bgTop = Color(0xFF2E2438);
  static const bgMid = Color(0xFF1E1826);
  static const bgBottom = Color(0xFF100D14);
  static const glow = Color(0xFF3A3048);
  static const accent = Color(0xFFE8F5A3);
  static const accentDeep = Color(0xFFC7F36B);
  static const field = Color(0xFF3A3344);
  static const fieldHint = Color(0xFF9A93A3);
  static const secondaryBtn = Color(0xFF3D3548);
  static const white = Color(0xFFFFFFFF);
  static const ink = Color(0xFF1C1B2E);
  static const soft = Color(0xFFB8B4BE);
  static const logoStroke = Color(0xFFE8E4DC);
  static const card = Color(0xB81E1826);
  static const danger = Color(0xFFFF8A80);

  static const Gradient background = LinearGradient(
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
    colors: [bgTop, bgMid, bgBottom],
    stops: [0.0, 0.45, 1.0],
  );

  static const Gradient radialGlow = RadialGradient(
    center: Alignment(0, -0.55),
    radius: 1.05,
    colors: [glow, Colors.transparent],
    stops: [0.0, 0.7],
  );
}

/// Light onboarding steps (weight / height / goals).
class OnboardColors {
  static const bg = Color(0xFFF4F6F4);
  static const ink = Color(0xFF17201C);
  static const muted = Color(0xFF68736D);
  static const border = Color(0xFFE4E9E6);
  static const progressDone = Color(0xFFD8EF9D);
  static const weightCard = Color(0xFFFBE9E4);
  static const heightCard = Color(0xFFDDF3E9);
  static const accent = Color(0xFF4F741D);
}
