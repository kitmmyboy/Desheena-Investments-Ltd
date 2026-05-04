import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'route_provider.dart';

/// A small chip widget that shows the current online/offline status.
///
/// Displays a green "Online" chip when connected and a red "Offline" chip
/// when not connected. Watches [connectivityStatusProvider] so it updates
/// automatically when connectivity changes.
///
/// Implements Requirement 3.5 — persistent offline/online status indicator
/// visible on all Driver screens.
class ConnectivityIndicator extends ConsumerWidget {
  const ConnectivityIndicator({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final connectivityAsync = ref.watch(connectivityStatusProvider);

    return connectivityAsync.when(
      data: (isOnline) => _StatusChip(isOnline: isOnline),
      loading: () => const _StatusChip(isOnline: null),
      error: (_, __) => const _StatusChip(isOnline: false),
    );
  }
}

class _StatusChip extends StatelessWidget {
  const _StatusChip({required this.isOnline});

  /// null means "checking" (loading state).
  final bool? isOnline;

  @override
  Widget build(BuildContext context) {
    final online = isOnline;

    final Color backgroundColor;
    final Color foregroundColor;
    final IconData icon;
    final String label;

    if (online == null) {
      backgroundColor = Colors.grey.shade300;
      foregroundColor = Colors.grey.shade700;
      icon = Icons.sync;
      label = 'Checking…';
    } else if (online) {
      backgroundColor = Colors.green.shade100;
      foregroundColor = Colors.green.shade800;
      icon = Icons.wifi;
      label = 'Online';
    } else {
      backgroundColor = Colors.red.shade100;
      foregroundColor = Colors.red.shade800;
      icon = Icons.wifi_off;
      label = 'Offline';
    }

    return Chip(
      avatar: Icon(icon, size: 16, color: foregroundColor),
      label: Text(
        label,
        style: TextStyle(
          color: foregroundColor,
          fontSize: 12,
          fontWeight: FontWeight.w600,
        ),
      ),
      backgroundColor: backgroundColor,
      side: BorderSide.none,
      padding: const EdgeInsets.symmetric(horizontal: 4),
      visualDensity: VisualDensity.compact,
    );
  }
}
