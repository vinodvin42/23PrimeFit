import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:primefit_mobile/core/theme/app_theme.dart';
import 'package:primefit_mobile/core/theme/auth_colors.dart';

/// Coach-web leaf mark (emerald tile + navy strokes).
class PrimeLeafMark extends StatelessWidget {
  const PrimeLeafMark({super.key, this.size = 34});

  final double size;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: AppColors.lime,
        borderRadius: BorderRadius.circular(size * 0.28),
      ),
      child: CustomPaint(painter: _LeafPainter(color: AppColors.navyDeep)),
    );
  }
}

class _LeafPainter extends CustomPainter {
  _LeafPainter({required this.color});
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = size.width * 0.14
      ..strokeCap = StrokeCap.round;

    final left = RRect.fromRectAndRadius(
      Rect.fromLTWH(
        size.width * 0.12,
        size.height * 0.28,
        size.width * 0.42,
        size.height * 0.62,
      ),
      Radius.circular(size.width * 0.2),
    );
    final right = RRect.fromRectAndRadius(
      Rect.fromLTWH(
        size.width * 0.42,
        size.height * 0.1,
        size.width * 0.42,
        size.height * 0.62,
      ),
      Radius.circular(size.width * 0.2),
    );

    canvas.save();
    canvas.translate(size.width * 0.5, size.height * 0.5);
    canvas.rotate(-0.3);
    canvas.translate(-size.width * 0.5, -size.height * 0.5);
    canvas.drawRRect(left, paint);
    canvas.drawRRect(right, paint);
    canvas.restore();
  }

  @override
  bool shouldRepaint(covariant _LeafPainter oldDelegate) =>
      oldDelegate.color != color;
}

/// Coach-web brand lockup: leaf + **23PrimeFit**.
class BrandLockup extends StatelessWidget {
  const BrandLockup({
    super.key,
    this.subtitle = 'Fitness OS',
    this.compact = false,
    this.centered = false,
    this.onDark = false,
  });

  final String? subtitle;
  final bool compact;
  final bool centered;
  final bool onDark;

  @override
  Widget build(BuildContext context) {
    final markSize = compact ? 28.0 : 36.0;
    final titleSize = compact ? 17.0 : 20.0;
    final nameColor = onDark ? AuthColors.white : AppColors.ink;
    final accentColor = onDark ? AuthColors.accent : AppColors.lime;
    final subColor =
        onDark ? AuthColors.soft.withValues(alpha: 0.8) : AppColors.muted;

    final row = Row(
      mainAxisSize: centered ? MainAxisSize.min : MainAxisSize.max,
      children: [
        PrimeLeafMark(size: markSize),
        SizedBox(width: compact ? 10 : 12),
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text.rich(
              TextSpan(
                children: [
                  TextSpan(
                    text: '23',
                    style: GoogleFonts.poppins(
                      color: accentColor,
                      fontSize: titleSize,
                      fontWeight: FontWeight.w700,
                      height: 1.05,
                      letterSpacing: -0.4,
                    ),
                  ),
                  TextSpan(
                    text: 'PrimeFit',
                    style: GoogleFonts.poppins(
                      color: nameColor,
                      fontSize: titleSize,
                      fontWeight: FontWeight.w700,
                      height: 1.05,
                      letterSpacing: -0.4,
                    ),
                  ),
                ],
              ),
            ),
            if (subtitle != null && subtitle!.isNotEmpty)
              Text(
                subtitle!.toUpperCase(),
                style: GoogleFonts.poppins(
                  color: subColor,
                  fontSize: 9,
                  fontWeight: FontWeight.w600,
                  letterSpacing: 1.6,
                ),
              ),
          ],
        ),
      ],
    );

    if (centered) return Center(child: row);
    return row;
  }
}

/// Circular weightlifter brand mark from coach-web login hero.
class BrandMark extends StatelessWidget {
  const BrandMark({
    super.key,
    this.size = 120,
    this.color = AuthColors.logoStroke,
    this.strokeWidth = 1.6,
    this.showRing = true,
  });

  final double size;
  final Color color;
  final double strokeWidth;
  final bool showRing;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: showRing
          ? BoxDecoration(
              shape: BoxShape.circle,
              border: Border.all(
                color: color.withValues(alpha: 0.85),
                width: 2,
              ),
              color: AuthColors.white.withValues(alpha: 0.04),
            )
          : null,
      child: CustomPaint(
        painter: _WeightlifterPainter(
          color: color,
          strokeWidth: strokeWidth,
          drawOuterRing: !showRing,
        ),
      ),
    );
  }
}

class _WeightlifterPainter extends CustomPainter {
  _WeightlifterPainter({
    required this.color,
    required this.strokeWidth,
    required this.drawOuterRing,
  });

  final Color color;
  final double strokeWidth;
  final bool drawOuterRing;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = strokeWidth
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;

    final c = Offset(size.width / 2, size.height / 2);
    final s = size.width;

    if (drawOuterRing) {
      canvas.drawCircle(c, size.width / 2 - strokeWidth, paint);
    }

    canvas.drawCircle(Offset(c.dx, s * 0.26), s * 0.055, paint);

    final barY = s * 0.34;
    final leftHand = Offset(s * 0.30, barY);
    final rightHand = Offset(s * 0.70, barY);
    canvas.drawLine(leftHand, rightHand, paint);
    for (final x in [s * 0.22, s * 0.78]) {
      canvas.drawLine(
        Offset(x, barY - s * 0.05),
        Offset(x, barY + s * 0.05),
        paint..strokeWidth = strokeWidth * 1.35,
      );
      paint.strokeWidth = strokeWidth;
    }

    final neck = Offset(c.dx, s * 0.34);
    final hip = Offset(c.dx, s * 0.55);
    canvas.drawLine(neck, hip, paint);
    canvas.drawLine(neck, leftHand, paint);
    canvas.drawLine(neck, rightHand, paint);
    canvas.drawLine(hip, Offset(s * 0.36, s * 0.78), paint);
    canvas.drawLine(hip, Offset(s * 0.64, s * 0.78), paint);
  }

  @override
  bool shouldRepaint(covariant _WeightlifterPainter oldDelegate) {
    return oldDelegate.color != color ||
        oldDelegate.strokeWidth != strokeWidth ||
        oldDelegate.drawOuterRing != drawOuterRing;
  }
}

class SquiggleArrow extends StatelessWidget {
  const SquiggleArrow({
    super.key,
    this.color = Colors.white54,
    this.width = 48,
    this.height = 90,
  });

  final Color color;
  final double width;
  final double height;

  @override
  Widget build(BuildContext context) {
    return CustomPaint(
      size: Size(width, height),
      painter: _SquigglePainter(color: color),
    );
  }
}

class _SquigglePainter extends CustomPainter {
  _SquigglePainter({required this.color});
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2
      ..strokeCap = StrokeCap.round;

    final path = Path()
      ..moveTo(size.width * 0.7, 0)
      ..cubicTo(
        size.width * 0.1,
        size.height * 0.25,
        size.width * 0.9,
        size.height * 0.45,
        size.width * 0.25,
        size.height * 0.7,
      )
      ..cubicTo(
        size.width * 0.05,
        size.height * 0.82,
        size.width * 0.35,
        size.height * 0.9,
        size.width * 0.2,
        size.height,
      );
    canvas.drawPath(path, paint);
    final tip = Offset(size.width * 0.2, size.height);
    canvas.drawLine(tip, tip.translate(10, -14), paint);
    canvas.drawLine(tip, tip.translate(-4, -16), paint);
  }

  @override
  bool shouldRepaint(covariant _SquigglePainter oldDelegate) =>
      oldDelegate.color != color;
}
