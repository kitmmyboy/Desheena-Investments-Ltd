import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../db/index.dart';
import 'complaint_submission_screen.dart';
import 'customer_provider.dart';

/// Complaint history view with FAB to submit a new complaint.
class CustomerComplaintsScreen extends ConsumerStatefulWidget {
  const CustomerComplaintsScreen({super.key});

  @override
  ConsumerState<CustomerComplaintsScreen> createState() =>
      _CustomerComplaintsScreenState();
}

class _CustomerComplaintsScreenState
    extends ConsumerState<CustomerComplaintsScreen> {
  Future<void> _openSubmissionForm() async {
    await Navigator.of(context).push<void>(
      MaterialPageRoute(
        builder: (_) => const ComplaintSubmissionScreen(),
      ),
    );
    // Refresh the list after returning (the submission screen also invalidates
    // the provider, but this ensures a refresh even if the user navigated back
    // without submitting).
    ref.invalidate(customerComplaintsProvider);
  }

  @override
  Widget build(BuildContext context) {
    final complaintsAsync = ref.watch(customerComplaintsProvider);

    return Scaffold(
      body: complaintsAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.cloud_off, size: 48, color: Colors.grey),
                const SizedBox(height: 12),
                Text(
                  'Could not refresh complaints.\nShowing cached data.',
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
              ],
            ),
          ),
        ),
        data: (complaints) {
          if (complaints.isEmpty) {
            return const Center(
              child: Text('No complaints found.'),
            );
          }
          return RefreshIndicator(
            onRefresh: () => ref.refresh(customerComplaintsProvider.future),
            child: ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: complaints.length,
              separatorBuilder: (_, __) => const SizedBox(height: 8),
              itemBuilder: (context, index) {
                return _ComplaintCard(complaint: complaints[index]);
              },
            ),
          );
        },
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: _openSubmissionForm,
        tooltip: 'Submit new complaint',
        child: const Icon(Icons.add),
      ),
    );
  }
}

class _ComplaintCard extends StatelessWidget {
  const _ComplaintCard({required this.complaint});

  final ComplaintsLocalData complaint;

  @override
  Widget build(BuildContext context) {
    Color statusColor;
    IconData statusIcon;
    switch (complaint.status.toLowerCase()) {
      case 'resolved':
        statusColor = Colors.green;
        statusIcon = Icons.check_circle_outline;
        break;
      case 'in-progress':
        statusColor = Colors.blue;
        statusIcon = Icons.autorenew_outlined;
        break;
      default: // open
        statusColor = Colors.orange;
        statusIcon = Icons.report_problem_outlined;
    }

    final dateStr = DateFormat('dd MMM yyyy').format(complaint.createdAt);

    return Card(
      elevation: 2,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Chip(
                  label: Text(
                    _formatCategory(complaint.category),
                    style: const TextStyle(fontSize: 12),
                  ),
                  padding: EdgeInsets.zero,
                  visualDensity: VisualDensity.compact,
                ),
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(statusIcon, size: 16, color: statusColor),
                    const SizedBox(width: 4),
                    Text(
                      complaint.status.toUpperCase(),
                      style: TextStyle(
                        color: statusColor,
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              complaint.message,
              maxLines: 3,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(context).textTheme.bodyMedium,
            ),
            const SizedBox(height: 8),
            Text(
              'Submitted: $dateStr',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: Colors.grey[600],
                  ),
            ),
          ],
        ),
      ),
    );
  }

  String _formatCategory(String category) {
    switch (category.toLowerCase()) {
      case 'missed_collection':
      case 'missed collection':
        return 'Missed Collection';
      case 'billing_dispute':
      case 'billing dispute':
        return 'Billing Dispute';
      case 'service_quality':
      case 'service quality':
        return 'Service Quality';
      default:
        return 'Other';
    }
  }
}
