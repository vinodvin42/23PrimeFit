import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:primefit_mobile/core/theme/app_theme.dart';
import 'package:primefit_mobile/core/widgets/glass.dart';
import 'package:primefit_mobile/features/workouts/data/fitness_repository.dart';

IconData _iconFor(String kind) {
  switch (kind) {
    case 'blood_report':
      return Icons.description_outlined;
    case 'progress_photo':
      return Icons.photo_camera_outlined;
    case 'blood_pressure':
      return Icons.favorite_border;
    case 'blood_sugar':
      return Icons.water_drop_outlined;
    case 'allergy':
      return Icons.warning_amber_outlined;
    case 'vaccination':
      return Icons.vaccines_outlined;
    case 'body_measurement':
      return Icons.straighten;
    default:
      return Icons.event_note_outlined;
  }
}

class HealthTimelineScreen extends ConsumerWidget {
  const HealthTimelineScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final timeline = ref.watch(healthTimelineProvider);
    return DarkHubTheme(
      child: Scaffold(
        backgroundColor: AppColors.voidBlack,
        body: SafeArea(
          child: RefreshIndicator(
            color: AppColors.lime,
            onRefresh: () async {
              ref.invalidate(healthTimelineProvider);
              await ref.read(healthTimelineProvider.future);
            },
            child: ListView(
              padding: const EdgeInsets.fromLTRB(24, 16, 24, 32),
              children: [
                const DarkBackButton(),
                const SizedBox(height: 8),
                const Text(
                  'HEALTH TIMELINE',
                  style: TextStyle(
                    color: AppColors.white,
                    fontSize: 32,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 4),
                const Text(
                  'Everything you have logged, in one chronological view.',
                  style: TextStyle(color: AppColors.mutedOnDark),
                ),
                const SizedBox(height: 16),
                timeline.when(
                  loading: () => const Center(
                    child: CircularProgressIndicator(color: AppColors.lime),
                  ),
                  error: (e, _) => Text(
                    '$e',
                    style: const TextStyle(color: AppColors.danger),
                  ),
                  data: (payload) {
                    final events = (payload['events'] as List? ?? [])
                        .whereType<Map<String, dynamic>>()
                        .toList();
                    if (events.isEmpty) {
                      return const GlassCard(
                        child: Text(
                          'Nothing logged yet — vitals, allergies, '
                          'vaccinations, measurements, blood reports, and '
                          'progress photos will show up here.',
                          style: TextStyle(color: AppColors.soft),
                        ),
                      );
                    }
                    return Column(
                      children: [
                        ...events.map(
                          (e) => Padding(
                            padding: const EdgeInsets.only(bottom: 8),
                            child: GlassCard(
                              padding: EdgeInsets.zero,
                              child: ListTile(
                                leading: CircleAvatar(
                                  backgroundColor:
                                      AppColors.lime.withValues(alpha: 0.18),
                                  foregroundColor: AppColors.lime,
                                  child: Icon(
                                    _iconFor('${e['kind']}'),
                                    size: 18,
                                  ),
                                ),
                                title: Text(
                                  '${e['title']}',
                                  style: const TextStyle(
                                    color: AppColors.white,
                                  ),
                                ),
                                subtitle: Text(
                                  '${e['occurredAt']}',
                                  style: const TextStyle(
                                    color: AppColors.mutedOnDark,
                                  ),
                                ),
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          '${payload['disclaimer']}',
                          style: const TextStyle(
                            color: AppColors.mutedOnDark,
                            fontSize: 12,
                          ),
                        ),
                      ],
                    );
                  },
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
