import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:primefit_mobile/core/theme/app_theme.dart';
import 'package:primefit_mobile/core/widgets/glass.dart';
import 'package:primefit_mobile/features/workouts/data/fitness_repository.dart';

class VitalsScreen extends StatefulWidget {
  const VitalsScreen({super.key});

  @override
  State<VitalsScreen> createState() => _VitalsScreenState();
}

class _VitalsScreenState extends State<VitalsScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabs;

  @override
  void initState() {
    super.initState();
    _tabs = TabController(length: 3, vsync: this);
  }

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return DarkHubTheme(
      child: Scaffold(
        backgroundColor: AppColors.voidBlack,
        body: SafeArea(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(24, 16, 24, 0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const DarkBackButton(),
                    const SizedBox(height: 8),
                    const Text(
                      'VITALS',
                      style: TextStyle(
                        color: AppColors.white,
                        fontSize: 32,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 4),
                    const Text(
                      'A personal trend log — not a diagnosis.',
                      style: TextStyle(color: AppColors.mutedOnDark),
                    ),
                  ],
                ),
              ),
              TabBar(
                controller: _tabs,
                isScrollable: true,
                labelColor: AppColors.lime,
                unselectedLabelColor: AppColors.mutedOnDark,
                indicatorColor: AppColors.lime,
                tabs: const [
                  Tab(text: 'Blood pressure'),
                  Tab(text: 'Blood sugar'),
                  Tab(text: 'Allergies'),
                ],
              ),
              Expanded(
                child: TabBarView(
                  controller: _tabs,
                  children: const [
                    _BloodPressureTab(),
                    _BloodSugarTab(),
                    _AllergiesTab(),
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

class _BloodPressureTab extends ConsumerStatefulWidget {
  const _BloodPressureTab();

  @override
  ConsumerState<_BloodPressureTab> createState() => _BloodPressureTabState();
}

class _BloodPressureTabState extends ConsumerState<_BloodPressureTab> {
  final _systolic = TextEditingController();
  final _diastolic = TextEditingController();
  final _pulse = TextEditingController();
  bool _saving = false;
  String? _busyId;

  @override
  void dispose() {
    _systolic.dispose();
    _diastolic.dispose();
    _pulse.dispose();
    super.dispose();
  }

  Future<void> _add() async {
    final systolic = int.tryParse(_systolic.text.trim());
    final diastolic = int.tryParse(_diastolic.text.trim());
    if (systolic == null || diastolic == null) return;
    setState(() => _saving = true);
    try {
      await ref.read(fitnessRepositoryProvider).logBloodPressure(
            systolic: systolic,
            diastolic: diastolic,
            pulseBpm: int.tryParse(_pulse.text.trim()),
          );
      _systolic.clear();
      _diastolic.clear();
      _pulse.clear();
      ref.invalidate(bloodPressureProvider);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('$e')));
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _remove(String id) async {
    setState(() => _busyId = id);
    try {
      await ref.read(fitnessRepositoryProvider).removeBloodPressure(id);
      ref.invalidate(bloodPressureProvider);
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
    final data = ref.watch(bloodPressureProvider);
    return RefreshIndicator(
      color: AppColors.lime,
      onRefresh: () async {
        ref.invalidate(bloodPressureProvider);
        await ref.read(bloodPressureProvider.future);
      },
      child: ListView(
        padding: const EdgeInsets.all(24),
        children: [
          GlassCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Log a reading',
                  style: TextStyle(
                    color: AppColors.white,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: _systolic,
                        keyboardType: TextInputType.number,
                        style: const TextStyle(color: AppColors.white),
                        decoration:
                            const InputDecoration(hintText: 'Systolic'),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: TextField(
                        controller: _diastolic,
                        keyboardType: TextInputType.number,
                        style: const TextStyle(color: AppColors.white),
                        decoration:
                            const InputDecoration(hintText: 'Diastolic'),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: TextField(
                        controller: _pulse,
                        keyboardType: TextInputType.number,
                        style: const TextStyle(color: AppColors.white),
                        decoration: const InputDecoration(
                          hintText: 'Pulse (opt.)',
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                ElevatedButton(
                  onPressed: _saving ? null : _add,
                  child: Text(_saving ? 'Saving…' : 'Save reading'),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          data.when(
            loading: () => const Center(
              child: CircularProgressIndicator(color: AppColors.lime),
            ),
            error: (e, _) =>
                Text('$e', style: const TextStyle(color: AppColors.danger)),
            data: (payload) {
              final readings = (payload['readings'] as List? ?? [])
                  .whereType<Map<String, dynamic>>()
                  .toList();
              return Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (readings.isEmpty)
                    const GlassCard(
                      child: Text(
                        'No readings yet.',
                        style: TextStyle(color: AppColors.soft),
                      ),
                    )
                  else
                    ...readings.map((r) {
                      final id = r['id'] as String;
                      final pulse = r['pulseBpm'];
                      return Padding(
                        padding: const EdgeInsets.only(bottom: 6),
                        child: GlassCard(
                          padding: EdgeInsets.zero,
                          child: ListTile(
                            title: Text(
                              '${r['systolic']}/${r['diastolic']} mmHg',
                              style: const TextStyle(color: AppColors.white),
                            ),
                            subtitle: Text(
                              pulse == null
                                  ? '${r['recordedAt']}'
                                  : '$pulse bpm · ${r['recordedAt']}',
                              style: const TextStyle(color: AppColors.mutedOnDark),
                            ),
                            trailing: IconButton(
                              icon: const Icon(Icons.close,
                                  color: AppColors.mutedOnDark),
                              onPressed: _busyId == id
                                  ? null
                                  : () => _remove(id),
                            ),
                          ),
                        ),
                      );
                    }),
                  const SizedBox(height: 12),
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
    );
  }
}

class _BloodSugarTab extends ConsumerStatefulWidget {
  const _BloodSugarTab();

  @override
  ConsumerState<_BloodSugarTab> createState() => _BloodSugarTabState();
}

class _BloodSugarTabState extends ConsumerState<_BloodSugarTab> {
  final _value = TextEditingController();
  String _context = 'fasting';
  bool _saving = false;
  String? _busyId;

  @override
  void dispose() {
    _value.dispose();
    super.dispose();
  }

  Future<void> _add() async {
    final value = double.tryParse(_value.text.trim());
    if (value == null) return;
    setState(() => _saving = true);
    try {
      await ref
          .read(fitnessRepositoryProvider)
          .logBloodSugar(valueMgDl: value, context: _context);
      _value.clear();
      ref.invalidate(bloodSugarProvider);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('$e')));
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _remove(String id) async {
    setState(() => _busyId = id);
    try {
      await ref.read(fitnessRepositoryProvider).removeBloodSugar(id);
      ref.invalidate(bloodSugarProvider);
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
    final data = ref.watch(bloodSugarProvider);
    return RefreshIndicator(
      color: AppColors.lime,
      onRefresh: () async {
        ref.invalidate(bloodSugarProvider);
        await ref.read(bloodSugarProvider.future);
      },
      child: ListView(
        padding: const EdgeInsets.all(24),
        children: [
          GlassCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Log a reading',
                  style: TextStyle(
                    color: AppColors.white,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: _value,
                        keyboardType:
                            const TextInputType.numberWithOptions(
                          decimal: true,
                        ),
                        style: const TextStyle(color: AppColors.white),
                        decoration:
                            const InputDecoration(hintText: 'mg/dL'),
                      ),
                    ),
                    const SizedBox(width: 8),
                    DropdownButton<String>(
                      // ignore: deprecated_member_use
                      value: _context,
                      dropdownColor: AppColors.card,
                      style: const TextStyle(color: AppColors.white),
                      items: const [
                        DropdownMenuItem(
                          value: 'fasting',
                          child: Text('Fasting'),
                        ),
                        DropdownMenuItem(
                          value: 'post-meal',
                          child: Text('Post-meal'),
                        ),
                        DropdownMenuItem(
                          value: 'random',
                          child: Text('Random'),
                        ),
                      ],
                      onChanged: (v) =>
                          setState(() => _context = v ?? 'fasting'),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                ElevatedButton(
                  onPressed: _saving ? null : _add,
                  child: Text(_saving ? 'Saving…' : 'Save reading'),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          data.when(
            loading: () => const Center(
              child: CircularProgressIndicator(color: AppColors.lime),
            ),
            error: (e, _) =>
                Text('$e', style: const TextStyle(color: AppColors.danger)),
            data: (payload) {
              final readings = (payload['readings'] as List? ?? [])
                  .whereType<Map<String, dynamic>>()
                  .toList();
              return Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (readings.isEmpty)
                    const GlassCard(
                      child: Text(
                        'No readings yet.',
                        style: TextStyle(color: AppColors.soft),
                      ),
                    )
                  else
                    ...readings.map((r) {
                      final id = r['id'] as String;
                      return Padding(
                        padding: const EdgeInsets.only(bottom: 6),
                        child: GlassCard(
                          padding: EdgeInsets.zero,
                          child: ListTile(
                            title: Text(
                              '${r['valueMgDl']} mg/dL',
                              style: const TextStyle(color: AppColors.white),
                            ),
                            subtitle: Text(
                              '${r['context'] ?? 'random'} · ${r['recordedAt']}',
                              style: const TextStyle(color: AppColors.mutedOnDark),
                            ),
                            trailing: IconButton(
                              icon: const Icon(Icons.close,
                                  color: AppColors.mutedOnDark),
                              onPressed: _busyId == id
                                  ? null
                                  : () => _remove(id),
                            ),
                          ),
                        ),
                      );
                    }),
                  const SizedBox(height: 12),
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
    );
  }
}

class _AllergiesTab extends ConsumerStatefulWidget {
  const _AllergiesTab();

  @override
  ConsumerState<_AllergiesTab> createState() => _AllergiesTabState();
}

class _AllergiesTabState extends ConsumerState<_AllergiesTab> {
  final _allergen = TextEditingController();
  final _reaction = TextEditingController();
  String _severity = 'MILD';
  bool _saving = false;
  String? _busyId;

  @override
  void dispose() {
    _allergen.dispose();
    _reaction.dispose();
    super.dispose();
  }

  Future<void> _add() async {
    if (_allergen.text.trim().isEmpty) return;
    setState(() => _saving = true);
    try {
      await ref.read(fitnessRepositoryProvider).addAllergy(
            allergen: _allergen.text.trim(),
            severity: _severity,
            reaction: _reaction.text.trim(),
          );
      _allergen.clear();
      _reaction.clear();
      ref.invalidate(allergiesProvider);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('$e')));
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _remove(String id) async {
    setState(() => _busyId = id);
    try {
      await ref.read(fitnessRepositoryProvider).removeAllergy(id);
      ref.invalidate(allergiesProvider);
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
    final data = ref.watch(allergiesProvider);
    return RefreshIndicator(
      color: AppColors.lime,
      onRefresh: () async {
        ref.invalidate(allergiesProvider);
        await ref.read(allergiesProvider.future);
      },
      child: ListView(
        padding: const EdgeInsets.all(24),
        children: [
          GlassCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Add allergy',
                  style: TextStyle(
                    color: AppColors.white,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: _allergen,
                        style: const TextStyle(color: AppColors.white),
                        decoration:
                            const InputDecoration(hintText: 'Allergen'),
                      ),
                    ),
                    const SizedBox(width: 8),
                    DropdownButton<String>(
                      // ignore: deprecated_member_use
                      value: _severity,
                      dropdownColor: AppColors.card,
                      style: const TextStyle(color: AppColors.white),
                      items: const [
                        DropdownMenuItem(value: 'MILD', child: Text('Mild')),
                        DropdownMenuItem(
                          value: 'MODERATE',
                          child: Text('Moderate'),
                        ),
                        DropdownMenuItem(
                          value: 'SEVERE',
                          child: Text('Severe'),
                        ),
                      ],
                      onChanged: (v) =>
                          setState(() => _severity = v ?? 'MILD'),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: _reaction,
                  style: const TextStyle(color: AppColors.white),
                  decoration: const InputDecoration(
                    hintText: 'Reaction (optional)',
                  ),
                ),
                const SizedBox(height: 10),
                ElevatedButton(
                  onPressed: _saving ? null : _add,
                  child: Text(_saving ? 'Saving…' : 'Add allergy'),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          data.when(
            loading: () => const Center(
              child: CircularProgressIndicator(color: AppColors.lime),
            ),
            error: (e, _) =>
                Text('$e', style: const TextStyle(color: AppColors.danger)),
            data: (payload) {
              final allergies = (payload['allergies'] as List? ?? [])
                  .whereType<Map<String, dynamic>>()
                  .toList();
              return Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (allergies.isEmpty)
                    const GlassCard(
                      child: Text(
                        'No allergies logged yet.',
                        style: TextStyle(color: AppColors.soft),
                      ),
                    )
                  else
                    ...allergies.map((a) {
                      final id = a['id'] as String;
                      final reaction = a['reaction'] as String?;
                      return Padding(
                        padding: const EdgeInsets.only(bottom: 6),
                        child: GlassCard(
                          padding: EdgeInsets.zero,
                          child: ListTile(
                            title: Text(
                              '${a['allergen']}',
                              style: const TextStyle(color: AppColors.white),
                            ),
                            subtitle: Text(
                              [
                                '${a['severity']}'.toLowerCase(),
                                if (reaction != null && reaction.isNotEmpty)
                                  reaction,
                              ].join(' · '),
                              style: const TextStyle(
                                color: AppColors.mutedOnDark,
                              ),
                            ),
                            trailing: IconButton(
                              icon: const Icon(Icons.close,
                                  color: AppColors.mutedOnDark),
                              onPressed: _busyId == id
                                  ? null
                                  : () => _remove(id),
                            ),
                          ),
                        ),
                      );
                    }),
                  const SizedBox(height: 12),
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
    );
  }
}
