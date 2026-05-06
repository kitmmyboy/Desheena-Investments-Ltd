import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../customer/customer_home_screen.dart';
import '../driver/driver_home_screen.dart';
import 'auth_provider.dart';
import 'login_screen.dart';
import '../../core/notification_service.dart';

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

  // Requirement: Ensure splash screen displays for at least 5 seconds.
  final splashFuture = Future.delayed(const Duration(seconds: 5));

  // 1. Check for a cached session.
  final cached = await repo.getOfflineSession();

  Widget destination;

  if (cached == null) {
    // No session at all — show login.
    destination = const LoginScreen();
  } else {
    final now = DateTime.now();
    final isExpired = cached.expiresAt.isBefore(now);

    if (!isExpired) {
      // Valid cached session — navigate directly.
      destination = _screenForRole(cached.role);
      
      // Register token in background
      NotificationService.registerDeviceToken();
    } else {
      // JWT is expired — try to refresh silently.
      final newRole = await repo.refreshToken(cached.refreshToken);

      if (newRole != null) {
        // Refresh succeeded.
        destination = _screenForRole(newRole);
        NotificationService.registerDeviceToken();
      } else {
        // Refresh failed (offline or revoked token).
        // If we have a cached role we allow offline access per Requirement 1.3.
        destination = _screenForRole(cached.role);
      }
    }
  }

  // Wait for the remainder of the 5 seconds if resolution was faster.
  await splashFuture;

  return destination;
});

Widget _screenForRole(String role) {
  return role.toLowerCase() == 'driver'
      ? const DriverHomeScreen()
      : const CustomerHomeScreen();
}

// ---------------------------------------------------------------------------
// Branding helper — fetches logo URL and app title from system_settings
// ---------------------------------------------------------------------------

Future<({String logoUrl, String title})> _fetchBranding() async {
  try {
    final response = await Supabase.instance.client
        .from('system_settings')
        .select('key, value')
        .inFilter('key', ['app_logo_url', 'app_title']);

    final map = <String, String>{};
    for (final row in (response as List)) {
      map[row['key'] as String] = row['value'] as String;
    }
    return (
      logoUrl: map['app_logo_url'] ?? '',
      title: map['app_title'] ?? 'Desheena Investments Ltd',
    );
  } catch (_) {
    return (logoUrl: '', title: 'Desheena Investments Ltd');
  }
}

// ---------------------------------------------------------------------------
// Splash / loading screen
// ---------------------------------------------------------------------------

class _SplashScreen extends StatefulWidget {
  const _SplashScreen();

  @override
  State<_SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<_SplashScreen> {
  String _logoUrl = '';
  String _title = 'Desheena Investments Ltd';

  @override
  void initState() {
    super.initState();
    _fetchBranding().then((b) {
      if (mounted) {
        setState(() {
          _logoUrl = b.logoUrl;
          _title = b.title;
        });
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final primary = Theme.of(context).colorScheme.primary;

    return Scaffold(
      backgroundColor: Colors.white,
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Logo — network image if available, fallback to branded circle
            if (_logoUrl.isNotEmpty)
              ClipRRect(
                borderRadius: BorderRadius.circular(20),
                child: Image.network(
                  _logoUrl,
                  width: 100,
                  height: 100,
                  fit: BoxFit.contain,
                  errorBuilder: (_, __, ___) => _FallbackLogo(primary: primary),
                ),
              )
            else
              _FallbackLogo(primary: primary),

            const SizedBox(height: 24),

            Text(
              _title,
              style: TextStyle(
                fontSize: 22,
                fontWeight: FontWeight.bold,
                color: primary,
              ),
              textAlign: TextAlign.center,
            ),

            const SizedBox(height: 8),

            Text(
              'Waste Management',
              style: TextStyle(
                fontSize: 14,
                color: Colors.grey.shade500,
              ),
            ),

            const SizedBox(height: 40),

            SizedBox(
              width: 28,
              height: 28,
              child: CircularProgressIndicator(
                strokeWidth: 2.5,
                valueColor: AlwaysStoppedAnimation<Color>(primary),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _FallbackLogo extends StatelessWidget {
  const _FallbackLogo({required this.primary});
  final Color primary;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 100,
      height: 100,
      decoration: BoxDecoration(
        color: primary,
        borderRadius: BorderRadius.circular(20),
      ),
      child: const Center(
        child: Text(
          'D',
          style: TextStyle(
            color: Colors.white,
            fontSize: 48,
            fontWeight: FontWeight.bold,
          ),
        ),
      ),
    );
  }
}
