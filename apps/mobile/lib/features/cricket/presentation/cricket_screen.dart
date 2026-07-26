import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:primefit_mobile/core/theme/mockup_colors.dart';
import 'package:primefit_mobile/features/workouts/data/fitness_repository.dart';

class CricketScreen extends ConsumerStatefulWidget {
  const CricketScreen({super.key});

  @override
  ConsumerState<CricketScreen> createState() => _CricketScreenState();
}

class _CricketScreenState extends ConsumerState<CricketScreen> {
  String _role = 'ALL_ROUNDER';
  String _kind = 'NETS';
  final _overs = TextEditingController(text: '4');
  final _rpe = TextEditingController(text: '6');
  final _duration = TextEditingController(text: '60');
  bool _busy = false;

  @override
  void dispose() {
    _overs.dispose();
    _rpe.dispose();
    _duration.dispose();
    super.dispose();
  }

  Future<void> _saveProfile() async {
    setState(() => _busy = true);
    try {
      await ref.read(fitnessRepositoryProvider).upsertCricketProfile({
        'primaryRole': _role,
        'teamLevel': 'CLUB',
      });
      ref.invalidate(cricketDashboardProvider);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Cricket profile saved')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _logSession() async {
    setState(() => _busy = true);
    try {
      await ref.read(fitnessRepositoryProvider).logCricketSession({
        'kind': _kind,
        'durationMin': int.tryParse(_duration.text) ?? 60,
        'rpe': int.tryParse(_rpe.text),
        'overs': double.tryParse(_overs.text),
      });
      ref.invalidate(cricketDashboardProvider);
      ref.invalidate(intelligenceTodayProvider);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Session logged — load refreshed')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final dash = ref.watch(cricketDashboardProvider);

    return Scaffold(
      backgroundColor: MockupColors.navyDeep,
      appBar: AppBar(
        backgroundColor: MockupColors.navyDeep,
        title: Text(
          'Cricket',
          style: GoogleFonts.poppins(fontWeight: FontWeight.w700),
        ),
      ),
      body: dash.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('$e')),
        data: (data) {
          final load = data['load'] as Map<String, dynamic>? ?? {};
          final profile = data['profile'] as Map<String, dynamic>? ?? {};
          final sessions =
              (data['recentSessions'] as List? ?? []).cast<Map<String, dynamic>>();
          final role = profile['primaryRole']?.toString() ?? _role;

          return ListView(
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
            children: [
              Text(
                data['disclaimer']?.toString() ??
                    'Wellness guidance — not selection science.',
                style: GoogleFonts.poppins(
                  color: MockupColors.navIdle,
                  fontSize: 12,
                ),
              ),
              const SizedBox(height: 16),
              _Card(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Role setup',
                      style: GoogleFonts.poppins(
                        color: MockupColors.ink,
                        fontWeight: FontWeight.w700,
                        fontSize: 16,
                      ),
                    ),
                    const SizedBox(height: 8),
                    DropdownButtonFormField<String>(
                      // ignore: deprecated_member_use
                      value: _role != role ? _role : role,
                      items: const [
                        DropdownMenuItem(value: 'BATTER', child: Text('Batter')),
                        DropdownMenuItem(value: 'BOWLER', child: Text('Bowler')),
                        DropdownMenuItem(value: 'KEEPER', child: Text('Keeper')),
                        DropdownMenuItem(
                          value: 'ALL_ROUNDER',
                          child: Text('All-rounder'),
                        ),
                      ],
                      onChanged: (v) => setState(() => _role = v ?? _role),
                    ),
                    const SizedBox(height: 8),
                    ElevatedButton(
                      onPressed: _busy ? null : _saveProfile,
                      child: const Text('Save role'),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 12),
              _Card(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Bowling load',
                      style: GoogleFonts.poppins(
                        color: MockupColors.ink,
                        fontWeight: FontWeight.w700,
                        fontSize: 16,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        _Metric(
                          label: '7d overs',
                          value: (load['overs7'] as num?)?.toStringAsFixed(1) ??
                              '—',
                        ),
                        _Metric(
                          label: '28d overs',
                          value: (load['overs28'] as num?)?.toStringAsFixed(1) ??
                              '—',
                        ),
                        _Metric(
                          label: 'ACWR',
                          value: '${load['acwr'] ?? '—'}',
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 12),
              _Card(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Log session',
                      style: GoogleFonts.poppins(
                        color: MockupColors.ink,
                        fontWeight: FontWeight.w700,
                        fontSize: 16,
                      ),
                    ),
                    DropdownButtonFormField<String>(
                      // ignore: deprecated_member_use
                      value: _kind,
                      items: const [
                        DropdownMenuItem(value: 'NETS', child: Text('Nets')),
                        DropdownMenuItem(value: 'MATCH', child: Text('Match')),
                        DropdownMenuItem(
                          value: 'GYM_CRICKET',
                          child: Text('Gym / S&C'),
                        ),
                        DropdownMenuItem(
                          value: 'RECOVERY',
                          child: Text('Recovery'),
                        ),
                      ],
                      onChanged: (v) => setState(() => _kind = v ?? _kind),
                    ),
                    TextField(
                      controller: _overs,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(labelText: 'Overs'),
                    ),
                    TextField(
                      controller: _duration,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(labelText: 'Minutes'),
                    ),
                    TextField(
                      controller: _rpe,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(labelText: 'RPE 1–10'),
                    ),
                    const SizedBox(height: 8),
                    ElevatedButton(
                      onPressed: _busy ? null : _logSession,
                      child: Text(_busy ? 'Saving…' : 'Log session'),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              Text(
                'Recent',
                style: GoogleFonts.poppins(
                  color: MockupColors.white,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 8),
              ...sessions.map(
                (s) => Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: _Card(
                    child: Text(
                      '${s['dateKey']} · ${s['kind']} · ${s['overs'] ?? 0} overs · RPE ${s['rpe'] ?? '—'}',
                      style: GoogleFonts.poppins(color: MockupColors.ink),
                    ),
                  ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _Card extends StatelessWidget {
  const _Card({required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: MockupColors.white,
        borderRadius: BorderRadius.circular(22),
      ),
      child: child,
    );
  }
}

class _Metric extends StatelessWidget {
  const _Metric({required this.label, required this.value});
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Column(
        children: [
          Text(
            value,
            style: GoogleFonts.poppins(
              color: MockupColors.ink,
              fontWeight: FontWeight.w700,
              fontSize: 20,
            ),
          ),
          Text(
            label,
            style: GoogleFonts.poppins(
              color: MockupColors.muted,
              fontSize: 11,
            ),
          ),
        ],
      ),
    );
  }
}
