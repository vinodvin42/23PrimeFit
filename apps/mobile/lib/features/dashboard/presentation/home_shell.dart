import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:primefit_mobile/core/theme/app_theme.dart';
import 'package:primefit_mobile/core/widgets/brand_mark.dart';
import 'package:primefit_mobile/core/widgets/floating_tab_bar.dart';
import 'package:primefit_mobile/features/auth/application/auth_controller.dart';
import 'package:primefit_mobile/features/profile/presentation/profile_screen.dart';
import 'package:primefit_mobile/features/schedule/presentation/schedule_screen.dart';
import 'package:primefit_mobile/features/stats/presentation/statistics_screen.dart';
import 'package:primefit_mobile/features/workouts/data/fitness_repository.dart';
import 'package:primefit_mobile/features/workouts/domain/workout_models.dart';

class HomeTabIndex extends Notifier<int> {
  @override
  int build() => 0;

  void set(int index) => state = index;
}

final homeTabIndexProvider =
    NotifierProvider<HomeTabIndex, int>(HomeTabIndex.new);

class HomeShell extends ConsumerWidget {
  const HomeShell({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final index = ref.watch(homeTabIndexProvider);
    final pages = const [
      _DashboardPage(),
      ScheduleScreen(),
      StatisticsScreen(),
      ProfileScreen(embedded: true),
    ];

    return Scaffold(
      backgroundColor: AppColors.canvas,
      body: Stack(
        children: [
          Positioned.fill(
            child: AnimatedSwitcher(
              duration: const Duration(milliseconds: 260),
              child: KeyedSubtree(
                key: ValueKey(index),
                child: pages[index],
              ),
            ),
          ),
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            child: FloatingTabBar(
              index: index,
              onChanged: (i) =>
                  ref.read(homeTabIndexProvider.notifier).set(i),
            ),
          ),
        ],
      ),
    );
  }
}

class _DashboardPage extends ConsumerWidget {
  const _DashboardPage();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authControllerProvider);
    final mine = ref.watch(myWorkoutsProvider);
    final nutrition = ref.watch(nutritionTodayProvider);
    final recovery = ref.watch(recoveryTodayProvider);
    final name = (auth.user?.displayName?.trim().isNotEmpty == true)
        ? auth.user!.displayName!.split(' ').first
        : 'Athlete';

    return ColoredBox(
      color: AppColors.canvas,
      child: SafeArea(
        bottom: false,
        child: RefreshIndicator(
          color: AppColors.lime,
          backgroundColor: AppColors.surface,
          onRefresh: () async {
            ref.invalidate(myWorkoutsProvider);
            ref.invalidate(nutritionTodayProvider);
            ref.invalidate(recoveryTodayProvider);
            await Future.wait([
              ref.read(myWorkoutsProvider.future),
              ref.read(nutritionTodayProvider.future),
              ref.read(recoveryTodayProvider.future),
            ]);
          },
          child: CustomScrollView(
            physics: const AlwaysScrollableScrollPhysics(
              parent: BouncingScrollPhysics(),
            ),
            slivers: [
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(24, 12, 24, 0),
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const BrandLockup(
                              compact: true,
                              subtitle: null,
                            ),
                            Text(
                              'Hi, $name',
                              style: GoogleFonts.poppins(
                                color: AppColors.muted,
                                fontSize: 13,
                              ),
                            ),
                          ],
                        ),
                      ),
                      IconButton(
                        tooltip: 'Exercises',
                        onPressed: () => context.push('/exercises'),
                        icon: const Icon(Icons.search, color: AppColors.muted),
                      ),
                      GestureDetector(
                        onTap: () =>
                            ref.read(homeTabIndexProvider.notifier).set(3),
                        child: CircleAvatar(
                          radius: 18,
                          backgroundColor: AppColors.mint,
                          child: Text(
                            name.isNotEmpty ? name[0].toUpperCase() : 'A',
                            style: GoogleFonts.poppins(
                              color: AppColors.lime,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(24, 20, 24, 0),
                  child: mine.when(
                    loading: () => const _HeroSkeleton(),
                    error: (_, _) => _HeroCard(
                      eyebrow: 'TRAIN',
                      title: 'Ready when you are',
                      subtitle: 'Open Train to pick a program',
                      cta: 'Open Train',
                      onTap: () => context.push('/train'),
                    ),
                    data: (data) {
                      final session = data.todaySession;
                      if (session == null) {
                        return _HeroCard(
                          eyebrow: 'TODAY',
                          title: 'No session planned',
                          subtitle: data.activeProgramTitle ??
                              'Browse programs to get started',
                          cta: 'Browse programs',
                          onTap: () => context.push('/train'),
                        );
                      }
                      return _HeroCard(
                        eyebrow: session.status == 'COMPLETED'
                            ? 'DONE'
                            : "TODAY'S WORKOUT",
                        title: session.title,
                        subtitle: data.activeProgramTitle != null
                            ? 'Program · ${data.activeProgramTitle}'
                            : 'Day ${session.dayIndex + 1}',
                        cta: session.status == 'COMPLETED'
                            ? 'View Train'
                            : 'Start session',
                        onTap: () {
                          if (session.status == 'COMPLETED') {
                            context.push('/train');
                          } else {
                            context.push('/session/${session.id}');
                          }
                        },
                      );
                    },
                  ),
                ),
              ),
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(24, 18, 24, 0),
                  child: _MetricRow(
                    nutrition: nutrition,
                    recovery: recovery,
                  ),
                ),
              ),
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(24, 24, 24, 0),
                  child: Text(
                    'Quick access',
                    style: GoogleFonts.poppins(
                      color: AppColors.ink,
                      fontSize: 18,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ),
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(24, 12, 24, 0),
                  child: const _QuickGrid(),
                ),
              ),
              ContainedSliver(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(24, 24, 24, 120),
                  child: mine.when(
                    loading: () => const SizedBox.shrink(),
                    error: (_, _) => const SizedBox.shrink(),
                    data: (data) {
                      final sessions = data.sessions
                          .where((s) => s.status != 'SKIPPED')
                          .take(3)
                          .toList();
                      if (sessions.isEmpty) {
                        return const SizedBox.shrink();
                      }
                      return Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Text(
                                'Up next',
                                style: GoogleFonts.poppins(
                                  color: AppColors.ink,
                                  fontSize: 18,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                              const Spacer(),
                              TextButton(
                                onPressed: () => ref
                                    .read(homeTabIndexProvider.notifier)
                                    .set(1),
                                child: Text(
                                  'Full plan',
                                  style: GoogleFonts.poppins(
                                    color: AppColors.lime,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 8),
                          ...sessions.map(
                            (s) => _MiniSessionTile(session: s),
                          ),
                        ],
                      );
                    },
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Helper so we can use a non-sliver child without typing SliverToBoxAdapter.
class ContainedSliver extends StatelessWidget {
  const ContainedSliver({super.key, required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) => SliverToBoxAdapter(child: child);
}

class _HeroSkeleton extends StatelessWidget {
  const _HeroSkeleton();

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 148,
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(24),
      ),
    );
  }
}

class _HeroCard extends StatelessWidget {
  const _HeroCard({
    required this.eyebrow,
    required this.title,
    required this.subtitle,
    required this.cta,
    required this.onTap,
  });

  final String eyebrow;
  final String title;
  final String subtitle;
  final String cta;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: AppColors.surface,
      borderRadius: BorderRadius.circular(24),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(24),
        child: Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(24),
            border: Border.all(color: AppColors.line),
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                AppColors.mint,
                AppColors.surface,
                AppColors.lime.withValues(alpha: 0.08),
              ],
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                eyebrow,
                style: GoogleFonts.poppins(
                  color: AppColors.lime,
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 1.3,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                title,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: GoogleFonts.poppins(
                  color: AppColors.ink,
                  fontSize: 22,
                  fontWeight: FontWeight.w700,
                  height: 1.2,
                  letterSpacing: -0.3,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                subtitle,
                style: GoogleFonts.poppins(
                  color: AppColors.muted,
                  fontSize: 13,
                ),
              ),
              const SizedBox(height: 16),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                decoration: BoxDecoration(
                  color: AppColors.lime,
                  borderRadius: BorderRadius.circular(99),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      cta,
                      style: GoogleFonts.poppins(
                        color: AppColors.white,
                        fontWeight: FontWeight.w700,
                        fontSize: 13,
                      ),
                    ),
                    const SizedBox(width: 4),
                    const Icon(
                      Icons.arrow_forward_rounded,
                      size: 18,
                      color: AppColors.white,
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _MetricRow extends StatelessWidget {
  const _MetricRow({required this.nutrition, required this.recovery});

  final AsyncValue<NutritionToday> nutrition;
  final AsyncValue<RecoveryToday> recovery;

  @override
  Widget build(BuildContext context) {
    final kcal = nutrition.asData?.value;
    final rec = recovery.asData?.value;
    return Row(
      children: [
        Expanded(
          child: _MetricTile(
            label: 'Fuel',
            value: kcal == null
                ? '—'
                : '${kcal.calories.round()}',
            unit: kcal == null ? '' : '/ ${kcal.targetCalories.round()} kcal',
            onTap: () => context.push('/fuel'),
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: _MetricTile(
            label: 'Recovery',
            value: rec?.recoveryScore?.toString() ??
                (rec?.sleepHours?.toStringAsFixed(1) ?? '—'),
            unit: rec?.recoveryScore != null
                ? 'score'
                : (rec?.sleepHours != null ? 'h sleep' : ''),
            onTap: () => context.push('/recover'),
          ),
        ),
      ],
    );
  }
}

class _MetricTile extends StatelessWidget {
  const _MetricTile({
    required this.label,
    required this.value,
    required this.unit,
    required this.onTap,
  });

  final String label;
  final String value;
  final String unit;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: AppColors.surface,
      borderRadius: BorderRadius.circular(20),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(20),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label.toUpperCase(),
                style: GoogleFonts.poppins(
                  color: AppColors.muted,
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                  letterSpacing: 0.8,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                value,
                style: GoogleFonts.poppins(
                  color: AppColors.lime,
                  fontSize: 26,
                  fontWeight: FontWeight.w700,
                  height: 1,
                ),
              ),
              if (unit.isNotEmpty)
                Text(
                  unit,
                  style: GoogleFonts.poppins(
                    color: AppColors.muted,
                    fontSize: 11,
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _QuickGrid extends StatelessWidget {
  const _QuickGrid();

  @override
  Widget build(BuildContext context) {
    final items = [
      (Icons.fitness_center_rounded, 'Train', () => context.push('/train')),
      (Icons.restaurant_rounded, 'Fuel', () => context.push('/fuel')),
      (Icons.bedtime_rounded, 'Recover', () => context.push('/recover')),
      (Icons.chat_bubble_rounded, 'Coach', () => context.push('/coach')),
      (Icons.groups_rounded, 'Community', () => context.push('/community')),
      (Icons.monitor_heart_outlined, 'Vitals', () => context.push('/vitals')),
      (Icons.medication_rounded, 'Meds', () => context.push('/medications')),
      (Icons.timeline_rounded, 'Timeline', () => context.push('/health-timeline')),
      (Icons.auto_awesome_rounded, 'AI', () => context.push('/ai')),
      (Icons.sports_cricket, 'Cricket', () => context.push('/cricket')),
      (Icons.favorite_outline_rounded, 'Wellness', () => context.push('/wellness')),
    ];

    return GridView.count(
      crossAxisCount: 3,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      mainAxisSpacing: 10,
      crossAxisSpacing: 10,
      childAspectRatio: 1.05,
      children: [
        for (final item in items)
          Material(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(18),
            child: InkWell(
              onTap: item.$3,
              borderRadius: BorderRadius.circular(18),
              child: Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(color: AppColors.line),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(item.$1, color: AppColors.lime, size: 22),
                    const Spacer(),
                    Text(
                      item.$2,
                      style: GoogleFonts.poppins(
                        color: AppColors.ink,
                        fontWeight: FontWeight.w700,
                        fontSize: 13,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
      ],
    );
  }
}

class _MiniSessionTile extends StatelessWidget {
  const _MiniSessionTile({required this.session});
  final WorkoutSessionSummary session;

  @override
  Widget build(BuildContext context) {
    final done = session.status == 'COMPLETED';
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Material(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: () => context.push('/session/${session.id}'),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
            child: Row(
              children: [
                Icon(
                  done ? Icons.check_circle : Icons.play_circle_fill,
                  color: AppColors.lime,
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    session.title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: GoogleFonts.poppins(
                      color: AppColors.ink,
                      fontWeight: FontWeight.w600,
                      fontSize: 14,
                    ),
                  ),
                ),
                Text(
                  done ? 'Done' : 'Start',
                  style: GoogleFonts.poppins(
                    color: AppColors.muted,
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
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
