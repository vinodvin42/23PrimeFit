import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:primefit_mobile/core/theme/app_theme.dart';
import 'package:primefit_mobile/features/auth/application/auth_controller.dart';
import 'package:primefit_mobile/features/auth/data/auth_repository.dart';

class ProfileScreen extends ConsumerStatefulWidget {
  const ProfileScreen({super.key, this.embedded = false});

  /// When true, used as a HomeShell tab (no back button).
  final bool embedded;

  @override
  ConsumerState<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends ConsumerState<ProfileScreen> {
  late final TextEditingController _name;
  late final TextEditingController _height;
  late final TextEditingController _weight;
  bool _editing = false;
  bool _saving = false;
  Map<String, bool> _consent = {
    'wearable_sync': false,
    'blood_report_analysis': false,
    'ai_coaching': false,
    'injury_risk_insights': false,
    'predictive_insights': false,
    'cricket_analytics': false,
  };

  @override
  void initState() {
    super.initState();
    final user = ref.read(authControllerProvider).user;
    _name = TextEditingController(text: user?.displayName ?? '');
    _height = TextEditingController(
      text: user?.profile?.heightCm?.toString() ?? '',
    );
    _weight = TextEditingController(
      text: user?.profile?.weightKg?.toString() ?? '',
    );
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadConsent());
  }

  Future<void> _loadConsent() async {
    try {
      final rows = await ref.read(authRepositoryProvider).listConsent();
      final next = Map<String, bool>.from(_consent);
      for (final row in rows) {
        final purpose = row['purpose'] as String?;
        if (purpose != null && next.containsKey(purpose)) {
          next[purpose] = row['granted'] as bool? ?? false;
        }
      }
      if (mounted) setState(() => _consent = next);
    } catch (_) {}
  }

  @override
  void dispose() {
    _name.dispose();
    _height.dispose();
    _weight.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    try {
      await ref.read(authControllerProvider.notifier).updateProfile({
        'displayName': _name.text.trim(),
        'heightCm': double.tryParse(_height.text),
        'weightKg': double.tryParse(_weight.text),
      });
      if (mounted) {
        setState(() => _editing = false);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Profile updated')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Update failed: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _toggleConsent(String purpose, bool value) async {
    setState(() => _consent[purpose] = value);
    try {
      await ref.read(authRepositoryProvider).setConsent(purpose, value);
    } catch (e) {
      setState(() => _consent[purpose] = !value);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Consent update failed: $e')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authControllerProvider).user;
    final height = user?.profile?.heightCm;
    final weight = user?.profile?.weightKg;

    return Scaffold(
      backgroundColor: AppColors.canvas,
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(24, 12, 24, 110),
          children: [
            if (!widget.embedded)
              Align(
                alignment: Alignment.centerLeft,
                child: IconButton(
                  onPressed: () => context.pop(),
                  icon: const Icon(Icons.arrow_back, color: AppColors.ink),
                ),
              ),
            const SizedBox(height: 8),
            Center(
              child: Stack(
                children: [
                  Container(
                    width: 118,
                    height: 118,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      border: Border.all(
                        color: AppColors.lime,
                        width: 3,
                      ),
                      color: AppColors.navy,
                    ),
                    child: const Icon(
                      Icons.person,
                      size: 64,
                      color: AppColors.white,
                    ),
                  ),
                  Positioned(
                    right: 4,
                    bottom: 4,
                    child: GestureDetector(
                      onTap: () => setState(() => _editing = !_editing),
                      child: Container(
                        width: 36,
                        height: 36,
                        decoration: const BoxDecoration(
                          color: AppColors.lime,
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(
                          Icons.edit,
                          size: 18,
                          color: AppColors.white,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            Text(
              user?.displayName?.isNotEmpty == true
                  ? user!.displayName!
                  : (user?.email ?? 'Athlete'),
              textAlign: TextAlign.center,
              style: GoogleFonts.poppins(
                color: AppColors.ink,
                fontSize: 24,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              [
                if (height != null) '${height.round()} cm',
                if (weight != null) '${weight.toStringAsFixed(0)} KG',
              ].join('   ·   '),
              textAlign: TextAlign.center,
              style: GoogleFonts.poppins(
                color: AppColors.muted,
                fontSize: 15,
                fontWeight: FontWeight.w500,
              ),
            ),
            if (_editing) ...[
              const SizedBox(height: 20),
              _editField(_name, 'Display name'),
              const SizedBox(height: 10),
              _editField(_height, 'Height (cm)', number: true),
              const SizedBox(height: 10),
              _editField(_weight, 'Weight (kg)', number: true),
              const SizedBox(height: 12),
              ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.lime,
                  foregroundColor: AppColors.white,
                  shape: const StadiumBorder(),
                  minimumSize: const Size.fromHeight(48),
                ),
                onPressed: _saving ? null : _save,
                child: Text(_saving ? 'Saving…' : 'Save'),
              ),
            ],
            const SizedBox(height: 28),
            _sectionLabel('App Settings'),
            const SizedBox(height: 10),
            _SettingsCard(
              children: [
                _SettingsRow(
                  label: 'Account information',
                  onTap: () => setState(() => _editing = true),
                ),
                _SettingsRow(
                  label: 'AI coaching alerts',
                  trailing: _consent['ai_coaching'] == true ? 'On' : 'Off',
                  onTap: () => _toggleConsent(
                    'ai_coaching',
                    !(_consent['ai_coaching'] ?? false),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 22),
            _sectionLabel('Features'),
            const SizedBox(height: 10),
            _SettingsCard(
              children: [
                _SettingsRow(
                  label: 'Train',
                  onTap: () => context.push('/train'),
                ),
                _SettingsRow(
                  label: 'Fuel',
                  onTap: () => context.push('/fuel'),
                ),
                _SettingsRow(
                  label: 'Recover',
                  onTap: () => context.push('/recover'),
                ),
                _SettingsRow(
                  label: 'Coach chat & consults',
                  onTap: () => context.push('/coach'),
                ),
                _SettingsRow(
                  label: 'AI suggestions',
                  onTap: () => context.push('/ai'),
                ),
                _SettingsRow(
                  label: 'Progress photos',
                  onTap: () => context.push('/progress'),
                ),
                _SettingsRow(
                  label: 'Blood / lab reports',
                  onTap: () => context.push('/blood-reports'),
                ),
                _SettingsRow(
                  label: 'Exercise library',
                  onTap: () => context.push('/exercises'),
                ),
                _SettingsRow(
                  label: 'Cricket performance',
                  onTap: () => context.push('/cricket'),
                ),
              ],
            ),
            const SizedBox(height: 22),
            _sectionLabel('Privacy & support'),
            const SizedBox(height: 10),
            _SettingsCard(
              children: [
                _SettingsRow(
                  label: 'Wearable sync',
                  trailing: (_consent['wearable_sync'] ?? false) ? 'On' : 'Off',
                  onTap: () => _toggleConsent(
                    'wearable_sync',
                    !(_consent['wearable_sync'] ?? false),
                  ),
                ),
                _SettingsRow(
                  label: 'Blood report analysis',
                  trailing: (_consent['blood_report_analysis'] ?? false)
                      ? 'On'
                      : 'Off',
                  onTap: () async {
                    final next = !(_consent['blood_report_analysis'] ?? false);
                    await _toggleConsent('blood_report_analysis', next);
                    if (context.mounted && next) {
                      context.push('/blood-reports');
                    }
                  },
                ),
                _SettingsRow(
                  label: 'AI coaching',
                  trailing: (_consent['ai_coaching'] ?? false) ? 'On' : 'Off',
                  onTap: () => _toggleConsent(
                    'ai_coaching',
                    !(_consent['ai_coaching'] ?? false),
                  ),
                ),
                _SettingsRow(
                  label: 'Injury risk insights',
                  trailing:
                      (_consent['injury_risk_insights'] ?? false) ? 'On' : 'Off',
                  onTap: () => _toggleConsent(
                    'injury_risk_insights',
                    !(_consent['injury_risk_insights'] ?? false),
                  ),
                ),
                _SettingsRow(
                  label: 'Predictive insights',
                  trailing:
                      (_consent['predictive_insights'] ?? false) ? 'On' : 'Off',
                  onTap: () => _toggleConsent(
                    'predictive_insights',
                    !(_consent['predictive_insights'] ?? false),
                  ),
                ),
                _SettingsRow(
                  label: 'Cricket analytics',
                  trailing:
                      (_consent['cricket_analytics'] ?? false) ? 'On' : 'Off',
                  onTap: () => _toggleConsent(
                    'cricket_analytics',
                    !(_consent['cricket_analytics'] ?? false),
                  ),
                ),
                _SettingsRow(
                  label: 'Terms of service',
                  onTap: () {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                        content: Text(
                          'Terms will open here when published.',
                        ),
                      ),
                    );
                  },
                ),
                _SettingsRow(
                  label: 'Sign out',
                  onTap: () async {
                    await ref.read(authControllerProvider.notifier).signOut();
                  },
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _sectionLabel(String text) {
    return Text(
      text,
      style: GoogleFonts.poppins(
        color: AppColors.muted,
        fontSize: 13,
        fontWeight: FontWeight.w700,
      ),
    );
  }

  Widget _editField(
    TextEditingController c,
    String hint, {
    bool number = false,
  }) {
    return TextField(
      controller: c,
      keyboardType: number ? TextInputType.number : TextInputType.text,
      style: const TextStyle(color: AppColors.ink),
      decoration: InputDecoration(
        hintText: hint,
        hintStyle: const TextStyle(color: AppColors.muted),
        filled: true,
        fillColor: AppColors.surface,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(18),
          borderSide: const BorderSide(color: AppColors.line),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(18),
          borderSide: const BorderSide(color: AppColors.line),
        ),
      ),
    );
  }
}

class _SettingsCard extends StatelessWidget {
  const _SettingsCard({required this.children});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(28),
        border: Border.all(color: AppColors.line),
      ),
      child: Column(
        children: [
          for (var i = 0; i < children.length; i++) ...[
            children[i],
            if (i != children.length - 1)
              const Divider(
                height: 1,
                color: AppColors.line,
              ),
          ],
        ],
      ),
    );
  }
}

class _SettingsRow extends StatelessWidget {
  const _SettingsRow({
    required this.label,
    required this.onTap,
    this.trailing,
  });

  final String label;
  final String? trailing;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(28),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
        child: Row(
          children: [
            Expanded(
              child: Text(
                label,
                style: GoogleFonts.poppins(
                  color: AppColors.ink,
                  fontSize: 15,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ),
            if (trailing != null)
              Text(
                trailing!,
                style: GoogleFonts.poppins(
                  color: AppColors.muted,
                  fontSize: 14,
                ),
              ),
            const SizedBox(width: 6),
            const Icon(Icons.chevron_right, color: AppColors.muted),
          ],
        ),
      ),
    );
  }
}
