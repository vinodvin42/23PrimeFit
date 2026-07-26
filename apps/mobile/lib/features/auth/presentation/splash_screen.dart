import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:primefit_mobile/core/theme/auth_colors.dart';
import 'package:primefit_mobile/core/widgets/auth_widgets.dart';
import 'package:primefit_mobile/core/widgets/brand_mark.dart';
import 'package:primefit_mobile/features/auth/application/auth_controller.dart';

class SplashScreen extends ConsumerStatefulWidget {
  const SplashScreen({super.key});

  @override
  ConsumerState<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends ConsumerState<SplashScreen>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late final Animation<double> _fade;
  late final Animation<double> _scale;
  bool _navigated = false;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
    );
    _fade = CurvedAnimation(parent: _controller, curve: Curves.easeOut);
    _scale = Tween<double>(begin: 0.88, end: 1).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeOutBack),
    );
    _controller.forward();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _goWelcomeIfReady() {
    if (_navigated || !mounted) return;
    final status = ref.read(authControllerProvider).status;
    if (status == AuthStatus.unknown) return;
    if (status == AuthStatus.unauthenticated) {
      _navigated = true;
      context.go('/welcome');
    }
  }

  @override
  Widget build(BuildContext context) {
    ref.listen(authControllerProvider, (_, next) {
      if (next.status == AuthStatus.unauthenticated) {
        Future<void>.delayed(
          const Duration(milliseconds: 700),
          _goWelcomeIfReady,
        );
      }
    });

    WidgetsBinding.instance.addPostFrameCallback((_) {
      Future<void>.delayed(
        const Duration(milliseconds: 900),
        _goWelcomeIfReady,
      );
    });

    return AuthScaffold(
      child: Center(
        child: FadeTransition(
          opacity: _fade,
          child: ScaleTransition(
            scale: _scale,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const BrandMark(size: 112, color: AuthColors.logoStroke),
                const SizedBox(height: 24),
                const BrandLockup(
                  centered: true,
                  subtitle: 'Fitness OS',
                  onDark: true,
                ),
                const SizedBox(height: 12),
                Text(
                  'Health · Fitness · Coaching',
                  style: GoogleFonts.poppins(
                    color: AuthColors.soft,
                    fontSize: 12,
                    fontWeight: FontWeight.w500,
                    letterSpacing: 0.4,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
