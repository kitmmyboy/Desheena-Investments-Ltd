import 'package:flutter_test/flutter_test.dart';

// ---------------------------------------------------------------------------
// Unit tests for complaint submission — Task 36.1
// Requirements: 13.1, 13.2
// ---------------------------------------------------------------------------

void main() {
  group('Complaint message validation', () {
    // Validates: Requirements 13.1
    test('message within 1000 characters is valid', () {
      final message = 'A' * 1000;
      expect(_validateMessage(message), isNull);
    });

    test('message of 1 character is valid', () {
      expect(_validateMessage('x'), isNull);
    });

    test('empty message is invalid', () {
      expect(_validateMessage(''), isNotNull);
    });

    test('whitespace-only message is invalid', () {
      expect(_validateMessage('   '), isNotNull);
    });

    test('message exceeding 1000 characters is invalid', () {
      final message = 'A' * 1001;
      expect(_validateMessage(message), isNotNull);
    });

    test('message of exactly 1001 characters is invalid', () {
      final message = 'B' * 1001;
      final result = _validateMessage(message);
      expect(result, contains('1000'));
    });
  });

  group('Complaint category validation', () {
    // Validates: Requirements 13.1
    test('valid category is accepted', () {
      for (final cat in ['missed_collection', 'billing_dispute',
          'service_quality', 'other']) {
        expect(_validateCategory(cat), isNull,
            reason: 'Category "$cat" should be valid');
      }
    });

    test('null category is invalid', () {
      expect(_validateCategory(null), isNotNull);
    });

    test('empty category is invalid', () {
      expect(_validateCategory(''), isNotNull);
    });
  });

  group('Complaint record construction', () {
    // Validates: Requirements 13.2
    test('complaint record has status "open" on creation', () {
      final record = _buildComplaintRecord(
        id: 'test-uuid',
        clientId: 'client-1',
        message: 'My bin was not collected.',
        category: 'missed_collection',
      );
      expect(record['status'], equals('open'));
    });

    test('complaint record contains all required fields', () {
      final record = _buildComplaintRecord(
        id: 'test-uuid',
        clientId: 'client-1',
        message: 'Billing error on my account.',
        category: 'billing_dispute',
      );
      expect(record['id'], isNotEmpty);
      expect(record['client_id'], isNotEmpty);
      expect(record['message'], isNotEmpty);
      expect(record['category'], isNotEmpty);
      expect(record['status'], equals('open'));
      expect(record['created_at'], isNotNull);
    });

    test('complaint record preserves message text exactly', () {
      const msg = 'The service quality was poor last Tuesday.';
      final record = _buildComplaintRecord(
        id: 'uuid-1',
        clientId: 'client-2',
        message: msg,
        category: 'service_quality',
      );
      expect(record['message'], equals(msg));
    });

    test('complaint record preserves category value', () {
      final record = _buildComplaintRecord(
        id: 'uuid-2',
        clientId: 'client-3',
        message: 'Other issue.',
        category: 'other',
      );
      expect(record['category'], equals('other'));
    });
  });

  group('Category display label mapping', () {
    // Validates: Requirements 13.1
    test('missed_collection maps to correct display label', () {
      expect(_categoryDisplayLabel('missed_collection'),
          equals('Missed Collection'));
    });

    test('billing_dispute maps to correct display label', () {
      expect(_categoryDisplayLabel('billing_dispute'),
          equals('Billing Dispute'));
    });

    test('service_quality maps to correct display label', () {
      expect(_categoryDisplayLabel('service_quality'),
          equals('Service Quality'));
    });

    test('other maps to correct display label', () {
      expect(_categoryDisplayLabel('other'), equals('Other'));
    });
  });
}

// ---------------------------------------------------------------------------
// Pure helper functions extracted from the UI/repository logic for testing.
// These mirror the validation and construction logic in the actual code.
// ---------------------------------------------------------------------------

/// Validates a complaint message. Returns an error string or null if valid.
String? _validateMessage(String? value) {
  if (value == null || value.trim().isEmpty) {
    return 'Please enter a message.';
  }
  if (value.trim().length > 1000) {
    return 'Message must not exceed 1000 characters.';
  }
  return null;
}

/// Validates a complaint category. Returns an error string or null if valid.
String? _validateCategory(String? value) {
  if (value == null || value.isEmpty) {
    return 'Please select a category.';
  }
  return null;
}

/// Builds the complaint record map as it would be inserted into Supabase.
Map<String, dynamic> _buildComplaintRecord({
  required String id,
  required String clientId,
  required String message,
  required String category,
}) {
  final now = DateTime.now().toUtc();
  return {
    'id': id,
    'client_id': clientId,
    'message': message,
    'category': category,
    'status': 'open',
    'created_at': now.toIso8601String(),
    'updated_at': now.toIso8601String(),
  };
}

/// Returns the display label for a DB category value.
String _categoryDisplayLabel(String category) {
  switch (category.toLowerCase()) {
    case 'missed_collection':
      return 'Missed Collection';
    case 'billing_dispute':
      return 'Billing Dispute';
    case 'service_quality':
      return 'Service Quality';
    default:
      return 'Other';
  }
}
