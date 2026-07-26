import 'package:firebase_auth/firebase_auth.dart' as fb;
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:primefit_mobile/core/config/app_config.dart';
import 'package:primefit_mobile/core/firebase/firebase_bootstrap.dart';
import 'package:primefit_mobile/core/theme/auth_colors.dart';
import 'package:primefit_mobile/core/widgets/auth_widgets.dart';
import 'package:primefit_mobile/core/widgets/brand_mark.dart';

class ForgotPasswordScreen extends StatefulWidget {
  const ForgotPasswordScreen({super.key});

  @override
  State<ForgotPasswordScreen> createState() => _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends State<ForgotPasswordScreen> {
  final _email = TextEditingController();
  bool _loading = false;
  bool _sent = false;
  String? _info;

  @override
  void dispose() {
    _email.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    final email = _email.text.trim();
    if (email.isEmpty || !email.contains('@')) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Enter a valid email address')),
      );
      return;
    }

    if (!AppConfig.firebaseEnabled || !FirebaseBootstrap.ready) {
      setState(() {
        _sent = false;
        _info =
            'Password reset requires Firebase Auth. '
            'This build is in AUTH_DEV_MODE — use your demo login instead, '
            'or enable FIREBASE_ENABLED with a real Firebase project.';
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Reset unavailable in demo auth mode'),
        ),
      );
      return;
    }

    setState(() {
      _loading = true;
      _info = null;
    });
    try {
      await fb.FirebaseAuth.instance.sendPasswordResetEmail(email: email);
      if (!mounted) return;
      setState(() {
        _sent = true;
        _info = 'If an account exists for $email, a reset email was sent.';
      });
    } on fb.FirebaseAuthException catch (e) {
      if (!mounted) return;
      setState(() => _info = e.message ?? e.code);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AuthScaffold(
      showBack: true,
      onBack: () => context.pop(),
      child: ListView(
        padding: const EdgeInsets.fromLTRB(24, 8, 24, 24),
        children: [
          const BrandLockup(
            centered: true,
            subtitle: 'Fitness OS',
            onDark: true,
          ),
          const SizedBox(height: 28),
          Text(
            'Reset password',
            textAlign: TextAlign.center,
            style: GoogleFonts.poppins(
              color: AuthColors.white,
              fontSize: 28,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 10),
          Text(
            AppConfig.firebaseEnabled
                ? "Enter the email linked to your 23PrimeFit account. We'll send a reset link."
                : 'Demo builds use AUTH_DEV_MODE — password reset is only available with Firebase enabled.',
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
                if (_info != null) ...[
                  const SizedBox(height: 14),
                  Text(
                    _info!,
                    style: GoogleFonts.poppins(
                      color: AuthColors.soft,
                      fontSize: 13,
                      height: 1.4,
                    ),
                  ),
                ],
                const SizedBox(height: 20),
                AuthPrimaryButton(
                  label: _sent ? 'Email sent' : 'Send reset link',
                  loading: _loading,
                  onPressed: _loading || _sent ? null : _send,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
