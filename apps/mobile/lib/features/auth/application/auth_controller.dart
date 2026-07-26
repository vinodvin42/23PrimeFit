import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:primefit_mobile/core/analytics/analytics.dart';
import 'package:primefit_mobile/features/auth/data/auth_repository.dart';
import 'package:primefit_mobile/features/auth/domain/models.dart';

enum AuthStatus { unknown, authenticated, unauthenticated }

class AuthState {
  const AuthState({
    required this.status,
    this.user,
    this.error,
  });

  final AuthStatus status;
  final AppUser? user;
  final String? error;

  AuthState copyWith({
    AuthStatus? status,
    AppUser? user,
    String? error,
    bool clearError = false,
    bool clearUser = false,
  }) {
    return AuthState(
      status: status ?? this.status,
      user: clearUser ? null : (user ?? this.user),
      error: clearError ? null : (error ?? this.error),
    );
  }
}

class AuthController extends Notifier<AuthState> {
  @override
  AuthState build() {
    Future.microtask(restore);
    return const AuthState(status: AuthStatus.unknown);
  }

  AuthRepository get _repo => ref.read(authRepositoryProvider);

  Future<void> restore() async {
    try {
      final user = await _repo.restoreSession();
      if (user == null) {
        state = const AuthState(status: AuthStatus.unauthenticated);
      } else {
        state = AuthState(status: AuthStatus.authenticated, user: user);
      }
    } catch (_) {
      state = const AuthState(status: AuthStatus.unauthenticated);
    }
  }

  Future<bool> signIn({
    required String email,
    required String password,
    bool asCoach = false,
  }) async {
    state = state.copyWith(clearError: true);
    try {
      final user = await _repo.signIn(
        email: email,
        password: password,
        asCoach: asCoach,
      );
      state = AuthState(status: AuthStatus.authenticated, user: user);
      return true;
    } catch (e) {
      state = state.copyWith(
        status: AuthStatus.unauthenticated,
        error: e.toString().replaceFirst('Exception: ', ''),
        clearUser: true,
      );
      return false;
    }
  }

  Future<bool> register({
    required String email,
    required String password,
    required String displayName,
  }) async {
    state = state.copyWith(clearError: true);
    try {
      final updated = await _repo.register(
        email: email,
        password: password,
        displayName: displayName,
      );
      state = AuthState(status: AuthStatus.authenticated, user: updated);
      return true;
    } catch (e) {
      state = state.copyWith(
        status: AuthStatus.unauthenticated,
        error: e.toString().replaceFirst('Exception: ', ''),
        clearUser: true,
      );
      return false;
    }
  }

  Future<bool> continueAsGuest() async {
    final stamp = DateTime.now().millisecondsSinceEpoch % 100000;
    return signIn(
      email: 'guest$stamp@23primefit.dev',
      password: 'guestpass',
    );
  }

  Future<void> refreshUser() async {
    final user = await _repo.fetchMe();
    state = AuthState(status: AuthStatus.authenticated, user: user);
  }

  Future<void> completeOnboarding(Map<String, dynamic> body) async {
    final user = await _repo.updateProfile({
      ...body,
      'onboardingComplete': true,
    });
    state = AuthState(status: AuthStatus.authenticated, user: user);
    await Analytics.onboardingComplete();
  }

  Future<void> updateProfile(Map<String, dynamic> body) async {
    final user = await _repo.updateProfile(body);
    state = AuthState(status: AuthStatus.authenticated, user: user);
  }

  Future<void> signOut() async {
    await _repo.signOut();
    state = const AuthState(status: AuthStatus.unauthenticated);
  }
}

final authControllerProvider =
    NotifierProvider<AuthController, AuthState>(AuthController.new);

final dashboardProvider = FutureProvider.autoDispose<DashboardToday>((ref) {
  ref.watch(authControllerProvider);
  return ref.read(authRepositoryProvider).fetchDashboard();
});
