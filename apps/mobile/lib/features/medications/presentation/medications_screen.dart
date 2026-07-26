import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:primefit_mobile/core/theme/app_theme.dart';
import 'package:primefit_mobile/core/widgets/glass.dart';
import 'package:primefit_mobile/features/workouts/data/fitness_repository.dart';

class MedicationsScreen extends ConsumerStatefulWidget {
  const MedicationsScreen({super.key});

  @override
  ConsumerState<MedicationsScreen> createState() => _MedicationsScreenState();
}

class _MedicationsScreenState extends ConsumerState<MedicationsScreen> {
  final _name = TextEditingController();
  final _dosage = TextEditingController();
  final _schedule = TextEditingController();
  bool _saving = false;
  String? _busyId;

  @override
  void dispose() {
    _name.dispose();
    _dosage.dispose();
    _schedule.dispose();
    super.dispose();
  }

  Future<void> _add() async {
    if (_name.text.trim().isEmpty) return;
    setState(() => _saving = true);
    try {
      await ref.read(fitnessRepositoryProvider).createMedication(
            name: _name.text.trim(),
            dosage: _dosage.text.trim(),
            schedule: _schedule.text.trim(),
          );
      _name.clear();
      _dosage.clear();
      _schedule.clear();
      ref.invalidate(medicationsProvider);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('$e')));
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _toggle(String id, bool takenToday) async {
    setState(() => _busyId = id);
    try {
      final repo = ref.read(fitnessRepositoryProvider);
      if (takenToday) {
        await repo.unlogMedicationTaken(id);
      } else {
        await repo.logMedicationTaken(id);
      }
      ref.invalidate(medicationsProvider);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('$e')));
      }
    } finally {
      if (mounted) setState(() => _busyId = null);
    }
  }

  Future<void> _remove(String id) async {
    setState(() => _busyId = id);
    try {
      await ref.read(fitnessRepositoryProvider).deactivateMedication(id);
      ref.invalidate(medicationsProvider);
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
    final medications = ref.watch(medicationsProvider);
    return DarkHubTheme(
      child: Scaffold(
        backgroundColor: AppColors.voidBlack,
        body: SafeArea(
          child: RefreshIndicator(
            color: AppColors.lime,
            onRefresh: () async {
              ref.invalidate(medicationsProvider);
              await ref.read(medicationsProvider.future);
            },
            child: ListView(
              padding: const EdgeInsets.fromLTRB(24, 16, 24, 32),
              children: [
                const DarkBackButton(),
                const SizedBox(height: 8),
                const Text(
                  'MEDICATIONS',
                  style: TextStyle(
                    color: AppColors.white,
                    fontSize: 32,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 4),
                const Text(
                  'A personal reminder log for what you take and when.',
                  style: TextStyle(color: AppColors.mutedOnDark),
                ),
                const SizedBox(height: 16),
                GlassCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Add medication',
                        style: TextStyle(
                          color: AppColors.white,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(height: 10),
                      TextField(
                        controller: _name,
                        style: const TextStyle(color: AppColors.white),
                        decoration: const InputDecoration(hintText: 'Name'),
                      ),
                      const SizedBox(height: 8),
                      TextField(
                        controller: _dosage,
                        style: const TextStyle(color: AppColors.white),
                        decoration: const InputDecoration(
                          hintText: 'Dosage (optional)',
                        ),
                      ),
                      const SizedBox(height: 8),
                      TextField(
                        controller: _schedule,
                        style: const TextStyle(color: AppColors.white),
                        decoration: const InputDecoration(
                          hintText: 'Schedule (optional, e.g. morning)',
                        ),
                      ),
                      const SizedBox(height: 10),
                      ElevatedButton(
                        onPressed: _saving ? null : _add,
                        child: Text(_saving ? 'Adding…' : 'Add medication'),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 20),
                const Text(
                  "Today's checklist",
                  style: TextStyle(
                    color: AppColors.white,
                    fontSize: 20,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 8),
                medications.when(
                  loading: () => const Center(
                    child: CircularProgressIndicator(color: AppColors.lime),
                  ),
                  error: (e, _) => Text(
                    '$e',
                    style: const TextStyle(color: AppColors.danger),
                  ),
                  data: (data) {
                    final items = (data['medications'] as List? ?? [])
                        .whereType<Map<String, dynamic>>()
                        .toList();
                    if (items.isEmpty) {
                      return const GlassCard(
                        child: Text(
                          'No medications yet — add one above to start tracking.',
                          style: TextStyle(color: AppColors.soft),
                        ),
                      );
                    }
                    return Column(
                      children: items.map((m) {
                        final id = m['id'] as String;
                        final takenToday =
                            m['takenToday'] as bool? ?? false;
                        final busy = _busyId == id;
                        final subtitle = [
                          if ((m['dosage'] as String?)?.isNotEmpty == true)
                            '${m['dosage']}',
                          if ((m['schedule'] as String?)?.isNotEmpty ==
                              true)
                            '${m['schedule']}',
                        ].join(' · ');
                        return Padding(
                          padding: const EdgeInsets.only(bottom: 8),
                          child: GlassCard(
                            padding: EdgeInsets.zero,
                            child: ListTile(
                              leading: Checkbox(
                                value: takenToday,
                                activeColor: AppColors.lime,
                                onChanged: busy
                                    ? null
                                    : (_) => _toggle(id, takenToday),
                              ),
                              title: Text(
                                '${m['name']}',
                                style: TextStyle(
                                  color: AppColors.white,
                                  decoration: takenToday
                                      ? TextDecoration.lineThrough
                                      : null,
                                ),
                              ),
                              subtitle: subtitle.isEmpty
                                  ? null
                                  : Text(
                                      subtitle,
                                      style: const TextStyle(
                                        color: AppColors.mutedOnDark,
                                      ),
                                    ),
                              trailing: IconButton(
                                icon: const Icon(
                                  Icons.close,
                                  color: AppColors.mutedOnDark,
                                ),
                                onPressed: busy ? null : () => _remove(id),
                              ),
                            ),
                          ),
                        );
                      }).toList(),
                    );
                  },
                ),
                const SizedBox(height: 16),
                medications.when(
                  loading: () => const SizedBox.shrink(),
                  error: (_, __) => const SizedBox.shrink(),
                  data: (data) => Text(
                    '${data['disclaimer']}',
                    style: const TextStyle(
                      color: AppColors.mutedOnDark,
                      fontSize: 12,
                    ),
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
