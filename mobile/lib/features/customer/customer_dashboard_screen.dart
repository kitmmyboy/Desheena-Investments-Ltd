import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'customer_provider.dart';
import 'customer_payments_screen.dart';
import 'customer_invoices_screen.dart';

class CustomerDashboardScreen extends ConsumerWidget {
  const CustomerDashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final dashboardDataAsync = ref.watch(customerDashboardDataProvider);
    final theme = Theme.of(context);

    return Scaffold(
      body: RefreshIndicator(
        onRefresh: () => ref.refresh(customerDashboardDataProvider.future),
        child: dashboardDataAsync.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => Center(child: Text('Error: $e')),
          data: (data) {
            final currencyFmt = NumberFormat('#,###', 'en_UG');
            final totalPaid = data.payments.fold<double>(0, (sum, p) => sum + p.amount);
            final outstanding = data.invoices
                .where((i) => i.status.toLowerCase() != 'paid')
                .fold<double>(0, (sum, i) => sum + i.totalAmount);

            return ListView(
              padding: const EdgeInsets.all(16),
              children: [
                // Financial Summary Card
                Card(
                  elevation: 0,
                  color: theme.colorScheme.primaryContainer.withOpacity(0.3),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16),
                    side: BorderSide(color: theme.colorScheme.primary.withOpacity(0.1)),
                  ),
                  child: Padding(
                    padding: const EdgeInsets.all(20),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Financial Summary',
                          style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
                        ),
                        const SizedBox(height: 20),
                        Row(
                          children: [
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text('Total Paid', style: theme.textTheme.bodySmall),
                                  Text(
                                    'UGX ${currencyFmt.format(totalPaid.toInt())}',
                                    style: theme.textTheme.titleLarge?.copyWith(
                                      color: Colors.green.shade700,
                                      fontWeight: FontWeight.bold,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            Container(width: 1, height: 40, color: theme.dividerColor),
                            const SizedBox(width: 16),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text('Outstanding', style: theme.textTheme.bodySmall),
                                  Text(
                                    'UGX ${currencyFmt.format(outstanding.toInt())}',
                                    style: theme.textTheme.titleLarge?.copyWith(
                                      color: Colors.red.shade700,
                                      fontWeight: FontWeight.bold,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 16),

                // Next Collection Card
                _InfoCard(
                  title: 'Next Collection',
                  icon: Icons.calendar_today_outlined,
                  color: Colors.blue,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (data.nextCollection != null) ...[
                        Text(
                          data.nextCollection!,
                          style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
                        ),
                        const SizedBox(height: 4),
                        const Text('Please ensure your waste is ready by 8:00 AM.',
                            style: TextStyle(fontSize: 12, color: Colors.grey)),
                      ] else
                        const Text('No upcoming collections scheduled.'),
                    ],
                  ),
                ),
                const SizedBox(height: 16),

                // Assigned Driver Card
                _InfoCard(
                  title: 'Your Driver',
                  icon: Icons.person_outline,
                  color: Colors.orange,
                  child: data.driver != null
                      ? Row(
                          children: [
                            CircleAvatar(
                              backgroundColor: Colors.orange.shade100,
                              child: const Icon(Icons.person, color: Colors.orange),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    data.driver!.name,
                                    style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
                                  ),
                                  if (data.driver!.phone != null)
                                    Text(data.driver!.phone!, style: theme.textTheme.bodySmall),
                                ],
                              ),
                            ),
                            if (data.driver!.phone != null)
                              IconButton.filledTonal(
                                onPressed: () {
                                  // TODO: Implement call
                                },
                                icon: const Icon(Icons.phone),
                              ),
                          ],
                        )
                      : const Text('No driver assigned yet.'),
                ),
                const SizedBox(height: 24),

                // Quick Actions
                Text('Quick Actions', style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
                const SizedBox(height: 12),
                Row(
                  children: [
                    _QuickAction(
                      label: 'Pay Bill',
                      icon: Icons.payment,
                      onTap: () {
                        // Switch to invoices tab? Or show list of unpaid
                      },
                    ),
                    const SizedBox(width: 12),
                    _QuickAction(
                      label: 'Report Issue',
                      icon: Icons.report_problem_outlined,
                      onTap: () {
                        // Switch to complaints tab
                      },
                    ),
                  ],
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}

class _InfoCard extends StatelessWidget {
  final String title;
  final IconData icon;
  final Color color;
  final Widget child;

  const _InfoCard({
    required this.title,
    required this.icon,
    required this.color,
    required this.child,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(color: Colors.grey.shade200),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(icon, size: 20, color: color),
                const SizedBox(width: 8),
                Text(
                  title,
                  style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Colors.grey),
                ),
              ],
            ),
            const SizedBox(height: 12),
            child,
          ],
        ),
      ),
    );
  }
}

class _QuickAction extends StatelessWidget {
  final String label;
  final IconData icon;
  final VoidCallback onTap;

  const _QuickAction({required this.label, required this.icon, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Expanded(
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 16),
          decoration: BoxDecoration(
            border: Border.all(color: theme.dividerColor),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Column(
            children: [
              Icon(icon, color: theme.colorScheme.primary),
              const SizedBox(height: 8),
              Text(label, style: const TextStyle(fontWeight: FontWeight.bold)),
            ],
          ),
        ),
      ),
    );
  }
}
