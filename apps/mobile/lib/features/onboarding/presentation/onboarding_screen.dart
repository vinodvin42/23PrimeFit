import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:primefit_mobile/core/theme/auth_colors.dart';
import 'package:primefit_mobile/core/widgets/brand_mark.dart';
import 'package:primefit_mobile/features/auth/application/auth_controller.dart';
import 'package:primefit_mobile/features/onboarding/presentation/onboarding_widgets.dart';

class OnboardingScreen extends ConsumerStatefulWidget {
  const OnboardingScreen({super.key});

  @override
  ConsumerState<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends ConsumerState<OnboardingScreen> {
  /// 0 = hero, 1 = weight, 2 = height, 3 = goals
  int _step = 0;
  bool _saving = false;

  int _weightKg = 70;
  bool _weightInKg = true;
  int _heightCm = 170;
  bool _heightInCm = true;
  String? _goal;

  static const _goals = [
    ('MUSCLE_GAIN', 'Strength Training for Muscle Gain'),
    ('WEIGHT_LOSS', 'High-Intensity Interval Training for Fat Loss'),
    ('ENDURANCE', 'Cardiovascular Exercise for Fat Loss'),
    ('GENERAL_FITNESS', 'Functional Training for Overall Fitness'),
  ];

  int get _displayWeight =>
      _weightInKg ? _weightKg : (_weightKg * 2.20462).round();

  int get _displayHeight =>
      _heightInCm ? _heightCm : (_heightCm / 2.54).round();

  Future<void> _finish({bool skip = false}) async {
    if (!skip && _goal == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Select a goal to continue')),
      );
      return;
    }
    setState(() => _saving = true);
    try {
      final user = ref.read(authControllerProvider).user;
      await ref.read(authControllerProvider.notifier).completeOnboarding({
        if (user?.displayName == null || (user?.displayName?.isEmpty ?? true))
          'displayName': user?.email?.split('@').first ?? 'Athlete',
        'heightCm': _heightCm.toDouble(),
        'weightKg': _weightKg.toDouble(),
        'goals': [_goal ?? 'GENERAL_FITNESS'],
        'activityLevel': 'MODERATE',
      });
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Could not save profile: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_step == 0) return _hero();
    return Theme(
      data: ThemeData(
        useMaterial3: true,
        brightness: Brightness.light,
        scaffoldBackgroundColor: OnboardColors.bg,
        colorScheme: const ColorScheme.light(
          primary: OnboardColors.accent,
          onPrimary: Colors.white,
          surface: OnboardColors.bg,
          onSurface: OnboardColors.ink,
        ),
      ),
      child: Scaffold(
        body: SafeArea(
          child: AnimatedSwitcher(
            duration: const Duration(milliseconds: 280),
            child: KeyedSubtree(
              key: ValueKey(_step),
              child: _step == 1
                  ? _weightStep()
                  : _step == 2
                      ? _heightStep()
                      : _goalsStep(),
            ),
          ),
        ),
        bottomNavigationBar: OnboardNavBar(
          onBack: () => setState(() => _step--),
          onNext: _saving
              ? null
              : () {
                  if (_step < 3) {
                    setState(() => _step++);
                  } else {
                    _finish();
                  }
                },
          nextLabel: _step == 3 ? 'Start Now' : 'Next',
          showChevrons: _step < 3,
          loading: _saving,
        ),
      ),
    );
  }

  Widget _hero() {
    return Scaffold(
      body: Container(
        width: double.infinity,
        height: double.infinity,
        decoration: const BoxDecoration(gradient: AuthColors.background),
        child: Stack(
          children: [
            Positioned(
              right: -40,
              top: 80,
              child: Container(
                width: 160,
                height: 160,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: Colors.white.withValues(alpha: 0.06),
                ),
              ),
            ),
            Positioned(
              right: 40,
              top: 40,
              child: Container(
                width: 70,
                height: 70,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: Colors.white.withValues(alpha: 0.05),
                ),
              ),
            ),
            SafeArea(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(24, 20, 24, 24),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Start your\nFitness Journey',
                      style: GoogleFonts.poppins(
                        color: Colors.white,
                        fontSize: 34,
                        fontWeight: FontWeight.w700,
                        height: 1.15,
                      ),
                    ),
                    const SizedBox(height: 10),
                    Text(
                      "Start your fitness journey with our app's guidance and support.",
                      style: GoogleFonts.poppins(
                        color: Colors.white.withValues(alpha: 0.85),
                        fontSize: 14,
                        height: 1.45,
                      ),
                    ),
                    const SizedBox(height: 18),
                    Expanded(
                      child: Stack(
                        clipBehavior: Clip.none,
                        children: [
                          Positioned(
                            left: 8,
                            top: 24,
                            child: SquiggleArrow(
                              color: Colors.white.withValues(alpha: 0.45),
                            ),
                          ),
                          Align(
                            alignment: const Alignment(0.55, 0.1),
                            child: ClipRRect(
                              borderRadius: BorderRadius.circular(28),
                              child: Image.asset(
                                'assets/images/athlete_hero.jpg',
                                height: 360,
                                width: 260,
                                fit: BoxFit.cover,
                                errorBuilder: (context, error, stackTrace) => Container(
                                  height: 360,
                                  width: 260,
                                  color: AuthColors.secondaryBtn,
                                  child: const Center(
                                    child: BrandMark(size: 96),
                                  ),
                                ),
                              ),
                            ),
                          ),
                          Positioned(
                            left: 0,
                            bottom: 88,
                            child: _drinkCard(),
                          ),
                        ],
                      ),
                    ),
                    _letsStartBar(),
                    const SizedBox(height: 10),
                    Center(
                      child: TextButton(
                        onPressed: _saving ? null : () => _finish(skip: true),
                        child: Text(
                          'Skip for now — open app',
                          style: GoogleFonts.poppins(
                            color: Colors.white70,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _drinkCard() {
    return Container(
      width: 132,
      padding: const EdgeInsets.fromLTRB(12, 12, 12, 10),
      decoration: BoxDecoration(
        color: const Color(0xFFE8E6EA),
        borderRadius: BorderRadius.circular(22),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 34,
                height: 34,
                decoration: const BoxDecoration(
                  color: Colors.white,
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.nightlight_round, size: 18, color: Colors.black87),
              ),
              const SizedBox(width: 8),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Drink',
                    style: GoogleFonts.poppins(
                      fontSize: 11,
                      color: Colors.black54,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                  Text(
                    '150 ml',
                    style: GoogleFonts.poppins(
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                      color: Colors.black87,
                    ),
                  ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 12),
          SizedBox(
            height: 36,
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [18, 28, 14, 32, 22, 26]
                  .map(
                    (h) => Expanded(
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 2),
                        child: Container(
                          height: h.toDouble(),
                          decoration: BoxDecoration(
                            color: Colors.black38,
                            borderRadius: BorderRadius.circular(4),
                          ),
                        ),
                      ),
                    ),
                  )
                  .toList(),
            ),
          ),
        ],
      ),
    );
  }

  Widget _letsStartBar() {
    return GestureDetector(
      onTap: () => setState(() => _step = 1),
      onHorizontalDragEnd: (d) {
        if ((d.primaryVelocity ?? 0) > 200) setState(() => _step = 1);
      },
      child: Container(
        height: 64,
        padding: const EdgeInsets.symmetric(horizontal: 10),
        decoration: BoxDecoration(
          color: AuthColors.accent,
          borderRadius: BorderRadius.circular(36),
          border: Border.all(color: Colors.white.withValues(alpha: 0.18)),
        ),
        child: Row(
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: const BoxDecoration(
                color: Colors.white,
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.chevron_right, color: OnboardColors.ink),
            ),
            Expanded(
              child: Text(
                'Lets start',
                textAlign: TextAlign.center,
                style: GoogleFonts.poppins(
                  color: Colors.white,
                  fontWeight: FontWeight.w600,
                  fontSize: 16,
                ),
              ),
            ),
            Text(
              '>>>',
              style: GoogleFonts.poppins(
                color: Colors.white54,
                fontWeight: FontWeight.w600,
                letterSpacing: -1,
              ),
            ),
            const SizedBox(width: 10),
          ],
        ),
      ),
    );
  }

  Widget _weightStep() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(24, 16, 24, 0),
      child: Column(
        children: [
          const OnboardProgress(step: 0),
          const SizedBox(height: 28),
          Text(
            'What is your weight?',
            style: GoogleFonts.poppins(
              fontSize: 24,
              fontWeight: FontWeight.w700,
              color: OnboardColors.ink,
            ),
          ),
          const SizedBox(height: 18),
          UnitToggle(
            left: 'lb',
            right: 'kg',
            rightSelected: _weightInKg,
            onChanged: (kg) {
              setState(() => _weightInKg = kg);
            },
          ),
          const SizedBox(height: 28),
          RulerPicker(
            min: _weightInKg ? 35 : 77,
            max: _weightInKg ? 150 : 330,
            value: _displayWeight,
            unit: _weightInKg ? 'kg' : 'lb',
            cardColor: OnboardColors.weightCard,
            onChanged: (v) {
              setState(() {
                _weightKg = _weightInKg ? v : (v / 2.20462).round();
              });
            },
          ),
        ],
      ),
    );
  }

  Widget _heightStep() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(24, 16, 24, 0),
      child: Column(
        children: [
          const OnboardProgress(step: 1),
          const SizedBox(height: 28),
          Text(
            'What is your height?',
            style: GoogleFonts.poppins(
              fontSize: 24,
              fontWeight: FontWeight.w700,
              color: OnboardColors.ink,
            ),
          ),
          const SizedBox(height: 18),
          UnitToggle(
            left: 'inches',
            right: 'cm',
            rightSelected: _heightInCm,
            onChanged: (cm) => setState(() => _heightInCm = cm),
          ),
          const SizedBox(height: 28),
          RulerPicker(
            min: _heightInCm ? 120 : 48,
            max: _heightInCm ? 220 : 86,
            value: _displayHeight,
            unit: _heightInCm ? 'cm' : 'in',
            cardColor: OnboardColors.heightCard,
            onChanged: (v) {
              setState(() {
                _heightCm = _heightInCm ? v : (v * 2.54).round();
              });
            },
          ),
        ],
      ),
    );
  }

  Widget _goalsStep() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(24, 16, 24, 0),
      child: Column(
        children: [
          const OnboardProgress(step: 2),
          const SizedBox(height: 24),
          Text(
            'What do you want to achieve?',
            textAlign: TextAlign.center,
            style: GoogleFonts.poppins(
              fontSize: 22,
              fontWeight: FontWeight.w700,
              color: OnboardColors.ink,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'What you are going to select will affect your workout program',
            textAlign: TextAlign.center,
            style: GoogleFonts.poppins(
              fontSize: 13,
              color: OnboardColors.muted,
              height: 1.4,
            ),
          ),
          const SizedBox(height: 22),
          Expanded(
            child: ListView.separated(
              itemCount: _goals.length,
              separatorBuilder: (_, index) => const SizedBox(height: 12),
              itemBuilder: (context, i) {
                final (key, label) = _goals[i];
                final selected = _goal == key;
                return GestureDetector(
                  onTap: () => setState(() => _goal = key),
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 180),
                    padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 22),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(22),
                      border: Border.all(
                              color: selected ? OnboardColors.accent : OnboardColors.border,
                        width: selected ? 2 : 1,
                      ),
                    ),
                    child: Stack(
                      clipBehavior: Clip.none,
                      children: [
                        Center(
                          child: Text(
                            label,
                            textAlign: TextAlign.center,
                            style: GoogleFonts.poppins(
                              fontSize: 14,
                              fontWeight: FontWeight.w600,
                              color: OnboardColors.ink,
                            ),
                          ),
                        ),
                        if (selected)
                          Positioned(
                            right: -6,
                            top: -28,
                            child: Container(
                              width: 26,
                              height: 26,
                              decoration: const BoxDecoration(
                                color: OnboardColors.accent,
                                shape: BoxShape.circle,
                              ),
                              child: const Icon(
                                Icons.check,
                                size: 16,
                                color: Colors.white,
                              ),
                            ),
                          ),
                      ],
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
