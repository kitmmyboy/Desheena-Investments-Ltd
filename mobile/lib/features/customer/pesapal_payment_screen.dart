import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../db/index.dart';
import 'customer_provider.dart';
import 'payment_confirmation_screen.dart';

/// Screen that initiates the Pesapal payment flow for an unpaid invoice.
///
/// Calls the `initiate-pesapal-payment` Edge Function, then opens the
/// Pesapal-hosted payment page in the device's external browser.
/// After the user returns from the browser, navigates to
/// [PaymentConfirmationScreen].
///
/// Implements Requirements 20.3, 20.4, 11.1, 11.2.
class PesapalPaymentScreen extends ConsumerStatefulWidget {
  const PesapalPaymentScreen({super.key, required this.invoice});

  final InvoicesLocalData invoice;

  @override
  ConsumerState<PesapalPaymentScreen> createState() =>
      _PesapalPaymentScreenState();
}

class _PesapalPaymentScreenState extends ConsumerState<PesapalPaymentScreen> {
  bool _isLoading = false;
  String? _errorMessage;

  final _currencyFmt = NumberFormat('#,###', 'en_UG');

  @override
  Widget build(BuildContext context) {
    final amountStr =
        'UGX ${_currencyFmt.format(widget.invoice.amount.toInt())}';

    return Scaffold(
      appBar: AppBar(
        title: const Text('Pay Invoice'),
      ),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Invoice summary card
            Card(
              elevation: 2,
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12)),
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Invoice Summary',
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                            fontWeight: FontWeight.bold,
                          ),
                    ),
                    const SizedBox(height: 12),
                    _SummaryRow(
                      label: 'Period',
                      value: widget.invoice.invoicePeriod,
                    ),
                    const SizedBox(height: 6),
                    _SummaryRow(
                      label: 'Amount',
                      value: amountStr,
                      valueStyle: Theme.of(context)
                          .textTheme
                          .headlineSmall
                          ?.copyWith(
                            color: Theme.of(context).colorScheme.primary,
                            fontWeight: FontWeight.bold,
                          ),
                    ),
                    const SizedBox(height: 6),
                    _SummaryRow(
                      label: 'Due Date',
                      value: widget.invoice.dueDate,
                    ),
                    const SizedBox(height: 6),
                    _SummaryRow(
                      label: 'Status',
                      value: widget.invoice.status.toUpperCase(),
                      valueStyle: TextStyle(
                        color: widget.invoice.status.toLowerCase() == 'overdue'
                            ? Colors.red
                            : Colors.orange,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
            ),

            const SizedBox(height: 24),

            // Info text
            Text(
              'You will be redirected to the Pesapal secure payment page to '
              'complete your payment. After paying, return to this app and '
              'tap "Check Payment Status".',
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: Colors.grey[700],
                  ),
              textAlign: TextAlign.center,
            ),

            const SizedBox(height: 24),

            // Error message
            if (_errorMessage != null) ...[
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.red.shade50,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: Colors.red.shade200),
                ),
                child: Row(
                  children: [
                    Icon(Icons.error_outline,
                        color: Colors.red.shade700, size: 20),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        _errorMessage!,
                        style: TextStyle(color: Colors.red.shade700),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
            ],

            const Spacer(),

            // Pay Now button
            FilledButton.icon(
              onPressed: _isLoading ? null : _initiatePayment,
              icon: _isLoading
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: Colors.white,
                      ),
                    )
                  : const Icon(Icons.payment),
              label: Text(
                _isLoading ? 'Initiating Payment…' : 'Pay Now via Pesapal',
                style: const TextStyle(fontSize: 16),
              ),
              style: FilledButton.styleFrom(
                minimumSize: const Size.fromHeight(52),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12)),
              ),
            ),

            const SizedBox(height: 12),

            // Cancel button
            OutlinedButton(
              onPressed: _isLoading ? null : () => Navigator.of(context).pop(),
              style: OutlinedButton.styleFrom(
                minimumSize: const Size.fromHeight(48),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12)),
              ),
              child: const Text('Cancel'),
            ),

            const SizedBox(height: 16),
          ],
        ),
      ),
    );
  }

  Future<void> _initiatePayment() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      // Get the current user's email and phone for the payment request.
      final clientId = ref.read(currentClientIdProvider);
      if (clientId == null) {
        throw Exception('Not authenticated. Please log in again.');
      }

      final userDetails = _getSupabaseUserDetails();

      final result = await ref.read(
        paymentInitiationProvider((
          invoiceId: widget.invoice.id,
          amount: widget.invoice.amount,
          currency: 'UGX',
          customerPhone: userDetails['phone'] ?? '',
          customerEmail: userDetails['email'] ?? '',
        )).future,
      );

      final redirectUrl = result['redirect_url'] as String?;
      if (redirectUrl == null || redirectUrl.isEmpty) {
        throw Exception('No payment URL received from server.');
      }

      // Open the Pesapal payment page in the external browser.
      final uri = Uri.parse(redirectUrl);
      final canLaunch = await canLaunchUrl(uri);
      if (!canLaunch) {
        throw Exception(
            'Could not open payment page. Please check your browser settings.');
      }

      await launchUrl(uri, mode: LaunchMode.externalApplication);

      // After returning from the browser, navigate to the confirmation screen.
      if (mounted) {
        Navigator.of(context).pushReplacement(
          MaterialPageRoute(
            builder: (_) => PaymentConfirmationScreen(
              invoice: widget.invoice,
              orderTrackingId: result['order_tracking_id'] as String? ?? '',
            ),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _errorMessage = e.toString().replaceFirst('Exception: ', '');
          _isLoading = false;
        });
      }
    }
  }

  /// Reads the current user's email and phone from Supabase Auth metadata.
  Map<String, String?> _getSupabaseUserDetails() {
    final user = Supabase.instance.client.auth.currentUser;
    return {
      'email': user?.email,
      'phone': user?.phone ??
          (user?.userMetadata?['phone'] as String?) ??
          '',
    };
  }
}

// ---------------------------------------------------------------------------
// Helper widgets
// ---------------------------------------------------------------------------

class _SummaryRow extends StatelessWidget {
  const _SummaryRow({
    required this.label,
    required this.value,
    this.valueStyle,
  });

  final String label;
  final String value;
  final TextStyle? valueStyle;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: Colors.grey[600],
              ),
        ),
        Text(
          value,
          style: valueStyle ?? Theme.of(context).textTheme.bodyMedium,
        ),
      ],
    );
  }
}
