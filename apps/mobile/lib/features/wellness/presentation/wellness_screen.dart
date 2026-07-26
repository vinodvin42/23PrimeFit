import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:primefit_mobile/core/theme/app_theme.dart';
import 'package:primefit_mobile/features/workouts/data/fitness_repository.dart';

class WellnessScreen extends ConsumerWidget {
  const WellnessScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cycle = ref.watch(femaleHealthTodayProvider);
    final healthspan = ref.watch(healthspanTodayProvider);
    Future<void> enable(String purpose) async {
      await ref.read(fitnessRepositoryProvider).setConsent(purpose, true);
      ref.invalidate(femaleHealthTodayProvider);
      ref.invalidate(healthspanTodayProvider);
    }

    return Scaffold(
      backgroundColor: AppColors.canvas,
      appBar: AppBar(
        backgroundColor: AppColors.canvas,
        foregroundColor: AppColors.ink,
        title: Text(
          'Wellness',
          style: GoogleFonts.poppins(fontWeight: FontWeight.w700),
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          _Section(
            title: 'Cycle-aware wellness',
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                cycle.when(
                  loading: () => const Center(child: CircularProgressIndicator()),
                  error: (_, _) => Text(
                    'Enable private tracking below to use this feature.',
                    style: GoogleFonts.poppins(color: AppColors.ink),
                  ),
                  data: (data) {
                    final phase =
                        data['phase'] as Map<String, dynamic>? ?? {};
                    return Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          (phase['phase']?.toString() ?? 'Unknown')
                              .toUpperCase(),
                          style: GoogleFonts.poppins(
                            color: AppColors.lime,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          data['suggestion']?.toString() ??
                              'Your cycle information stays private unless you choose to share it.',
                          style: GoogleFonts.poppins(color: AppColors.ink),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          'Wellness guidance only — not medical diagnosis.',
                          style: GoogleFonts.poppins(
                            color: AppColors.muted,
                            fontSize: 12,
                          ),
                        ),
                      ],
                    );
                  },
                ),
                const SizedBox(height: 8),
                TextButton(
                  onPressed: () => enable('female_health_tracking'),
                  child: const Text('Enable private tracking'),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          _Section(
            title: 'Healthspan',
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                healthspan.when(
                  loading: () => const Center(child: CircularProgressIndicator()),
                  error: (_, _) => Text(
                    'Enable Healthspan insights below to see this card.',
                    style: GoogleFonts.poppins(color: AppColors.ink),
                  ),
                  data: (data) {
                    final baseline =
                        data['baseline'] as Map<String, dynamic>? ?? {};
                    final snapshot =
                        data['snapshot'] as Map<String, dynamic>?;
                    if (snapshot == null) {
                      return Text(
                        'Baseline needed: ${(baseline['missing'] as List? ?? []).join(', ')}.',
                        style: GoogleFonts.poppins(color: AppColors.ink),
                      );
                    }
                    return Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '${snapshot['score'] ?? '—'} / 100',
                          style: GoogleFonts.poppins(
                            color: AppColors.lime,
                            fontWeight: FontWeight.w700,
                            fontSize: 28,
                          ),
                        ),
                        Text(
                          'Trend: ${snapshot['trend'] ?? 'steady'} · confidence: ${snapshot['coverageConfidence'] ?? 'low'}',
                          style: GoogleFonts.poppins(color: AppColors.ink),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          'Wellness estimate only — not a medical assessment.',
                          style: GoogleFonts.poppins(
                            color: AppColors.muted,
                            fontSize: 12,
                          ),
                        ),
                      ],
                    );
                  },
                ),
                const SizedBox(height: 8),
                TextButton(
                  onPressed: () => enable('healthspan_insights'),
                  child: const Text('Enable Healthspan insights'),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          _Section(
            title: 'Health trackers',
            child: Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                FilledButton.tonal(
                  onPressed: () => context.push('/vitals'),
                  child: const Text('Vitals'),
                ),
                FilledButton.tonal(
                  onPressed: () => context.push('/medications'),
                  child: const Text('Medications'),
                ),
                FilledButton.tonal(
                  onPressed: () => context.push('/health-timeline'),
                  child: const Text('Timeline'),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _Section extends StatelessWidget {
  const _Section({required this.title, required this.child});
  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.line),
      ),
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              title,
              style: GoogleFonts.poppins(
                color: AppColors.ink,
                fontWeight: FontWeight.w700,
                fontSize: 18,
              ),
            ),
            const SizedBox(height: 12),
            child,
          ],
        ),
      ),
    );
  }
}
