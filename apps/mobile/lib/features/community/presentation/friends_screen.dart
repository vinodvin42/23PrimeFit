import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:primefit_mobile/core/theme/app_theme.dart';
import 'package:primefit_mobile/core/widgets/glass.dart';
import 'package:primefit_mobile/features/workouts/data/fitness_repository.dart';

class FriendsScreen extends ConsumerStatefulWidget {
  const FriendsScreen({super.key});

  @override
  ConsumerState<FriendsScreen> createState() => _FriendsScreenState();
}

class _FriendsScreenState extends ConsumerState<FriendsScreen> {
  String? _busyId;

  Future<void> _refresh() async {
    ref.invalidate(friendsProvider);
    ref.invalidate(tenantMembersProvider);
    await Future.wait([
      ref.read(friendsProvider.future),
      ref.read(tenantMembersProvider.future),
    ]);
  }

  Future<void> _send(String userId) async {
    setState(() => _busyId = userId);
    try {
      await ref.read(fitnessRepositoryProvider).sendFriendRequest(userId);
      await _refresh();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('$e')));
      }
    } finally {
      if (mounted) setState(() => _busyId = null);
    }
  }

  Future<void> _accept(String requestId) async {
    setState(() => _busyId = requestId);
    try {
      await ref.read(fitnessRepositoryProvider).acceptFriendRequest(requestId);
      await _refresh();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('$e')));
      }
    } finally {
      if (mounted) setState(() => _busyId = null);
    }
  }

  Future<void> _decline(String requestId) async {
    setState(() => _busyId = requestId);
    try {
      await ref
          .read(fitnessRepositoryProvider)
          .declineFriendRequest(requestId);
      await _refresh();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('$e')));
      }
    } finally {
      if (mounted) setState(() => _busyId = null);
    }
  }

  Future<void> _remove(String userId) async {
    setState(() => _busyId = userId);
    try {
      await ref.read(fitnessRepositoryProvider).removeFriend(userId);
      await _refresh();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('$e')));
      }
    } finally {
      if (mounted) setState(() => _busyId = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final friends = ref.watch(friendsProvider);
    final members = ref.watch(tenantMembersProvider);
    return DarkHubTheme(
      child: Scaffold(
        backgroundColor: AppColors.voidBlack,
        body: SafeArea(
          child: RefreshIndicator(
            color: AppColors.lime,
            onRefresh: _refresh,
            child: ListView(
              padding: const EdgeInsets.fromLTRB(24, 16, 24, 32),
              children: [
                const DarkBackButton(),
                const SizedBox(height: 8),
                const Text(
                  'FRIENDS',
                  style: TextStyle(
                    color: AppColors.white,
                    fontSize: 32,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 4),
                const Text(
                  'Only visible within your workspace — never across coaches.',
                  style: TextStyle(color: AppColors.mutedOnDark),
                ),
                const SizedBox(height: 16),
                friends.when(
                  loading: () => const Center(
                    child: CircularProgressIndicator(color: AppColors.lime),
                  ),
                  error: (e, _) => Text(
                    '$e',
                    style: const TextStyle(color: AppColors.danger),
                  ),
                  data: (data) {
                    final list = (data['friends'] as List? ?? [])
                        .whereType<Map<String, dynamic>>()
                        .toList();
                    final received = (data['pendingReceived'] as List? ?? [])
                        .whereType<Map<String, dynamic>>()
                        .toList();
                    final sent = (data['pendingSent'] as List? ?? [])
                        .whereType<Map<String, dynamic>>()
                        .toList();
                    return Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        if (received.isNotEmpty) ...[
                          const Text(
                            'Requests',
                            style: TextStyle(
                              color: AppColors.white,
                              fontSize: 18,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          const SizedBox(height: 8),
                          ...received.map((r) {
                            final requestId = r['requestId'] as String;
                            final busy = _busyId == requestId;
                            return Padding(
                              padding: const EdgeInsets.only(bottom: 6),
                              child: GlassCard(
                                padding: EdgeInsets.zero,
                                child: ListTile(
                                  title: Text(
                                    '${r['displayName'] ?? 'Member'}',
                                    style: const TextStyle(
                                      color: AppColors.white,
                                    ),
                                  ),
                                  trailing: Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      IconButton(
                                        icon: const Icon(Icons.check,
                                            color: AppColors.lime),
                                        onPressed: busy
                                            ? null
                                            : () => _accept(requestId),
                                      ),
                                      IconButton(
                                        icon: const Icon(Icons.close,
                                            color: AppColors.mutedOnDark),
                                        onPressed: busy
                                            ? null
                                            : () => _decline(requestId),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            );
                          }),
                          const SizedBox(height: 16),
                        ],
                        const Text(
                          'Friends',
                          style: TextStyle(
                            color: AppColors.white,
                            fontSize: 18,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        const SizedBox(height: 8),
                        if (list.isEmpty)
                          const GlassCard(
                            child: Text(
                              'No friends yet — add someone from your '
                              'workspace below.',
                              style: TextStyle(color: AppColors.soft),
                            ),
                          )
                        else
                          ...list.map((f) {
                            final userId = f['userId'] as String;
                            final busy = _busyId == userId;
                            return Padding(
                              padding: const EdgeInsets.only(bottom: 6),
                              child: GlassCard(
                                padding: EdgeInsets.zero,
                                child: ListTile(
                                  title: Text(
                                    '${f['displayName'] ?? 'Member'}',
                                    style: const TextStyle(
                                      color: AppColors.white,
                                    ),
                                  ),
                                  trailing: IconButton(
                                    icon: const Icon(
                                      Icons.person_remove_outlined,
                                      color: AppColors.mutedOnDark,
                                    ),
                                    onPressed:
                                        busy ? null : () => _remove(userId),
                                  ),
                                ),
                              ),
                            );
                          }),
                        if (sent.isNotEmpty) ...[
                          const SizedBox(height: 16),
                          const Text(
                            'Sent requests',
                            style: TextStyle(
                              color: AppColors.white,
                              fontSize: 18,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          const SizedBox(height: 8),
                          ...sent.map(
                            (r) => Padding(
                              padding: const EdgeInsets.only(bottom: 6),
                              child: GlassCard(
                                padding: EdgeInsets.zero,
                                child: ListTile(
                                  title: Text(
                                    '${r['displayName'] ?? 'Member'}',
                                    style: const TextStyle(
                                      color: AppColors.white,
                                    ),
                                  ),
                                  trailing: const Text(
                                    'Pending',
                                    style:
                                        TextStyle(color: AppColors.mutedOnDark),
                                  ),
                                ),
                              ),
                            ),
                          ),
                        ],
                      ],
                    );
                  },
                ),
                const SizedBox(height: 20),
                const Text(
                  'Your workspace',
                  style: TextStyle(
                    color: AppColors.white,
                    fontSize: 20,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 8),
                members.when(
                  loading: () =>
                      const LinearProgressIndicator(color: AppColors.lime),
                  error: (e, _) => Text(
                    '$e',
                    style: const TextStyle(color: AppColors.danger),
                  ),
                  data: (rows) {
                    if (rows.isEmpty) {
                      return const GlassCard(
                        child: Text(
                          'No other members in this workspace yet.',
                          style: TextStyle(color: AppColors.soft),
                        ),
                      );
                    }
                    return Column(
                      children: rows.map((m) {
                        final userId = m['userId'] as String;
                        final status =
                            m['friendStatus'] as Map<String, dynamic>?;
                        final busy = _busyId == userId;
                        return Padding(
                          padding: const EdgeInsets.only(bottom: 6),
                          child: GlassCard(
                            padding: EdgeInsets.zero,
                            child: ListTile(
                              title: Text(
                                '${m['displayName'] ?? 'Member'}',
                                style: const TextStyle(color: AppColors.white),
                              ),
                              trailing: status == null
                                  ? TextButton(
                                      onPressed:
                                          busy ? null : () => _send(userId),
                                      child: const Text('Add friend'),
                                    )
                                  : Text(
                                      status['status'] == 'ACCEPTED'
                                          ? 'Friends'
                                          : 'Pending',
                                      style: const TextStyle(
                                        color: AppColors.mutedOnDark,
                                      ),
                                    ),
                            ),
                          ),
                        );
                      }).toList(),
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
