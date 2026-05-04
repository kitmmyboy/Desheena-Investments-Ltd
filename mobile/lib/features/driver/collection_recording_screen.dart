import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';

import '../../db/index.dart';
import '../auth/auth_provider.dart';
import 'collection_provider.dart';
import 'connectivity_indicator.dart';

/// Screen for recording a waste collection at a client stop.
///
/// Accepts a [RouteClientsLocalData] client and pre-populates the form with
/// the client's name and waste type.
///
/// Implements Requirements 4.1, 4.2, 4.3, 4.4, 4.5, 4.6.
class CollectionRecordingScreen extends ConsumerStatefulWidget {
  const CollectionRecordingScreen({super.key, required this.client});

  final RouteClientsLocalData client;

  @override
  ConsumerState<CollectionRecordingScreen> createState() =>
      _CollectionRecordingScreenState();
}

class _CollectionRecordingScreenState
    extends ConsumerState<CollectionRecordingScreen> {
  static const _wasteTypes = ['general', 'organic', 'recyclable', 'hazardous'];

  final _weightController = TextEditingController();
  final _formKey = GlobalKey<FormState>();

  late String _selectedWasteType;
  double? _gpsLat;
  double? _gpsLng;
  bool _gpsLoading = true;
  bool _gpsFailed = false;
  bool _isSaving = false;

  @override
  void initState() {
    super.initState();
    // Pre-select waste type from client; fall back to 'general' if not in list.
    final clientWasteType = widget.client.wasteType.toLowerCase();
    _selectedWasteType =
        _wasteTypes.contains(clientWasteType) ? clientWasteType : 'general';

    // Auto-capture GPS on screen open (Requirement 4.1).
    _captureGps();
  }

  @override
  void dispose() {
    _weightController.dispose();
    super.dispose();
  }

  // ---------------------------------------------------------------------------
  // GPS capture
  // ---------------------------------------------------------------------------

  Future<void> _captureGps() async {
    setState(() {
      _gpsLoading = true;
      _gpsFailed = false;
    });

    try {
      // Request permission if needed.
      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }

      if (permission == LocationPermission.deniedForever ||
          permission == LocationPermission.denied) {
        throw Exception('Location permission denied');
      }

      final position = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high,
      );

      if (mounted) {
        setState(() {
          _gpsLat = position.latitude;
          _gpsLng = position.longitude;
          _gpsLoading = false;
          _gpsFailed = false;
        });
      }
    } catch (_) {
      // GPS unavailable — allow submission with missingGps = true (Req 4.5).
      if (mounted) {
        setState(() {
          _gpsLat = null;
          _gpsLng = null;
          _gpsLoading = false;
          _gpsFailed = true;
        });
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Submit
  // ---------------------------------------------------------------------------

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;

    final weightText = _weightController.text.trim();
    final weightKg = double.tryParse(weightText);
    if (weightKg == null || weightKg <= 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please enter a valid weight in kg.')),
      );
      return;
    }

    setState(() => _isSaving = true);

    try {
      // Resolve driver ID from cached session.
      final session =
          await ref.read(authRepositoryProvider).getOfflineSession();
      final driverId = session?.userId ?? '';

      await ref.read(collectionRepositoryProvider).recordCollection(
            clientId: widget.client.clientId,
            driverId: driverId,
            wasteType: _selectedWasteType,
            weightKg: weightKg,
            gpsLat: _gpsFailed ? null : _gpsLat,
            gpsLng: _gpsFailed ? null : _gpsLng,
          );

      if (mounted) {
        // Confirmation message (Requirement 4.6).
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Saved — pending sync'),
            backgroundColor: Colors.green,
          ),
        );
        Navigator.of(context).pop();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to save: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  // ---------------------------------------------------------------------------
  // Build
  // ---------------------------------------------------------------------------

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Record Collection'),
        actions: const [
          // Connectivity indicator (Requirement 3.5).
          Padding(
            padding: EdgeInsets.symmetric(horizontal: 8.0),
            child: Center(child: ConnectivityIndicator()),
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Client name (pre-populated, read-only).
              Text(
                'Client',
                style: theme.textTheme.labelLarge?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                ),
              ),
              const SizedBox(height: 6),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 14,
                ),
                decoration: BoxDecoration(
                  color: theme.colorScheme.surfaceContainerHighest,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text(
                  widget.client.clientName,
                  style: const TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
              const SizedBox(height: 24),

              // Waste type dropdown (Requirement 4.1, 4.2).
              Text(
                'Waste Type',
                style: theme.textTheme.labelLarge?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                ),
              ),
              const SizedBox(height: 6),
              DropdownButtonFormField<String>(
                value: _selectedWasteType,
                decoration: InputDecoration(
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                  ),
                  contentPadding: const EdgeInsets.symmetric(
                    horizontal: 16,
                    vertical: 14,
                  ),
                ),
                style: const TextStyle(fontSize: 18),
                items: _wasteTypes
                    .map(
                      (type) => DropdownMenuItem(
                        value: type,
                        child: Text(
                          _formatWasteType(type),
                          style: const TextStyle(fontSize: 18),
                        ),
                      ),
                    )
                    .toList(),
                onChanged: (value) {
                  if (value != null) {
                    setState(() => _selectedWasteType = value);
                  }
                },
                validator: (value) =>
                    value == null ? 'Please select a waste type' : null,
              ),
              const SizedBox(height: 24),

              // Weight input (Requirement 4.1, 4.2).
              Text(
                'Weight (kg)',
                style: theme.textTheme.labelLarge?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                ),
              ),
              const SizedBox(height: 6),
              TextFormField(
                controller: _weightController,
                keyboardType: const TextInputType.numberWithOptions(
                  decimal: true,
                ),
                inputFormatters: [
                  FilteringTextInputFormatter.allow(RegExp(r'^\d*\.?\d*')),
                ],
                style: const TextStyle(fontSize: 18),
                decoration: InputDecoration(
                  hintText: 'e.g. 12.5',
                  hintStyle: const TextStyle(fontSize: 18),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                  ),
                  contentPadding: const EdgeInsets.symmetric(
                    horizontal: 16,
                    vertical: 18,
                  ),
                  suffixText: 'kg',
                  suffixStyle: const TextStyle(fontSize: 18),
                ),
                validator: (value) {
                  if (value == null || value.trim().isEmpty) {
                    return 'Please enter the weight';
                  }
                  final parsed = double.tryParse(value.trim());
                  if (parsed == null || parsed <= 0) {
                    return 'Enter a valid positive number';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 24),

              // GPS status (Requirement 4.1, 4.5).
              Text(
                'GPS Location',
                style: theme.textTheme.labelLarge?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                ),
              ),
              const SizedBox(height: 6),
              _GpsStatusWidget(
                isLoading: _gpsLoading,
                gpsFailed: _gpsFailed,
                gpsLat: _gpsLat,
                gpsLng: _gpsLng,
                onRetry: _captureGps,
              ),
              const SizedBox(height: 36),

              // Submit button (large touch target — Requirement 4.2).
              SizedBox(
                width: double.infinity,
                height: 56,
                child: ElevatedButton(
                  onPressed: _isSaving ? null : _submit,
                  style: ElevatedButton.styleFrom(
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                    textStyle: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  child: _isSaving
                      ? const SizedBox(
                          width: 24,
                          height: 24,
                          child: CircularProgressIndicator(strokeWidth: 2.5),
                        )
                      : const Text('Submit'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  String _formatWasteType(String raw) {
    if (raw.isEmpty) return 'General';
    return raw[0].toUpperCase() + raw.substring(1).toLowerCase();
  }
}

// ---------------------------------------------------------------------------
// GPS status widget
// ---------------------------------------------------------------------------

class _GpsStatusWidget extends StatelessWidget {
  const _GpsStatusWidget({
    required this.isLoading,
    required this.gpsFailed,
    required this.gpsLat,
    required this.gpsLng,
    required this.onRetry,
  });

  final bool isLoading;
  final bool gpsFailed;
  final double? gpsLat;
  final double? gpsLng;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    if (isLoading) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        decoration: BoxDecoration(
          border: Border.all(color: Colors.grey.shade300),
          borderRadius: BorderRadius.circular(10),
        ),
        child: const Row(
          children: [
            SizedBox(
              width: 18,
              height: 18,
              child: CircularProgressIndicator(strokeWidth: 2),
            ),
            SizedBox(width: 12),
            Text(
              'Acquiring GPS…',
              style: TextStyle(fontSize: 16, color: Colors.grey),
            ),
          ],
        ),
      );
    }

    if (gpsFailed) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        decoration: BoxDecoration(
          color: Colors.orange.shade50,
          border: Border.all(color: Colors.orange.shade300),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Row(
          children: [
            Icon(Icons.location_off, color: Colors.orange.shade700, size: 20),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                'GPS unavailable — record will be flagged',
                style: TextStyle(
                  fontSize: 16,
                  color: Colors.orange.shade800,
                ),
              ),
            ),
            TextButton(
              onPressed: onRetry,
              child: const Text('Retry'),
            ),
          ],
        ),
      );
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        color: Colors.green.shade50,
        border: Border.all(color: Colors.green.shade300),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        children: [
          Icon(Icons.location_on, color: Colors.green.shade700, size: 20),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              '${gpsLat?.toStringAsFixed(5)}, ${gpsLng?.toStringAsFixed(5)}',
              style: TextStyle(
                fontSize: 16,
                color: Colors.green.shade800,
                fontFeatures: const [FontFeature.tabularFigures()],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
