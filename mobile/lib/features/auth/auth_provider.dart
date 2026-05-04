import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../db/database_provider.dart';
import 'auth_repository.dart';

// ---------------------------------------------------------------------------
// Repository provider
// ---------------------------------------------------------------------------

/// Provides the singleton [AuthRepository] instance.
final authRepositoryProvider = Provider<AuthRepository>((ref) {
  final db = ref.watch(appDatabaseProvider);
  return AuthRepository(db: db);
});

// ---------------------------------------------------------------------------
// Auth state stream
// ---------------------------------------------------------------------------

/// Streams Supabase [AuthState] changes (sign-in, sign-out, token refresh).
final authStateProvider = StreamProvider<AuthState>((ref) {
  return Supabase.instance.client.auth.onAuthStateChange;
});

// ---------------------------------------------------------------------------
// Current user role
// ---------------------------------------------------------------------------

/// Reads the role from the current Supabase session metadata, or falls back
/// to the cached session in Local_DB.
///
/// Returns null when no session is available.
final currentUserRoleProvider = FutureProvider<String?>((ref) async {
  // Re-evaluate whenever the auth state changes.
  ref.watch(authStateProvider);

  final repo = ref.read(authRepositoryProvider);
  return repo.getCurrentRole();
});
