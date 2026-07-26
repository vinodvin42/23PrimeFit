import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:primefit_mobile/core/theme/app_theme.dart';
import 'package:primefit_mobile/features/workouts/data/fitness_repository.dart';

class ProgressScreen extends ConsumerStatefulWidget {
  const ProgressScreen({super.key});

  @override
  ConsumerState<ProgressScreen> createState() => _ProgressScreenState();
}

class _ProgressScreenState extends ConsumerState<ProgressScreen> {
  bool _busy = false;
  String _pose = 'front';
  final _caption = TextEditingController();
  final _weight = TextEditingController();
  final _picker = ImagePicker();
  XFile? _picked;
  String? _previewLabel;

  @override
  void dispose() {
    _caption.dispose();
    _weight.dispose();
    super.dispose();
  }

  Future<void> _pick(ImageSource source) async {
    try {
      final file = await _picker.pickImage(
        source: source,
        maxWidth: 1280,
        maxHeight: 1280,
        imageQuality: 82,
      );
      if (file == null) return;
      setState(() {
        _picked = file;
        _previewLabel = file.name;
      });
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            kIsWeb
                ? 'Could not open picker ($e). Use placeholder check-in instead.'
                : 'Could not open camera/gallery: $e',
          ),
        ),
      );
    }
  }

  Future<void> _addCheckIn({required bool usePlaceholder}) async {
    setState(() => _busy = true);
    try {
      final weight = double.tryParse(_weight.text.trim());
      String? imageBase64;
      String? contentType;
      String? fileName;

      if (!usePlaceholder && _picked != null) {
        final bytes = await _picked!.readAsBytes();
        imageBase64 = base64Encode(bytes);
        final path = _picked!.path.toLowerCase();
        final name = _picked!.name.toLowerCase();
        contentType = path.endsWith('.png') || name.endsWith('.png')
            ? 'image/png'
            : 'image/jpeg';
        fileName = _picked!.name.isNotEmpty
            ? _picked!.name
            : '$_pose-${DateTime.now().millisecondsSinceEpoch}.jpg';
      }

      await ref.read(fitnessRepositoryProvider).createProgressPhoto(
            pose: _pose,
            caption:
                _caption.text.trim().isEmpty ? null : _caption.text.trim(),
            weightKg: weight,
            imageBase64: imageBase64,
            contentType: contentType,
            fileName: fileName,
          );
      _caption.clear();
      setState(() {
        _picked = null;
        _previewLabel = null;
      });
      ref.invalidate(progressPhotosProvider);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              usePlaceholder || imageBase64 == null
                  ? 'Placeholder check-in saved'
                  : 'Photo check-in saved',
            ),
          ),
        );
      }
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

  Future<void> _delete(String id) async {
    await ref.read(fitnessRepositoryProvider).deleteProgressPhoto(id);
    ref.invalidate(progressPhotosProvider);
  }

  @override
  Widget build(BuildContext context) {
    final photos = ref.watch(progressPhotosProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('PROGRESS')),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(progressPhotosProvider);
          await ref.read(progressPhotosProvider.future);
        },
        child: ListView(
          padding: const EdgeInsets.all(24),
          children: [
            Text(
              'Check-ins',
              style: Theme.of(context).textTheme.headlineMedium,
            ),
            const SizedBox(height: 8),
            const Text(
              'Photos are optional. On emulator, use “Save check-in” — no camera needed.',
              style: TextStyle(color: AppColors.muted),
            ),
            const SizedBox(height: 20),
            Wrap(
              spacing: 8,
              children: ['front', 'side', 'back'].map((p) {
                final selected = _pose == p;
                return ChoiceChip(
                  label: Text(p.toUpperCase()),
                  selected: selected,
                  onSelected: (_) => setState(() => _pose = p),
                );
              }).toList(),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _weight,
              keyboardType:
                  const TextInputType.numberWithOptions(decimal: true),
              decoration: const InputDecoration(
                labelText: 'Weight (kg)',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _caption,
              decoration: const InputDecoration(
                labelText: 'Caption (optional)',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 12),
            if (_previewLabel != null)
              Text(
                'Selected: $_previewLabel',
                style: const TextStyle(color: AppColors.forestMid),
              ),
            const SizedBox(height: 12),
            FilledButton(
              onPressed:
                  _busy ? null : () => _addCheckIn(usePlaceholder: true),
              child: Text(_busy ? 'Saving…' : 'Save check-in (no photo)'),
            ),
            const SizedBox(height: 10),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                OutlinedButton.icon(
                  onPressed: _busy ? null : () => _pick(ImageSource.gallery),
                  icon: const Icon(Icons.photo_library_outlined),
                  label: const Text('Gallery'),
                ),
                if (!kIsWeb)
                  OutlinedButton.icon(
                    onPressed: _busy ? null : () => _pick(ImageSource.camera),
                    icon: const Icon(Icons.photo_camera_outlined),
                    label: const Text('Camera'),
                  ),
                FilledButton.tonal(
                  onPressed: _busy || _picked == null
                      ? null
                      : () => _addCheckIn(usePlaceholder: false),
                  child: const Text('Upload photo'),
                ),
              ],
            ),
            const SizedBox(height: 28),
            photos.when(
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (e, _) =>
                  Text('$e', style: const TextStyle(color: AppColors.danger)),
              data: (items) {
                if (items.isEmpty) {
                  return const Text(
                    'No photos yet — add your first check-in above.',
                    style: TextStyle(color: AppColors.muted),
                  );
                }
                return Column(
                  children: items.map((p) {
                    final url = p['fileUrl'] as String?;
                    final pose =
                        (p['pose'] as String? ?? 'front').toUpperCase();
                    final taken = (p['takenAt'] as String? ?? '').slice0to10();
                    final weight = (p['weightKg'] as num?)?.toDouble();
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 14),
                      child: Material(
                        color: Colors.white.withValues(alpha: 0.9),
                        borderRadius: BorderRadius.circular(16),
                        child: Padding(
                          padding: const EdgeInsets.all(12),
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              ClipRRect(
                                borderRadius: BorderRadius.circular(12),
                                child: SizedBox(
                                  width: 88,
                                  height: 118,
                                  child: url == null
                                      ? Container(color: AppColors.forest)
                                      : Image.network(
                                          url,
                                          fit: BoxFit.cover,
                                          errorBuilder:
                                              (context, error, stackTrace) =>
                                                  Container(
                                            color: AppColors.forest,
                                            alignment: Alignment.center,
                                            child: Text(
                                              pose,
                                              style: const TextStyle(
                                                color: AppColors.lime,
                                              ),
                                            ),
                                          ),
                                        ),
                                ),
                              ),
                              const SizedBox(width: 14),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      pose,
                                      style: Theme.of(context)
                                          .textTheme
                                          .titleLarge,
                                    ),
                                    const SizedBox(height: 4),
                                    Text(
                                      taken,
                                      style: const TextStyle(
                                        color: AppColors.muted,
                                      ),
                                    ),
                                    if (weight != null)
                                      Text('${weight.toStringAsFixed(1)} kg'),
                                    if ((p['caption'] as String?)
                                            ?.isNotEmpty ==
                                        true)
                                      Text(p['caption'] as String),
                                  ],
                                ),
                              ),
                              IconButton(
                                onPressed: () => _delete(p['id'] as String),
                                icon: const Icon(Icons.delete_outline),
                              ),
                            ],
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
    );
  }
}

extension on String {
  String slice0to10() => length >= 10 ? substring(0, 10) : this;
}
