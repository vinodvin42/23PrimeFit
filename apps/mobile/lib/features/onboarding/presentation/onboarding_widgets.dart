import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:primefit_mobile/core/theme/auth_colors.dart';

class RulerPicker extends StatefulWidget {
  const RulerPicker({
    super.key,
    required this.min,
    required this.max,
    required this.value,
    required this.onChanged,
    required this.unit,
    required this.cardColor,
    this.step = 1,
  });

  final int min;
  final int max;
  final int value;
  final ValueChanged<int> onChanged;
  final String unit;
  final Color cardColor;
  final int step;

  @override
  State<RulerPicker> createState() => _RulerPickerState();
}

class _RulerPickerState extends State<RulerPicker> {
  late final ScrollController _controller;
  static const double _itemWidth = 12;

  @override
  void initState() {
    super.initState();
    final index = ((widget.value - widget.min) / widget.step).round();
    _controller = ScrollController(
      initialScrollOffset: index * _itemWidth,
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (!_controller.hasClients) return;
    final index = (_controller.offset / _itemWidth).round().clamp(
          0,
          ((widget.max - widget.min) / widget.step).round(),
        );
    final next = widget.min + index * widget.step;
    if (next != widget.value) widget.onChanged(next);
  }

  @override
  Widget build(BuildContext context) {
    final count = ((widget.max - widget.min) / widget.step).round() + 1;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(16, 28, 16, 20),
      decoration: BoxDecoration(
        color: widget.cardColor,
        borderRadius: BorderRadius.circular(28),
      ),
      child: Column(
        children: [
          Text(
            '${widget.value}',
            style: GoogleFonts.poppins(
              fontSize: 56,
              fontWeight: FontWeight.w700,
              color: OnboardColors.ink,
              height: 1,
            ),
          ),
          const SizedBox(height: 18),
          SizedBox(
            height: 90,
            child: NotificationListener<ScrollNotification>(
              onNotification: (n) {
                if (n is ScrollUpdateNotification || n is ScrollEndNotification) {
                  _onScroll();
                }
                if (n is ScrollEndNotification) {
                  final index = (_controller.offset / _itemWidth)
                      .round()
                      .clamp(0, count - 1);
                  _controller.animateTo(
                    index * _itemWidth,
                    duration: const Duration(milliseconds: 120),
                    curve: Curves.easeOut,
                  );
                }
                return false;
              },
              child: Stack(
                alignment: Alignment.center,
                children: [
                  ListView.builder(
                    controller: _controller,
                    scrollDirection: Axis.horizontal,
                    physics: const BouncingScrollPhysics(),
                    itemCount: count,
                    padding: EdgeInsets.symmetric(
                      horizontal: MediaQuery.sizeOf(context).width / 2 - 40,
                    ),
                    itemBuilder: (context, i) {
                      final v = widget.min + i * widget.step;
                      final major = v % 10 == 0;
                      return SizedBox(
                        width: _itemWidth,
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.end,
                          children: [
                            if (major)
                              Text(
                                '$v',
                                style: GoogleFonts.poppins(
                                  fontSize: 11,
                                  color: OnboardColors.ink.withValues(alpha: 0.55),
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                            const SizedBox(height: 6),
                            Container(
                              width: major ? 2 : 1.2,
                              height: major ? 34 : 18,
                              color: OnboardColors.ink.withValues(
                                alpha: major ? 0.75 : 0.35,
                              ),
                            ),
                            const SizedBox(height: 10),
                          ],
                        ),
                      );
                    },
                  ),
                  IgnorePointer(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.end,
                      children: [
                        Container(
                          width: 2.5,
                          height: 48,
                          color: OnboardColors.ink,
                        ),
                        const SizedBox(height: 4),
                        Text(
                          widget.unit,
                          style: GoogleFonts.poppins(
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            color: OnboardColors.ink,
                          ),
                        ),
                        const SizedBox(height: 6),
                      ],
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

class UnitToggle extends StatelessWidget {
  const UnitToggle({
    super.key,
    required this.left,
    required this.right,
    required this.rightSelected,
    required this.onChanged,
  });

  final String left;
  final String right;
  final bool rightSelected;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(3),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(28),
        border: Border.all(color: OnboardColors.border),
        color: Colors.white,
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          _seg(left, !rightSelected, () => onChanged(false)),
          _seg(right, rightSelected, () => onChanged(true), dark: true),
        ],
      ),
    );
  }

  Widget _seg(String label, bool selected, VoidCallback onTap, {bool dark = false}) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 10),
        decoration: BoxDecoration(
          color: selected
              ? (dark || selected ? OnboardColors.ink : Colors.white)
              : Colors.transparent,
          borderRadius: BorderRadius.circular(24),
        ),
        child: Text(
          label,
          style: GoogleFonts.poppins(
            fontSize: 14,
            fontWeight: FontWeight.w600,
            color: selected ? Colors.white : OnboardColors.muted,
          ),
        ),
      ),
    );
  }
}

class OnboardProgress extends StatelessWidget {
  const OnboardProgress({super.key, required this.step, this.total = 3});

  final int step;
  final int total;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: List.generate(total, (i) {
        final active = i == step;
        final done = i < step;
        return Expanded(
          child: Container(
            height: 5,
            margin: EdgeInsets.only(right: i == total - 1 ? 0 : 8),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(8),
              color: active
                  ? OnboardColors.accent
                  : done
                      ? OnboardColors.progressDone
                      : OnboardColors.border,
            ),
          ),
        );
      }),
    );
  }
}

class OnboardNavBar extends StatelessWidget {
  const OnboardNavBar({
    super.key,
    required this.onBack,
    required this.onNext,
    this.nextLabel = 'Next',
    this.showChevrons = true,
    this.loading = false,
  });

  final VoidCallback onBack;
  final VoidCallback? onNext;
  final String nextLabel;
  final bool showChevrons;
  final bool loading;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 16),
        child: Row(
          children: [
            Material(
              color: Colors.white,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(16),
                side: const BorderSide(color: OnboardColors.border),
              ),
              child: InkWell(
                onTap: onBack,
                borderRadius: BorderRadius.circular(16),
                child: const SizedBox(
                  width: 52,
                  height: 52,
                  child: Icon(Icons.chevron_left, color: OnboardColors.ink, size: 28),
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: SizedBox(
                height: 52,
                child: ElevatedButton(
                  onPressed: loading ? null : onNext,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: OnboardColors.accent,
                    foregroundColor: Colors.white,
                    elevation: 0,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(28),
                    ),
                    textStyle: GoogleFonts.poppins(
                      fontWeight: FontWeight.w700,
                      fontSize: 16,
                    ),
                  ),
                  child: loading
                      ? const SizedBox(
                          width: 22,
                          height: 22,
                          child: CircularProgressIndicator(
                            strokeWidth: 2.2,
                            color: Colors.white,
                          ),
                        )
                      : Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Text(nextLabel),
                            if (showChevrons) ...[
                              const SizedBox(width: 8),
                              Text(
                                '>>>',
                                style: GoogleFonts.poppins(
                                  color: Colors.white70,
                                  fontWeight: FontWeight.w600,
                                  fontSize: 14,
                                  letterSpacing: -1,
                                ),
                              ),
                            ],
                          ],
                        ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
