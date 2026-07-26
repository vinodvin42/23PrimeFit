import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:primefit_mobile/core/theme/app_theme.dart';
import 'package:primefit_mobile/features/workouts/data/fitness_repository.dart';
import 'package:primefit_mobile/features/workouts/domain/workout_models.dart';

class ExerciseLibraryScreen extends ConsumerStatefulWidget {
  const ExerciseLibraryScreen({super.key});

  @override
  ConsumerState<ExerciseLibraryScreen> createState() =>
      _ExerciseLibraryScreenState();
}

class _ExerciseLibraryScreenState extends ConsumerState<ExerciseLibraryScreen> {
  final _q = TextEditingController(text: 'squat');
  List<ExerciseItem> _items = [];
  bool _loading = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _search());
  }

  @override
  void dispose() {
    _q.dispose();
    super.dispose();
  }

  Future<void> _search() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final items = await ref
          .read(fitnessRepositoryProvider)
          .searchExercises(_q.text.trim());
      if (mounted) setState(() => _items = items);
    } catch (e) {
      if (mounted) setState(() => _error = '$e');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('EXERCISE LIBRARY')),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _q,
                    decoration: const InputDecoration(
                      hintText: 'Search free-exercise-db…',
                    ),
                    onSubmitted: (_) => _search(),
                  ),
                ),
                const SizedBox(width: 8),
                ElevatedButton(
                  onPressed: _loading ? null : _search,
                  child: const Text('Go'),
                ),
              ],
            ),
          ),
          if (_loading) const LinearProgressIndicator(),
          if (_error != null)
            Padding(
              padding: const EdgeInsets.all(16),
              child: Text(
                _error!,
                style: const TextStyle(color: AppColors.danger),
              ),
            ),
          Expanded(
            child: ListView.builder(
              itemCount: _items.length,
              itemBuilder: (context, i) {
                final ex = _items[i];
                final img = ex.imageUrls.isNotEmpty ? ex.imageUrls.first : null;
                return ListTile(
                  leading: img == null
                      ? const Icon(Icons.fitness_center)
                      : Image.network(
                          img,
                          width: 48,
                          height: 48,
                          fit: BoxFit.cover,
                          errorBuilder: (_, error, stack) =>
                              const Icon(Icons.fitness_center),
                        ),
                  title: Text(ex.name),
                  subtitle: Text(
                    [
                      if (ex.equipment != null) ex.equipment!,
                      if (ex.level != null) ex.level!,
                      ...ex.primaryMuscles.take(2),
                      if (ex.videoUrls.isNotEmpty) 'video',
                    ].join(' · '),
                  ),
                  trailing: ex.videoUrls.isNotEmpty
                      ? const Icon(Icons.play_circle_outline)
                      : null,
                  onTap: () {
                    showModalBottomSheet<void>(
                      context: context,
                      backgroundColor: AppColors.card,
                      builder: (ctx) => Padding(
                        padding: const EdgeInsets.all(24),
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              ex.name,
                              style: Theme.of(ctx).textTheme.titleLarge,
                            ),
                            const SizedBox(height: 8),
                            if (img != null)
                              ClipRRect(
                                borderRadius: BorderRadius.circular(12),
                                child: Image.network(
                                  img,
                                  height: 160,
                                  width: double.infinity,
                                  fit: BoxFit.cover,
                                  errorBuilder: (_, e, s) =>
                                      const SizedBox.shrink(),
                                ),
                              ),
                            const SizedBox(height: 12),
                            Text(
                              ex.videoUrls.isNotEmpty
                                  ? 'Demo video: ${ex.videoUrls.first}'
                                  : 'Stills from free-exercise-db. Set EXERCISE_MEDIA_CDN_BASE for licensed video.',
                              style: const TextStyle(color: AppColors.muted),
                            ),
                            const SizedBox(height: 8),
                            ...ex.instructions.take(4).map(
                                  (s) => Text(
                                    '• $s',
                                    style: const TextStyle(color: AppColors.soft),
                                  ),
                                ),
                          ],
                        ),
                      ),
                    );
                  },
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
