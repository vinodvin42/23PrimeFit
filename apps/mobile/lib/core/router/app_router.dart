import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:primefit_mobile/features/auth/application/auth_controller.dart';
import 'package:primefit_mobile/features/auth/presentation/forgot_password_screen.dart';
import 'package:primefit_mobile/features/auth/presentation/login_screen.dart';
import 'package:primefit_mobile/features/auth/presentation/register_screen.dart';
import 'package:primefit_mobile/features/auth/presentation/splash_screen.dart';
import 'package:primefit_mobile/features/auth/presentation/welcome_screen.dart';
import 'package:primefit_mobile/features/dashboard/presentation/home_shell.dart';
import 'package:primefit_mobile/features/onboarding/presentation/onboarding_screen.dart';
import 'package:primefit_mobile/features/profile/presentation/profile_screen.dart';
import 'package:primefit_mobile/features/ai/presentation/ai_hub_screen.dart';
import 'package:primefit_mobile/features/ai/presentation/assessment_screen.dart';
import 'package:primefit_mobile/features/ai/presentation/body_scan_screen.dart';
import 'package:primefit_mobile/features/ai/presentation/blood_reports_screen.dart';
import 'package:primefit_mobile/features/progress/presentation/progress_screen.dart';
import 'package:primefit_mobile/features/workouts/presentation/exercise_library_screen.dart';
import 'package:primefit_mobile/features/workouts/presentation/session_screen.dart';
import 'package:primefit_mobile/features/workouts/presentation/train_screen.dart';
import 'package:primefit_mobile/features/nutrition/presentation/fuel_screen.dart';
import 'package:primefit_mobile/features/recovery/presentation/recover_screen.dart';
import 'package:primefit_mobile/features/coach/presentation/coach_hub_screen.dart';
import 'package:primefit_mobile/features/community/presentation/community_screen.dart';
import 'package:primefit_mobile/features/activity/presentation/run_activity_screen.dart';
import 'package:primefit_mobile/features/activity/presentation/workout_timer_screen.dart';
import 'package:primefit_mobile/features/activity/presentation/training_complete_screen.dart';
import 'package:primefit_mobile/features/cricket/presentation/cricket_screen.dart';
import 'package:primefit_mobile/features/wellness/presentation/wellness_screen.dart';

final _rootKey = GlobalKey<NavigatorState>();

const _publicRoutes = {
  '/splash',
  '/welcome',
  '/login',
  '/register',
  '/forgot-password',
};

final routerProvider = Provider<GoRouter>((ref) {
  final auth = ref.watch(authControllerProvider);

  return GoRouter(
    navigatorKey: _rootKey,
    initialLocation: '/splash',
    refreshListenable: _AuthRefresh(ref),
    redirect: (context, state) {
      final loc = state.matchedLocation;
      final status = auth.status;
      final user = auth.user;

      if (status == AuthStatus.unknown) {
        return loc == '/splash' ? null : '/splash';
      }

      if (status == AuthStatus.unauthenticated) {
        if (_publicRoutes.contains(loc)) return null;
        return '/welcome';
      }

      final needsOnboarding = user?.needsOnboarding ?? true;
      if (needsOnboarding) {
        if (loc == '/onboarding') return null;
        if (_publicRoutes.contains(loc)) return '/onboarding';
        return '/onboarding';
      }

      if (_publicRoutes.contains(loc) || loc == '/onboarding') {
        return '/home';
      }
      return null;
    },
    routes: [
      GoRoute(path: '/splash', builder: (context, state) => const SplashScreen()),
      GoRoute(path: '/welcome', builder: (context, state) => const WelcomeScreen()),
      GoRoute(path: '/login', builder: (context, state) => const LoginScreen()),
      GoRoute(path: '/register', builder: (context, state) => const RegisterScreen()),
      GoRoute(
        path: '/forgot-password',
        builder: (context, state) => const ForgotPasswordScreen(),
      ),
      GoRoute(
        path: '/onboarding',
        builder: (context, state) => const OnboardingScreen(),
      ),
      GoRoute(path: '/home', builder: (context, state) => const HomeShell()),
      GoRoute(path: '/profile', builder: (context, state) => const ProfileScreen()),
      GoRoute(path: '/train', builder: (context, state) => const TrainScreen()),
      GoRoute(path: '/fuel', builder: (context, state) => const FuelScreen()),
      GoRoute(path: '/recover', builder: (context, state) => const RecoverScreen()),
      GoRoute(path: '/coach', builder: (context, state) => const CoachHubScreen()),
      GoRoute(
        path: '/community',
        builder: (context, state) => const CommunityScreen(),
      ),
      GoRoute(path: '/cricket', builder: (context, state) => const CricketScreen()),
      GoRoute(path: '/wellness', builder: (context, state) => const WellnessScreen()),
      GoRoute(
        path: '/exercises',
        builder: (context, state) => const ExerciseLibraryScreen(),
      ),
      GoRoute(
        path: '/session/:id',
        builder: (context, state) => SessionScreen(
          sessionId: state.pathParameters['id']!,
        ),
      ),
      GoRoute(path: '/ai', builder: (context, state) => const AiHubScreen()),
      GoRoute(
        path: '/blood-reports',
        builder: (context, state) => const BloodReportsScreen(),
      ),
      GoRoute(
        path: '/assessment',
        builder: (context, state) => const AssessmentScreen(),
      ),
      GoRoute(
        path: '/body-scan',
        builder: (context, state) => const BodyScanScreen(),
      ),
      GoRoute(
        path: '/progress',
        builder: (context, state) => const ProgressScreen(),
      ),
      GoRoute(
        path: '/activity/run',
        builder: (context, state) {
          final extra = state.extra as Map<String, dynamic>? ?? const {};
          return RunActivityScreen(
            title: extra['title'] as String? ?? 'WarmUp',
            subtitle: extra['subtitle'] as String? ?? 'Run 02 km',
          );
        },
      ),
      GoRoute(
        path: '/activity/timer',
        builder: (context, state) {
          final extra = state.extra as Map<String, dynamic>? ?? const {};
          return WorkoutTimerScreen(
            title: extra['title'] as String? ?? 'Pushups session',
            subtitle: extra['subtitle'] as String? ??
                '25 rep, 3 sets with 20 sec rest',
          );
        },
      ),
      GoRoute(
        path: '/activity/complete',
        builder: (context, state) {
          final extra = state.extra as Map<String, dynamic>? ?? const {};
          return TrainingCompleteScreen(
            title: extra['title'] as String? ?? 'Training',
            km: (extra['km'] as num?)?.toDouble() ?? 0,
            seconds: extra['seconds'] as int? ?? 0,
            calories: extra['calories'] as int? ?? 0,
          );
        },
      ),
    ],
  );
});

class _AuthRefresh extends ChangeNotifier {
  _AuthRefresh(this.ref) {
    ref.listen(authControllerProvider, (previous, next) => notifyListeners());
  }

  final Ref ref;
}
