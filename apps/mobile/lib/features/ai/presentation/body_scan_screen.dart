import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:primefit_mobile/core/theme/app_theme.dart';
import 'package:primefit_mobile/core/widgets/glass.dart';

class BodyScanScreen extends StatefulWidget {
  const BodyScanScreen({super.key});

  @override
  State<BodyScanScreen> createState() => _BodyScanScreenState();
}

class _BodyScanScreenState extends State<BodyScanScreen>
    with SingleTickerProviderStateMixin {
  late final AnimationController _scan;

  @override
  void initState() {
    super.initState();
    _scan = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 2),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _scan.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.voidBlack,
      body: Stack(
        fit: StackFit.expand,
        children: [
          Container(
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                colors: [Color(0xFF1A1A1A), Color(0xFF050505)],
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
              ),
            ),
          ),
          CustomPaint(painter: _SilhouettePainter()),
          AnimatedBuilder(
            animation: _scan,
            builder: (context, _) {
              return CustomPaint(
                painter: _ScanOverlayPainter(progress: _scan.value),
              );
            },
          ),
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
              child: Column(
                children: [
                  const GlassCard(
                    padding: EdgeInsets.all(12),
                    radius: 18,
                    child: Row(
                      children: [
                        Icon(Icons.info_outline, color: AppColors.lime),
                        SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            'Demo only — placeholders, not your health data.',
                            style: TextStyle(fontWeight: FontWeight.w600),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 12),
                  const Row(
                    children: [
                      Expanded(
                        child: GlassCard(
                          padding: EdgeInsets.all(12),
                          radius: 18,
                          child: Row(
                            children: [
                              Icon(Icons.favorite, color: AppColors.heart),
                              SizedBox(width: 8),
                              Text(
                                '— bpm',
                                style: TextStyle(fontWeight: FontWeight.w700),
                              ),
                            ],
                          ),
                        ),
                      ),
                      SizedBox(width: 12),
                      Expanded(
                        child: GlassCard(
                          padding: EdgeInsets.all(12),
                          radius: 18,
                          child: Row(
                            children: [
                              Icon(Icons.fitness_center,
                                  color: AppColors.accentBlue),
                              SizedBox(width: 8),
                              Flexible(
                                child: Text(
                                  'Coming soon',
                                  style: TextStyle(fontWeight: FontWeight.w700),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                  const Spacer(),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                    children: [
                      _RoundAction(
                        icon: Icons.home_outlined,
                        onTap: () => context.go('/home'),
                      ),
                      GestureDetector(
                        onTap: () {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                              content: Text(
                                'Body scan is a demo preview — no measurement saved.',
                              ),
                            ),
                          );
                          context.pop();
                        },
                        child: Container(
                          width: 78,
                          height: 78,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: Colors.white,
                            border: Border.all(
                              color: AppColors.lime,
                              width: 4,
                            ),
                          ),
                          child: const Icon(
                            Icons.photo_camera,
                            color: AppColors.voidBlack,
                            size: 32,
                          ),
                        ),
                      ),
                      _RoundAction(
                        icon: Icons.close,
                        onTap: () {
                          if (context.canPop()) {
                            context.pop();
                          } else {
                            context.go('/home');
                          }
                        },
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _RoundAction extends StatelessWidget {
  const _RoundAction({required this.icon, required this.onTap});

  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: SizedBox(
          width: 52,
          height: 52,
          child: Icon(icon, color: AppColors.voidBlack),
        ),
      ),
    );
  }
}

class _SilhouettePainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = Colors.white.withValues(alpha: 0.08)
      ..style = PaintingStyle.fill;
    final cx = size.width / 2;
    final path = Path()
      ..addOval(Rect.fromCenter(
        center: Offset(cx, size.height * 0.28),
        width: 70,
        height: 80,
      ))
      ..addRRect(
        RRect.fromRectAndRadius(
          Rect.fromCenter(
            center: Offset(cx, size.height * 0.48),
            width: 120,
            height: 160,
          ),
          const Radius.circular(40),
        ),
      );
    canvas.drawPath(path, paint);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

class _ScanOverlayPainter extends CustomPainter {
  _ScanOverlayPainter({required this.progress});

  final double progress;

  @override
  void paint(Canvas canvas, Size size) {
    final frame = Rect.fromCenter(
      center: Offset(size.width / 2, size.height * 0.45),
      width: size.width * 0.62,
      height: size.height * 0.48,
    );
    final corner = Paint()
      ..color = Colors.white
      ..strokeWidth = 3
      ..style = PaintingStyle.stroke;
    const len = 28.0;
    canvas.drawLine(frame.topLeft, frame.topLeft + const Offset(len, 0), corner);
    canvas.drawLine(frame.topLeft, frame.topLeft + const Offset(0, len), corner);
    canvas.drawLine(
        frame.topRight, frame.topRight + const Offset(-len, 0), corner);
    canvas.drawLine(
        frame.topRight, frame.topRight + const Offset(0, len), corner);
    canvas.drawLine(
        frame.bottomLeft, frame.bottomLeft + const Offset(len, 0), corner);
    canvas.drawLine(
        frame.bottomLeft, frame.bottomLeft + const Offset(0, -len), corner);
    canvas.drawLine(
        frame.bottomRight, frame.bottomRight + const Offset(-len, 0), corner);
    canvas.drawLine(
        frame.bottomRight, frame.bottomRight + const Offset(0, -len), corner);

    final y = frame.top + frame.height * progress;
    final band = Paint()
      ..shader = LinearGradient(
        colors: [
          AppColors.lime.withValues(alpha: 0),
          AppColors.lime.withValues(alpha: 0.35),
          AppColors.lime.withValues(alpha: 0),
        ],
      ).createShader(Rect.fromLTWH(frame.left, y - 18, frame.width, 36));
    canvas.drawRect(Rect.fromLTWH(frame.left, y - 18, frame.width, 36), band);
    canvas.drawLine(
      Offset(frame.left, y),
      Offset(frame.right, y),
      Paint()
        ..color = AppColors.lime
        ..strokeWidth = 2,
    );
  }

  @override
  bool shouldRepaint(covariant _ScanOverlayPainter oldDelegate) =>
      oldDelegate.progress != progress;
}
