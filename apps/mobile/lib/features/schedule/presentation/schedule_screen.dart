import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import 'package:primefit_mobile/core/theme/app_theme.dart';
import 'package:primefit_mobile/features/workouts/data/fitness_repository.dart';
import 'package:primefit_mobile/features/workouts/domain/workout_models.dart';

class ScheduleScreen extends ConsumerStatefulWidget {
  const ScheduleScreen({super.key});

  @override
  ConsumerState<ScheduleScreen> createState() => _ScheduleScreenState();
}

class _ScheduleScreenState extends ConsumerState<ScheduleScreen> {
  late DateTime _month;
  late DateTime _selected;

  @override
  void initState() {
    super.initState();
    final now = DateTime.now();
    _month = DateTime(now.year, now.month);
    _selected = DateTime(now.year, now.month, now.day);
  }

  @override
  Widget build(BuildContext context) {
    final mine = ref.watch(myWorkoutsProvider);
    final dateLabel = DateFormat('EEE, d MMM').format(_selected);
    final isToday = DateUtils.isSameDay(_selected, DateTime.now());

    return Scaffold(
      backgroundColor: AppColors.canvas,
      body: SafeArea(
        bottom: false,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(24, 8, 16, 0),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          isToday ? 'TODAY' : 'SCHEDULE',
                          style: GoogleFonts.poppins(
                            color: AppColors.lime,
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                            letterSpacing: 1.4,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          dateLabel,
                          style: GoogleFonts.poppins(
                            color: AppColors.ink,
                            fontSize: 28,
                            fontWeight: FontWeight.w700,
                            letterSpacing: -0.5,
                          ),
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    onPressed: () => setState(() {
                      _month = DateTime(_month.year, _month.month - 1);
                    }),
                    icon: const Icon(Icons.chevron_left, color: AppColors.muted),
                  ),
                  IconButton(
                    onPressed: () => setState(() {
                      _month = DateTime(_month.year, _month.month + 1);
                    }),
                    icon:
                        const Icon(Icons.chevron_right, color: AppColors.muted),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            _WeekStrip(
              month: _month,
              selected: _selected,
              onSelect: (d) => setState(() {
                _selected = d;
                _month = DateTime(d.year, d.month);
              }),
            ),
            const SizedBox(height: 8),
            Expanded(
              child: mine.when(
                loading: () => const Center(
                  child: CircularProgressIndicator(color: AppColors.lime),
                ),
                error: (e, _) => Center(
                  child: Text('$e', style: const TextStyle(color: AppColors.danger)),
                ),
                data: (data) => _SessionList(
                  sessions: data.sessions,
                  selected: _selected,
                  onBrowse: () => context.push('/train'),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _WeekStrip extends StatelessWidget {
  const _WeekStrip({
    required this.month,
    required this.selected,
    required this.onSelect,
  });

  final DateTime month;
  final DateTime selected;
  final ValueChanged<DateTime> onSelect;

  @override
  Widget build(BuildContext context) {
    final daysInMonth = DateUtils.getDaysInMonth(month.year, month.month);
    final start = selected.day > 3 ? selected.day - 3 : 1;
    final end = (start + 6).clamp(1, daysInMonth);
    final days = [for (var d = start; d <= end; d++) d];

    return SizedBox(
      height: 78,
      child: ListView.separated(
        padding: const EdgeInsets.symmetric(horizontal: 20),
        scrollDirection: Axis.horizontal,
        itemCount: days.length,
        separatorBuilder: (_, _) => const SizedBox(width: 10),
        itemBuilder: (context, i) {
          final day = days[i];
          final date = DateTime(month.year, month.month, day);
          final isSelected = DateUtils.isSameDay(date, selected);
          final weekday = DateFormat('E').format(date).substring(0, 2);
          return GestureDetector(
            onTap: () => onSelect(date),
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              width: 54,
              decoration: BoxDecoration(
                color: isSelected ? AppColors.lime : AppColors.surface,
                borderRadius: BorderRadius.circular(18),
                border: Border.all(
                  color: isSelected ? AppColors.lime : AppColors.line,
                ),
              ),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    weekday.toUpperCase(),
                    style: GoogleFonts.poppins(
                      color: isSelected
                          ? AppColors.white.withValues(alpha: 0.85)
                          : AppColors.muted,
                      fontSize: 10,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '$day',
                    style: GoogleFonts.poppins(
                      color: isSelected
                          ? AppColors.white
                          : AppColors.ink,
                      fontSize: 18,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}

class _SessionList extends StatelessWidget {
  const _SessionList({
    required this.sessions,
    required this.selected,
    required this.onBrowse,
  });

  final List<WorkoutSessionSummary> sessions;
  final DateTime selected;
  final VoidCallback onBrowse;

  @override
  Widget build(BuildContext context) {
    final daySessions = sessions.where((s) {
      if (s.scheduledFor == null) return true;
      final dt = DateTime.tryParse(s.scheduledFor!);
      if (dt == null) return true;
      return DateUtils.isSameDay(dt.toLocal(), selected);
    }).toList();

    if (daySessions.isEmpty && sessions.isEmpty) {
      return ListView(
        padding: const EdgeInsets.fromLTRB(24, 24, 24, 120),
        children: [
          _EmptyCard(onBrowse: onBrowse),
        ],
      );
    }

    final list = daySessions.isEmpty ? sessions.take(6).toList() : daySessions;

    return ListView(
      padding: const EdgeInsets.fromLTRB(24, 20, 24, 120),
      children: [
        Row(
          children: [
            Text(
              daySessions.isEmpty ? 'Upcoming sessions' : 'Your plan',
              style: GoogleFonts.poppins(
                color: AppColors.ink,
                fontSize: 18,
                fontWeight: FontWeight.w700,
              ),
            ),
            const Spacer(),
            TextButton(
              onPressed: onBrowse,
              child: Text(
                'Programs',
                style: GoogleFonts.poppins(
                  color: AppColors.lime,
                  fontWeight: FontWeight.w600,
                  fontSize: 13,
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        ...list.map((s) => _SessionCard(session: s)),
      ],
    );
  }
}

class _EmptyCard extends StatelessWidget {
  const _EmptyCard({required this.onBrowse});
  final VoidCallback onBrowse;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: AppColors.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.fitness_center, color: AppColors.lime, size: 28),
          const SizedBox(height: 14),
          Text(
            'No sessions yet',
            style: GoogleFonts.poppins(
              color: AppColors.ink,
              fontSize: 20,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Assign a program in Train and your workouts will appear here.',
            style: GoogleFonts.poppins(
              color: AppColors.muted,
              fontSize: 14,
              height: 1.45,
            ),
          ),
          const SizedBox(height: 18),
          FilledButton(
            onPressed: onBrowse,
            child: const Text('Browse programs'),
          ),
        ],
      ),
    );
  }
}

class _SessionCard extends StatelessWidget {
  const _SessionCard({required this.session});

  final WorkoutSessionSummary session;

  @override
  Widget build(BuildContext context) {
    final done = session.status == 'COMPLETED';
    final time = session.scheduledFor != null
        ? DateFormat('h:mm a').format(
            (DateTime.tryParse(session.scheduledFor!) ?? DateTime.now())
                .toLocal(),
          )
        : 'Flexible';

    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Material(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(22),
        child: InkWell(
          borderRadius: BorderRadius.circular(22),
          onTap: () => context.push('/session/${session.id}'),
          child: Container(
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(22),
              border: Border.all(
                color: done
                    ? AppColors.lime.withValues(alpha: 0.35)
                    : AppColors.line,
              ),
            ),
            child: Row(
              children: [
                Container(
                  width: 4,
                  height: 64,
                  decoration: BoxDecoration(
                    color: done ? AppColors.limeDim : AppColors.lime,
                    borderRadius: BorderRadius.circular(99),
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        time,
                        style: GoogleFonts.poppins(
                          color: AppColors.muted,
                          fontSize: 12,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        session.title,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: GoogleFonts.poppins(
                          color: AppColors.ink,
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                          height: 1.25,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 10,
                          vertical: 4,
                        ),
                        decoration: BoxDecoration(
                          color: done
                              ? AppColors.lime.withValues(alpha: 0.15)
                              : AppColors.mint,
                          borderRadius: BorderRadius.circular(99),
                        ),
                        child: Text(
                          done ? 'Completed' : session.status.toLowerCase(),
                          style: GoogleFonts.poppins(
                            color: done ? AppColors.lime : AppColors.muted,
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                if (!done)
                  Container(
                    width: 44,
                    height: 44,
                    decoration: const BoxDecoration(
                      color: AppColors.lime,
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(
                      Icons.play_arrow_rounded,
                      color: AppColors.white,
                    ),
                  )
                else
                  const Icon(Icons.check_circle, color: AppColors.lime),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
