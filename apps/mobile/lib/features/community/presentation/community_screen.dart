import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:primefit_mobile/core/theme/app_theme.dart';
import 'package:primefit_mobile/core/widgets/glass.dart';
import 'package:primefit_mobile/features/workouts/data/fitness_repository.dart';

class CommunityScreen extends ConsumerStatefulWidget {
  const CommunityScreen({super.key});

  @override
  ConsumerState<CommunityScreen> createState() => _CommunityScreenState();
}

class _CommunityScreenState extends ConsumerState<CommunityScreen> {
  List<Map<String, dynamic>> _challenges = [];
  List<Map<String, dynamic>> _achievements = [];
  List<Map<String, dynamic>> _events = [];
  int _streakDays = 0;
  bool _loading = true;
  String? _error;
  String? _busyChallengeId;
  String? _busyEventId;

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
      final repo = ref.read(fitnessRepositoryProvider);
      final results = await Future.wait([
        repo.listChallenges(),
        repo.listAchievements(),
        repo.communityStreak(),
        repo.listEvents(),
      ]);
      if (!mounted) return;
      setState(() {
        _challenges = results[0] as List<Map<String, dynamic>>;
        _achievements = results[1] as List<Map<String, dynamic>>;
        _streakDays = (results[2] as Map<String, dynamic>)['streakDays']
                as int? ??
            0;
        _events = results[3] as List<Map<String, dynamic>>;
      });
    } catch (e) {
      if (mounted) setState(() => _error = '$e');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _rsvp(String eventId, String status) async {
    setState(() => _busyEventId = eventId);
    try {
      await ref.read(fitnessRepositoryProvider).rsvpEvent(eventId, status);
      await _load();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('$e')));
      }
    } finally {
      if (mounted) setState(() => _busyEventId = null);
    }
  }

  Future<void> _join(String id) async {
    setState(() => _busyChallengeId = id);
    try {
      await ref.read(fitnessRepositoryProvider).joinChallenge(id);
      await _load();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('$e')));
      }
    } finally {
      if (mounted) setState(() => _busyChallengeId = null);
    }
  }

  Future<void> _logProgress(String id) async {
    setState(() => _busyChallengeId = id);
    try {
      await ref.read(fitnessRepositoryProvider).logChallengeProgress(id, 1);
      await _load();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('$e')));
      }
    } finally {
      if (mounted) setState(() => _busyChallengeId = null);
    }
  }

  Future<void> _showLeaderboard(String id, String title) async {
    try {
      final result =
          await ref.read(fitnessRepositoryProvider).challengeLeaderboard(id);
      final rows =
          (result['leaderboard'] as List? ?? []).whereType<Map>().toList();
      if (!mounted) return;
      await showModalBottomSheet<void>(
        context: context,
        backgroundColor: AppColors.card,
        builder: (context) => SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    color: AppColors.white,
                    fontSize: 18,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 12),
                if (rows.isEmpty)
                  const Text(
                    'No one has joined yet — be the first!',
                    style: TextStyle(color: AppColors.mutedOnDark),
                  )
                else
                  ...rows.map(
                    (r) => ListTile(
                      contentPadding: EdgeInsets.zero,
                      leading: CircleAvatar(
                        backgroundColor: AppColors.lime,
                        child: Text(
                          '${r['rank']}',
                          style: const TextStyle(
                            color: AppColors.voidBlack,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                      title: Text(
                        '${r['displayName'] ?? 'Member'}',
                        style: const TextStyle(color: AppColors.white),
                      ),
                      trailing: Text(
                        '${r['progressValue']}',
                        style: const TextStyle(
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
      );
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('$e')));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return DarkHubTheme(
      child: Scaffold(
        backgroundColor: AppColors.voidBlack,
        body: SafeArea(
          child: RefreshIndicator(
            color: AppColors.lime,
            onRefresh: _load,
            child: ListView(
              padding: const EdgeInsets.fromLTRB(24, 16, 24, 32),
              children: [
                const DarkBackButton(),
                const SizedBox(height: 8),
                const Text(
                  'COMMUNITY',
                  style: TextStyle(
                    color: AppColors.white,
                    fontSize: 32,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 4),
                const Text(
                  'Join challenges, climb the leaderboard, keep your streak.',
                  style: TextStyle(color: AppColors.mutedOnDark),
                ),
                const SizedBox(height: 12),
                GlassCard(
                  onTap: () => context.push('/friends'),
                  child: const Row(
                    children: [
                      Icon(Icons.people_outline, color: AppColors.lime),
                      SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          'Friends',
                          style: TextStyle(
                            color: AppColors.white,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                      Icon(Icons.chevron_right, color: AppColors.mutedOnDark),
                    ],
                  ),
                ),
                const SizedBox(height: 8),
                GlassCard(
                  onTap: () => context.push('/stories'),
                  child: const Row(
                    children: [
                      Icon(Icons.auto_awesome, color: AppColors.lime),
                      SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          'Transformation Stories',
                          style: TextStyle(
                            color: AppColors.white,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                      Icon(Icons.chevron_right, color: AppColors.mutedOnDark),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                if (_loading)
                  const LinearProgressIndicator(color: AppColors.lime),
                if (_error != null)
                  Text(_error!, style: const TextStyle(color: AppColors.danger)),
                const SizedBox(height: 12),
                GlassCard(
                  child: Row(
                    children: [
                      const Icon(
                        Icons.local_fire_department,
                        color: AppColors.lime,
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          _streakDays > 0
                              ? '$_streakDays-day workout streak'
                              : 'Log a workout today to start a streak',
                          style: const TextStyle(
                            color: AppColors.white,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 20),
                const Text(
                  'Achievements',
                  style: TextStyle(
                    color: AppColors.white,
                    fontSize: 20,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 8),
                if (_achievements.isEmpty)
                  const GlassCard(
                    child: Text(
                      'No badges yet — join a challenge or build a streak.',
                      style: TextStyle(color: AppColors.soft),
                    ),
                  )
                else
                  SizedBox(
                    height: 88,
                    child: ListView.separated(
                      scrollDirection: Axis.horizontal,
                      itemCount: _achievements.length,
                      separatorBuilder: (_, __) => const SizedBox(width: 10),
                      itemBuilder: (context, i) {
                        final a = _achievements[i];
                        return GlassCard(
                          padding: const EdgeInsets.all(10),
                          radius: 14,
                          child: SizedBox(
                            width: 120,
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                const Icon(
                                  Icons.emoji_events,
                                  color: AppColors.lime,
                                ),
                                const SizedBox(height: 6),
                                Text(
                                  '${a['title']}',
                                  textAlign: TextAlign.center,
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(
                                    color: AppColors.white,
                                    fontSize: 12,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        );
                      },
                    ),
                  ),
                const SizedBox(height: 20),
                const Text(
                  'Events',
                  style: TextStyle(
                    color: AppColors.white,
                    fontSize: 20,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 8),
                if (_events.isEmpty)
                  const GlassCard(
                    child: Text(
                      'No upcoming events — check back soon.',
                      style: TextStyle(color: AppColors.soft),
                    ),
                  )
                else
                  ..._events.map((e) {
                    final id = e['id'] as String;
                    final myRsvp = e['myRsvp'] as String?;
                    final busy = _busyEventId == id;
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: GlassCard(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Expanded(
                                  child: Text(
                                    '${e['title']}',
                                    style: const TextStyle(
                                      color: AppColors.white,
                                      fontWeight: FontWeight.w700,
                                      fontSize: 16,
                                    ),
                                  ),
                                ),
                                Text(
                                  '${e['attendeeCount']} going',
                                  style: const TextStyle(
                                    color: AppColors.mutedOnDark,
                                    fontSize: 12,
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 4),
                            Text(
                              [
                                '${e['startAt']}',
                                if ((e['location'] as String?)
                                        ?.isNotEmpty ==
                                    true)
                                  '${e['location']}',
                              ].join(' · '),
                              style: const TextStyle(
                                color: AppColors.mutedOnDark,
                              ),
                            ),
                            if ((e['description'] as String?)
                                    ?.isNotEmpty ==
                                true) ...[
                              const SizedBox(height: 6),
                              Text(
                                '${e['description']}',
                                style: const TextStyle(color: AppColors.soft),
                              ),
                            ],
                            const SizedBox(height: 10),
                            Row(
                              children: [
                                ChoiceChip(
                                  label: const Text('Going'),
                                  selected: myRsvp == 'GOING',
                                  onSelected: busy
                                      ? null
                                      : (_) => _rsvp(id, 'GOING'),
                                ),
                                const SizedBox(width: 8),
                                ChoiceChip(
                                  label: const Text('Maybe'),
                                  selected: myRsvp == 'MAYBE',
                                  onSelected: busy
                                      ? null
                                      : (_) => _rsvp(id, 'MAYBE'),
                                ),
                                const SizedBox(width: 8),
                                ChoiceChip(
                                  label: const Text('Can\'t go'),
                                  selected: myRsvp == 'DECLINED',
                                  onSelected: busy
                                      ? null
                                      : (_) => _rsvp(id, 'DECLINED'),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    );
                  }),
                const SizedBox(height: 20),
                const Text(
                  'Challenges',
                  style: TextStyle(
                    color: AppColors.white,
                    fontSize: 20,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 8),
                if (_challenges.isEmpty)
                  const GlassCard(
                    child: Text(
                      'No challenges yet — check back soon.',
                      style: TextStyle(color: AppColors.soft),
                    ),
                  )
                else
                  ..._challenges.map((c) {
                    final id = c['id'] as String;
                    final target = c['targetValue'] as int? ?? 1;
                    final myProgress =
                        c['myProgress'] as Map<String, dynamic>?;
                    final joined = myProgress != null;
                    final progressValue =
                        myProgress?['progressValue'] as int? ?? 0;
                    final completed = myProgress?['completedAt'] != null;
                    final busy = _busyChallengeId == id;
                    final ratio = target > 0
                        ? (progressValue / target).clamp(0, 1).toDouble()
                        : 0.0;
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: GlassCard(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Expanded(
                                  child: Text(
                                    '${c['title']}',
                                    style: const TextStyle(
                                      color: AppColors.white,
                                      fontWeight: FontWeight.w700,
                                      fontSize: 16,
                                    ),
                                  ),
                                ),
                                Text(
                                  '${c['participantCount']} joined',
                                  style: const TextStyle(
                                    color: AppColors.mutedOnDark,
                                    fontSize: 12,
                                  ),
                                ),
                              ],
                            ),
                            if ((c['description'] as String?)
                                    ?.isNotEmpty ==
                                true) ...[
                              const SizedBox(height: 4),
                              Text(
                                '${c['description']}',
                                style:
                                    const TextStyle(color: AppColors.soft),
                              ),
                            ],
                            const SizedBox(height: 10),
                            if (joined) ...[
                              ClipRRect(
                                borderRadius: BorderRadius.circular(8),
                                child: LinearProgressIndicator(
                                  value: ratio,
                                  minHeight: 8,
                                  backgroundColor: Colors.white12,
                                  color: AppColors.lime,
                                ),
                              ),
                              const SizedBox(height: 6),
                              Text(
                                completed
                                    ? 'Completed 🎉'
                                    : '$progressValue / $target',
                                style:
                                    const TextStyle(color: AppColors.mutedOnDark),
                              ),
                            ],
                            const SizedBox(height: 10),
                            Row(
                              children: [
                                if (!joined)
                                  ElevatedButton(
                                    onPressed:
                                        busy ? null : () => _join(id),
                                    child: Text(busy ? 'Joining…' : 'Join'),
                                  )
                                else if (!completed)
                                  ElevatedButton(
                                    onPressed:
                                        busy ? null : () => _logProgress(id),
                                    child: Text(busy ? 'Logging…' : '+1 progress'),
                                  ),
                                const SizedBox(width: 8),
                                TextButton(
                                  onPressed: () => _showLeaderboard(
                                    id,
                                    '${c['title']}',
                                  ),
                                  child: const Text('Leaderboard'),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    );
                  }),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
