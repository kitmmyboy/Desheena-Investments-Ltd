import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../sync/sync_engine.dart';
import '../sync/sync_provider.dart';

/// Persistent sync status bar shown on the Driver route list screen.
///
/// Implements Requirements 5.7 and 5.8:
/// - 5.7: Displays count of pending records and timestamp of last successful sync.
/// - 5.8: Provides a "Sync Now" button that immediately triggers the SyncEngine.
///
/// Display format:
/// - Pending records:  "↑ 3 pending · Last sync: 14:32"
/// - All synced:       "✓ All synced · Last sync: 14:32"
/// - Never synced:     "↑ {count} pending · Never synced"
class SyncStatusWidget extends ConsumerWidget {
  const SyncStatusWidget({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final statusAsync = ref.watch(syncStatusProvider);

    return statusAsync.when(
      data: (status) => _SyncStatusBar(status: status),
      loading: () => const _SyncStatusBar(
        status: SyncStatus(pendingCount: 0, isSyncing: false),
      ),
      error: (_, __) => const _SyncStatusBar(
        status: SyncStatus(pendingCount: 0, isSyncing: false),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Internal bar widget
// ---------------------------------------------------------------------------

class _SyncStatusBar extends ConsumerWidget {
  const _SyncStatusBar({required this.status});

  final SyncStatus status;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    final bool hasPending = status.pendingCount > 0;
    final bool isSyncing = status.isSyncing;

    // Build the status label text.
    final String syncLabel = _buildSyncLabel(status);

    return Container(
      width: double.infinity,
      color: colorScheme.surfaceContainerHighest,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      child: Row(
        children: [
          // Status icon or spinner.
          if (isSyncing)
            SizedBox(
              width: 16,
              height: 16,
              child: CircularProgressIndicator(
                strokeWidth: 2,
                color: colorScheme.primary,
              ),
            )
          else
            Icon(
              hasPending ? Icons.upload_outlined : Icons.check_circle_outline,
              size: 16,
              color: hasPending
                  ? colorScheme.secondary
                  : colorScheme.primary,
            ),

          const SizedBox(width: 8),

          // Status label — expands to fill available space.
          Expanded(
            child: Text(
              syncLabel,
              style: theme.textTheme.bodySmall?.copyWith(
                color: colorScheme.onSurfaceVariant,
                fontWeight: FontWeight.w500,
              ),
              overflow: TextOverflow.ellipsis,
            ),
          ),

          const SizedBox(width: 8),

          // "Sync Now" button — disabled while syncing.
          TextButton(
            onPressed: isSyncing
                ? null
                : () => ref.read(syncEngineProvider).syncNow(),
            style: TextButton.styleFrom(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
              minimumSize: Size.zero,
              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
            ),
            child: Text(
              'Sync Now',
              style: theme.textTheme.labelSmall?.copyWith(
                color: isSyncing
                    ? colorScheme.onSurfaceVariant.withOpacity(0.4)
                    : colorScheme.primary,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }

  /// Builds the human-readable sync status label.
  ///
  /// Format:
  /// - "↑ 3 pending · Last sync: 14:32"
  /// - "✓ All synced · Last sync: 14:32"
  /// - "↑ 3 pending · Never synced"
  String _buildSyncLabel(SyncStatus status) {
    final String pendingPart = status.pendingCount > 0
        ? '↑ ${status.pendingCount} pending'
        : '✓ All synced';

    final String syncTimePart = status.lastSyncTime != null
        ? 'Last sync: ${DateFormat('HH:mm').format(status.lastSyncTime!.toLocal())}'
        : 'Never synced';

    return '$pendingPart · $syncTimePart';
  }
}
