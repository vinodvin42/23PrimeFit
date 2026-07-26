import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:primefit_mobile/app.dart';
import 'package:primefit_mobile/core/config/app_config.dart';
import 'package:primefit_mobile/core/firebase/firebase_bootstrap.dart';
import 'package:primefit_mobile/core/observability/crash_reporter.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await AppConfig.init();
  await FirebaseBootstrap.init();
  await CrashReporter.runApp(() async {
    runApp(const ProviderScope(child: PrimeFitApp()));
  });
}
