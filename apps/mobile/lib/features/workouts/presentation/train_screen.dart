import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:primefit_mobile/core/theme/app_theme.dart';
import 'package:primefit_mobile/core/widgets/glass.dart';
import 'package:primefit_mobile/features/workouts/data/fitness_repository.dart';

class TrainScreen extends ConsumerWidget {
  const TrainScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final mine = ref.watch(myWorkoutsProvider);

    return DarkHubTheme(
      child: Builder(
        builder: (context) {
          return Scaffold(
      backgroundColor: AppColors.voidBlack,
      body: SafeArea(
        child: RefreshIndicator(
          color: AppColors.lime,
          onRefresh: () async {
            ref.invalidate(myWorkoutsProvider);
            await ref.read(myWorkoutsProvider.future);
          },
          child: ListView(
            padding: const EdgeInsets.fromLTRB(24, 16, 24, 32),
            children: [
              const DarkBackButton(),
              const SizedBox(height: 8),
              Text('TRAIN', style: Theme.of(context).textTheme.headlineLarge?.copyWith(color: AppColors.white)),
              const SizedBox(height: 4),
              const Text(
                'Your programs and today’s session.',
                style: TextStyle(color: AppColors.muted),
              ),
              const SizedBox(height: 20),
              mine.when(
                loading: () => const Padding(
                  padding: EdgeInsets.all(32),
                  child: Center(child: CircularProgressIndicator(color: AppColors.lime)),
                ),
                error: (e, _) => GlassCard(
                  child: Text('$e', style: const TextStyle(color: AppColors.danger)),
                ),
                data: (data) => Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (data.todaySession != null) ...[
                      const Text('Today', style: TextStyle(color: AppColors.white, fontSize: 20, fontWeight: FontWeight.w700)),
                      const SizedBox(height: 8),
                      _SessionCard(
                        title: data.todaySession!.title,
                        status: data.todaySession!.status,
                        onOpen: () => context.push('/session/${data.todaySession!.id}'),
                      ),
                      const SizedBox(height: 20),
                    ],
                    if (data.activeProgramTitle != null)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: Text(
                          'Active: ${data.activeProgramTitle}',
                          style: const TextStyle(
                            color: AppColors.lime,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    const Text('Program catalog', style: TextStyle(color: AppColors.white, fontSize: 20, fontWeight: FontWeight.w700)),
                    const SizedBox(height: 8),
                    if (data.catalog.isEmpty)
                      const GlassCard(
                        child: Text(
                          'No programs yet. Pull to refresh — seed may still be loading.',
                          style: TextStyle(color: AppColors.soft),
                        ),
                      )
                    else
                      ...data.catalog.map(
                        (p) => Padding(
                          padding: const EdgeInsets.only(bottom: 10),
                          child: GlassCard(
                            padding: EdgeInsets.zero,
                            child: ListTile(
                              title: Text(
                                p.title,
                                style: const TextStyle(
                                  color: AppColors.white,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                              subtitle: Text(
                                '${p.level} · ${p.durationMin} min · ${p.daysPerWeek}x/week\n${p.description}',
                                style: const TextStyle(color: AppColors.muted),
                              ),
                              isThreeLine: true,
                              trailing: TextButton(
                                onPressed: () async {
                                  await ref
                                      .read(fitnessRepositoryProvider)
                                      .assignProgram(p.slug);
                                  ref.invalidate(myWorkoutsProvider);
                                  if (context.mounted) {
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      SnackBar(content: Text('Assigned ${p.title}')),
                                    );
                                  }
                                },
                                child: const Text('Start'),
                              ),
                            ),
                          ),
                        ),
                      ),
                    const SizedBox(height: 16),
                    const Text('Upcoming sessions', style: TextStyle(color: AppColors.white, fontSize: 20, fontWeight: FontWeight.w700)),
                    const SizedBox(height: 8),
                    if (data.sessions.isEmpty)
                      const GlassCard(
                        child: Text(
                          'No sessions yet. Start a program above to generate your plan.',
                          style: TextStyle(color: AppColors.soft),
                        ),
                      )
                    else
                      ...data.sessions.map(
                        (s) => ListTile(
                          contentPadding: EdgeInsets.zero,
                          title: Text(s.title, style: const TextStyle(color: AppColors.white)),
                          subtitle: Text(s.status, style: const TextStyle(color: AppColors.muted)),
                          trailing: const Icon(Icons.chevron_right, color: AppColors.lime),
                          onTap: () => context.push('/session/${s.id}'),
                        ),
                      ),
                    const SizedBox(height: 12),
                    OutlinedButton.icon(
                      onPressed: () => context.push('/exercises'),
                      icon: const Icon(Icons.search, color: AppColors.white),
                      label: const Text('Browse exercise library', style: TextStyle(color: AppColors.white)),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
        },
      ),
    );
  }
}

class _SessionCard extends StatelessWidget {
  const _SessionCard({
    required this.title,
    required this.status,
    required this.onOpen,
  });

  final String title;
  final String status;
  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context) {
    return GlassCard(
      onTap: onOpen,
      child: Row(
        children: [
          const Icon(Icons.play_circle_fill, color: AppColors.lime, size: 40),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    color: AppColors.white,
                    fontWeight: FontWeight.w700,
                    fontSize: 16,
                  ),
                ),
                Text(status, style: const TextStyle(color: AppColors.muted)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
