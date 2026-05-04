import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../db/index.dart';
import 'customer_provider.dart';

/// Screen shown after the user returns from the Pesapal payment page.
///
/// Allows the user to check whether their payment was confirmed by
/// re-fetching the invoice status from Supabase. If confirmed, updates
/// Local_DB and shows a success state. If still pending, shows a
/// "payment pending" message.
///
/// Implements Requirements 20.3, 20.4, 11.1, 11.2.
class PaymentConfirmationScreen extends ConsumerStatefulWidget {
  const PaymentConfirmationScreen({
    super.key,
    required this.invoice,
    required this.orderTrackingId,
  });

  final InvoicesLocalData invoice;
  final String orderTrackingId;

  @override
  ConsumerState<PaymentConfirmationScreen> createState() =>
      _PaymentConfirmationScreenState();
}

class _PaymentConfirmationScreenState
    extends ConsumerState<PaymentConfirmationScreen> {
  bool _isChecking = false;
  String? _currentStatus;
  String? _errorMessage;

  final _currencyFmt = NumberFormat('#,###', 'en_UG');

  @override
  void initState() {
    super.initState();
    _currentStatus = widget.invoice.status;
  }

  bool get _isPaid => _currentStatus?.toLowerCase() == 'paid';

  @override
  Widget build(BuildContext context) {
    final amountStr =
        'UGX ${_currencyFmt.format(widget.invoice.amount.toInt())}';

    return PopScope(
      // Prevent accidental back navigation — user should use the button
      canPop: !_isChecking,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Payment Status'),
          automaticallyImplyLeading: !_isChecking,
        ),
        body: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Status icon
              Center(
                child: AnimatedSwitcher(
                  duration: const Duration(milliseconds: 400),
                  child: _isPaid
                      ? const _SuccessIcon(key: ValueKey('success'))
                      : const _PendingIcon(key: ValueKey('pending')),
                ),
              ),

              const SizedBox(height: 24),

              // Status title
              Center(
                child: Text(
                  _isPaid ? 'Payment Confirmed!' : 'Payment Submitted',
                  style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                        fontWeight: FontWeight.bold,
                        color: _isPaid ? Colors.green : Colors.orange,
                      ),
                  textAlign: TextAlign.center,
                ),
              ),

              const SizedBox(height: 8),

              // Status subtitle
              Center(
                child: Text(
                  _isPaid
                      ? 'Your invoice has been marked as paid.'
                      : 'Your payment is being processed by Pesapal.\n'
                          'It may take a few minutes to confirm.',
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: Colors.grey[700],
                      ),
                  textAlign: TextAlign.center,
                ),
              ),

              const SizedBox(height: 24),

              // Invoice details card
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
                        'Invoice Details',
                        style:
                            Theme.of(context).textTheme.titleMedium?.copyWith(
                                  fontWeight: FontWeight.bold,
                                ),
                      ),
                      const SizedBox(height: 12),
                      _DetailRow(
                        label: 'Invoice Reference',
                        value: widget.invoice.id,
                        isMonospace: true,
                      ),
                      const SizedBox(height: 6),
                      _DetailRow(
                        label: 'Period',
                        value: widget.invoice.invoicePeriod,
                      ),
                      const SizedBox(height: 6),
                      _DetailRow(
                        label: 'Amount',
                        value: amountStr,
                        isBold: true,
                      ),
                      const SizedBox(height: 6),
                      _DetailRow(
                        label: 'Status',
                        value: (_currentStatus ?? widget.invoice.status)
                            .toUpperCase(),
                        valueColor: _isPaid ? Colors.green : Colors.orange,
                      ),
                    ],
                  ),
                ),
              ),

              // Error message
              if (_errorMessage != null) ...[
                const SizedBox(height: 16),
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
              ],

              const Spacer(),

              // Check Payment Status button (only shown when not yet paid)
              if (!_isPaid) ...[
                FilledButton.icon(
                  onPressed: _isChecking ? null : _checkPaymentStatus,
                  icon: _isChecking
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Colors.white,
                          ),
                        )
                      : const Icon(Icons.refresh),
                  label: Text(
                    _isChecking ? 'Checking…' : 'Check Payment Status',
                    style: const TextStyle(fontSize: 16),
                  ),
                  style: FilledButton.styleFrom(
                    minimumSize: const Size.fromHeight(52),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12)),
                  ),
                ),
                const SizedBox(height: 12),
              ],

              // Back to Invoices button
              OutlinedButton.icon(
                onPressed: _isChecking ? null : _backToInvoices,
                icon: const Icon(Icons.receipt_long_outlined),
                label: const Text('Back to Invoices'),
                style: OutlinedButton.styleFrom(
                  minimumSize: const Size.fromHeight(48),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12)),
                ),
              ),

              const SizedBox(height: 16),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _checkPaymentStatus() async {
    setState(() {
      _isChecking = true;
      _errorMessage = null;
    });

    try {
      final status = await ref.read(
        invoiceStatusRefreshProvider(widget.invoice.id).future,
      );

      if (mounted) {
        setState(() {
          _currentStatus = status;
          _isChecking = false;
        });

        if (status.toLowerCase() == 'paid') {
          // Invalidate the invoices list so it refreshes on back navigation.
          ref.invalidate(customerInvoicesProvider);
        }
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _errorMessage =
              'Could not check payment status. Please try again.\n'
              '${e.toString().replaceFirst('Exception: ', '')}';
          _isChecking = false;
        });
      }
    }
  }

  void _backToInvoices() {
    // Pop back to the invoices screen (pop twice: confirmation + payment screens)
    final nav = Navigator.of(context);
    if (nav.canPop()) {
      nav.pop();
      if (nav.canPop()) {
        nav.pop();
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Helper widgets
// ---------------------------------------------------------------------------

class _SuccessIcon extends StatelessWidget {
  const _SuccessIcon({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 80,
      height: 80,
      decoration: BoxDecoration(
        color: Colors.green.shade50,
        shape: BoxShape.circle,
      ),
      child: Icon(
        Icons.check_circle_outline,
        size: 48,
        color: Colors.green.shade600,
      ),
    );
  }
}

class _PendingIcon extends StatelessWidget {
  const _PendingIcon({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 80,
      height: 80,
      decoration: BoxDecoration(
        color: Colors.orange.shade50,
        shape: BoxShape.circle,
      ),
      child: Icon(
        Icons.hourglass_empty_outlined,
        size: 48,
        color: Colors.orange.shade600,
      ),
    );
  }
}

class _DetailRow extends StatelessWidget {
  const _DetailRow({
    required this.label,
    required this.value,
    this.isBold = false,
    this.isMonospace = false,
    this.valueColor,
  });

  final String label;
  final String value;
  final bool isBold;
  final bool isMonospace;
  final Color? valueColor;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: 130,
          child: Text(
            label,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: Colors.grey[600],
                ),
          ),
        ),
        Expanded(
          child: Text(
            value,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  fontWeight: isBold ? FontWeight.bold : FontWeight.normal,
                  fontFamily: isMonospace ? 'monospace' : null,
                  color: valueColor,
                  fontSize: isMonospace ? 11 : null,
                ),
          ),
        ),
      ],
    );
  }
}
