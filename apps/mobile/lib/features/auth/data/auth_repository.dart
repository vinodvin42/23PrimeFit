import 'package:dio/dio.dart';
import 'package:firebase_auth/firebase_auth.dart' as fb;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:primefit_mobile/core/config/app_config.dart';
import 'package:primefit_mobile/core/firebase/firebase_bootstrap.dart';
import 'package:primefit_mobile/core/network/api_client.dart';
import 'package:primefit_mobile/core/network/token_storage.dart';
import 'package:primefit_mobile/core/analytics/analytics.dart';
import 'package:primefit_mobile/features/auth/domain/models.dart';

final authRepositoryProvider = Provider<AuthRepository>((ref) {
  return AuthRepository(
    dio: ref.watch(dioProvider),
    storage: ref.watch(tokenStorageProvider),
  );
});

class AuthRepository {
  AuthRepository({
    required this.dio,
    required this.storage,
  });

  final Dio dio;
  final TokenStorage storage;

  Future<String?> getToken() => storage.getToken();

  Future<void> signOut() => storage.clear();

  /// Dev auth: maps email to a stable `dev:<uid>` token accepted by the API.
  Future<AppUser> signInDev({
    required String email,
    required String password,
    bool asCoach = false,
  }) async {
    if (password.trim().isEmpty) {
      throw Exception('Password is required');
    }
    final slug = email
        .trim()
        .toLowerCase()
        .replaceAll(RegExp(r'[^a-z0-9]+'), '-')
        .replaceAll(RegExp(r'^-|-$'), '');
    final uid = asCoach ? 'coach-$slug' : slug;
    final token = 'dev:$uid';
    await storage.saveSession(token, email.trim());
    return fetchMe();
  }

  /// Firebase path — requires FIREBASE_ENABLED + platform config.
  /// Falls back to signInDev when Firebase is not enabled.
  Future<AppUser> signIn({
    required String email,
    required String password,
    bool asCoach = false,
  }) async {
    if (!AppConfig.firebaseEnabled || !FirebaseBootstrap.ready) {
      return signInDev(email: email, password: password, asCoach: asCoach);
    }
    try {
      final cred = await fb.FirebaseAuth.instance.signInWithEmailAndPassword(
        email: email.trim(),
        password: password,
      );
      final idToken = await cred.user?.getIdToken();
      if (idToken == null || idToken.isEmpty) {
        throw Exception('Firebase did not return an ID token');
      }
      await storage.saveSession(idToken, email.trim());
      await Analytics.event('login', {'provider': 'firebase'});
      return fetchMe();
    } on fb.FirebaseAuthException catch (e) {
      throw Exception(e.message ?? e.code);
    }
  }

  Future<AppUser> register({
    required String email,
    required String password,
    required String displayName,
  }) async {
    if (!AppConfig.firebaseEnabled || !FirebaseBootstrap.ready) {
      await signInDev(email: email, password: password);
      await updateProfile({'displayName': displayName});
      await Analytics.signup();
      return fetchMe();
    }
    try {
      final cred = await fb.FirebaseAuth.instance.createUserWithEmailAndPassword(
        email: email.trim(),
        password: password,
      );
      await cred.user?.updateDisplayName(displayName);
      final idToken = await cred.user?.getIdToken();
      if (idToken == null || idToken.isEmpty) {
        throw Exception('Firebase did not return an ID token');
      }
      await storage.saveSession(idToken, email.trim());
      await updateProfile({'displayName': displayName});
      await Analytics.signup();
      return fetchMe();
    } on fb.FirebaseAuthException catch (e) {
      throw Exception(e.message ?? e.code);
    }
  }

  Future<AppUser> fetchMe() async {
    final res = await dio.get<Map<String, dynamic>>('/users/me');
    return AppUser.fromJson(res.data!);
  }

  Future<AppUser> updateProfile(Map<String, dynamic> body) async {
    final res = await dio.patch<Map<String, dynamic>>(
      '/users/me/profile',
      data: body,
    );
    return AppUser.fromJson(res.data!);
  }

  Future<DashboardToday> fetchDashboard() async {
    final res = await dio.get<Map<String, dynamic>>('/dashboard/today');
    return DashboardToday.fromJson(res.data!);
  }

  Future<AppUser?> restoreSession() async {
    final token = await getToken();
    if (token == null) return null;
    try {
      return await fetchMe();
    } on DioException {
      if (!AppConfig.authDevMode) {
        await signOut();
      }
      rethrow;
    }
  }

  Future<List<Map<String, dynamic>>> listConsent() async {
    final res = await dio.get<List<dynamic>>('/consent');
    return res.data?.whereType<Map<String, dynamic>>().toList() ?? [];
  }

  Future<void> setConsent(String purpose, bool granted) async {
    await dio.put('/consent', data: {'purpose': purpose, 'granted': granted});
  }
}
