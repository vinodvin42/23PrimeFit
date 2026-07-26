import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:primefit_mobile/core/offline/offline_outbox.dart';
import 'package:primefit_mobile/core/theme/app_theme.dart';
import 'package:primefit_mobile/core/widgets/glass.dart';
import 'package:primefit_mobile/features/workouts/data/fitness_repository.dart';
import 'package:primefit_mobile/features/workouts/domain/workout_models.dart';

class _SetLog {
  _SetLog({required this.targetReps});

  final String targetReps;
  bool done = false;
  bool skipped = false;
  final repsCtrl = TextEditingController();
  final weightCtrl = TextEditingController();

  void dispose() {
    repsCtrl.dispose();
    weightCtrl.dispose();
  }

  Map<String, dynamic> toJson(String exerciseId, int setIndex) => {
        'exerciseId': exerciseId,
        'setIndex': setIndex,
        'reps': int.tryParse(repsCtrl.text.trim()),
        'weightKg': double.tryParse(weightCtrl.text.trim()),
        'completed': done,
        'skipped': skipped,
      };
}

class SessionScreen extends ConsumerStatefulWidget {
  const SessionScreen({super.key, required this.sessionId});

  final String sessionId;

  @override
  ConsumerState<SessionScreen> createState() => _SessionScreenState();
}

class _SessionScreenState extends ConsumerState<SessionScreen> {
  SessionDetail? _session;
  Object? _error;
  bool _loading = true;
  bool _completing = false;
  bool _starting = false;
  double _rpe = 7;
  final _notes = TextEditingController();
  final Map<String, List<_SetLog>> _setsByExercise = {};
  Timer? _restTimer;
  int _restRemaining = 0;
  int _restTotal = 0;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _restTimer?.cancel();
    _notes.dispose();
    for (final sets in _setsByExercise.values) {
      for (final s in sets) {
        s.dispose();
      }
    }
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final session =
          await ref.read(fitnessRepositoryProvider).session(widget.sessionId);
      for (final existing in _setsByExercise.values) {
        for (final s in existing) {
          s.dispose();
        }
      }
      _setsByExercise.clear();
      for (final item in session.exercises) {
        final key = item.exercise.id;
        final logs = List.generate(
          item.sets,
          (_) => _SetLog(targetReps: item.reps)
            ..repsCtrl.text = item.reps.split('-').first.trim(),
        );
        _setsByExercise[key] = logs;
      }
      if (mounted) {
        setState(() {
          _session = session;
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = e;
          _loading = false;
        });
      }
    }
  }

  void _startRest(int seconds) {
    _restTimer?.cancel();
    setState(() {
      _restTotal = seconds;
      _restRemaining = seconds;
    });
    _restTimer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (!mounted) {
        t.cancel();
        return;
      }
      if (_restRemaining <= 1) {
        t.cancel();
        setState(() => _restRemaining = 0);
        return;
      }
      setState(() => _restRemaining -= 1);
    });
  }

  Future<void> _startWorkout() async {
    final session = _session;
    if (session == null) return;
    setState(() => _starting = true);
    try {
      await ref.read(fitnessRepositoryProvider).startSession(session.id);
      await _load();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Workout started — log your sets')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Could not start: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _starting = false);
    }
  }

  Future<void> _complete() async {
    final session = _session;
    if (session == null) return;
    setState(() => _completing = true);
    final setLogs = <Map<String, dynamic>>[];
    for (final item in session.exercises) {
      final logs = _setsByExercise[item.exercise.id] ?? [];
      for (var i = 0; i < logs.length; i++) {
        setLogs.add(logs[i].toJson(item.exercise.id, i + 1));
      }
    }
    final completedSets = setLogs.where((s) => s['completed'] == true).length;
    final skippedSets = setLogs.where((s) => s['skipped'] == true).length;
    final notesPayload = jsonEncode({
      'setLogs': setLogs,
      'completedSets': completedSets,
      'skippedSets': skippedSets,
      'userNotes': _notes.text.trim(),
    });
    try {
      if (session.status == 'PLANNED') {
        await ref.read(fitnessRepositoryProvider).startSession(session.id);
      }
      await ref.read(fitnessRepositoryProvider).completeSession(
            session.id,
            perceivedEffort: _rpe.round(),
            notes: notesPayload,
            outbox: ref.read(offlineOutboxProvider),
          );
      ref.invalidate(myWorkoutsProvider);
      if (mounted) Navigator.of(context).pop();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Could not save: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _completing = false);
    }
  }

  int get _doneCount {
    var n = 0;
    for (final logs in _setsByExercise.values) {
      for (final log in logs) {
        if (log.done || log.skipped) n++;
      }
    }
    return n;
  }

  int get _totalSets {
    var n = 0;
    for (final logs in _setsByExercise.values) {
      n += logs.length;
    }
    return n;
  }

  @override
  Widget build(BuildContext context) {
    return DarkHubTheme(
      child: Builder(
        builder: (context) {
          if (_loading) {
            return const Scaffold(
              backgroundColor: AppColors.voidBlack,
              body: Center(
                child: CircularProgressIndicator(color: AppColors.lime),
              ),
            );
          }
          if (_error != null || _session == null) {
            return Scaffold(
              backgroundColor: AppColors.voidBlack,
              appBar: AppBar(
                leading: const DarkBackButton(),
                title: const Text('Session'),
              ),
              body: Center(
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        'Could not load session',
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                      const SizedBox(height: 8),
                      Text(
                        '$_error',
                        textAlign: TextAlign.center,
                        style: const TextStyle(color: AppColors.mutedOnDark),
                      ),
                      const SizedBox(height: 16),
                      FilledButton(
                        onPressed: _load,
                        child: const Text('Retry'),
                      ),
                    ],
                  ),
                ),
              ),
            );
          }

          final session = _session!;
          final done = session.status == 'COMPLETED';
          final planned = session.status == 'PLANNED';
          final progress =
              _totalSets == 0 ? 0.0 : _doneCount / _totalSets;

          return Scaffold(
            backgroundColor: AppColors.voidBlack,
            appBar: AppBar(
              leading: const DarkBackButton(),
              title: Text(
                session.title,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              actions: [
                if (_restRemaining > 0)
                  Padding(
                    padding: const EdgeInsets.only(right: 12),
                    child: Center(
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 10,
                          vertical: 6,
                        ),
                        decoration: BoxDecoration(
                          color: AppColors.lime.withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: Text(
                          'Rest $_restRemaining s',
                          style: const TextStyle(
                            color: AppColors.lime,
                            fontWeight: FontWeight.w700,
                            fontSize: 12,
                          ),
                        ),
                      ),
                    ),
                  ),
              ],
            ),
            body: ListView(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 120),
              children: [
                Text(
                  '${session.exercises.length} exercises · ${session.status.replaceAll('_', ' ')}',
                  style: const TextStyle(color: AppColors.mutedOnDark, fontSize: 13),
                ),
                const SizedBox(height: 10),
                ClipRRect(
                  borderRadius: BorderRadius.circular(8),
                  child: LinearProgressIndicator(
                    value: progress,
                    minHeight: 8,
                    color: AppColors.lime,
                    backgroundColor: AppColors.card,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  '$_doneCount / $_totalSets sets logged',
                  style: const TextStyle(color: AppColors.soft, fontSize: 12),
                ),
                if (_restRemaining > 0) ...[
                  const SizedBox(height: 14),
                  GlassCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Rest timer',
                          style: Theme.of(context).textTheme.titleMedium,
                        ),
                        const SizedBox(height: 10),
                        LinearProgressIndicator(
                          value: _restTotal == 0
                              ? 0
                              : (_restTotal - _restRemaining) / _restTotal,
                          minHeight: 8,
                          borderRadius: BorderRadius.circular(8),
                          color: AppColors.lime,
                          backgroundColor: AppColors.card,
                        ),
                        const SizedBox(height: 10),
                        Row(
                          children: [
                            Text(
                              '$_restRemaining s remaining',
                              style: const TextStyle(color: AppColors.soft),
                            ),
                            const Spacer(),
                            TextButton(
                              onPressed: () {
                                _restTimer?.cancel();
                                setState(() => _restRemaining = 0);
                              },
                              child: const Text('Skip rest'),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ],
                if (planned && !done) ...[
                  const SizedBox(height: 14),
                  FilledButton.icon(
                    onPressed: _starting ? null : _startWorkout,
                    icon: const Icon(Icons.play_arrow_rounded),
                    label: Text(_starting ? 'Starting…' : 'Start workout'),
                  ),
                ],
                const SizedBox(height: 16),
                ...session.exercises.map((item) {
                  final img = item.exercise.imageUrls.isNotEmpty
                      ? item.exercise.imageUrls.first
                      : null;
                  final logs = _setsByExercise[item.exercise.id] ?? [];
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 14),
                    child: GlassCard(
                      padding: const EdgeInsets.all(14),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              ClipRRect(
                                borderRadius: BorderRadius.circular(12),
                                child: img == null
                                    ? Container(
                                        width: 56,
                                        height: 56,
                                        color: AppColors.cardElevated,
                                        child: const Icon(
                                          Icons.fitness_center,
                                          color: AppColors.lime,
                                        ),
                                      )
                                    : Image.network(
                                        img,
                                        width: 56,
                                        height: 56,
                                        fit: BoxFit.cover,
                                        errorBuilder: (_, error, stackTrace) =>
                                            Container(
                                          width: 56,
                                          height: 56,
                                          color: AppColors.cardElevated,
                                          child: const Icon(
                                            Icons.fitness_center,
                                            color: AppColors.lime,
                                          ),
                                        ),
                                      ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      item.exercise.name,
                                      style: const TextStyle(
                                        color: AppColors.white,
                                        fontWeight: FontWeight.w700,
                                        fontSize: 16,
                                        height: 1.25,
                                      ),
                                    ),
                                    const SizedBox(height: 4),
                                    Text(
                                      'Target ${item.sets} × ${item.reps} · rest ${item.restSec}s',
                                      style: const TextStyle(
                                        color: AppColors.mutedOnDark,
                                        fontSize: 12,
                                        height: 1.3,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 14),
                          const Row(
                            children: [
                              SizedBox(
                                width: 52,
                                child: Text(
                                  'SET',
                                  style: TextStyle(
                                    color: AppColors.mutedOnDark,
                                    fontSize: 11,
                                    fontWeight: FontWeight.w700,
                                    letterSpacing: 0.4,
                                  ),
                                ),
                              ),
                              Expanded(
                                child: Text(
                                  'REPS',
                                  style: TextStyle(
                                    color: AppColors.mutedOnDark,
                                    fontSize: 11,
                                    fontWeight: FontWeight.w700,
                                    letterSpacing: 0.4,
                                  ),
                                ),
                              ),
                              SizedBox(width: 8),
                              Expanded(
                                child: Text(
                                  'KG',
                                  style: TextStyle(
                                    color: AppColors.mutedOnDark,
                                    fontSize: 11,
                                    fontWeight: FontWeight.w700,
                                    letterSpacing: 0.4,
                                  ),
                                ),
                              ),
                              SizedBox(width: 88),
                            ],
                          ),
                          const SizedBox(height: 8),
                          ...List.generate(logs.length, (i) {
                            final log = logs[i];
                            final rowDone = log.done;
                            final rowSkipped = log.skipped;
                            return Padding(
                              padding: const EdgeInsets.only(bottom: 10),
                              child: DecoratedBox(
                                decoration: BoxDecoration(
                                  color: rowDone
                                      ? AppColors.lime.withValues(alpha: 0.08)
                                      : rowSkipped
                                          ? AppColors.coral
                                              .withValues(alpha: 0.08)
                                          : Colors.transparent,
                                  borderRadius: BorderRadius.circular(12),
                                ),
                                child: Padding(
                                  padding: const EdgeInsets.symmetric(
                                    vertical: 4,
                                  ),
                                  child: Row(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.center,
                                    children: [
                                      SizedBox(
                                        width: 52,
                                        child: Text(
                                          '${i + 1}',
                                          style: TextStyle(
                                            color: rowDone
                                                ? AppColors.lime
                                                : AppColors.soft,
                                            fontWeight: FontWeight.w700,
                                            fontSize: 15,
                                          ),
                                        ),
                                      ),
                                      Expanded(
                                        child: TextField(
                                          enabled: !done && !rowSkipped,
                                          controller: log.repsCtrl,
                                          keyboardType: TextInputType.number,
                                          style: const TextStyle(
                                            color: AppColors.white,
                                            fontWeight: FontWeight.w600,
                                          ),
                                          decoration: const InputDecoration(
                                            hintText: '0',
                                          ),
                                        ),
                                      ),
                                      const SizedBox(width: 8),
                                      Expanded(
                                        child: TextField(
                                          enabled: !done && !rowSkipped,
                                          controller: log.weightCtrl,
                                          keyboardType:
                                              const TextInputType
                                                  .numberWithOptions(
                                            decimal: true,
                                          ),
                                          style: const TextStyle(
                                            color: AppColors.white,
                                            fontWeight: FontWeight.w600,
                                          ),
                                          decoration: const InputDecoration(
                                            hintText: '0.0',
                                          ),
                                        ),
                                      ),
                                      const SizedBox(width: 4),
                                      IconButton(
                                        tooltip: 'Mark done',
                                        visualDensity: VisualDensity.compact,
                                        onPressed: done
                                            ? null
                                            : () {
                                                setState(() {
                                                  log.done = true;
                                                  log.skipped = false;
                                                });
                                                _startRest(item.restSec);
                                              },
                                        icon: Icon(
                                          rowDone
                                              ? Icons.check_circle
                                              : Icons.check_circle_outline,
                                          color: rowDone
                                              ? AppColors.lime
                                              : AppColors.mutedOnDark,
                                        ),
                                      ),
                                      IconButton(
                                        tooltip: 'Skip set',
                                        visualDensity: VisualDensity.compact,
                                        onPressed: done
                                            ? null
                                            : () {
                                                setState(() {
                                                  log.skipped = !log.skipped;
                                                  if (log.skipped) {
                                                    log.done = false;
                                                  }
                                                });
                                              },
                                        icon: Icon(
                                          Icons.block,
                                          color: rowSkipped
                                              ? AppColors.danger
                                              : AppColors.mutedOnDark,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            );
                          }),
                        ],
                      ),
                    ),
                  );
                }),
                if (!done) ...[
                  Text(
                    'Session RPE',
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  const SizedBox(height: 4),
                  Slider(
                    value: _rpe,
                    min: 1,
                    max: 10,
                    divisions: 9,
                    label: _rpe.round().toString(),
                    onChanged: (v) => setState(() => _rpe = v),
                  ),
                  Text(
                    'Perceived effort: ${_rpe.round()} / 10',
                    style: const TextStyle(color: AppColors.soft),
                  ),
                  const SizedBox(height: 14),
                  TextField(
                    controller: _notes,
                    maxLines: 3,
                    style: const TextStyle(color: AppColors.white),
                    decoration: const InputDecoration(
                      hintText: 'Notes (optional)',
                    ),
                  ),
                ] else
                  const GlassCard(
                    child: Text(
                      'This session is completed. Set logs were saved with your notes.',
                      style: TextStyle(color: AppColors.soft),
                    ),
                  ),
              ],
            ),
            bottomNavigationBar: done
                ? null
                : SafeArea(
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
                      child: SizedBox(
                        width: double.infinity,
                        child: ElevatedButton(
                          onPressed: _completing ? null : _complete,
                          child: Text(
                            _completing ? 'Saving…' : 'Mark workout complete',
                          ),
                        ),
                      ),
                    ),
                  ),
          );
        },
      ),
    );
  }
}
