import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:primefit_mobile/core/offline/offline_outbox.dart';
import 'package:primefit_mobile/core/theme/app_theme.dart';
import 'package:primefit_mobile/core/widgets/glass.dart';
import 'package:primefit_mobile/features/nutrition/presentation/barcode_scan_screen.dart';
import 'package:primefit_mobile/features/workouts/data/fitness_repository.dart';

class FuelScreen extends ConsumerStatefulWidget {
  const FuelScreen({super.key});

  @override
  ConsumerState<FuelScreen> createState() => _FuelScreenState();
}

class _FuelScreenState extends ConsumerState<FuelScreen>
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
                    'FUEL',
                    style: TextStyle(
                      color: AppColors.white,
                      fontSize: 32,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 4),
                  const Text(
                    'Log meals, scan barcodes, and follow your meal plan.',
                    style: TextStyle(color: AppColors.muted),
                  ),
                ],
              ),
            ),
            TabBar(
              controller: _tabs,
              labelColor: AppColors.lime,
              unselectedLabelColor: AppColors.muted,
              indicatorColor: AppColors.lime,
              tabs: const [
                Tab(text: 'Today'),
                Tab(text: 'Add'),
                Tab(text: 'Recipes'),
              ],
            ),
            Expanded(
              child: TabBarView(
                controller: _tabs,
                children: const [
                  _TodayTab(),
                  _AddFoodTab(),
                  _RecipesTab(),
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

class _TodayTab extends ConsumerWidget {
  const _TodayTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final nutrition = ref.watch(nutritionTodayProvider);
    return RefreshIndicator(
      color: AppColors.lime,
      onRefresh: () async {
        ref.invalidate(nutritionTodayProvider);
        await ref.read(nutritionTodayProvider.future);
      },
      child: ListView(
        padding: const EdgeInsets.all(24),
        children: [
          nutrition.when(
            loading: () => const Center(
              child: CircularProgressIndicator(color: AppColors.lime),
            ),
            error: (e, _) =>
                Text('$e', style: const TextStyle(color: AppColors.danger)),
            data: (data) {
              final pct =
                  (data.calories / data.targetCalories).clamp(0, 1).toDouble();
              return Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  GlassCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '${data.calories.round()} / ${data.targetCalories.round()} kcal',
                          style: const TextStyle(
                            color: AppColors.white,
                            fontSize: 28,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        const SizedBox(height: 8),
                        LinearProgressIndicator(
                          value: pct,
                          minHeight: 10,
                          borderRadius: BorderRadius.circular(8),
                          color: AppColors.lime,
                          backgroundColor: AppColors.card,
                        ),
                        const SizedBox(height: 12),
                        Text(
                          'P ${data.proteinG.round()}g · C ${data.carbsG.round()}g · F ${data.fatG.round()}g',
                          style: const TextStyle(color: AppColors.soft),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 20),
                  const Text("Today's log", style: TextStyle(color: AppColors.white, fontSize: 20, fontWeight: FontWeight.w700)),
                  const SizedBox(height: 8),
                  if (data.logs.isEmpty)
                    const GlassCard(
                      child: Text(
                        'Nothing logged yet. Use the Add tab to search foods or scan a barcode.',
                        style: TextStyle(color: AppColors.soft),
                      ),
                    )
                  else
                    ...data.logs.map(
                      (log) => Dismissible(
                        key: ValueKey(log.id),
                        direction: DismissDirection.endToStart,
                        onDismissed: (_) async {
                          if (log.id.isEmpty) return;
                          await ref
                              .read(fitnessRepositoryProvider)
                              .deleteFoodLog(log.id);
                          ref.invalidate(nutritionTodayProvider);
                        },
                        background: Container(
                          color: AppColors.danger,
                          alignment: Alignment.centerRight,
                          padding: const EdgeInsets.only(right: 16),
                          child: const Icon(Icons.delete, color: Colors.white),
                        ),
                        child: ListTile(
                          contentPadding: EdgeInsets.zero,
                          leading: CircleAvatar(
                            backgroundColor: AppColors.lime.withValues(alpha: 0.25),
                            foregroundColor: AppColors.lime,
                            child: Text(log.mealType[0].toUpperCase()),
                          ),
                          title: Text(
                            log.name,
                            style: const TextStyle(color: AppColors.white),
                          ),
                          subtitle: Text(
                            log.mealType,
                            style: const TextStyle(color: AppColors.muted),
                          ),
                          trailing: Text(
                            '${log.calories.round()} kcal',
                            style: const TextStyle(color: AppColors.lime),
                          ),
                        ),
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

class _AddFoodTab extends ConsumerStatefulWidget {
  const _AddFoodTab();

  @override
  ConsumerState<_AddFoodTab> createState() => _AddFoodTabState();
}

class _AddFoodTabState extends ConsumerState<_AddFoodTab> {
  final _q = TextEditingController(text: 'yogurt');
  final _barcode = TextEditingController();
  String _mealType = 'snack';
  List<FoodSearchItem> _results = [];
  bool _loading = false;
  String? _error;

  @override
  void dispose() {
    _q.dispose();
    _barcode.dispose();
    super.dispose();
  }

  Future<void> _search() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final items =
          await ref.read(fitnessRepositoryProvider).searchFoods(_q.text.trim());
      setState(() => _results = items);
    } catch (e) {
      setState(() => _error = '$e');
    } finally {
      setState(() => _loading = false);
    }
  }

  Future<void> _scanBarcode() async {
    final code = _barcode.text.trim();
    if (code.isEmpty) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final item =
          await ref.read(fitnessRepositoryProvider).lookupBarcode(code);
      setState(() => _results = [item]);
    } catch (e) {
      setState(() => _error = '$e');
    } finally {
      setState(() => _loading = false);
    }
  }

  Future<void> _openCameraScan() async {
    try {
      final code = await Navigator.of(context).push<String>(
        MaterialPageRoute(builder: (_) => const BarcodeScanScreen()),
      );
      if (code == null || code.isEmpty) return;
      _barcode.text = code;
      await _scanBarcode();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'Camera scan unavailable on this device/emulator. Enter a barcode manually. ($e)',
          ),
        ),
      );
    }
  }

  Future<void> _log(FoodSearchItem item) async {
    final outbox = ref.read(offlineOutboxProvider);
    await ref.read(fitnessRepositoryProvider).addFoodLog(
          foodItemId: item.id,
          mealType: _mealType,
          outbox: outbox,
        );
    ref.invalidate(nutritionTodayProvider);
    ref.invalidate(pendingSyncCountProvider);
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Logged ${item.name}')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(24),
      children: [
        DropdownButtonFormField<String>(
          // ignore: deprecated_member_use
          value: _mealType,
          dropdownColor: AppColors.card,
          style: const TextStyle(color: AppColors.white),
          decoration: const InputDecoration(labelText: 'Meal'),
          items: const [
            DropdownMenuItem(value: 'breakfast', child: Text('Breakfast')),
            DropdownMenuItem(value: 'lunch', child: Text('Lunch')),
            DropdownMenuItem(value: 'snack', child: Text('Snack')),
            DropdownMenuItem(value: 'dinner', child: Text('Dinner')),
          ],
          onChanged: (v) => setState(() => _mealType = v ?? 'snack'),
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: TextField(
                controller: _q,
                style: const TextStyle(color: AppColors.white),
                decoration: const InputDecoration(
                  hintText: 'Search Open Food Facts…',
                ),
                onSubmitted: (_) => _search(),
              ),
            ),
            const SizedBox(width: 8),
            ElevatedButton(
              onPressed: _loading ? null : _search,
              child: const Text('Search'),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: TextField(
                controller: _barcode,
                keyboardType: TextInputType.number,
                style: const TextStyle(color: AppColors.white),
                decoration: const InputDecoration(
                  hintText: 'Barcode (e.g. 3017620422003)',
                ),
                onSubmitted: (_) => _scanBarcode(),
              ),
            ),
            const SizedBox(width: 8),
            OutlinedButton(
              onPressed: _loading ? null : _scanBarcode,
              child: const Text('Lookup'),
            ),
            const SizedBox(width: 8),
            IconButton.filled(
              onPressed: _loading ? null : _openCameraScan,
              style: IconButton.styleFrom(backgroundColor: AppColors.lime),
              icon: const Icon(Icons.qr_code_scanner, color: AppColors.voidBlack),
              tooltip: 'Camera scan',
            ),
          ],
        ),
        if (_loading)
          const Padding(
            padding: EdgeInsets.only(top: 12),
            child: LinearProgressIndicator(color: AppColors.lime),
          ),
        if (_error != null)
          Padding(
            padding: const EdgeInsets.only(top: 12),
            child: Text(_error!, style: const TextStyle(color: AppColors.danger)),
          ),
        const SizedBox(height: 12),
        if (_results.isEmpty && !_loading)
          const GlassCard(
            child: Text(
              'Search a food or enter a barcode (e.g. 3017620422003). Camera scan is optional and often unavailable on emulators.',
              style: TextStyle(color: AppColors.soft),
            ),
          ),
        ..._results.map(
          (item) => ListTile(
            contentPadding: EdgeInsets.zero,
            leading: item.imageUrl == null
                ? const Icon(Icons.restaurant, color: AppColors.lime)
                : Image.network(
                    item.imageUrl!,
                    width: 40,
                    height: 40,
                    errorBuilder: (c, e, s) =>
                        const Icon(Icons.restaurant, color: AppColors.lime),
                  ),
            title: Text(item.name, style: const TextStyle(color: AppColors.white)),
            subtitle: Text(
              '${item.brand ?? item.source ?? 'food'} · ${item.calories.round()} kcal · ${item.servingLabel}',
              style: const TextStyle(color: AppColors.muted),
            ),
            trailing: IconButton(
              icon: const Icon(Icons.add_circle, color: AppColors.lime),
              onPressed: () => _log(item),
            ),
          ),
        ),
      ],
    );
  }
}

class _RecipesTab extends ConsumerStatefulWidget {
  const _RecipesTab();

  @override
  ConsumerState<_RecipesTab> createState() => _RecipesTabState();
}

class _RecipesTabState extends ConsumerState<_RecipesTab> {
  final _remoteQ = TextEditingController(text: 'chicken');
  List<Map<String, dynamic>> _remote = [];
  String _remoteSource = '';
  bool _remoteLoading = false;

  @override
  void dispose() {
    _remoteQ.dispose();
    super.dispose();
  }

  Future<void> _loadRemote() async {
    setState(() => _remoteLoading = true);
    try {
      final data = await ref
          .read(fitnessRepositoryProvider)
          .searchRemoteRecipes(_remoteQ.text.trim());
      if (!mounted) return;
      setState(() {
        _remote = (data['items'] as List? ?? [])
            .whereType<Map<String, dynamic>>()
            .toList();
        _remoteSource = '${data['source'] ?? ''}';
      });
    } catch (_) {
      if (mounted) setState(() => _remote = []);
    } finally {
      if (mounted) setState(() => _remoteLoading = false);
    }
  }

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadRemote());
  }

  @override
  Widget build(BuildContext context) {
    final recipes = ref.watch(recipesProvider);
    final plans = ref.watch(mealPlansProvider);

    return ListView(
      padding: const EdgeInsets.all(24),
      children: [
        const Text('Meal plans', style: TextStyle(color: AppColors.white, fontSize: 20, fontWeight: FontWeight.w700)),
        const SizedBox(height: 8),
        plans.when(
          loading: () => const LinearProgressIndicator(color: AppColors.lime),
          error: (e, _) => Text('$e', style: const TextStyle(color: AppColors.danger)),
          data: (items) => items.isEmpty
              ? const GlassCard(
                  child: Text(
                    'No meal plans seeded yet.',
                    style: TextStyle(color: AppColors.soft),
                  ),
                )
              : Column(
                  children: items
                      .map(
                        (p) => GlassCard(
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
                              '${p.dailyKcal} kcal/day · ${p.description}',
                              style: const TextStyle(color: AppColors.muted),
                            ),
                            trailing: TextButton(
                              onPressed: () async {
                                await ref
                                    .read(fitnessRepositoryProvider)
                                    .assignMealPlan(p.slug);
                                ref.invalidate(nutritionTodayProvider);
                                if (context.mounted) {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    SnackBar(content: Text('Assigned ${p.title}')),
                                  );
                                }
                              },
                              child: const Text('Use'),
                            ),
                          ),
                        ),
                      )
                      .toList(),
                ),
        ),
        const SizedBox(height: 20),
        const Text('Remote recipes', style: TextStyle(color: AppColors.white, fontSize: 20, fontWeight: FontWeight.w700)),
        const SizedBox(height: 4),
        Text(
          _remoteSource.isEmpty
              ? 'Spoonacular when keyed, else seeded fallback.'
              : 'Source: $_remoteSource',
          style: const TextStyle(color: AppColors.muted, fontSize: 12),
        ),
        const SizedBox(height: 8),
        Row(
          children: [
            Expanded(
              child: TextField(
                controller: _remoteQ,
                style: const TextStyle(color: AppColors.white),
                decoration: const InputDecoration(hintText: 'Search remote…'),
                onSubmitted: (_) => _loadRemote(),
              ),
            ),
            const SizedBox(width: 8),
            ElevatedButton(
              onPressed: _remoteLoading ? null : _loadRemote,
              child: const Text('Go'),
            ),
          ],
        ),
        if (_remoteLoading) const LinearProgressIndicator(color: AppColors.lime),
        ..._remote.map(
          (r) => Padding(
            padding: const EdgeInsets.only(top: 8),
            child: GlassCard(
              padding: EdgeInsets.zero,
              child: ListTile(
                title: Text(
                  '${r['title']}',
                  style: const TextStyle(
                    color: AppColors.white,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                subtitle: Text(
                  [
                    if (r['readyInMinutes'] != null) '${r['readyInMinutes']} min',
                    if (r['servings'] != null) '${r['servings']} servings',
                    if (r['calories'] != null) '${r['calories']} kcal',
                  ].join(' · '),
                  style: const TextStyle(color: AppColors.muted),
                ),
                trailing: TextButton(
                  onPressed: () async {
                    await ref
                        .read(fitnessRepositoryProvider)
                        .importRemoteRecipe(r);
                    ref.invalidate(recipesProvider);
                    if (context.mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(content: Text('Saved ${r['title']}')),
                      );
                    }
                  },
                  child: const Text('Save'),
                ),
              ),
            ),
          ),
        ),
        const SizedBox(height: 20),
        const Text('Recipes', style: TextStyle(color: AppColors.white, fontSize: 20, fontWeight: FontWeight.w700)),
        const SizedBox(height: 8),
        recipes.when(
          loading: () => const LinearProgressIndicator(color: AppColors.lime),
          error: (e, _) => Text('$e', style: const TextStyle(color: AppColors.danger)),
          data: (items) => items.isEmpty
              ? const GlassCard(
                  child: Text(
                    'No recipes seeded yet.',
                    style: TextStyle(color: AppColors.soft),
                  ),
                )
              : Column(
                  children: items
                      .map(
                        (r) => Padding(
                          padding: const EdgeInsets.only(bottom: 10),
                          child: GlassCard(
                            padding: EdgeInsets.zero,
                            child: Theme(
                              data: Theme.of(context).copyWith(
                                dividerColor: Colors.transparent,
                              ),
                              child: ExpansionTile(
                                iconColor: AppColors.lime,
                                collapsedIconColor: AppColors.muted,
                                title: Text(
                                  r.title,
                                  style: const TextStyle(
                                    color: AppColors.white,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                                subtitle: Text(
                                  '${r.calories.round()} kcal · ${r.proteinG.round()}g protein · ${r.prepMin + r.cookMin} min',
                                  style: const TextStyle(color: AppColors.muted),
                                ),
                                children: [
                                  Padding(
                                    padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          r.summary,
                                          style: const TextStyle(color: AppColors.soft),
                                        ),
                                        const SizedBox(height: 8),
                                        const Text(
                                          'Ingredients',
                                          style: TextStyle(
                                            color: AppColors.lime,
                                            fontWeight: FontWeight.w700,
                                          ),
                                        ),
                                        ...r.ingredients.map(
                                          (i) => Text(
                                            '• $i',
                                            style: const TextStyle(color: AppColors.soft),
                                          ),
                                        ),
                                        const SizedBox(height: 8),
                                        const Text(
                                          'Steps',
                                          style: TextStyle(
                                            color: AppColors.lime,
                                            fontWeight: FontWeight.w700,
                                          ),
                                        ),
                                        ...r.instructions.asMap().entries.map(
                                              (e) => Text(
                                                '${e.key + 1}. ${e.value}',
                                                style: const TextStyle(color: AppColors.soft),
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
                      )
                      .toList(),
                ),
        ),
      ],
    );
  }
}
