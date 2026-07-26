import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:primefit_mobile/core/theme/mockup_colors.dart';

class _Interval {
  const _Interval(this.label, this.seconds);
  final String label;
  final int seconds;
}

/// Interval timer for strength sessions (Work / Rest).
class WorkoutTimerScreen extends StatefulWidget {
  const WorkoutTimerScreen({
    super.key,
    this.title = 'Pushups session',
    this.subtitle = '25 rep, 3 sets with 20 sec rest',
  });

  final String title;
  final String subtitle;

  @override
  State<WorkoutTimerScreen> createState() => _WorkoutTimerScreenState();
}

class _WorkoutTimerScreenState extends State<WorkoutTimerScreen> {
  static const _plan = [
    _Interval('Get ready', 10),
    _Interval('Work', 40),
    _Interval('Rest', 10),
    _Interval('Work', 40),
    _Interval('Rest', 10),
    _Interval('Work', 40),
  ];

  int _index = 0;
  int _remaining = 10;
  bool _paused = false;
  bool _started = false;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _remaining = _plan.first.seconds;
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  void _toggle() {
    if (!_started) {
      setState(() => _started = true);
      _startTicker();
      return;
    }
    setState(() => _paused = !_paused);
    if (_paused) {
      _timer?.cancel();
    } else {
      _startTicker();
    }
  }

  void _startTicker() {
    _timer?.cancel();
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted || _paused) return;
      if (_remaining <= 1) {
        if (_index >= _plan.length - 1) {
          _timer?.cancel();
          context.pushReplacement('/activity/complete', extra: {
            'title': widget.title,
            'km': 0.0,
            'seconds': _plan.fold<int>(0, (a, b) => a + b.seconds),
            'calories': 120,
          });
          return;
        }
        setState(() {
          _index++;
          _remaining = _plan[_index].seconds;
        });
      } else {
        setState(() => _remaining--);
      }
    });
  }

  String get _clock {
    final m = (_remaining ~/ 60).toString().padLeft(2, '0');
    final s = (_remaining % 60).toString().padLeft(2, '0');
    return '$m:$s';
  }

  double get _progress {
    final total = _plan[_index].seconds;
    if (total == 0) return 0;
    return 1 - (_remaining / total);
  }

  @override
  Widget build(BuildContext context) {
    final cue = !_started
        ? 'Start!'
        : _plan[_index].label == 'Rest'
            ? 'Rest'
            : _plan[_index].label == 'Get ready'
                ? 'Get ready'
                : 'Work!';

    return Scaffold(
      backgroundColor: MockupColors.navyDeep,
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
              child: Row(
                children: [
                  Material(
                    color: MockupColors.navy,
                    borderRadius: BorderRadius.circular(14),
                    child: InkWell(
                      onTap: () => context.pop(),
                      borderRadius: BorderRadius.circular(14),
                      child: const SizedBox(
                        width: 44,
                        height: 44,
                        child: Icon(Icons.chevron_left,
                            color: MockupColors.white),
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Container(
                      padding: const EdgeInsets.fromLTRB(16, 10, 10, 10),
                      decoration: BoxDecoration(
                        color: MockupColors.navy,
                        borderRadius: BorderRadius.circular(22),
                      ),
                      child: Row(
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  widget.title,
                                  style: GoogleFonts.poppins(
                                    color: MockupColors.white,
                                    fontWeight: FontWeight.w700,
                                    fontSize: 15,
                                  ),
                                ),
                                Text(
                                  widget.subtitle,
                                  style: GoogleFonts.poppins(
                                    color: MockupColors.navIdle,
                                    fontSize: 11,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          Container(
                            width: 42,
                            height: 42,
                            decoration: const BoxDecoration(
                              color: MockupColors.white,
                              shape: BoxShape.circle,
                            ),
                            child: const Icon(
                              Icons.fitness_center,
                              color: MockupColors.ink,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const Spacer(),
            Text(
              cue,
              style: GoogleFonts.poppins(
                color: MockupColors.white,
                fontSize: 36,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 20),
            SizedBox(
              width: 220,
              height: 220,
              child: CustomPaint(
                painter: _RingPainter(progress: _progress),
                child: Center(
                  child: Text(
                    _clock,
                    style: GoogleFonts.poppins(
                      color: MockupColors.white,
                      fontSize: 42,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ),
            ),
            const SizedBox(height: 24),
            GestureDetector(
              onTap: _toggle,
              child: Container(
                width: 72,
                height: 72,
                decoration: const BoxDecoration(
                  color: MockupColors.yellow,
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  !_started || _paused ? Icons.play_arrow : Icons.pause,
                  size: 34,
                  color: MockupColors.ink,
                ),
              ),
            ),
            const Spacer(),
            Container(
              width: double.infinity,
              decoration: const BoxDecoration(
                color: MockupColors.white,
                borderRadius: BorderRadius.vertical(top: Radius.circular(32)),
              ),
              padding: const EdgeInsets.fromLTRB(24, 20, 24, 28),
              child: Column(
                children: [
                  for (var i = 0; i < _plan.length; i++)
                    Container(
                      margin: const EdgeInsets.only(bottom: 6),
                      padding: const EdgeInsets.symmetric(
                        horizontal: 14,
                        vertical: 10,
                      ),
                      decoration: BoxDecoration(
                        color: i == _index && _started
                            ? MockupColors.pink
                            : Colors.transparent,
                        borderRadius: BorderRadius.circular(14),
                      ),
                      child: Row(
                        children: [
                          Expanded(
                            child: Text(
                              _plan[i].label,
                              style: GoogleFonts.poppins(
                                color: i < _index
                                    ? MockupColors.muted
                                    : MockupColors.ink,
                                fontWeight: i == _index
                                    ? FontWeight.w700
                                    : FontWeight.w500,
                              ),
                            ),
                          ),
                          Text(
                            '${_plan[i].seconds}',
                            style: GoogleFonts.poppins(
                              color: i < _index
                                  ? MockupColors.muted
                                  : MockupColors.ink,
                              fontWeight: i == _index
                                  ? FontWeight.w700
                                  : FontWeight.w500,
                            ),
                          ),
                        ],
                      ),
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _RingPainter extends CustomPainter {
  _RingPainter({required this.progress});
  final double progress;

  @override
  void paint(Canvas canvas, Size size) {
    final c = Offset(size.width / 2, size.height / 2);
    final r = size.width / 2 - 10;
    final track = Paint()
      ..color = const Color(0xFF3A3548)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 14
      ..strokeCap = StrokeCap.round;
    final active = Paint()
      ..color = const Color(0xFFC8CBD8)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 14
      ..strokeCap = StrokeCap.round;
    canvas.drawCircle(c, r, track);
    canvas.drawArc(
      Rect.fromCircle(center: c, radius: r),
      -math.pi / 2,
      2 * math.pi * progress.clamp(0.0, 1.0),
      false,
      active,
    );
  }

  @override
  bool shouldRepaint(covariant _RingPainter oldDelegate) =>
      oldDelegate.progress != progress;
}
