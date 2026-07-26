import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:primefit_mobile/core/theme/auth_colors.dart';
import 'package:primefit_mobile/core/widgets/auth_widgets.dart';
import 'package:primefit_mobile/core/widgets/brand_mark.dart';
import 'package:primefit_mobile/features/auth/application/auth_controller.dart';

class WelcomeScreen extends ConsumerStatefulWidget {
  const WelcomeScreen({super.key});

  @override
  ConsumerState<WelcomeScreen> createState() => _WelcomeScreenState();
}

class _WelcomeScreenState extends ConsumerState<WelcomeScreen>
    with SingleTickerProviderStateMixin {
  late final AnimationController _motion;
  bool _loading = false;

  @override
  void initState() {
    super.initState();
    _motion = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 750),
    )..forward();
  }

  @override
  void dispose() {
    _motion.dispose();
    super.dispose();
  }

  Future<void> _guest() async {
    setState(() => _loading = true);
    final ok =
        await ref.read(authControllerProvider.notifier).continueAsGuest();
    if (mounted) setState(() => _loading = false);
    if (!ok && mounted) {
      final err = ref.read(authControllerProvider).error;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(err ?? 'Could not continue as guest')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return AuthScaffold(
      header: const BrandLockup(subtitle: 'Fitness OS', onDark: true),
      child: FadeTransition(
        opacity: CurvedAnimation(parent: _motion, curve: Curves.easeOut),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(28, 8, 28, 28),
          child: Column(
            children: [
              const Spacer(flex: 2),
              SlideTransition(
                position: Tween<Offset>(
                  begin: const Offset(0, 0.08),
                  end: Offset.zero,
                ).animate(
                  CurvedAnimation(parent: _motion, curve: Curves.easeOutCubic),
                ),
                child: const BrandMark(size: 112, color: AuthColors.logoStroke),
              ),
              const SizedBox(height: 28),
              Text(
                'One platform for\nhealth & performance',
                textAlign: TextAlign.center,
                style: GoogleFonts.poppins(
                  color: AuthColors.white,
                  fontSize: 28,
                  fontWeight: FontWeight.w700,
                  height: 1.2,
                  letterSpacing: -0.4,
                ),
              ),
              const SizedBox(height: 12),
              Text(
                'Workouts, nutrition, wearables, and coaching — '
                'together in 23PrimeFit.',
                textAlign: TextAlign.center,
                style: GoogleFonts.poppins(
                  color: AuthColors.soft,
                  fontSize: 14,
                  height: 1.45,
                ),
              ),
              const Spacer(flex: 3),
              AuthPrimaryButton(
                label: 'Sign in',
                onPressed: _loading ? null : () => context.push('/login'),
              ),
              const SizedBox(height: 12),
              AuthSecondaryButton(
                label: 'Create account',
                onPressed: _loading ? null : () => context.push('/register'),
              ),
              const SizedBox(height: 20),
              GestureDetector(
                onTap: _loading ? null : _guest,
                child: Text(
                  'Continue as guest',
                  style: GoogleFonts.poppins(
                    color: AuthColors.accent,
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
              if (_loading) ...[
                const SizedBox(height: 16),
                const SizedBox(
                  width: 22,
                  height: 22,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: AuthColors.accent,
                  ),
                ),
              ],
              const SizedBox(height: 8),
            ],
          ),
        ),
      ),
    );
  }
}
