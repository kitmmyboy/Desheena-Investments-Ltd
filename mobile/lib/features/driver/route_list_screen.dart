import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/storage_warning_widget.dart';
import '../../db/index.dart';
import '../auth/auth_provider.dart';
import '../auth/login_screen.dart';
import 'collection_recording_screen.dart';
import 'collections_history_screen.dart';
import 'connectivity_indicator.dart';
import 'route_map_screen.dart';
import 'route_provider.dart';
import 'sync_status_widget.dart';

/// Main Driver screen — shows the assigned route and daily pickup list.
///
/// Implements Requirements 3.1, 3.2, 3.3, and 3.5:
/// - Downloads route when online (3.1)
/// - Shows cached route when offline (3.2)
/// - Displays client name, location, waste type, and record button (3.3)
/// - Shows persistent connectivity indicator (3.5)
///
/// Also implements Requirement 21.5: on first render a storage check is
/// performed via [StorageWarningWidget]; if free storage is below 100 MB a
/// dismissible warning dialog is shown.
class RouteListScreen extends ConsumerWidget {
  const RouteListScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final routeAsync = ref.watch(driverRouteProvider);
    final connectivityAsync = ref.watch(connectivityStatusProvider);

    final isOffline = connectivityAsync.valueOrNull == false;

    // StorageWarningWidget wraps the Scaffold so that a one-shot storage check
    // is performed when this screen is first displayed (Requirement 21.5).
    return StorageWarningWidget(
      child: Scaffold(
      appBar: AppBar(
        title: const Text('My Route'),
        actions: [
          // Connectivity indicator always visible in the AppBar (Req 3.5).
          const Padding(
            padding: EdgeInsets.symmetric(horizontal: 8.0),
            child: Center(child: ConnectivityIndicator()),
          ),
          // Map button — navigates to RouteMapScreen (Req 17.2).
          IconButton(
            icon: const Icon(Icons.map_outlined),
            tooltip: 'View Route Map',
            onPressed: () {
              final routeData = routeAsync.valueOrNull;
              Navigator.of(context).push(
                MaterialPageRoute(
                  builder: (_) => RouteMapScreen(routeData: routeData),
                ),
              );
            },
          ),
          // History button — navigates to CollectionsHistoryScreen (Req 4.7).
          IconButton(
            icon: const Icon(Icons.history),
            tooltip: 'Collection History',
            onPressed: () {
              Navigator.of(context).push(
                MaterialPageRoute(
                  builder: (_) => const CollectionsHistoryScreen(),
                ),
              );
            },
          ),
          IconButton(
            icon: const Icon(Icons.logout),
            tooltip: 'Sign out',
            onPressed: () async {
              await ref.read(authRepositoryProvider).signOut();
              if (context.mounted) {
                Navigator.of(context).pushAndRemoveUntil(
                  MaterialPageRoute(builder: (_) => const LoginScreen()),
                  (_) => false,
                );
              }
            },
          ),
        ],
      ),
      // Persistent sync status bar at the bottom of the screen (Req 5.7, 5.8).
      bottomNavigationBar: const SyncStatusWidget(),
      body: Column(
        children: [
          // Offline banner — shown when serving cached data (Req 3.2).
          if (isOffline)
            _OfflineBanner(
              isCachedData: routeAsync.valueOrNull?.isFromCache ?? false,
            ),

          // Route content.
          Expanded(
            child: routeAsync.when(
              data: (routeData) {
                if (routeData == null) {
                  return const _NoRouteView();
                }
                return _RouteClientList(
                  routeData: routeData,
                );
              },
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (error, _) => _ErrorView(error: error.toString()),
            ),
          ),
        ],
      ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Offline banner
// ---------------------------------------------------------------------------

class _OfflineBanner extends StatelessWidget {
  const _OfflineBanner({required this.isCachedData});

  final bool isCachedData;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      color: Colors.orange.shade100,
      padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 16),
      child: Row(
        children: [
          Icon(Icons.wifi_off, size: 16, color: Colors.orange.shade800),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              isCachedData
                  ? 'Offline — showing cached route'
                  : 'Offline — connect to download your route',
              style: TextStyle(
                color: Colors.orange.shade900,
                fontSize: 13,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Route client list
// ---------------------------------------------------------------------------

class _RouteClientList extends StatelessWidget {
  const _RouteClientList({required this.routeData});

  final DriverRouteData routeData;

  @override
  Widget build(BuildContext context) {
    final clients = routeData.clients;
    final schedulesByClient = routeData.schedulesByClient;

    // Count how many clients are due today
    final dueTodayCount = clients.where((c) {
      final schedules = schedulesByClient[c.clientId] ?? [];
      return isClientDueToday(schedules);
    }).length;

    return Column(
      children: [
        // Route info header
        Container(
          width: double.infinity,
          margin: const EdgeInsets.fromLTRB(12, 12, 12, 0),
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: const Color(0xFF1A233A),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      routeData.route.name,
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.bold,
                        fontSize: 18,
                      ),
                    ),
                    if (routeData.route.zone.isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.only(top: 4),
                        child: Text(
                          'Zone: ${routeData.route.zone}',
                          style: const TextStyle(
                              color: Colors.white70, fontSize: 13),
                        ),
                      ),
                  ],
                ),
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 12, vertical: 6),
                    decoration: BoxDecoration(
                      color: clients.isNotEmpty
                          ? Colors.green.shade600
                          : Colors.orange.shade700,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      '${clients.length} stops',
                      style: const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.bold,
                          fontSize: 13),
                    ),
                  ),
                  if (dueTodayCount > 0) ...[
                    const SizedBox(height: 4),
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: Colors.orange.shade600,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        '$dueTodayCount due today',
                        style: const TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.bold,
                            fontSize: 12),
                      ),
                    ),
                  ],
                ],
              ),
            ],
          ),
        ),
        // Client list
        Expanded(
          child: clients.isEmpty
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(32),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.location_off_outlined,
                            size: 48, color: Colors.orange.shade300),
                        const SizedBox(height: 16),
                        const Text(
                          'No stops added yet',
                          style: TextStyle(
                              fontSize: 16, fontWeight: FontWeight.bold),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          'Your route is assigned but the admin hasn\'t added client stops yet.',
                          textAlign: TextAlign.center,
                          style: TextStyle(color: Colors.grey.shade600),
                        ),
                      ],
                    ),
                  ),
                )
              : ListView.separated(
                  padding: const EdgeInsets.all(12),
                  itemCount: clients.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 8),
                  itemBuilder: (context, index) {
                    final client = clients[index];
                    final schedules =
                        schedulesByClient[client.clientId] ?? [];
                    return _ClientCard(
                      client: client,
                      schedules: schedules,
                    );
                  },
                ),
        ),
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// Client card
// ---------------------------------------------------------------------------

class _ClientCard extends StatelessWidget {
  const _ClientCard({required this.client, required this.schedules});

  final RouteClientsLocalData client;
  final List<ClientSchedulesLocalData> schedules;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final dueToday = isClientDueToday(schedules);
    final label = scheduleLabel(schedules);

    return Card(
      elevation: dueToday ? 3 : 2,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: dueToday
            ? BorderSide(color: Colors.orange.shade400, width: 1.5)
            : BorderSide.none,
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Client name + Due Today badge
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Text(
                    client.clientName,
                    style: theme.textTheme.titleLarge?.copyWith(
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
                if (dueToday)
                  Container(
                    margin: const EdgeInsets.only(left: 8),
                    padding: const EdgeInsets.symmetric(
                        horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: Colors.orange.shade100,
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: Colors.orange.shade300),
                    ),
                    child: Text(
                      'Due today',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: Colors.orange.shade800,
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 6),

            // Location
            Row(
              children: [
                const Icon(Icons.location_on_outlined, size: 16),
                const SizedBox(width: 4),
                Expanded(
                  child: Text(
                    client.locationText.isNotEmpty
                        ? client.locationText
                        : 'No address',
                    style: theme.textTheme.bodyMedium,
                  ),
                ),
                if (client.gpsLat != null && client.gpsLng != null)
                  IconButton(
                    icon: const Icon(Icons.directions, color: Colors.blue),
                    tooltip: 'Navigate',
                    onPressed: () =>
                        _launchNavigation(client.gpsLat!, client.gpsLng!),
                  ),
              ],
            ),
            const SizedBox(height: 4),

            // Waste type
            Row(
              children: [
                const Icon(Icons.delete_outline, size: 16),
                const SizedBox(width: 4),
                Text(
                  _formatWasteType(client.wasteType),
                  style: theme.textTheme.bodyMedium,
                ),
              ],
            ),

            // Schedule label (if any)
            if (label.isNotEmpty) ...[
              const SizedBox(height: 4),
              Row(
                children: [
                  Icon(Icons.schedule,
                      size: 15, color: Colors.grey.shade500),
                  const SizedBox(width: 4),
                  Text(
                    label,
                    style: TextStyle(
                      fontSize: 12,
                      color: Colors.grey.shade600,
                    ),
                  ),
                ],
              ),
            ],

            const SizedBox(height: 16),

            // Record Collection button
            SizedBox(
              width: double.infinity,
              height: 52,
              child: ElevatedButton.icon(
                icon: const Icon(Icons.check_circle_outline),
                label: const Text(
                  'Record Collection',
                  style: TextStyle(
                      fontSize: 16, fontWeight: FontWeight.w600),
                ),
                style: ElevatedButton.styleFrom(
                  backgroundColor:
                      dueToday ? Colors.orange.shade600 : null,
                  foregroundColor: dueToday ? Colors.white : null,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10),
                  ),
                ),
                onPressed: () => _navigateToRecording(context, client),
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _navigateToRecording(
      BuildContext context, RouteClientsLocalData client) {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => CollectionRecordingScreen(client: client),
      ),
    );
  }

  Future<void> _launchNavigation(double lat, double lng) async {
    final url = 'google.navigation:q=$lat,$lng';
    final webUrl =
        'https://www.google.com/maps/search/?api=1&query=$lat,$lng';
    try {
      if (await canLaunchUrl(Uri.parse(url))) {
        await launchUrl(Uri.parse(url));
      } else {
        await launchUrl(Uri.parse(webUrl),
            mode: LaunchMode.externalApplication);
      }
    } catch (_) {}
  }

  String _formatWasteType(String raw) {
    if (raw.isEmpty) return 'General';
    return raw[0].toUpperCase() + raw.substring(1).toLowerCase();
  }
}

// ---------------------------------------------------------------------------
// Empty / error states
// ---------------------------------------------------------------------------

class _NoRouteView extends StatelessWidget {
  const _NoRouteView();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            Icons.route_outlined,
            size: 64,
            color: Theme.of(context).colorScheme.outline,
          ),
          const SizedBox(height: 16),
          Text(
            'No route assigned',
            style: Theme.of(context).textTheme.titleMedium,
          ),
          const SizedBox(height: 8),
          Text(
            'Contact your operations manager to get a route assigned.',
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.bodySmall,
          ),
        ],
      ),
    );
  }
}

class _ErrorView extends StatelessWidget {
  const _ErrorView({required this.error});

  final String error;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.error_outline, size: 48, color: Colors.red),
            const SizedBox(height: 12),
            const Text(
              'Failed to load route',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            Text(
              error,
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 13, color: Colors.grey),
            ),
          ],
        ),
      ),
    );
  }
}
