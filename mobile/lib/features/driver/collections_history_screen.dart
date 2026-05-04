import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'collection_provider.dart';
import 'connectivity_indicator.dart';

/// Screen showing previously recorded collections from Local_DB.
///
/// Displays up to 200 records with sync_status badge per record.
///
/// Implements Requirements 4.7, 5.10.
class CollectionsHistoryScreen extends ConsumerWidget {
  const CollectionsHistoryScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final collectionsAsync = ref.watch(collectionsHistoryProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Collection History'),
        actions: const [
          // Connectivity indicator (Requirement 3.5).
          Padding(
            padding: EdgeInsets.symmetric(horizontal: 8.0),
            child: Center(child: ConnectivityIndicator()),
          ),
        ],
      ),
      body: collectionsAsync.when(
        data: (collections) {
          if (collections.isEmpty) {
            return const _EmptyHistoryView();
          }
          return ListView.separated(
            padding: const EdgeInsets.all(12),
            itemCount: collections.length,
            separatorBuilder: (_, __) => const SizedBox(height: 8),
            itemBuilder: (context, index) {
              final collection = collections[index];
              return _CollectionHistoryCard(collection: collection);
            },
          );
        },
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.error_outline, size: 48, color: Colors.red),
                const SizedBox(height: 12),
                const Text(
                  'Failed to load history',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  error.toString(),
                  textAlign: TextAlign.center,
                  style: const TextStyle(fontSize: 13, color: Colors.grey),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Collection history card
// ---------------------------------------------------------------------------

class _CollectionHistoryCard extends StatelessWidget {
  const _CollectionHistoryCard({required this.collection});

  final dynamic collection; // CollectionsLocalData

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isSynced = collection.syncStatus == 'synced';

    return Card(
      elevation: 1,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Client ID row + sync badge.
            Row(
              children: [
                Expanded(
                  child: Text(
                    'Client: ${collection.clientId}',
                    style: theme.textTheme.titleSmall?.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                const SizedBox(width: 8),
                _SyncBadge(isSynced: isSynced),
              ],
            ),
            const SizedBox(height: 8),

            // Waste type.
            Row(
              children: [
                const Icon(Icons.delete_outline, size: 15),
                const SizedBox(width: 4),
                Text(
                  _formatWasteType(collection.wasteType as String),
                  style: theme.textTheme.bodyMedium,
                ),
                const SizedBox(width: 16),
                const Icon(Icons.scale_outlined, size: 15),
                const SizedBox(width: 4),
                Text(
                  '${(collection.weightKg as double).toStringAsFixed(1)} kg',
                  style: theme.textTheme.bodyMedium,
                ),
              ],
            ),
            const SizedBox(height: 6),

            // Collected at timestamp.
            Row(
              children: [
                const Icon(Icons.access_time, size: 15),
                const SizedBox(width: 4),
                Text(
                  _formatTimestamp(collection.collectedAt as String),
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: theme.colorScheme.onSurfaceVariant,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  String _formatWasteType(String raw) {
    if (raw.isEmpty) return 'General';
    return raw[0].toUpperCase() + raw.substring(1).toLowerCase();
  }

  String _formatTimestamp(String iso) {
    try {
      final dt = DateTime.parse(iso).toLocal();
      return '${dt.year}-${_pad(dt.month)}-${_pad(dt.day)} '
          '${_pad(dt.hour)}:${_pad(dt.minute)}';
    } catch (_) {
      return iso;
    }
  }

  String _pad(int n) => n.toString().padLeft(2, '0');
}

// ---------------------------------------------------------------------------
// Sync status badge
// ---------------------------------------------------------------------------

class _SyncBadge extends StatelessWidget {
  const _SyncBadge({required this.isSynced});

  final bool isSynced;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: isSynced ? Colors.green.shade100 : Colors.orange.shade100,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        isSynced ? 'Synced' : 'Pending',
        style: TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w600,
          color: isSynced ? Colors.green.shade800 : Colors.orange.shade800,
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

class _EmptyHistoryView extends StatelessWidget {
  const _EmptyHistoryView();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            Icons.history_outlined,
            size: 64,
            color: Theme.of(context).colorScheme.outline,
          ),
          const SizedBox(height: 16),
          Text(
            'No collections recorded yet',
            style: Theme.of(context).textTheme.titleMedium,
          ),
          const SizedBox(height: 8),
          Text(
            'Collections you record will appear here.',
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.bodySmall,
          ),
        ],
      ),
    );
  }
}
