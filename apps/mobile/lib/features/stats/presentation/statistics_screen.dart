import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import 'package:primefit_mobile/core/theme/app_theme.dart';
import 'package:primefit_mobile/features/workouts/data/fitness_repository.dart';

class StatisticsScreen extends ConsumerStatefulWidget {
  const StatisticsScreen({super.key});

  @override
  ConsumerState<StatisticsScreen> createState() => _StatisticsScreenState();
}

class _StatisticsScreenState extends ConsumerState<StatisticsScreen> {
  int _range = 1; // default week

  @override
  Widget build(BuildContext context) {
    final nutrition = ref.watch(nutritionTodayProvider);
    final recovery = ref.watch(recoveryTodayProvider);
    final history = ref.watch(recoveryHistoryProvider);

    final calories = nutrition.maybeWhen(
      data: (d) => d.calories.round(),
      orElse: () => 0,
    );
    final protein = nutrition.maybeWhen(
      data: (d) => d.proteinG.round(),
      orElse: () => 0,
    );
    final targetKcal = nutrition.maybeWhen(
      data: (d) => d.targetCalories.round(),
      orElse: () => 2000,
    );
    final steps = recovery.maybeWhen(
      data: (d) => d.steps ?? 0,
      orElse: () => 0,
    );
    final sleep = recovery.maybeWhen(
      data: (d) => d.sleepHours,
      orElse: () => null,
    );
    final score = recovery.maybeWhen(
      data: (d) => d.recoveryScore,
      orElse: () => null,
    );

    final bars = history.maybeWhen(
      data: (points) {
        if (points.isEmpty) return List<double>.filled(7, 0.15);
        final vals = points.take(7).map((p) {
          return ((p.steps ?? 0) / 10000.0).clamp(0.08, 1.0);
        }).toList();
        while (vals.length < 7) {
          vals.add(0.12);
        }
        return vals;
      },
      orElse: () => <double>[0.25, 0.3, 0.22, 0.28, 0.85, 0.2, 0.18],
    );

    return Scaffold(
      backgroundColor: AppColors.canvas,
      body: SafeArea(
        bottom: false,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(24, 12, 24, 120),
          children: [
            Text(
              DateFormat('EEEE · d MMM').format(DateTime.now()).toUpperCase(),
              style: GoogleFonts.poppins(
                color: AppColors.lime,
                fontSize: 11,
                fontWeight: FontWeight.w700,
                letterSpacing: 1.2,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              'Performance',
              style: GoogleFonts.poppins(
                color: AppColors.ink,
                fontSize: 30,
                fontWeight: FontWeight.w700,
                letterSpacing: -0.5,
              ),
            ),
            const SizedBox(height: 18),
            Container(
              padding: const EdgeInsets.all(4),
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(999),
                border: Border.all(color: AppColors.line),
              ),
              child: Row(
                children: [
                  for (final entry in [(0, 'Day'), (1, 'Week'), (2, 'Month')])
                    Expanded(
                      child: GestureDetector(
                        onTap: () => setState(() => _range = entry.$1),
                        child: AnimatedContainer(
                          duration: const Duration(milliseconds: 180),
                          padding: const EdgeInsets.symmetric(vertical: 10),
                          decoration: BoxDecoration(
                            color: _range == entry.$1
                                ? AppColors.lime
                                : Colors.transparent,
                            borderRadius: BorderRadius.circular(999),
                          ),
                          child: Text(
                            entry.$2,
                            textAlign: TextAlign.center,
                            style: GoogleFonts.poppins(
                              color: _range == entry.$1
                                  ? AppColors.white
                                  : AppColors.muted,
                              fontWeight: FontWeight.w700,
                              fontSize: 13,
                            ),
                          ),
                        ),
                      ),
                    ),
                ],
              ),
            ),
            const SizedBox(height: 20),
            Row(
              children: [
                Expanded(
                  child: _StatTile(
                    label: 'Calories',
                    value: '$calories',
                    hint: 'of $targetKcal',
                    onTap: () => context.push('/fuel'),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: _StatTile(
                    label: 'Protein',
                    value: '${protein}g',
                    hint: 'today',
                    onTap: () => context.push('/fuel'),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                  child: _StatTile(
                    label: 'Steps',
                    value: NumberFormat.compact().format(steps),
                    hint: 'activity',
                    onTap: () => context.push('/recover'),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: _StatTile(
                    label: 'Recovery',
                    value: score?.toString() ??
                        (sleep?.toStringAsFixed(1) ?? '—'),
                    hint: score != null ? 'score' : 'sleep h',
                    onTap: () => context.push('/recover'),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 20),
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(24),
                border: Border.all(color: AppColors.line),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Activity load',
                    style: GoogleFonts.poppins(
                      color: AppColors.ink,
                      fontWeight: FontWeight.w700,
                      fontSize: 16,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Relative steps over the last 7 days',
                    style: GoogleFonts.poppins(
                      color: AppColors.muted,
                      fontSize: 12,
                    ),
                  ),
                  const SizedBox(height: 18),
                  SizedBox(
                    height: 150,
                    child: BarChart(
                      BarChartData(
                        maxY: 1,
                        gridData: const FlGridData(show: false),
                        borderData: FlBorderData(show: false),
                        titlesData: FlTitlesData(
                          topTitles: const AxisTitles(
                            sideTitles: SideTitles(showTitles: false),
                          ),
                          rightTitles: const AxisTitles(
                            sideTitles: SideTitles(showTitles: false),
                          ),
                          leftTitles: const AxisTitles(
                            sideTitles: SideTitles(showTitles: false),
                          ),
                          bottomTitles: AxisTitles(
                            sideTitles: SideTitles(
                              showTitles: true,
                              getTitlesWidget: (v, _) {
                                const labels = [
                                  'M',
                                  'T',
                                  'W',
                                  'T',
                                  'F',
                                  'S',
                                  'S',
                                ];
                                final i = v.toInt();
                                if (i < 0 || i >= labels.length) {
                                  return const SizedBox.shrink();
                                }
                                return Padding(
                                  padding: const EdgeInsets.only(top: 8),
                                  child: Text(
                                    labels[i],
                                    style: GoogleFonts.poppins(
                                      color: AppColors.muted,
                                      fontSize: 11,
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                );
                              },
                            ),
                          ),
                        ),
                        barGroups: [
                          for (var i = 0; i < bars.length; i++)
                            BarChartGroupData(
                              x: i,
                              barRods: [
                                BarChartRodData(
                                  toY: bars[i],
                                  width: 14,
                                  borderRadius: BorderRadius.circular(8),
                                  color: i == 4
                                      ? AppColors.lime
                                      : AppColors.lime.withValues(alpha: 0.35),
                                ),
                              ],
                            ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            FilledButton.icon(
              onPressed: () => context.push('/progress'),
              icon: const Icon(Icons.photo_camera_outlined),
              label: const Text('Progress check-in'),
            ),
          ],
        ),
      ),
    );
  }
}

class _StatTile extends StatelessWidget {
  const _StatTile({
    required this.label,
    required this.value,
    required this.hint,
    required this.onTap,
  });

  final String label;
  final String value;
  final String hint;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: AppColors.surface,
      borderRadius: BorderRadius.circular(20),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(20),
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: AppColors.line),
          ),
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
              const SizedBox(height: 4),
              Text(
                hint,
                style: GoogleFonts.poppins(
                  color: AppColors.muted,
                  fontSize: 12,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
