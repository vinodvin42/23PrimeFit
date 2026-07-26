import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:primefit_mobile/core/theme/auth_colors.dart';
import 'package:primefit_mobile/core/widgets/auth_widgets.dart';
import 'package:primefit_mobile/core/widgets/brand_mark.dart';
import 'package:primefit_mobile/features/auth/application/auth_controller.dart';

class RegisterScreen extends ConsumerStatefulWidget {
  const RegisterScreen({super.key});

  @override
  ConsumerState<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends ConsumerState<RegisterScreen> {
  final _username = TextEditingController();
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _confirm = TextEditingController();
  bool _loading = false;
  bool _showPassword = false;
  bool _showConfirm = false;

  @override
  void dispose() {
    _username.dispose();
    _email.dispose();
    _password.dispose();
    _confirm.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final name = _username.text.trim();
    final email = _email.text.trim();
    final password = _password.text;
    if (name.isEmpty || email.isEmpty || password.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please fill all fields')),
      );
      return;
    }
    if (password != _confirm.text) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Passwords do not match')),
      );
      return;
    }
    if (password.length < 6) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Password must be at least 6 characters')),
      );
      return;
    }

    setState(() => _loading = true);
    final ok = await ref.read(authControllerProvider.notifier).register(
          email: email,
          password: password,
          displayName: name,
        );
    if (mounted) setState(() => _loading = false);
    if (!ok && mounted) {
      final err = ref.read(authControllerProvider).error;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(err ?? 'Registration failed')),
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
          const BrandLockup(
            centered: true,
            subtitle: 'Fitness OS',
            onDark: true,
          ),
          const SizedBox(height: 22),
          Text(
            'Create your account',
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
            'Join 23PrimeFit for workouts, nutrition, recovery, and coach support in one place.',
            textAlign: TextAlign.center,
            style: GoogleFonts.poppins(
              color: AuthColors.soft,
              fontSize: 14,
              height: 1.45,
            ),
          ),
          const SizedBox(height: 24),
          AuthGlassCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                AuthPillField(
                  controller: _username,
                  label: 'Display name',
                  hint: 'How should we call you?',
                ),
                const SizedBox(height: 12),
                AuthPillField(
                  controller: _email,
                  label: 'Email',
                  hint: 'you@email.com',
                  keyboardType: TextInputType.emailAddress,
                ),
                const SizedBox(height: 12),
                AuthPillField(
                  controller: _password,
                  label: 'Password',
                  hint: 'At least 6 characters',
                  obscureText: true,
                  showVisibilityToggle: true,
                  visible: _showPassword,
                  onToggleVisibility: () =>
                      setState(() => _showPassword = !_showPassword),
                ),
                const SizedBox(height: 12),
                AuthPillField(
                  controller: _confirm,
                  label: 'Confirm password',
                  hint: 'Repeat password',
                  obscureText: true,
                  showVisibilityToggle: true,
                  visible: _showConfirm,
                  onToggleVisibility: () =>
                      setState(() => _showConfirm = !_showConfirm),
                ),
                const SizedBox(height: 22),
                AuthPrimaryButton(
                  label: 'Create 23PrimeFit account',
                  loading: _loading,
                  onPressed: _submit,
                ),
              ],
            ),
          ),
          const SizedBox(height: 28),
          AuthFooterLink(
            prefix: 'Already have an account? ',
            action: 'Sign in',
            onTap: () => context.go('/login'),
          ),
        ],
      ),
    );
  }
}
