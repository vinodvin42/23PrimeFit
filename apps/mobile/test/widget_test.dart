import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:primefit_mobile/app.dart';
import 'package:primefit_mobile/core/config/app_config.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUpAll(() async {
    await AppConfig.init();
  });

  testWidgets('shows splash brand', (tester) async {
    await tester.pumpWidget(const ProviderScope(child: PrimeFitApp()));
    await tester.pump(const Duration(milliseconds: 100));
    expect(find.textContaining('23PRIMEFIT'), findsWidgets);
  });
}
