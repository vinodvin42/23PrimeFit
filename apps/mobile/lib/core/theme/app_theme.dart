import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// 23PrimeFit theme — matches coach-web enterprise workspace.
class AppColors {
  // Workspace (coach-web .appShell)
  static const canvas = Color(0xFFF0F3F1);
  static const surface = Color(0xFFFFFFFF);
  static const ink = Color(0xFF111A21);
  static const muted = Color(0xFF7D8784);
  /// AA-compliant (5.4:1) secondary-text color for light surfaces (canvas/surface).
  /// [muted] itself only reaches 3.3:1 against canvas — too low for body text (WCAG AA needs 4.5:1).
  static const mutedInk = Color(0xFF5D6563);
  /// AA-compliant (5.1:1 on card, 6.5:1 on voidBlack) secondary-text color for dark hub surfaces.
  /// [muted] only reaches 3.9:1 against card — use this instead for new dark-surface text.
  static const mutedOnDark = Color(0xFF8F9B97);
  static const line = Color(0xFFE2E8E4);
  static const lime = Color(0xFF20A875);
  static const limeDeep = Color(0xFF13865E);
  static const limeSoft = Color(0xFFDDF3E9);
  static const navy = Color(0xFF0D1B2E);
  static const navyDeep = Color(0xFF081421);
  static const coral = Color(0xFFF16F56);
  static const coralSoft = Color(0xFFFBE9E4);
  static const cream = Color(0xFFF5EECF);
  static const mint = Color(0xFFDDF3E9);
  static const white = Color(0xFFFFFFFF);

  // Dark feature hubs (Train / Fuel / Recover) — coach sidebar navy
  static const voidBlack = navyDeep;
  static const card = Color(0xFF172A40);
  static const cardElevated = Color(0xFF1E3550);
  static const glass = Color(0xE6172A40);
  static const soft = Color(0xFFF0F3F1);
  static const danger = coral;
  static const accentBlue = Color(0xFF61BCA5);
  static const heart = coral;
  static const stroke = Color(0x14000000);
  static const strokeLight = Color(0xFFE2E8E4);

  // Legacy
  static const forest = navyDeep;
  static const forestMid = navy;
  static const sand = soft;
  static const mist = canvas;
  static const limeDim = limeDeep;
}

class AppTheme {
  static ThemeData get light {
    final base = ThemeData(
      useMaterial3: true,
      brightness: Brightness.light,
      colorScheme: const ColorScheme.light(
        primary: AppColors.lime,
        onPrimary: AppColors.white,
        secondary: AppColors.limeDeep,
        onSecondary: AppColors.white,
        surface: AppColors.surface,
        onSurface: AppColors.ink,
        error: AppColors.coral,
      ),
      scaffoldBackgroundColor: AppColors.canvas,
    );

    final text = GoogleFonts.poppinsTextTheme(base.textTheme);
    return base.copyWith(
      textTheme: text.copyWith(
        headlineLarge: text.headlineLarge?.copyWith(
          color: AppColors.ink,
          fontWeight: FontWeight.w700,
          letterSpacing: -0.4,
        ),
        titleLarge: text.titleLarge?.copyWith(
          color: AppColors.ink,
          fontWeight: FontWeight.w700,
        ),
        bodyLarge: text.bodyLarge?.copyWith(color: AppColors.ink),
        bodyMedium: text.bodyMedium?.copyWith(color: AppColors.mutedInk),
      ),
      appBarTheme: AppBarTheme(
        backgroundColor: Colors.transparent,
        elevation: 0,
        foregroundColor: AppColors.ink,
        centerTitle: true,
        titleTextStyle: GoogleFonts.poppins(
          fontSize: 18,
          fontWeight: FontWeight.w700,
          color: AppColors.ink,
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.lime,
          // voidBlack on lime is 6.1:1 (AA); white on lime was only 3.0:1.
          foregroundColor: AppColors.voidBlack,
          minimumSize: const Size(88, 52),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(28),
          ),
          textStyle: GoogleFonts.poppins(fontWeight: FontWeight.w700),
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: AppColors.lime,
          foregroundColor: AppColors.voidBlack,
          minimumSize: const Size(88, 52),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(28),
          ),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: AppColors.ink,
          side: const BorderSide(color: AppColors.line),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(28),
          ),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: AppColors.surface,
        hintStyle: const TextStyle(color: AppColors.muted),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(18),
          borderSide: const BorderSide(color: AppColors.line),
        ),
      ),
      snackBarTheme: const SnackBarThemeData(
        backgroundColor: AppColors.navy,
        contentTextStyle: TextStyle(color: AppColors.white),
      ),
      dividerColor: AppColors.line,
    );
  }

  /// Dark navy theme for immersive feature hubs.
  static ThemeData get dark {
    final base = ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      colorScheme: const ColorScheme.dark(
        primary: AppColors.lime,
        onPrimary: AppColors.white,
        secondary: AppColors.limeSoft,
        surface: AppColors.navy,
        onSurface: AppColors.white,
        error: AppColors.coral,
      ),
      scaffoldBackgroundColor: AppColors.voidBlack,
    );
    final text = GoogleFonts.poppinsTextTheme(base.textTheme);
    return base.copyWith(
      textTheme: text.copyWith(
        headlineLarge: text.headlineLarge?.copyWith(
          color: AppColors.white,
          fontWeight: FontWeight.w700,
        ),
        headlineMedium: text.headlineMedium?.copyWith(
          color: AppColors.white,
          fontWeight: FontWeight.w700,
        ),
        titleLarge: text.titleLarge?.copyWith(
          color: AppColors.white,
          fontWeight: FontWeight.w700,
        ),
        titleMedium: text.titleMedium?.copyWith(
          color: AppColors.white,
          fontWeight: FontWeight.w600,
        ),
        titleSmall: text.titleSmall?.copyWith(
          color: AppColors.soft,
          fontWeight: FontWeight.w600,
        ),
        bodyLarge: text.bodyLarge?.copyWith(color: AppColors.soft),
        bodyMedium: text.bodyMedium?.copyWith(color: AppColors.soft),
        bodySmall: text.bodySmall?.copyWith(color: AppColors.muted),
        labelLarge: text.labelLarge?.copyWith(color: AppColors.white),
      ),
      appBarTheme: AppBarTheme(
        backgroundColor: AppColors.voidBlack,
        elevation: 0,
        foregroundColor: AppColors.white,
        centerTitle: false,
        titleTextStyle: GoogleFonts.poppins(
          fontSize: 16,
          fontWeight: FontWeight.w700,
          color: AppColors.white,
        ),
        iconTheme: const IconThemeData(color: AppColors.white),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.lime,
          // voidBlack on lime is 6.1:1 (AA); white on lime was only 3.0:1.
          foregroundColor: AppColors.voidBlack,
          minimumSize: const Size.fromHeight(52),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
          ),
          textStyle: GoogleFonts.poppins(fontWeight: FontWeight.w700),
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: AppColors.lime,
          foregroundColor: AppColors.voidBlack,
          minimumSize: const Size.fromHeight(52),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
          ),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: AppColors.white,
          side: BorderSide(color: Colors.white.withValues(alpha: 0.2)),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
          ),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: AppColors.cardElevated,
        isDense: true,
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
        hintStyle: const TextStyle(color: AppColors.muted, fontSize: 14),
        labelStyle: const TextStyle(color: AppColors.muted, fontSize: 13),
        floatingLabelBehavior: FloatingLabelBehavior.never,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: Colors.white.withValues(alpha: 0.08)),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: Colors.white.withValues(alpha: 0.08)),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: AppColors.lime, width: 1.4),
        ),
        disabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: Colors.white.withValues(alpha: 0.04)),
        ),
      ),
      sliderTheme: const SliderThemeData(
        activeTrackColor: AppColors.lime,
        inactiveTrackColor: AppColors.card,
        thumbColor: AppColors.lime,
      ),
      snackBarTheme: const SnackBarThemeData(
        backgroundColor: AppColors.cardElevated,
        contentTextStyle: TextStyle(color: AppColors.white),
      ),
      dividerColor: Colors.white12,
    );
  }
}
