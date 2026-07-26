import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:primefit_mobile/core/theme/mockup_colors.dart';

class TrainingCompleteScreen extends StatelessWidget {
  const TrainingCompleteScreen({
    super.key,
    this.title = 'Training',
    this.km = 0,
    this.seconds = 0,
    this.calories = 0,
  });

  final String title;
  final double km;
  final int seconds;
  final int calories;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [MockupColors.navy, MockupColors.navyDeep],
          ),
        ),
        child: Stack(
          children: [
            const Positioned.fill(child: CustomPaint(painter: _ConfettiPainter())),
            SafeArea(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(24, 24, 24, 28),
                child: Column(
                  children: [
                    const Spacer(flex: 2),
                    SizedBox(
                      height: 280,
                      width: double.infinity,
                      child: Stack(
                        alignment: Alignment.center,
                        children: [
                          Transform.translate(
                            offset: const Offset(0, -28),
                            child: Opacity(
                              opacity: 0.25,
                              child: _Card(
                                child: const SizedBox(height: 200, width: double.infinity),
                              ),
                            ),
                          ),
                          Transform.translate(
                            offset: const Offset(0, -14),
                            child: Opacity(
                              opacity: 0.45,
                              child: _Card(
                                child: const SizedBox(height: 200, width: double.infinity),
                              ),
                            ),
                          ),
                          _Card(
                            child: Padding(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 28,
                                vertical: 36,
                              ),
                              child: Column(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  const _FlameIcon(),
                                  const SizedBox(height: 20),
                                  Text(
                                    'Training completed\nsuccessfully',
                                    textAlign: TextAlign.center,
                                    style: GoogleFonts.poppins(
                                      color: MockupColors.ink,
                                      fontSize: 22,
                                      fontWeight: FontWeight.w700,
                                      height: 1.25,
                                    ),
                                  ),
                                  if (km > 0 || calories > 0) ...[
                                    const SizedBox(height: 12),
                                    Text(
                                      [
                                        if (km > 0)
                                          '${km.toStringAsFixed(2)} km',
                                        if (calories > 0) '$calories cal',
                                      ].join(' · '),
                                      style: GoogleFonts.poppins(
                                        color: MockupColors.muted,
                                        fontSize: 13,
                                      ),
                                    ),
                                  ],
                                ],
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const Spacer(flex: 3),
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: MockupColors.emerald,
                          foregroundColor: MockupColors.white,
                          elevation: 0,
                          shape: const StadiumBorder(),
                          padding: const EdgeInsets.symmetric(vertical: 16),
                        ),
                        onPressed: () => context.go('/home'),
                        child: Text(
                          'Continue',
                          style: GoogleFonts.poppins(
                            fontWeight: FontWeight.w700,
                            fontSize: 16,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Card extends StatelessWidget {
  const _Card({required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        color: MockupColors.white,
        borderRadius: BorderRadius.circular(32),
      ),
      child: child,
    );
  }
}

class _FlameIcon extends StatelessWidget {
  const _FlameIcon();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 72,
      height: 72,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        gradient: const LinearGradient(
          colors: [MockupColors.coralSoft, MockupColors.coral],
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
        ),
        boxShadow: [
          BoxShadow(
            color: MockupColors.coral.withValues(alpha: 0.35),
            blurRadius: 18,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: const Icon(Icons.local_fire_department, color: Colors.white, size: 40),
    );
  }
}

class _ConfettiPainter extends CustomPainter {
  const _ConfettiPainter();

  @override
  void paint(Canvas canvas, Size size) {
    final rnd = math.Random(7);
    final colors = [
      MockupColors.coral,
      MockupColors.emerald,
      MockupColors.cream,
      MockupColors.mint,
    ];
    for (var i = 0; i < 28; i++) {
      final paint = Paint()
        ..color = colors[i % colors.length].withValues(alpha: 0.55)
        ..strokeWidth = 6
        ..strokeCap = StrokeCap.round
        ..style = PaintingStyle.stroke;
      final x = rnd.nextDouble() * size.width;
      final y = rnd.nextDouble() * size.height;
      final path = Path()
        ..moveTo(x, y)
        ..quadraticBezierTo(
          x + 20,
          y + 30,
          x + (rnd.nextBool() ? 40 : -20),
          y + 55,
        );
      canvas.drawPath(path, paint);
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
