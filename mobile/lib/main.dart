import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'core/constants.dart';
import 'features/auth/app_router.dart';
import 'features/driver/route_provider.dart';
import 'features/sync/sync_provider.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  await Supabase.initialize(
    url: AppConstants.supabaseUrl,
    anonKey: AppConstants.supabaseAnonKey,
  );

  runApp(
    const ProviderScope(
      child: DesheenaApp(),
    ),
  );
}

/// Root application widget.
///
/// Uses [ConsumerWidget] so it can eagerly initialize the [syncEngineProvider]
/// and [connectivitySyncListenerProvider] on first build, ensuring the sync
/// engine starts monitoring connectivity immediately on app launch.
///
/// Implements Requirements 5.1 and 3.6.
class DesheenaApp extends ConsumerWidget {
  const DesheenaApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // Eagerly initialize the sync engine so it starts monitoring connectivity
    // as soon as the app launches (Requirement 5.1).
    ref.watch(syncEngineProvider);

    // Eagerly initialize the connectivity-triggered sync listener so that
    // transitioning from offline → online automatically triggers a sync
    // (Requirement 3.6).
    ref.watch(connectivitySyncListenerProvider);

    return MaterialApp(
      title: 'Desheena Waste',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF2E7D32)),
        useMaterial3: true,
      ),
      home: const AppRouter(),
    );
  }
}
