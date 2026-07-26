import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:primefit_mobile/core/theme/app_theme.dart';
import 'package:primefit_mobile/core/widgets/glass.dart';
import 'package:primefit_mobile/features/recovery/data/wearable_native_sync.dart';
import 'package:primefit_mobile/features/workouts/data/fitness_repository.dart';
import 'package:primefit_mobile/features/workouts/domain/workout_models.dart';

class RecoverScreen extends ConsumerStatefulWidget {
  const RecoverScreen({super.key});

  @override
  ConsumerState<RecoverScreen> createState() => _RecoverScreenState();
}

class _RecoverScreenState extends ConsumerState<RecoverScreen> {
  bool _syncing = false;
  String _provider = 'health_connect';

  Future<void> _sync() async {
    setState(() => _syncing = true);
    try {
      if (_provider == 'garmin' || _provider == 'whoop') {
        final oauth = await ref
            .read(fitnessRepositoryProvider)
            .startWearableOauth(_provider);
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(
                'OAuth ${oauth['mode']}: open ${oauth['authorizeUrl']}',
              ),
            ),
          );
        }
        // Stub complete so connection row appears in demos.
        await ref.read(fitnessRepositoryProvider).completeWearableOauth(
              _provider,
              code: 'demo-code',
              state: oauth['state']?.toString(),
            );
        await ref
            .read(fitnessRepositoryProvider)
            .syncWearableDemo(provider: _provider);
      } else {
        final native = await WearableNativeSync().readToday(provider: _provider);
        if (native != null) {
          await ref.read(fitnessRepositoryProvider).syncWearableNative({
            ...native,
            'provider': _provider,
          });
        } else {
          await ref
              .read(fitnessRepositoryProvider)
              .syncWearableDemo(provider: _provider);
        }
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(
                native != null
                    ? 'Synced from native $_provider'
                    : 'Synced demo from $_provider',
              ),
            ),
          );
        }
      }
      ref.invalidate(recoveryTodayProvider);
      ref.invalidate(recoveryHistoryProvider);
      ref.invalidate(intelligenceTodayProvider);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Sync failed: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _syncing = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final recovery = ref.watch(recoveryTodayProvider);
    final history = ref.watch(recoveryHistoryProvider);

    return DarkHubTheme(
      child: Scaffold(
      backgroundColor: AppColors.voidBlack,
      body: SafeArea(
        child: RefreshIndicator(
          color: AppColors.lime,
          onRefresh: () async {
            ref.invalidate(recoveryTodayProvider);
            ref.invalidate(recoveryHistoryProvider);
            await Future.wait([
              ref.read(recoveryTodayProvider.future),
              ref.read(recoveryHistoryProvider.future),
            ]);
          },
          child: ListView(
            padding: const EdgeInsets.fromLTRB(24, 16, 24, 32),
            children: [
              const DarkBackButton(),
              const SizedBox(height: 8),
              const Text(
                'RECOVER',
                style: TextStyle(
                  color: AppColors.white,
                  fontSize: 32,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 4),
              const Text(
                'Sleep, stress, and readiness from your wearables.',
                style: TextStyle(color: AppColors.muted),
              ),
              const SizedBox(height: 16),
              Consumer(
                builder: (context, ref, _) {
                  final intel = ref.watch(intelligenceTodayProvider);
                  return intel.when(
                    loading: () => const SizedBox.shrink(),
                    error: (_, _) => const SizedBox.shrink(),
                    data: (data) {
                      final signals =
                          (data['signals'] as List? ?? []).cast<Map>();
                      Map? injury;
                      Map? readiness;
                      for (final s in signals) {
                        if (s['type'] == 'INJURY_RISK') injury = s;
                        if (s['type'] == 'READINESS') readiness = s;
                      }
                      if (injury == null && readiness == null) {
                        return const SizedBox.shrink();
                      }
                      final band = '${injury?['band'] ?? readiness?['band'] ?? '—'}';
                      final score =
                          (injury?['score'] as num?)?.round() ??
                              (readiness?['score'] as num?)?.round();
                      final explain = injury?['explain'] as Map? ?? {};
                      final drivers =
                          (explain['drivers'] as List? ?? []).map((e) => '$e');
                      return Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: GlassCard(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text(
                                'Training stress / readiness',
                                style: TextStyle(
                                  fontWeight: FontWeight.w700,
                                  fontSize: 16,
                                ),
                              ),
                              const SizedBox(height: 6),
                              Text(
                                'Band $band · score ${score ?? '—'}',
                                style: const TextStyle(
                                  color: AppColors.lime,
                                  fontSize: 22,
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                              if (drivers.isNotEmpty) ...[
                                const SizedBox(height: 8),
                                const Text(
                                  'Why this score',
                                  style: TextStyle(color: AppColors.muted),
                                ),
                                ...drivers.map(
                                  (d) => Text(
                                    '· $d',
                                    style: const TextStyle(color: AppColors.soft),
                                  ),
                                ),
                              ],
                              const SizedBox(height: 8),
                              Text(
                                data['disclaimer']?.toString() ??
                                    'Wellness guidance only.',
                                style: const TextStyle(
                                  color: AppColors.muted,
                                  fontSize: 11,
                                ),
                              ),
                              TextButton(
                                onPressed: () async {
                                  await ref
                                      .read(fitnessRepositoryProvider)
                                      .runIntelligence();
                                  ref.invalidate(intelligenceTodayProvider);
                                },
                                child: const Text('Refresh intelligence'),
                              ),
                              TextButton(
                                onPressed: () async {
                                  await ref
                                      .read(fitnessRepositoryProvider)
                                      .createOutcomeLabel(
                                        kind: 'SORENESS',
                                        note: 'Athlete self-report from Recover',
                                      );
                                  if (context.mounted) {
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      const SnackBar(
                                        content: Text(
                                          'Soreness logged for future models',
                                        ),
                                      ),
                                    );
                                  }
                                },
                                child: const Text('Log soreness (optional)'),
                              ),
                            ],
                          ),
                        ),
                      );
                    },
                  );
                },
              ),
              recovery.when(
                loading: () => const Center(
                  child: CircularProgressIndicator(color: AppColors.lime),
                ),
                error: (e, _) =>
                    Text('$e', style: const TextStyle(color: AppColors.danger)),
                data: (data) => Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    GlassCard(
                      child: Row(
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text(
                                  'Recovery score',
                                  style: TextStyle(color: AppColors.muted),
                                ),
                                Text(
                                  '${data.recoveryScore ?? '—'}',
                                  style: const TextStyle(
                                    color: AppColors.lime,
                                    fontSize: 42,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                                Text(
                                  'Source: ${data.source ?? 'mock'}',
                                  style: const TextStyle(color: AppColors.soft),
                                ),
                              ],
                            ),
                          ),
                          ElevatedButton(
                            onPressed: _syncing ? null : _sync,
                            child: Text(_syncing ? 'Syncing…' : 'Sync'),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 12),
                    DropdownButtonFormField<String>(
                      // ignore: deprecated_member_use
                      value: _provider,
                      dropdownColor: AppColors.card,
                      style: const TextStyle(color: AppColors.white),
                      decoration: const InputDecoration(
                        labelText: 'Wearable provider',
                      ),
                      items: const [
                        DropdownMenuItem(
                          value: 'health_connect',
                          child: Text('Google Health Connect'),
                        ),
                        DropdownMenuItem(
                          value: 'apple_health',
                          child: Text('Apple Health'),
                        ),
                        DropdownMenuItem(
                          value: 'garmin',
                          child: Text('Garmin'),
                        ),
                        DropdownMenuItem(
                          value: 'whoop',
                          child: Text('WHOOP'),
                        ),
                      ],
                      onChanged: (v) =>
                          setState(() => _provider = v ?? 'health_connect'),
                    ),
                    const SizedBox(height: 16),
                    Wrap(
                      spacing: 10,
                      runSpacing: 10,
                      children: [
                        _Stat(label: 'Sleep', value: '${data.sleepHours ?? '—'}h'),
                        _Stat(label: 'Steps', value: '${data.steps ?? 0}'),
                        _Stat(label: 'RHR', value: '${data.restingHr ?? '—'}'),
                        _Stat(label: 'Stress', value: '${data.stressScore ?? '—'}'),
                        _Stat(label: 'HRV', value: '${data.hrvMs ?? '—'} ms'),
                        _Stat(label: 'Active', value: '${data.activeKcal ?? 0} kcal'),
                        _Stat(label: 'VO₂', value: '${data.vo2Max ?? '—'}'),
                        _Stat(label: 'SpO₂', value: '${data.spo2 ?? '—'}%'),
                        _Stat(
                          label: 'Load',
                          value: '${data.trainingLoad?.round() ?? '—'}',
                        ),
                      ],
                    ),
                    const SizedBox(height: 20),
                    const Text(
                      '7-day trend',
                      style: TextStyle(
                        color: AppColors.white,
                        fontSize: 20,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 8),
                    history.when(
                      loading: () =>
                          const LinearProgressIndicator(color: AppColors.lime),
                      error: (e, _) => Text('$e'),
                      data: (points) => _RecoveryChart(points: points),
                    ),
                    const SizedBox(height: 20),
                    const Text(
                      'Connected sources',
                      style: TextStyle(
                        color: AppColors.white,
                        fontSize: 20,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 8),
                    ...data.providers.map(
                      (p) => ListTile(
                        contentPadding: EdgeInsets.zero,
                        leading: Icon(
                          p.status == 'connected'
                              ? Icons.check_circle
                              : Icons.watch_outlined,
                          color: p.status == 'connected'
                              ? AppColors.lime
                              : AppColors.muted,
                        ),
                        title: Text(
                          p.label,
                          style: const TextStyle(color: AppColors.white),
                        ),
                        subtitle: Text(
                          p.status ?? 'not connected',
                          style: const TextStyle(color: AppColors.muted),
                        ),
                      ),
                    ),
                    const SizedBox(height: 12),
                    if (data.insights.isEmpty)
                      const GlassCard(
                        child: Text(
                          'Sync a wearable to get recovery insights.',
                          style: TextStyle(color: AppColors.soft),
                        ),
                      )
                    else
                      ...data.insights.map(
                        (insight) => Padding(
                          padding: const EdgeInsets.only(bottom: 10),
                          child: GlassCard(
                            child: Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Icon(
                                  Icons.tips_and_updates_outlined,
                                  color: AppColors.lime,
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Text(
                                    insight,
                                    style: const TextStyle(color: AppColors.soft),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                  ],
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

class _RecoveryChart extends StatelessWidget {
  const _RecoveryChart({required this.points});

  final List<RecoveryHistoryPoint> points;

  @override
  Widget build(BuildContext context) {
    if (points.isEmpty) {
      return const GlassCard(
        child: Text('No history yet', style: TextStyle(color: AppColors.soft)),
      );
    }

    final spots = <FlSpot>[];
    for (var i = 0; i < points.length; i++) {
      spots.add(
        FlSpot(i.toDouble(), (points[i].recoveryScore ?? 50).toDouble()),
      );
    }

    return SizedBox(
      height: 200,
      child: GlassCard(
        padding: const EdgeInsets.fromLTRB(12, 16, 16, 12),
        child: LineChart(
          LineChartData(
            minY: 0,
            maxY: 100,
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
                  interval: 1,
                  getTitlesWidget: (value, meta) {
                    final i = value.toInt();
                    if (i < 0 || i >= points.length) {
                      return const SizedBox.shrink();
                    }
                    final label = points[i].dateKey.substring(5);
                    return Text(
                      label,
                      style: const TextStyle(fontSize: 10, color: AppColors.muted),
                    );
                  },
                ),
              ),
            ),
            lineBarsData: [
              LineChartBarData(
                spots: spots,
                isCurved: true,
                color: AppColors.lime,
                barWidth: 3,
                dotData: const FlDotData(show: true),
                belowBarData: BarAreaData(
                  show: true,
                  color: AppColors.lime.withValues(alpha: 0.2),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Stat extends StatelessWidget {
  const _Stat({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 150,
      child: GlassCard(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label, style: const TextStyle(color: AppColors.muted)),
            const SizedBox(height: 4),
            Text(
              value,
              style: const TextStyle(
                color: AppColors.lime,
                fontSize: 22,
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
