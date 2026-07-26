import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:primefit_mobile/core/theme/app_theme.dart';
import 'package:primefit_mobile/core/widgets/glass.dart';
import 'package:primefit_mobile/features/workouts/data/fitness_repository.dart';

class AiHubScreen extends ConsumerStatefulWidget {
  const AiHubScreen({super.key});

  @override
  ConsumerState<AiHubScreen> createState() => _AiHubScreenState();
}

class _AiHubScreenState extends ConsumerState<AiHubScreen> {
  Map<String, dynamic>? _data;
  bool _loading = true;
  bool _busy = false;
  String? _error;
  int _tab = 0; // 0 fitness, 1 diet, 2 other

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final data = await ref.read(fitnessRepositoryProvider).aiDashboard();
      if (mounted) setState(() => _data = data);
    } catch (e) {
      if (mounted) setState(() => _error = '$e');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _generate() async {
    setState(() => _busy = true);
    try {
      final data =
          await ref.read(fitnessRepositoryProvider).generateAiInsights();
      if (mounted) setState(() => _data = data);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('$e')),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  List<Map<String, dynamic>> get _insights {
    final all = (_data?['insights'] as List? ?? [])
        .whereType<Map<String, dynamic>>()
        .toList();
    return all.where((i) {
      final cat = '${i['category']}'.toLowerCase();
      return switch (_tab) {
        0 => cat.contains('workout') ||
            cat.contains('fitness') ||
            cat.contains('recovery') ||
            cat.contains('train'),
        1 => cat.contains('nutrition') ||
            cat.contains('diet') ||
            cat.contains('metabolic') ||
            cat.contains('meal'),
        _ => true,
      };
    }).toList();
  }

  /// Emulator-friendly destinations — do not force body-scan / camera.
  String _tabAction(int tab) => switch (tab) {
        1 => '/fuel',
        2 => '/recover',
        _ => '/train',
      };

  @override
  Widget build(BuildContext context) {
    final bio = _data?['biologicalAge'] as Map<String, dynamic>?;
    final insights = _insights;
    final featured = insights.isNotEmpty ? insights.first : null;
    final grid = insights.skip(1).take(2).toList();
    final rest = insights.skip(3).toList();

    return Scaffold(
      backgroundColor: AppColors.voidBlack,
      body: SafeArea(
        child: RefreshIndicator(
          color: AppColors.lime,
          backgroundColor: AppColors.card,
          onRefresh: _load,
          child: ListView(
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
            children: [
              Row(
                children: [
                  const DarkBackButton(),
                  const Expanded(
                    child: Text(
                      'AI Suggestion',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontWeight: FontWeight.w700,
                        fontSize: 18,
                      ),
                    ),
                  ),
                  IconButton(
                    onPressed: _busy ? null : _generate,
                    icon: const Icon(Icons.auto_awesome, color: AppColors.lime),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              _SegmentTabs(
                index: _tab,
                onChanged: (i) => setState(() => _tab = i),
              ),
              const SizedBox(height: 20),
              if (_loading) const LinearProgressIndicator(color: AppColors.lime),
              if (_error != null)
                Text(_error!, style: const TextStyle(color: AppColors.danger)),
              _FeaturedCard(
                title: featured?['title']?.toString() ?? 'Increase Calorie',
                subtitle: featured?['body']?.toString() ??
                    'Gain muscle with extra calorie intake timed around training.',
                tab: _tab,
                onTap: () => context.push(_tabAction(_tab)),
              ),
              const SizedBox(height: 22),
              const Text(
                'All Suggestion',
                style: TextStyle(fontWeight: FontWeight.w700, fontSize: 18),
              ),
              const SizedBox(height: 12),
              SizedBox(
                height: 148,
                child: ListView(
                  scrollDirection: Axis.horizontal,
                  children: [
                    if (grid.isEmpty) ...[
                      _MiniSuggestionCard(
                        icon: Icons.fitness_center,
                        title: 'Take Less Breaks, More Exercise',
                        subtitle: 'Open Train',
                        onTap: () => context.push('/train'),
                      ),
                      _MiniSuggestionCard(
                        icon: Icons.apple,
                        title: 'Less Fat, More Protein',
                        subtitle: 'Open Fuel',
                        onTap: () => context.push('/fuel'),
                      ),
                    ] else
                      ...grid.map(
                        (i) => _MiniSuggestionCard(
                          icon: i['severity'] == 'alert'
                              ? Icons.warning_amber
                              : Icons.bolt,
                          title: '${i['title']}',
                          subtitle: '${i['body']}',
                          onTap: () => context.push(_tabAction(_tab)),
                        ),
                      ),
                    _MiniSuggestionCard(
                      icon: Icons.accessibility_new,
                      title: 'Body Analysis Scan',
                      subtitle: 'Optional demo — no photo needed',
                      onTap: () => context.push('/assessment'),
                    ),
                    _MiniSuggestionCard(
                      icon: Icons.bloodtype_outlined,
                      title: 'Blood Reports',
                      subtitle: 'Optional lab upload',
                      onTap: () => context.push('/blood-reports'),
                    ),
                    _MiniSuggestionCard(
                      icon: Icons.chat_bubble_outline,
                      title: 'Talk to your coach',
                      subtitle: 'Chat & book a consult',
                      onTap: () => context.push('/coach'),
                    ),
                    _MiniSuggestionCard(
                      icon: Icons.bedtime_outlined,
                      title: 'Check recovery',
                      subtitle: 'Sleep & readiness',
                      onTap: () => context.push('/recover'),
                    ),
                    _MiniSuggestionCard(
                      icon: Icons.emoji_events_outlined,
                      title: 'Community',
                      subtitle: 'Challenges & streaks',
                      onTap: () => context.push('/community'),
                    ),
                    _MiniSuggestionCard(
                      icon: Icons.medication_outlined,
                      title: 'Medications',
                      subtitle: 'Reminder log, not a prescription',
                      onTap: () => context.push('/medications'),
                    ),
                    _MiniSuggestionCard(
                      icon: Icons.favorite_border,
                      title: 'Vitals',
                      subtitle: 'Blood pressure & sugar trends',
                      onTap: () => context.push('/vitals'),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 22),
              Row(
                children: [
                  const Expanded(
                    child: Text(
                      'Suggestion',
                      style:
                          TextStyle(fontWeight: FontWeight.w700, fontSize: 18),
                    ),
                  ),
                  TextButton(
                    onPressed: _busy ? null : _generate,
                    child: const Text(
                      'View All',
                      style: TextStyle(color: AppColors.lime),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              if (rest.isEmpty)
                _SuggestionRow(
                  icon: Icons.self_improvement,
                  title: 'Do Proper Stretching',
                  subtitle: 'Do 10m of proper stretching!',
                  onTap: () => context.push('/recover'),
                )
              else
                ...rest.map(
                  (i) => Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: _SuggestionRow(
                      icon: Icons.auto_awesome,
                      title: '${i['title']}',
                      subtitle: '${i['body']}',
                      onTap: () => context.push(_tabAction(_tab)),
                    ),
                  ),
                ),
              const SizedBox(height: 16),
              Consumer(
                builder: (context, ref, _) {
                  final intel = ref.watch(intelligenceTodayProvider);
                  return intel.when(
                    loading: () => const SizedBox.shrink(),
                    error: (_, _) => const SizedBox.shrink(),
                    data: (data) {
                      final preds =
                          (data['predictions'] as List? ?? []).cast<Map>();
                      if (preds.isEmpty) return const SizedBox.shrink();
                      return Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'Predictive outlook',
                            style: TextStyle(
                              fontWeight: FontWeight.w700,
                              fontSize: 18,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            data['disclaimer']?.toString() ??
                                'Rules-based forecasts — not medical predictions.',
                            style: const TextStyle(
                              color: AppColors.muted,
                              fontSize: 12,
                            ),
                          ),
                          const SizedBox(height: 10),
                          ...preds.map((p) {
                            final hours = p['horizonHours'];
                            final metric = p['metric'];
                            final value = p['predictedValue'];
                            final conf = p['confidence'];
                            final version = p['modelVersion'] ?? 'rules-v1';
                            return Padding(
                              padding: const EdgeInsets.only(bottom: 8),
                              child: GlassCard(
                                padding: const EdgeInsets.all(14),
                                child: Row(
                                  children: [
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            '$metric · ${hours}h',
                                            style: const TextStyle(
                                              fontWeight: FontWeight.w700,
                                            ),
                                          ),
                                          Text(
                                            'Forecast ${value ?? '—'} · confidence $conf · $version',
                                            style: const TextStyle(
                                              color: AppColors.muted,
                                              fontSize: 12,
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            );
                          }),
                          TextButton(
                            onPressed: () => context.push('/cricket'),
                            child: const Text('Open cricket analytics'),
                          ),
                          const SizedBox(height: 12),
                        ],
                      );
                    },
                  );
                },
              ),
              GlassCard(
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'Biological age',
                            style: TextStyle(color: AppColors.muted),
                          ),
                          Text(
                            bio == null ? '—' : '${bio['biologicalAge']} yrs',
                            style: const TextStyle(
                              color: AppColors.lime,
                              fontSize: 28,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                        ],
                      ),
                    ),
                    NeonCircleButton(
                      icon: Icons.refresh,
                      onPressed: _busy
                          ? null
                          : () async {
                              setState(() => _busy = true);
                              try {
                                await ref
                                    .read(fitnessRepositoryProvider)
                                    .calculateBiologicalAge();
                                await _load();
                                ref.invalidate(intelligenceTodayProvider);
                              } finally {
                                if (mounted) setState(() => _busy = false);
                              }
                            },
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

class _SegmentTabs extends StatelessWidget {
  const _SegmentTabs({required this.index, required this.onChanged});

  final int index;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) {
    const labels = ['Fitness', 'Diet', 'Other'];
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(28),
      ),
      child: Row(
        children: List.generate(labels.length, (i) {
          final selected = index == i;
          return Expanded(
            child: GestureDetector(
              onTap: () => onChanged(i),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                padding: const EdgeInsets.symmetric(vertical: 12),
                decoration: BoxDecoration(
                  color: selected ? AppColors.lime : Colors.transparent,
                  borderRadius: BorderRadius.circular(24),
                ),
                alignment: Alignment.center,
                child: Text(
                  labels[i],
                  style: TextStyle(
                    fontWeight: FontWeight.w700,
                    color:
                        selected ? AppColors.voidBlack : AppColors.muted,
                  ),
                ),
              ),
            ),
          );
        }),
      ),
    );
  }
}

class _FeaturedCard extends StatelessWidget {
  const _FeaturedCard({
    required this.title,
    required this.subtitle,
    required this.tab,
    required this.onTap,
  });

  final String title;
  final String subtitle;
  final int tab;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(28),
      child: Stack(
        children: [
          Container(
            height: 210,
            width: double.infinity,
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [
                  const Color(0xFF2A2A2A),
                  AppColors.voidBlack,
                  tab == 1 ? const Color(0xFF1A2A12) : const Color(0xFF1A1F2A),
                ],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
            ),
            child: CustomPaint(painter: _MeshPainter()),
          ),
          Positioned(
            left: 16,
            top: 16,
            child: Row(
              children: [
                _Tag(
                  icon: tab == 1 ? Icons.restaurant : Icons.fitness_center,
                  label: tab == 1 ? 'Diet' : 'Habit',
                ),
                const SizedBox(width: 8),
                const _Tag(icon: Icons.auto_awesome, label: 'AI'),
              ],
            ),
          ),
          Positioned(
            left: 20,
            right: 80,
            bottom: 20,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 26,
                    fontWeight: FontWeight.w800,
                    color: AppColors.white,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  subtitle,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(color: AppColors.soft),
                ),
              ],
            ),
          ),
          Positioned(
            right: 16,
            bottom: 16,
            child: NeonCircleButton(
              icon: Icons.arrow_forward,
              onPressed: onTap,
            ),
          ),
        ],
      ),
    );
  }
}

class _Tag extends StatelessWidget {
  const _Tag({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: Colors.black.withValues(alpha: 0.45),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: AppColors.lime),
          const SizedBox(width: 4),
          Text(label, style: const TextStyle(fontSize: 12)),
        ],
      ),
    );
  }
}

class _MiniSuggestionCard extends StatelessWidget {
  const _MiniSuggestionCard({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(right: 12),
      child: SizedBox(
        width: 170,
        child: GlassCard(
          onTap: onTap,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: AppColors.lime.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(icon, color: AppColors.lime),
              ),
              const Spacer(),
              Text(
                title,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: 4),
              Text(
                subtitle,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(color: AppColors.muted, fontSize: 12),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _SuggestionRow extends StatelessWidget {
  const _SuggestionRow({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GlassCard(
      onTap: onTap,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: AppColors.lime.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Icon(icon, color: AppColors.lime),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: const TextStyle(fontWeight: FontWeight.w700)),
                Text(
                  subtitle,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(color: AppColors.muted, fontSize: 13),
                ),
              ],
            ),
          ),
          const Icon(Icons.chevron_right, color: AppColors.muted),
        ],
      ),
    );
  }
}

class _MeshPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = AppColors.lime.withValues(alpha: 0.08)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1;
    for (var i = 0; i < 8; i++) {
      final y = size.height * (i / 7);
      canvas.drawLine(Offset(0, y), Offset(size.width, y), paint);
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
