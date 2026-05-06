import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../auth/auth_provider.dart';
import '../auth/login_screen.dart';
import 'customer_dashboard_screen.dart';
import 'customer_complaints_screen.dart';
import 'customer_invoices_screen.dart';
import 'customer_payments_screen.dart';
import 'customer_provider.dart';

/// Customer Portal — main entry point shown when role = Customer.
///
/// Provides four tabs:
///   1. Dashboard  — unified summary of account, schedule and driver
///   2. Invoices   — active and historical invoices with status badges
///   3. Payments   — payment history
///   4. Complaints — complaint history
class CustomerHomeScreen extends ConsumerStatefulWidget {
  const CustomerHomeScreen({super.key});

  @override
  ConsumerState<CustomerHomeScreen> createState() =>
      _CustomerHomeScreenState();
}

class _CustomerHomeScreenState extends ConsumerState<CustomerHomeScreen> {
  int _selectedIndex = 0;

  static const _tabs = [
    _TabItem(
      label: 'Dashboard',
      icon: Icons.dashboard_outlined,
      activeIcon: Icons.dashboard,
    ),
    _TabItem(
      label: 'Invoices',
      icon: Icons.receipt_long_outlined,
      activeIcon: Icons.receipt_long,
    ),
    _TabItem(
      label: 'Payments',
      icon: Icons.payment_outlined,
      activeIcon: Icons.payment,
    ),
    _TabItem(
      label: 'Complaints',
      icon: Icons.report_problem_outlined,
      activeIcon: Icons.report_problem,
    ),
  ];

  static const _screens = [
    CustomerDashboardScreen(),
    CustomerInvoicesScreen(),
    CustomerPaymentsScreen(),
    CustomerComplaintsScreen(),
  ];

  @override
  void initState() {
    super.initState();
    // Kick off notification fetch on screen load.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(customerNotificationsProvider);
    });
  }

  @override
  Widget build(BuildContext context) {
    final badgeCount = ref.watch(notificationBadgeCountProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Customer Portal'),
        actions: [
          // Notification bell with badge
          Stack(
            alignment: Alignment.center,
            children: [
              IconButton(
                icon: const Icon(Icons.notifications_outlined),
                tooltip: 'Notifications',
                onPressed: () => _showNotificationsSheet(context),
              ),
              if (badgeCount > 0)
                Positioned(
                  top: 8,
                  right: 8,
                  child: _NotificationBadge(count: badgeCount),
                ),
            ],
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
      body: IndexedStack(
        index: _selectedIndex,
        children: _screens,
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _selectedIndex,
        onDestinationSelected: (index) {
          setState(() => _selectedIndex = index);
        },
        destinations: _tabs
            .map(
              (tab) => NavigationDestination(
                icon: Icon(tab.icon),
                selectedIcon: Icon(tab.activeIcon),
                label: tab.label,
              ),
            )
            .toList(),
      ),
    );
  }

  void _showNotificationsSheet(BuildContext context) {
    showModalBottomSheet<void>(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => const _NotificationsSheet(),
    );
  }
}

// ---------------------------------------------------------------------------
// Notification badge widget
// ---------------------------------------------------------------------------

class _NotificationBadge extends StatelessWidget {
  const _NotificationBadge({required this.count});

  final int count;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(3),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.error,
        shape: BoxShape.circle,
      ),
      constraints: const BoxConstraints(minWidth: 16, minHeight: 16),
      child: Text(
        count > 99 ? '99+' : '$count',
        style: const TextStyle(
          color: Colors.white,
          fontSize: 9,
          fontWeight: FontWeight.bold,
        ),
        textAlign: TextAlign.center,
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Notifications bottom sheet
// ---------------------------------------------------------------------------

class _NotificationsSheet extends ConsumerWidget {
  const _NotificationsSheet();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final notificationsAsync = ref.watch(customerNotificationsProvider);

    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Notifications',
                style: Theme.of(context).textTheme.titleLarge,
              ),
              TextButton(
                onPressed: () {
                  ref.read(notificationBadgeCountProvider.notifier).state = 0;
                  Navigator.of(context).pop();
                },
                child: const Text('Mark all read'),
              ),
            ],
          ),
          const Divider(),
          notificationsAsync.when(
            loading: () => const Padding(
              padding: EdgeInsets.symmetric(vertical: 24),
              child: Center(child: CircularProgressIndicator()),
            ),
            error: (_, __) => const Padding(
              padding: EdgeInsets.symmetric(vertical: 24),
              child: Center(child: Text('Could not load notifications.')),
            ),
            data: (count) => count == 0
                ? const Padding(
                    padding: EdgeInsets.symmetric(vertical: 24),
                    child: Center(child: Text('No new notifications.')),
                  )
                : Text(
                    'You have $count unread notification(s).',
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
          ),
          const SizedBox(height: 16),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Tab item model
// ---------------------------------------------------------------------------

class _TabItem {
  const _TabItem({
    required this.label,
    required this.icon,
    required this.activeIcon,
  });

  final String label;
  final IconData icon;
  final IconData activeIcon;
}
