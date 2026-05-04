import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../db/index.dart';
import 'customer_provider.dart';

class CustomerPaymentsScreen extends ConsumerWidget {
  const CustomerPaymentsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final paymentsAsync = ref.watch(customerPaymentsProvider);

    return paymentsAsync.when(
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
                'Could not refresh payment history.\nShowing cached data.',
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodyMedium,
              ),
            ],
          ),
        ),
      ),
      data: (payments) {
        if (payments.isEmpty) {
          return const Center(
            child: Text('No payment history found.'),
          );
        }
        return RefreshIndicator(
          onRefresh: () => ref.refresh(customerPaymentsProvider.future),
          child: ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: payments.length,
            separatorBuilder: (_, __) => const SizedBox(height: 8),
            itemBuilder: (context, index) {
              return _PaymentCard(payment: payments[index]);
            },
          ),
        );
      },
    );
  }
}

class _PaymentCard extends StatelessWidget {
  const _PaymentCard({required this.payment});

  final PaymentsLocalData payment;

  @override
  Widget build(BuildContext context) {
    final currencyFmt = NumberFormat('#,###', 'en_UG');
    final amountStr = 'UGX ${currencyFmt.format(payment.amount.toInt())}';

    final paidAtStr = payment.paidAt != null
        ? _formatDate(payment.paidAt!)
        : 'Date unknown';

    return Card(
      elevation: 2,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: ListTile(
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        leading: CircleAvatar(
          backgroundColor:
              Theme.of(context).colorScheme.primary.withOpacity(0.12),
          child: Icon(
            Icons.payment_outlined,
            color: Theme.of(context).colorScheme.primary,
          ),
        ),
        title: Text(
          amountStr,
          style: Theme.of(context).textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.bold,
              ),
        ),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SizedBox(height: 2),
            Text('Paid: $paidAtStr'),
            Text(
              'Method: ${_formatMethod(payment.paymentMethod)}',
              style: Theme.of(context).textTheme.bodySmall,
            ),
            if (payment.transactionRef != null)
              Text(
                'Ref: ${payment.transactionRef}',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: Colors.grey[600],
                    ),
              ),
          ],
        ),
        trailing: _statusChip(payment.status, context),
      ),
    );
  }

  Widget _statusChip(String status, BuildContext context) {
    final color =
        status.toLowerCase() == 'completed' ? Colors.green : Colors.orange;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withOpacity(0.12),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(
        status.toUpperCase(),
        style: TextStyle(
          color: color,
          fontSize: 11,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }

  String _formatDate(String isoDate) {
    try {
      final dt = DateTime.parse(isoDate);
      return DateFormat('dd MMM yyyy').format(dt);
    } catch (_) {
      return isoDate;
    }
  }

  String _formatMethod(String method) {
    switch (method.toLowerCase()) {
      case 'pesapal':
        return 'Pesapal';
      case 'cash':
        return 'Cash';
      case 'bank_transfer':
        return 'Bank Transfer';
      default:
        return method;
    }
  }
}
