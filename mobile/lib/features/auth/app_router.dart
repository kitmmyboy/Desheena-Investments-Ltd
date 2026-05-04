import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../customer/customer_home_screen.dart';
import '../driver/driver_home_screen.dart';
import 'auth_provider.dart';
import 'login_screen.dart';

/// Root router widget.
///
/// On every app launch it evaluates the session state and routes to the
/// appropriate screen:
///
/// 1. **Offline + valid cache** → navigate to the role-appropriate screen
///    without any network call.
/// 2. **Online + expired JWT** → silently refresh the token, then navigate.
/// 3. **Online + valid JWT** → navigate directly.
/// 4. **No session** → show [LoginScreen].
class AppRouter extends ConsumerWidget {
  const AppRouter({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return ref.watch(_startupRouteProvider).when(
          data: (destination) => destination,
          loading: () => const _SplashScreen(),
          error: (_, __) => const LoginScreen(),
        );
  }
}

// ---------------------------------------------------------------------------
// Startup route resolution
// ---------------------------------------------------------------------------

/// Resolves the initial destination widget once on app startup.
final _startupRouteProvider = FutureProvider<Widget>((ref) async {
  final repo = ref.read(authRepositoryProvider);

  // 1. Check for a cached session.
  final cached = await repo.getOfflineSession();

  if (cached == null) {
    // No session at all — show login.
    return const LoginScreen();
  }

  final now = DateTime.now();
  final isExpired = cached.expiresAt.isBefore(now);

  if (!isExpired) {
    // Valid cached session — navigate directly.
    return _screenForRole(cached.role);
  }

  // JWT is expired — try to refresh silently.
  final newRole = await repo.refreshToken(cached.refreshToken);

  if (newRole != null) {
    // Refresh succeeded.
    return _screenForRole(newRole);
  }

  // Refresh failed (offline or revoked token).
  // If we have a cached role we allow offline access per Requirement 1.3.
  return _screenForRole(cached.role);
});

Widget _screenForRole(String role) {
  return role.toLowerCase() == 'driver'
      ? const DriverHomeScreen()
      : const CustomerHomeScreen();
}

// ---------------------------------------------------------------------------
// Splash / loading screen
// ---------------------------------------------------------------------------

class _SplashScreen extends StatelessWidget {
  const _SplashScreen();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.delete_outline_rounded,
              size: 72,
              color: Theme.of(context).colorScheme.primary,
            ),
            const SizedBox(height: 16),
            const CircularProgressIndicator(),
          ],
        ),
      ),
    );
  }
}
