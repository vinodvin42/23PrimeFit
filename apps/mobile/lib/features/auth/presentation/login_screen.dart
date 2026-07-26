import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:primefit_mobile/core/theme/auth_colors.dart';
import 'package:primefit_mobile/core/widgets/auth_widgets.dart';
import 'package:primefit_mobile/core/widgets/brand_mark.dart';
import 'package:primefit_mobile/features/auth/application/auth_controller.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _email = TextEditingController(text: 'athlete@23primefit.dev');
  final _password = TextEditingController(text: 'primefit');
  bool _loading = false;
  bool _showPassword = false;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit({bool asCoach = false}) async {
    setState(() => _loading = true);
    final ok = await ref.read(authControllerProvider.notifier).signIn(
          email: _email.text,
          password: _password.text,
          asCoach: asCoach,
        );
    if (mounted) setState(() => _loading = false);
    if (!ok && mounted) {
      final err = ref.read(authControllerProvider).error;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(err ?? 'Sign in failed')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return AuthScaffold(
      showBack: true,
      onBack: () => context.go('/welcome'),
      child: ListView(
        padding: const EdgeInsets.fromLTRB(24, 4, 24, 28),
        children: [
          const BrandMark(size: 84, color: AuthColors.logoStroke),
          const SizedBox(height: 16),
          const BrandLockup(
            centered: true,
            subtitle: 'Fitness OS',
            onDark: true,
          ),
          const SizedBox(height: 20),
          Text(
            'Welcome back',
            textAlign: TextAlign.center,
            style: GoogleFonts.poppins(
              color: AuthColors.white,
              fontSize: 28,
              fontWeight: FontWeight.w700,
              height: 1.15,
              letterSpacing: -0.3,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Sign in to continue your training, nutrition, and coaching in 23PrimeFit.',
            textAlign: TextAlign.center,
            style: GoogleFonts.poppins(
              color: AuthColors.soft,
              fontSize: 14,
              height: 1.45,
            ),
          ),
          const SizedBox(height: 28),
          AuthGlassCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                AuthPillField(
                  controller: _email,
                  label: 'Email',
                  hint: 'you@email.com',
                  keyboardType: TextInputType.emailAddress,
                ),
                const SizedBox(height: 14),
                AuthPillField(
                  controller: _password,
                  label: 'Password',
                  hint: 'Password',
                  obscureText: true,
                  showVisibilityToggle: true,
                  visible: _showPassword,
                  onToggleVisibility: () =>
                      setState(() => _showPassword = !_showPassword),
                ),
                const SizedBox(height: 8),
                Align(
                  alignment: Alignment.centerRight,
                  child: TextButton(
                    onPressed: () => context.push('/forgot-password'),
                    style: TextButton.styleFrom(
                      foregroundColor: AuthColors.accent,
                      padding: EdgeInsets.zero,
                      minimumSize: Size.zero,
                      tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                    ),
                    child: Text(
                      'Forgot password?',
                      style: GoogleFonts.poppins(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 18),
                AuthPrimaryButton(
                  label: 'Sign in to 23PrimeFit',
                  loading: _loading,
                  onPressed: () => _submit(),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          TextButton(
            onPressed: _loading ? null : () => _submit(asCoach: true),
            child: Text(
              'Continue as coach',
              style: GoogleFonts.poppins(
                color: AuthColors.soft,
                fontSize: 13,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
          const SizedBox(height: 28),
          AuthFooterLink(
            prefix: "Don't have an account? ",
            action: 'Create account',
            onTap: () => context.push('/register'),
          ),
        ],
      ),
    );
  }
}
