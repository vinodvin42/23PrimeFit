import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:primefit_mobile/core/theme/mockup_colors.dart';

/// Demo run tracker with a light route map and white stats sheet.
class RunActivityScreen extends StatefulWidget {
  const RunActivityScreen({
    super.key,
    this.title = 'WarmUp',
    this.subtitle = 'Run 02 km',
  });

  final String title;
  final String subtitle;

  @override
  State<RunActivityScreen> createState() => _RunActivityScreenState();
}

class _RunActivityScreenState extends State<RunActivityScreen>
    with SingleTickerProviderStateMixin {
  late final AnimationController _pulse;
  Timer? _timer;
  bool _paused = false;
  int _elapsedSec = 0;
  double _km = 0.12;
  late final DateTime _startedAt;
  final _path = <Offset>[];

  @override
  void initState() {
    super.initState();
    _startedAt = DateTime.now();
    _pulse = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1400),
    )..repeat(reverse: true);
    _seedPath();
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (_paused || !mounted) return;
      setState(() {
        _elapsedSec++;
        _km = (0.12 + _elapsedSec * 0.0018).clamp(0.0, 2.0);
        _advancePath();
      });
    });
  }

  void _seedPath() {
    const origin = Offset(0.28, 0.62);
    _path.add(origin);
    for (var i = 1; i < 18; i++) {
      _path.add(Offset(
        origin.dx + i * 0.028,
        origin.dy - math.sin(i / 3.2) * 0.08 - i * 0.008,
      ));
    }
  }

  void _advancePath() {
    if (_path.isEmpty) return;
    final last = _path.last;
    _path.add(Offset(
      (last.dx + 0.006).clamp(0.05, 0.92),
      (last.dy - 0.004 + math.sin(_elapsedSec / 4) * 0.004).clamp(0.2, 0.85),
    ));
    if (_path.length > 60) _path.removeAt(0);
  }

  @override
  void dispose() {
    _timer?.cancel();
    _pulse.dispose();
    super.dispose();
  }

  String get _timeLabel {
    final m = (_elapsedSec ~/ 60).toString().padLeft(2, '0');
    final s = (_elapsedSec % 60).toString().padLeft(2, '0');
    return '$m:$s';
  }

  int get _calories => (80 + _elapsedSec * 0.38).round();

  void _finish() {
    context.pushReplacement(
      '/activity/complete',
      extra: {
        'title': widget.title,
        'km': _km,
        'seconds': _elapsedSec,
        'calories': _calories,
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final started =
        '${_startedAt.hour.toString().padLeft(2, '0')}:${_startedAt.minute.toString().padLeft(2, '0')}';

    return Scaffold(
      backgroundColor: MockupColors.sheetAlt,
      body: Stack(
        children: [
          Positioned.fill(
            child: AnimatedBuilder(
              animation: _pulse,
              builder: (context, _) {
                return CustomPaint(
                  painter: _DarkMapPainter(
                    path: _path,
                    pulse: _pulse.value,
                  ),
                );
              },
            ),
          ),
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
              child: Row(
                children: [
                  _SquareBack(onTap: () => context.pop()),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Container(
                      padding: const EdgeInsets.fromLTRB(16, 10, 10, 10),
                      decoration: BoxDecoration(
                        color: MockupColors.navy.withValues(alpha: 0.92),
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
                                    fontSize: 16,
                                  ),
                                ),
                                Text(
                                  widget.subtitle,
                                  style: GoogleFonts.poppins(
                                    color: MockupColors.navIdle,
                                    fontSize: 12,
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
                              Icons.directions_run,
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
          ),
          if (_path.isNotEmpty)
            Positioned(
              left: MediaQuery.sizeOf(context).width * _path.last.dx - 70,
              top: MediaQuery.sizeOf(context).height * _path.last.dy - 78,
              child: Container(
                width: 160,
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: MockupColors.white,
                  borderRadius: BorderRadius.circular(14),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.2),
                      blurRadius: 12,
                    ),
                  ],
                ),
                child: Row(
                  children: [
                    Container(
                      width: 8,
                      height: 8,
                      decoration: const BoxDecoration(
                        color: MockupColors.pinkBorder,
                        shape: BoxShape.circle,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            '2972 Westheimer',
                            style: GoogleFonts.poppins(
                              color: MockupColors.ink,
                              fontWeight: FontWeight.w700,
                              fontSize: 11,
                            ),
                          ),
                          Text(
                            'Rd. Santa Ana, Illinois',
                            style: GoogleFonts.poppins(
                              color: MockupColors.muted,
                              fontSize: 10,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          Align(
            alignment: Alignment.bottomCenter,
            child: Container(
              width: double.infinity,
              decoration: const BoxDecoration(
                color: MockupColors.white,
                borderRadius: BorderRadius.vertical(top: Radius.circular(36)),
              ),
              padding: const EdgeInsets.fromLTRB(24, 0, 24, 28),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Transform.translate(
                    offset: const Offset(0, -28),
                    child: GestureDetector(
                      onTap: () => setState(() => _paused = !_paused),
                      onLongPress: _finish,
                      child: Container(
                        width: 72,
                        height: 72,
                        decoration: const BoxDecoration(
                          color: MockupColors.emerald,
                          shape: BoxShape.circle,
                        ),
                        child: Icon(
                          _paused ? Icons.play_arrow : Icons.pause,
                          size: 34,
                          color: MockupColors.white,
                        ),
                      ),
                    ),
                  ),
                  Text(
                    _km.toStringAsFixed(2),
                    style: GoogleFonts.poppins(
                      color: MockupColors.ink,
                      fontSize: 56,
                      fontWeight: FontWeight.w700,
                      height: 1,
                    ),
                  ),
                  Text(
                    'Km',
                    style: GoogleFonts.poppins(
                      color: MockupColors.muted,
                      fontSize: 16,
                    ),
                  ),
                  const SizedBox(height: 22),
                  Row(
                    children: [
                      _Stat(value: started, label: 'Started'),
                      _Stat(value: _timeLabel, label: 'Time'),
                      _Stat(value: '$_calories', label: 'Calories'),
                    ],
                  ),
                  const SizedBox(height: 8),
                  TextButton(
                    onPressed: _finish,
                    style: TextButton.styleFrom(
                      backgroundColor: MockupColors.emerald,
                      foregroundColor: MockupColors.white,
                      minimumSize: const Size.fromHeight(48),
                      shape: const StadiumBorder(),
                    ),
                    child: Text(
                      'Finish run',
                      style: GoogleFonts.poppins(
                        color: MockupColors.white,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _Stat extends StatelessWidget {
  const _Stat({required this.value, required this.label});
  final String value;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Column(
        children: [
          Text(
            value,
            style: GoogleFonts.poppins(
              color: MockupColors.ink,
              fontSize: 22,
              fontWeight: FontWeight.w700,
            ),
          ),
          Text(
            label,
            style: GoogleFonts.poppins(
              color: MockupColors.muted,
              fontSize: 12,
            ),
          ),
        ],
      ),
    );
  }
}

class _SquareBack extends StatelessWidget {
  const _SquareBack({required this.onTap});
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: MockupColors.navy,
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: const SizedBox(
          width: 44,
          height: 44,
          child: Icon(Icons.chevron_left, color: MockupColors.white),
        ),
      ),
    );
  }
}

class _DarkMapPainter extends CustomPainter {
  _DarkMapPainter({required this.path, required this.pulse});

  final List<Offset> path;
  final double pulse;

  @override
  void paint(Canvas canvas, Size size) {
    final bg = Paint()..color = MockupColors.sheetAlt;
    canvas.drawRect(Offset.zero & size, bg);

    final road = Paint()
      ..color = const Color(0xFFDDE3E0)
      ..strokeWidth = 10
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round;
    final roadThin = Paint()
      ..color = const Color(0xFFE8ECEA)
      ..strokeWidth = 3
      ..style = PaintingStyle.stroke;

    for (var i = 0; i < 8; i++) {
      final y = size.height * (0.18 + i * 0.1);
      canvas.drawLine(Offset(0, y), Offset(size.width, y), roadThin);
    }
    for (var i = 0; i < 6; i++) {
      final x = size.width * (0.12 + i * 0.16);
      canvas.drawLine(Offset(x, 0), Offset(x, size.height), road);
    }

    if (path.length > 1) {
      final route = Path()
        ..moveTo(path.first.dx * size.width, path.first.dy * size.height);
      for (final p in path.skip(1)) {
        route.lineTo(p.dx * size.width, p.dy * size.height);
      }
      canvas.drawPath(
        route,
        Paint()
          ..color = MockupColors.coral
          ..strokeWidth = 5
          ..style = PaintingStyle.stroke
          ..strokeCap = StrokeCap.round
          ..strokeJoin = StrokeJoin.round,
      );
      final last = path.last;
      final c = Offset(last.dx * size.width, last.dy * size.height);
      canvas.drawCircle(
        c,
        18 + pulse * 10,
        Paint()..color = MockupColors.coral.withValues(alpha: 0.25),
      );
      canvas.drawCircle(c, 8, Paint()..color = MockupColors.emerald);
    }
  }

  @override
  bool shouldRepaint(covariant _DarkMapPainter oldDelegate) => true;
}
