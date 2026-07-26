import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:primefit_mobile/core/theme/app_theme.dart';
import 'package:primefit_mobile/core/widgets/glass.dart';
import 'package:primefit_mobile/features/integrations/agora_client.dart';
import 'package:primefit_mobile/features/integrations/razorpay_client.dart';
import 'package:primefit_mobile/features/integrations/stream_client.dart';
import 'package:primefit_mobile/features/workouts/data/fitness_repository.dart';

class CoachHubScreen extends ConsumerStatefulWidget {
  const CoachHubScreen({super.key});

  @override
  ConsumerState<CoachHubScreen> createState() => _CoachHubScreenState();
}

class _CoachHubScreenState extends ConsumerState<CoachHubScreen> {
  final _draft = TextEditingController();
  final _topic = TextEditingController(text: 'Progress review');
  String? _threadId;
  List<Map<String, dynamic>> _messages = [];
  List<Map<String, dynamic>> _consults = [];
  List<Map<String, dynamic>> _notifications = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  @override
  void dispose() {
    _draft.dispose();
    _topic.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final repo = ref.read(fitnessRepositoryProvider);
      final thread = await repo.ensureChatThread();
      final threadId = thread['id'] as String;
      final results = await Future.wait([
        repo.chatMessages(threadId),
        repo.listConsultations(),
        repo.listNotifications(),
        ref.read(streamClientProvider).fetchToken(),
      ]);
      if (!mounted) return;
      setState(() {
        _threadId = threadId;
        _messages = results[0] as List<Map<String, dynamic>>;
        _consults = results[1] as List<Map<String, dynamic>>;
        _notifications = results[2] as List<Map<String, dynamic>>;
      });
    } catch (e) {
      if (mounted) {
        final msg = '$e';
        setState(() {
          _error = msg.contains('404') || msg.contains('No coach')
              ? 'No coach linked yet. Pull to refresh — the app will auto-assign Coach Priya.'
              : msg;
        });
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _send() async {
    if (_threadId == null || _draft.text.trim().isEmpty) return;
    final msg = await ref
        .read(fitnessRepositoryProvider)
        .sendChatMessage(_threadId!, _draft.text.trim());
    setState(() {
      _messages = [..._messages, msg];
      _draft.clear();
    });
  }

  Future<void> _book() async {
    final when = DateTime.now().add(const Duration(days: 2));
    await ref.read(fitnessRepositoryProvider).bookConsultation(
          topic: _topic.text.trim().isEmpty ? 'Check-in' : _topic.text.trim(),
          scheduledAt: when.toUtc().toIso8601String(),
        );
    await _load();
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Consultation requested')),
      );
    }
  }

  Future<void> _pay(String id) async {
    final result = await ref.read(fitnessRepositoryProvider).payConsultation(id);
    final razorpay = result['razorpay'] as Map<String, dynamic>?;
    final presented = await RazorpayClientAdapter().presentCheckout(razorpay);
    if (!presented && razorpay != null && razorpay['mode'] != 'demo') {
      await ref.read(fitnessRepositoryProvider).confirmConsultationPayment(
            id,
            razorpayOrderId: razorpay['orderId']?.toString(),
          );
    }
    await AgoraClientAdapter().joinMeeting(
      result['agora'] as Map<String, dynamic>?,
    );
    await _load();
    if (mounted) {
      final mode = razorpay?['mode']?.toString() ?? 'demo';
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Paid via Razorpay ($mode)')),
      );
    }
  }

  Future<void> _join(String id) async {
    final meeting =
        await ref.read(fitnessRepositoryProvider).consultationMeeting(id);
    await AgoraClientAdapter().joinMeeting(
      meeting['agora'] as Map<String, dynamic>? ?? meeting,
    );
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'Meeting: ${meeting['meetingUrl'] ?? meeting['agora']?['meetingUrl']}',
          ),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return DarkHubTheme(
      child: Scaffold(
      backgroundColor: AppColors.voidBlack,
      body: SafeArea(
        child: RefreshIndicator(
          color: AppColors.lime,
          onRefresh: _load,
          child: ListView(
            padding: const EdgeInsets.fromLTRB(24, 16, 24, 32),
            children: [
              const DarkBackButton(),
              const SizedBox(height: 8),
              const Text(
                'COACH',
                style: TextStyle(
                  color: AppColors.white,
                  fontSize: 32,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 4),
              const Text(
                'Message your coach, book consults, and pay securely.',
                style: TextStyle(color: AppColors.mutedOnDark),
              ),
              const SizedBox(height: 16),
              if (_loading)
                const LinearProgressIndicator(color: AppColors.lime),
              if (_error != null)
                Text(_error!, style: const TextStyle(color: AppColors.danger)),
              const SizedBox(height: 12),
              const Text(
                'Messages',
                style: TextStyle(
                  color: AppColors.white,
                  fontSize: 20,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 8),
              GlassCard(
                child: Column(
                  children: [
                    SizedBox(
                      height: 180,
                      child: _messages.isEmpty
                          ? const Center(
                              child: Text(
                                'Say hi to Coach Priya to start the thread.',
                                textAlign: TextAlign.center,
                                style: TextStyle(color: AppColors.soft),
                              ),
                            )
                          : ListView(
                              children: _messages
                                  .map(
                                    (m) => ListTile(
                                      dense: true,
                                      title: Text(
                                        (m['sender'] as Map?)?['displayName']
                                                ?.toString() ??
                                            'User',
                                        style: const TextStyle(
                                          color: AppColors.lime,
                                          fontWeight: FontWeight.w600,
                                        ),
                                      ),
                                      subtitle: Text(
                                        '${m['body']}',
                                        style: const TextStyle(
                                          color: AppColors.white,
                                        ),
                                      ),
                                    ),
                                  )
                                  .toList(),
                            ),
                    ),
                    Row(
                      children: [
                        Expanded(
                          child: TextField(
                            controller: _draft,
                            style: const TextStyle(color: AppColors.white),
                            decoration: const InputDecoration(
                              hintText: 'Message Coach Priya…',
                            ),
                          ),
                        ),
                        IconButton(
                          onPressed: _send,
                          icon: const Icon(Icons.send, color: AppColors.lime),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),
              const Text(
                'Book consultation',
                style: TextStyle(
                  color: AppColors.white,
                  fontSize: 20,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 8),
              TextField(
                controller: _topic,
                style: const TextStyle(color: AppColors.white),
                decoration: const InputDecoration(hintText: 'Topic'),
              ),
              const SizedBox(height: 8),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: _book,
                  child: const Text('Request consult (₹999)'),
                ),
              ),
              const SizedBox(height: 20),
              const Text(
                'Your consults',
                style: TextStyle(
                  color: AppColors.white,
                  fontSize: 20,
                  fontWeight: FontWeight.w700,
                ),
              ),
              if (_consults.isEmpty)
                const Padding(
                  padding: EdgeInsets.only(top: 8),
                  child: GlassCard(
                    child: Text(
                      'No consultations yet.',
                      style: TextStyle(color: AppColors.soft),
                    ),
                  ),
                ),
              ..._consults.map((c) {
                final payment = c['payment'] as Map?;
                final paid = payment?['status'] == 'PAID';
                final status = '${c['status']}';
                final canJoin =
                    paid || status == 'SCHEDULED' || status == 'COMPLETED';
                return ListTile(
                  contentPadding: EdgeInsets.zero,
                  title: Text(
                    '${c['topic']}',
                    style: const TextStyle(color: AppColors.white),
                  ),
                  subtitle: Text(
                    '${c['status']} · ${c['scheduledAt']} · ₹${c['amountInr']}',
                    style: const TextStyle(color: AppColors.mutedOnDark),
                  ),
                  trailing: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      if (canJoin)
                        IconButton(
                          tooltip: 'Join meeting',
                          onPressed: () => _join(c['id'] as String),
                          icon: const Icon(Icons.videocam, color: AppColors.lime),
                        ),
                      if (!paid)
                        TextButton(
                          onPressed: () => _pay(c['id'] as String),
                          child: const Text('Pay'),
                        ),
                    ],
                  ),
                );
              }),
              const SizedBox(height: 12),
              const Text(
                'Notifications',
                style: TextStyle(
                  color: AppColors.white,
                  fontSize: 20,
                  fontWeight: FontWeight.w700,
                ),
              ),
              if (_notifications.isEmpty)
                const Padding(
                  padding: EdgeInsets.only(top: 8),
                  child: GlassCard(
                    child: Text(
                      'No notifications yet.',
                      style: TextStyle(color: AppColors.soft),
                    ),
                  ),
                ),
              ..._notifications.take(8).map(
                    (n) => ListTile(
                      contentPadding: EdgeInsets.zero,
                      leading: Icon(
                        (n['read'] as bool? ?? false)
                            ? Icons.notifications_none
                            : Icons.notifications_active,
                        color: AppColors.lime,
                      ),
                      title: Text(
                        '${n['title']}',
                        style: const TextStyle(color: AppColors.white),
                      ),
                      subtitle: Text(
                        '${n['body']}',
                        style: const TextStyle(color: AppColors.mutedOnDark),
                      ),
                    ),
                  ),
            ],
          ),
        ),
      ),
    ),
    );
  }
}
