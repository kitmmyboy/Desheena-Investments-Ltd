import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../db/index.dart';
import 'customer_provider.dart';
import 'pesapal_payment_screen.dart';

class CustomerInvoicesScreen extends ConsumerWidget {
  const CustomerInvoicesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final invoicesAsync = ref.watch(customerInvoicesProvider);

    return invoicesAsync.when(
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
                'Could not refresh invoices.\nShowing cached data.',
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodyMedium,
              ),
            ],
          ),
        ),
      ),
      data: (invoices) {
        if (invoices.isEmpty) {
          return const Center(
            child: Text('No invoices found.'),
          );
        }
        return RefreshIndicator(
          onRefresh: () => ref.refresh(customerInvoicesProvider.future),
          child: ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: invoices.length,
            separatorBuilder: (_, __) => const SizedBox(height: 8),
            itemBuilder: (context, index) {
              return _InvoiceCard(invoice: invoices[index]);
            },
          ),
        );
      },
    );
  }
}

class _InvoiceCard extends StatelessWidget {
  const _InvoiceCard({required this.invoice});

  final InvoicesLocalData invoice;

  bool get _isPayable =>
      invoice.status.toLowerCase() == 'unpaid' ||
      invoice.status.toLowerCase() == 'overdue';

  @override
  Widget build(BuildContext context) {
    final currencyFmt = NumberFormat('#,###', 'en_UG');
    final amountStr = 'UGX ${currencyFmt.format(invoice.amount.toInt())}';

    Color statusColor;
    IconData statusIcon;
    switch (invoice.status.toLowerCase()) {
      case 'paid':
        statusColor = Colors.green;
        statusIcon = Icons.check_circle_outline;
        break;
      case 'overdue':
        statusColor = Colors.red;
        statusIcon = Icons.warning_amber_outlined;
        break;
      default: // unpaid
        statusColor = Colors.orange;
        statusIcon = Icons.schedule_outlined;
    }

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
                Text(
                  'Period: ${invoice.invoicePeriod}',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.bold,
                      ),
                ),
                _StatusBadge(
                  label: invoice.status.toUpperCase(),
                  color: statusColor,
                  icon: statusIcon,
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              amountStr,
              style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                    color: Theme.of(context).colorScheme.primary,
                    fontWeight: FontWeight.bold,
                  ),
            ),
            const SizedBox(height: 4),
            Text(
              'Due: ${invoice.dueDate}',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: Colors.grey[600],
                  ),
            ),
            // Show "Pay Now" button only for unpaid or overdue invoices
            if (_isPayable) ...[
              const SizedBox(height: 12),
              SizedBox(
                width: double.infinity,
                child: FilledButton.icon(
                  onPressed: () => _navigateToPayment(context),
                  icon: const Icon(Icons.payment, size: 18),
                  label: const Text('Pay Now'),
                  style: FilledButton.styleFrom(
                    backgroundColor:
                        invoice.status.toLowerCase() == 'overdue'
                            ? Colors.red
                            : Theme.of(context).colorScheme.primary,
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(8)),
                    padding: const EdgeInsets.symmetric(vertical: 10),
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  void _navigateToPayment(BuildContext context) {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => PesapalPaymentScreen(invoice: invoice),
      ),
    );
  }
}

class _StatusBadge extends StatelessWidget {
  const _StatusBadge({
    required this.label,
    required this.color,
    required this.icon,
  });

  final String label;
  final Color color;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: color.withOpacity(0.12),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: color.withOpacity(0.4)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: color),
          const SizedBox(width: 4),
          Text(
            label,
            style: TextStyle(
              color: color,
              fontSize: 12,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}
