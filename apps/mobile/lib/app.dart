import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:primefit_mobile/core/firebase/push_registration.dart';
import 'package:primefit_mobile/core/offline/outbox_sync_bootstrap.dart';
import 'package:primefit_mobile/core/router/app_router.dart';
import 'package:primefit_mobile/core/theme/app_theme.dart';

class PrimeFitApp extends ConsumerStatefulWidget {
  const PrimeFitApp({super.key});

  @override
  ConsumerState<PrimeFitApp> createState() => _PrimeFitAppState();
}

class _PrimeFitAppState extends ConsumerState<PrimeFitApp> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(outboxSyncBootstrapProvider).start();
      ref.read(pushRegistrationProvider).registerIfReady();
    });
  }

  @override
  Widget build(BuildContext context) {
    final router = ref.watch(routerProvider);
    return MaterialApp.router(
      title: '23PrimeFit',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light,
      darkTheme: AppTheme.dark,
      themeMode: ThemeMode.light,
      routerConfig: router,
    );
  }
}
