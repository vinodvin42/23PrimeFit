import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:primefit_mobile/core/theme/app_theme.dart';
import 'package:primefit_mobile/core/widgets/glass.dart';
import 'package:primefit_mobile/features/workouts/data/fitness_repository.dart';

class BloodReportsScreen extends ConsumerStatefulWidget {
  const BloodReportsScreen({super.key});

  @override
  ConsumerState<BloodReportsScreen> createState() => _BloodReportsScreenState();
}

class _BloodReportsScreenState extends ConsumerState<BloodReportsScreen> {
  List<Map<String, dynamic>> _reports = [];
  bool _loading = true;
  bool _uploading = false;
  String? _error;

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
      final items =
          await ref.read(fitnessRepositoryProvider).listBloodReports();
      if (mounted) setState(() => _reports = items);
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = '$e'.contains('Consent') || '$e'.contains('403')
              ? 'Grant blood_report_analysis consent in Profile first.'
              : '$e';
        });
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _upload({bool placeholder = false}) async {
    try {
      setState(() => _uploading = true);
      var fileName = 'lab-placeholder.jpg';
      String? imageBase64;
      String? mimeType;

      if (!placeholder) {
        final picker = ImagePicker();
        final file = await picker.pickImage(
          source: ImageSource.gallery,
          imageQuality: 85,
        );
        if (file == null) return;
        fileName = file.name;
        final bytes = await file.readAsBytes();
        imageBase64 = base64Encode(bytes);
        mimeType = file.mimeType ?? 'image/jpeg';
      } else {
        // Minimal JPEG so emulator can exercise OCR/storage without gallery.
        imageBase64 =
            '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAGfAP/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAQUCf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQMBAT8Bf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQIBAT8Bf//Z';
        mimeType = 'image/jpeg';
        fileName = 'emulator-lab.jpg';
      }

      await ref.read(fitnessRepositoryProvider).uploadBloodReport(
            fileName: fileName,
            title: 'Lab report',
            imageBase64: imageBase64,
            mimeType: mimeType,
          );
      await _load();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              placeholder
                  ? 'Placeholder report uploaded (OCR path exercised)'
                  : 'Blood report uploaded',
            ),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Upload failed — try placeholder on emulator. ($e)'),
            action: SnackBarAction(
              label: 'Placeholder',
              onPressed: () => _upload(placeholder: true),
            ),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.voidBlack,
      appBar: AppBar(
        title: const Text('BLOOD REPORTS'),
        actions: [
          IconButton(
            tooltip: 'Upload placeholder',
            onPressed: _uploading ? null : () => _upload(placeholder: true),
            icon: const Icon(Icons.science_outlined),
          ),
          IconButton(
            onPressed: _uploading ? null : () => _upload(),
            icon: _uploading
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.upload_file),
          ),
        ],
      ),
      body: RefreshIndicator(
        color: AppColors.lime,
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.all(24),
          children: [
            const Text(
              'Upload a lab photo. Image is stored and OCR/vision extracts markers when keyed. Consent required in Profile.',
              style: TextStyle(color: AppColors.muted),
            ),
            const SizedBox(height: 16),
            if (_loading) const LinearProgressIndicator(color: AppColors.lime),
            if (_error != null)
              Text(_error!, style: const TextStyle(color: AppColors.danger)),
            if (!_loading && _reports.isEmpty && _error == null)
              const GlassCard(
                child: Text(
                  'No blood reports yet. Tap upload (or science icon for emulator placeholder).',
                  style: TextStyle(color: AppColors.soft),
                ),
              ),
            ..._reports.map(
              (r) => Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: GlassCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        '${r['title'] ?? 'Blood report'}',
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                      const SizedBox(height: 4),
                      Text(
                        '${r['fileName'] ?? ''}',
                        style: const TextStyle(color: AppColors.muted),
                      ),
                      if (r['fileUrl'] != null) ...[
                        const SizedBox(height: 4),
                        Text(
                          'Stored: ${r['fileUrl']}',
                          style: const TextStyle(
                            color: AppColors.muted,
                            fontSize: 11,
                          ),
                        ),
                      ],
                      if (r['summary'] != null) ...[
                        const SizedBox(height: 8),
                        Text(
                          '${r['summary']}',
                          style: const TextStyle(color: AppColors.soft),
                        ),
                      ],
                      if (r['markersJson'] != null) ...[
                        const SizedBox(height: 8),
                        Text(
                          'Markers: ${r['markersJson']}',
                          style: const TextStyle(
                            color: AppColors.lime,
                            fontSize: 12,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
            ),
            const SizedBox(height: 16),
            ElevatedButton.icon(
              onPressed: _uploading ? null : () => _upload(),
              icon: const Icon(Icons.add),
              label: Text(_uploading ? 'Uploading…' : 'Upload report'),
            ),
            TextButton(
              onPressed: _uploading ? null : () => _upload(placeholder: true),
              child: const Text('Use emulator placeholder'),
            ),
          ],
        ),
      ),
    );
  }
}
