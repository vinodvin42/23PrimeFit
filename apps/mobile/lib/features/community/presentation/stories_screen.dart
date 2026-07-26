import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:primefit_mobile/core/theme/app_theme.dart';
import 'package:primefit_mobile/core/widgets/glass.dart';
import 'package:primefit_mobile/features/workouts/data/fitness_repository.dart';

class StoriesScreen extends ConsumerStatefulWidget {
  const StoriesScreen({super.key});

  @override
  ConsumerState<StoriesScreen> createState() => _StoriesScreenState();
}

class _StoriesScreenState extends ConsumerState<StoriesScreen> {
  final _captionController = TextEditingController();
  String? _beforePhotoId;
  String? _afterPhotoId;
  bool _posting = false;
  String? _busyStoryId;

  @override
  void dispose() {
    _captionController.dispose();
    super.dispose();
  }

  Future<void> _refresh() async {
    ref.invalidate(transformationStoriesProvider);
    ref.invalidate(progressPhotosProvider);
    await Future.wait([
      ref.read(transformationStoriesProvider.future),
      ref.read(progressPhotosProvider.future),
    ]);
  }

  Future<void> _post() async {
    setState(() => _posting = true);
    try {
      await ref.read(fitnessRepositoryProvider).createStory(
            caption: _captionController.text.trim().isEmpty
                ? null
                : _captionController.text.trim(),
            beforePhotoId: _beforePhotoId,
            afterPhotoId: _afterPhotoId,
          );
      _captionController.clear();
      setState(() {
        _beforePhotoId = null;
        _afterPhotoId = null;
      });
      await _refresh();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('$e')));
      }
    } finally {
      if (mounted) setState(() => _posting = false);
    }
  }

  Future<void> _cheer(String id) async {
    setState(() => _busyStoryId = id);
    try {
      await ref.read(fitnessRepositoryProvider).cheerStory(id);
      await _refresh();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('$e')));
      }
    } finally {
      if (mounted) setState(() => _busyStoryId = null);
    }
  }

  Future<void> _remove(String id) async {
    setState(() => _busyStoryId = id);
    try {
      await ref.read(fitnessRepositoryProvider).removeStory(id);
      await _refresh();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('$e')));
      }
    } finally {
      if (mounted) setState(() => _busyStoryId = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final stories = ref.watch(transformationStoriesProvider);
    final photos = ref.watch(progressPhotosProvider);
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
                  'TRANSFORMATION STORIES',
                  style: TextStyle(
                    color: AppColors.white,
                    fontSize: 28,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 4),
                const Text(
                  'Share your progress and cheer on your workspace.',
                  style: TextStyle(color: AppColors.mutedOnDark),
                ),
                const SizedBox(height: 16),
                GlassCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Post a story',
                        style: TextStyle(
                          color: AppColors.white,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(height: 8),
                      TextField(
                        controller: _captionController,
                        maxLines: 3,
                        style: const TextStyle(color: AppColors.white),
                        decoration: const InputDecoration(
                          hintText: 'What changed for you?',
                        ),
                      ),
                      const SizedBox(height: 8),
                      photos.when(
                        loading: () => const LinearProgressIndicator(
                          color: AppColors.lime,
                        ),
                        error: (e, _) => Text(
                          '$e',
                          style: const TextStyle(color: AppColors.danger),
                        ),
                        data: (rows) {
                          if (rows.isEmpty) {
                            return const Text(
                              'Add progress photos first to attach a '
                              'before/after (optional).',
                              style: TextStyle(color: AppColors.soft),
                            );
                          }
                          return Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              _PhotoPicker(
                                label: 'Before photo (optional)',
                                photos: rows,
                                selectedId: _beforePhotoId,
                                onSelected: (id) =>
                                    setState(() => _beforePhotoId = id),
                              ),
                              const SizedBox(height: 8),
                              _PhotoPicker(
                                label: 'After photo (optional)',
                                photos: rows,
                                selectedId: _afterPhotoId,
                                onSelected: (id) =>
                                    setState(() => _afterPhotoId = id),
                              ),
                            ],
                          );
                        },
                      ),
                      const SizedBox(height: 10),
                      Align(
                        alignment: Alignment.centerRight,
                        child: ElevatedButton(
                          onPressed: _posting ? null : _post,
                          child: Text(_posting ? 'Posting…' : 'Post story'),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 20),
                stories.when(
                  loading: () => const Center(
                    child: CircularProgressIndicator(color: AppColors.lime),
                  ),
                  error: (e, _) => Text(
                    '$e',
                    style: const TextStyle(color: AppColors.danger),
                  ),
                  data: (rows) {
                    if (rows.isEmpty) {
                      return const GlassCard(
                        child: Text(
                          'No stories yet — be the first to share your '
                          'progress.',
                          style: TextStyle(color: AppColors.soft),
                        ),
                      );
                    }
                    return Column(
                      children: rows.map((s) {
                        final id = s['id'] as String;
                        final busy = _busyStoryId == id;
                        final before =
                            s['beforePhoto'] as Map<String, dynamic>?;
                        final after =
                            s['afterPhoto'] as Map<String, dynamic>?;
                        final displayName =
                            (s['user'] as Map<String, dynamic>?)?['displayName']
                                    as String? ??
                                'Member';
                        final cheerCount = s['cheerCount'] as int? ?? 0;
                        final cheeredByMe = s['cheeredByMe'] as bool? ?? false;
                        final isMine = s['isMine'] as bool? ?? false;
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
                                        displayName,
                                        style: const TextStyle(
                                          color: AppColors.white,
                                          fontWeight: FontWeight.w700,
                                        ),
                                      ),
                                    ),
                                    if (isMine)
                                      IconButton(
                                        icon: const Icon(
                                          Icons.delete_outline,
                                          color: AppColors.mutedOnDark,
                                          size: 20,
                                        ),
                                        onPressed:
                                            busy ? null : () => _remove(id),
                                      ),
                                  ],
                                ),
                                if ((s['caption'] as String?)
                                        ?.isNotEmpty ==
                                    true) ...[
                                  const SizedBox(height: 6),
                                  Text(
                                    '${s['caption']}',
                                    style:
                                        const TextStyle(color: AppColors.soft),
                                  ),
                                ],
                                if (before != null || after != null) ...[
                                  const SizedBox(height: 10),
                                  Row(
                                    children: [
                                      if (before != null)
                                        Expanded(
                                          child: _StoryPhoto(
                                            label: 'Before',
                                            url: before['fileUrl'] as String?,
                                          ),
                                        ),
                                      if (before != null && after != null)
                                        const SizedBox(width: 8),
                                      if (after != null)
                                        Expanded(
                                          child: _StoryPhoto(
                                            label: 'After',
                                            url: after['fileUrl'] as String?,
                                          ),
                                        ),
                                    ],
                                  ),
                                ],
                                const SizedBox(height: 10),
                                Row(
                                  children: [
                                    IconButton(
                                      icon: Icon(
                                        cheeredByMe
                                            ? Icons.favorite
                                            : Icons.favorite_border,
                                        color: cheeredByMe
                                            ? AppColors.lime
                                            : AppColors.mutedOnDark,
                                      ),
                                      onPressed:
                                          busy ? null : () => _cheer(id),
                                    ),
                                    Text(
                                      '$cheerCount',
                                      style: const TextStyle(
                                        color: AppColors.mutedOnDark,
                                      ),
                                    ),
                                  ],
                                ),
                              ],
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

class _PhotoPicker extends StatelessWidget {
  const _PhotoPicker({
    required this.label,
    required this.photos,
    required this.selectedId,
    required this.onSelected,
  });

  final String label;
  final List<Map<String, dynamic>> photos;
  final String? selectedId;
  final ValueChanged<String?> onSelected;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(color: AppColors.mutedOnDark)),
        const SizedBox(height: 4),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            ChoiceChip(
              label: const Text('None'),
              selected: selectedId == null,
              onSelected: (_) => onSelected(null),
            ),
            ...photos.map((p) {
              final id = p['id'] as String;
              return ChoiceChip(
                label: Text('${p['pose'] ?? 'photo'}'),
                selected: selectedId == id,
                onSelected: (_) => onSelected(id),
              );
            }),
          ],
        ),
      ],
    );
  }
}

class _StoryPhoto extends StatelessWidget {
  const _StoryPhoto({required this.label, required this.url});

  final String label;
  final String? url;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(color: AppColors.mutedOnDark, fontSize: 12),
        ),
        const SizedBox(height: 4),
        ClipRRect(
          borderRadius: BorderRadius.circular(10),
          child: AspectRatio(
            aspectRatio: 1,
            child: url != null
                ? Image.network(url!, fit: BoxFit.cover)
                : Container(color: Colors.white12),
          ),
        ),
      ],
    );
  }
}
