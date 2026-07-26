import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

final tokenStorageProvider = Provider<TokenStorage>((ref) => TokenStorage());

class TokenStorage {
  static const tokenKey = 'auth_token';
  static const emailKey = 'auth_email';
  static const tenantKey = 'active_tenant_id';

  Future<SharedPreferences> get _prefs async =>
      SharedPreferences.getInstance();

  Future<String?> getToken() async {
    final prefs = await _prefs;
    return prefs.getString(tokenKey);
  }

  Future<String?> getTenantId() async {
    final prefs = await _prefs;
    return prefs.getString(tenantKey);
  }

  Future<void> saveTenantId(String? tenantId) async {
    final prefs = await _prefs;
    if (tenantId == null || tenantId.isEmpty) {
      await prefs.remove(tenantKey);
      return;
    }
    await prefs.setString(tenantKey, tenantId);
  }

  Future<void> saveSession(String token, String email) async {
    final prefs = await _prefs;
    await prefs.setString(tokenKey, token);
    await prefs.setString(emailKey, email);
  }

  Future<void> clear() async {
    final prefs = await _prefs;
    await prefs.remove(tokenKey);
    await prefs.remove(emailKey);
    await prefs.remove(tenantKey);
  }
}
