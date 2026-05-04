import 'package:drift/drift.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../db/index.dart';

/// Result type for sign-in operations.
sealed class AuthResult {
  const AuthResult();
}

class AuthSuccess extends AuthResult {
  final String role;
  const AuthSuccess({required this.role});
}

class AuthFailureInvalidCredentials extends AuthResult {
  const AuthFailureInvalidCredentials();
}

class AuthFailureNoNetwork extends AuthResult {
  const AuthFailureNoNetwork();
}

class AuthFailureUnknown extends AuthResult {
  final String message;
  const AuthFailureUnknown(this.message);
}

/// Handles all authentication logic: sign-in, sign-out, session caching,
/// token refresh, and role resolution.
class AuthRepository {
  AuthRepository({required AppDatabase db}) : _db = db;

  final AppDatabase _db;

  SessionDao get _sessionDao => _db.sessionDao;

  SupabaseClient get _client => Supabase.instance.client;

  // ---------------------------------------------------------------------------
  // Sign in
  // ---------------------------------------------------------------------------

  /// Authenticates the user with Supabase and caches the session locally.
  ///
  /// Returns an [AuthResult] describing the outcome.
  Future<AuthResult> signIn(String email, String password) async {
    try {
      final response = await _client.auth.signInWithPassword(
        email: email,
        password: password,
      );

      final session = response.session;
      final user = response.user;

      if (session == null || user == null) {
        return const AuthFailureInvalidCredentials();
      }

      final role = _extractRole(user);

      await _cacheSession(session: session, user: user, role: role);

      return AuthSuccess(role: role);
    } on AuthException catch (e) {
      // Supabase throws AuthException for invalid credentials (400/401).
      if (e.statusCode == '400' || e.statusCode == '401') {
        return const AuthFailureInvalidCredentials();
      }
      return AuthFailureUnknown(e.message);
    } catch (e) {
      // Network errors surface as generic exceptions.
      final msg = e.toString().toLowerCase();
      if (msg.contains('socket') ||
          msg.contains('network') ||
          msg.contains('connection') ||
          msg.contains('timeout') ||
          msg.contains('host lookup')) {
        return const AuthFailureNoNetwork();
      }
      return AuthFailureUnknown(e.toString());
    }
  }

  // ---------------------------------------------------------------------------
  // Sign out
  // ---------------------------------------------------------------------------

  /// Signs out from Supabase and clears the local session cache.
  Future<void> signOut() async {
    try {
      await _client.auth.signOut();
    } catch (_) {
      // Best-effort — always clear local cache even if remote call fails.
    }
    await _sessionDao.clearSession();
  }

  // ---------------------------------------------------------------------------
  // Offline session
  // ---------------------------------------------------------------------------

  /// Returns the cached session from Local_DB, or null if none exists.
  Future<SessionCacheData?> getOfflineSession() => _sessionDao.getSession();

  // ---------------------------------------------------------------------------
  // Token refresh
  // ---------------------------------------------------------------------------

  /// Silently refreshes an expired JWT using the stored refresh token.
  ///
  /// Updates the local cache on success. Returns the new role string, or null
  /// if the refresh fails.
  Future<String?> refreshToken(String refreshToken) async {
    try {
      final response = await _client.auth.refreshSession(refreshToken);
      final session = response.session;
      final user = response.user;

      if (session == null || user == null) return null;

      final role = _extractRole(user);
      await _cacheSession(session: session, user: user, role: role);
      return role;
    } catch (_) {
      return null;
    }
  }

  // ---------------------------------------------------------------------------
  // Role resolution
  // ---------------------------------------------------------------------------

  /// Returns the role from the current Supabase session metadata, falling back
  /// to the cached session if the live session is unavailable.
  Future<String?> getCurrentRole() async {
    final liveUser = _client.auth.currentUser;
    if (liveUser != null) {
      return _extractRole(liveUser);
    }

    final cached = await _sessionDao.getSession();
    return cached?.role;
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  String _extractRole(User user) {
    final meta = user.userMetadata;
    if (meta != null && meta['role'] is String) {
      return meta['role'] as String;
    }
    return 'customer'; // safe default
  }

  Future<void> _cacheSession({
    required Session session,
    required User user,
    required String role,
  }) async {
    await _sessionDao.saveSession(
      SessionCacheCompanion(
        userId: Value(user.id),
        email: Value(user.email ?? ''),
        role: Value(role),
        accessToken: Value(session.accessToken),
        refreshToken: Value(session.refreshToken ?? ''),
        expiresAt: Value(
          DateTime.fromMillisecondsSinceEpoch(
            (session.expiresAt ?? 0) * 1000,
          ),
        ),
      ),
    );
  }
}
