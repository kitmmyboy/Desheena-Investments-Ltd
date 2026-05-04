import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'customer_provider.dart';
import 'customer_repository.dart';

/// Maps display labels to DB category values.
const _categories = <String, String>{
  'Missed Collection': 'missed_collection',
  'Billing Dispute': 'billing_dispute',
  'Service Quality': 'service_quality',
  'Other': 'other',
};

const int _maxMessageLength = 1000;

/// Screen for submitting a new complaint from the Customer Portal.
class ComplaintSubmissionScreen extends ConsumerStatefulWidget {
  const ComplaintSubmissionScreen({super.key});

  @override
  ConsumerState<ComplaintSubmissionScreen> createState() =>
      _ComplaintSubmissionScreenState();
}

class _ComplaintSubmissionScreenState
    extends ConsumerState<ComplaintSubmissionScreen> {
  final _formKey = GlobalKey<FormState>();
  final _messageController = TextEditingController();

  String? _selectedCategoryLabel;
  bool _isSubmitting = false;

  @override
  void dispose() {
    _messageController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;

    final clientId = ref.read(currentClientIdProvider);
    if (clientId == null) {
      _showError('You must be logged in to submit a complaint.');
      return;
    }

    final categoryValue = _categories[_selectedCategoryLabel!]!;
    final message = _messageController.text.trim();

    setState(() => _isSubmitting = true);

    try {
      await ref
          .read(
            submitComplaintProvider((
              clientId: clientId,
              message: message,
              category: categoryValue,
            )).future,
          );

      // Invalidate the complaints list so it refreshes.
      ref.invalidate(customerComplaintsProvider);

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Complaint submitted successfully.'),
            backgroundColor: Colors.green,
          ),
        );
        Navigator.of(context).pop();
      }
    } on OfflineException catch (e) {
      _showError(e.message);
    } catch (e) {
      _showError('Failed to submit complaint. Please try again.');
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  void _showError(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: Colors.red[700],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final messageLength = _messageController.text.length;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Submit Complaint'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // ── Category dropdown ──────────────────────────────────────
              DropdownButtonFormField<String>(
                value: _selectedCategoryLabel,
                decoration: const InputDecoration(
                  labelText: 'Category',
                  border: OutlineInputBorder(),
                ),
                hint: const Text('Select a category'),
                items: _categories.keys
                    .map(
                      (label) => DropdownMenuItem(
                        value: label,
                        child: Text(label),
                      ),
                    )
                    .toList(),
                onChanged: (value) =>
                    setState(() => _selectedCategoryLabel = value),
                validator: (value) {
                  if (value == null || value.isEmpty) {
                    return 'Please select a category.';
                  }
                  return null;
                },
              ),

              const SizedBox(height: 20),

              // ── Message text field ─────────────────────────────────────
              TextFormField(
                controller: _messageController,
                maxLines: 6,
                maxLength: _maxMessageLength,
                decoration: InputDecoration(
                  labelText: 'Message',
                  alignLabelWithHint: true,
                  border: const OutlineInputBorder(),
                  helperText: 'Describe your complaint in detail.',
                  counterText: '$messageLength / $_maxMessageLength',
                ),
                onChanged: (_) => setState(() {}),
                validator: (value) {
                  if (value == null || value.trim().isEmpty) {
                    return 'Please enter a message.';
                  }
                  if (value.trim().length > _maxMessageLength) {
                    return 'Message must not exceed $_maxMessageLength characters.';
                  }
                  return null;
                },
              ),

              const SizedBox(height: 28),

              // ── Submit button ──────────────────────────────────────────
              FilledButton(
                onPressed: _isSubmitting ? null : _submit,
                style: FilledButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 16),
                ),
                child: _isSubmitting
                    ? const SizedBox(
                        height: 20,
                        width: 20,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : const Text(
                        'Submit Complaint',
                        style: TextStyle(fontSize: 16),
                      ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
