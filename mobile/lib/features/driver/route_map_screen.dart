import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import 'package:latlong2/latlong.dart';

import 'connectivity_indicator.dart';
import 'route_provider.dart';

/// Displays the driver's assigned route on an OpenStreetMap map.
///
/// Implements Requirements 17.2, 17.5, and 17.6:
/// - 17.2: flutter_map with OpenStreetMap tiles showing client stops in sequence
/// - 17.5: Offline rendering using NetworkTileProvider (degrades gracefully)
/// - 17.6: Driver's current GPS position updated every 30 seconds
class RouteMapScreen extends ConsumerStatefulWidget {
  const RouteMapScreen({super.key, required this.routeData});

  /// The route data to display on the map. May be null if no route is assigned.
  final DriverRouteData? routeData;

  @override
  ConsumerState<RouteMapScreen> createState() => _RouteMapScreenState();
}

class _RouteMapScreenState extends ConsumerState<RouteMapScreen> {
  final MapController _mapController = MapController();

  /// The driver's current GPS position, updated every 30 seconds.
  LatLng? _driverPosition;

  /// Timer that fires every 30 seconds to refresh the GPS position.
  Timer? _gpsTimer;

  @override
  void initState() {
    super.initState();
    _fetchDriverPosition();
    // Update GPS position every 30 seconds while the app is in the foreground
    // (Requirement 17.6).
    _gpsTimer = Timer.periodic(const Duration(seconds: 30), (_) {
      _fetchDriverPosition();
    });
  }

  @override
  void dispose() {
    _gpsTimer?.cancel();
    _mapController.dispose();
    super.dispose();
  }

  /// Fetches the device's current GPS position and updates [_driverPosition].
  ///
  /// Requests location permission if not already granted. Silently ignores
  /// errors so the map still renders without a driver marker when GPS is
  /// unavailable.
  Future<void> _fetchDriverPosition() async {
    try {
      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.deniedForever ||
          permission == LocationPermission.denied) {
        return;
      }

      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
        ),
      );

      if (mounted) {
        setState(() {
          _driverPosition = LatLng(position.latitude, position.longitude);
        });
      }
    } catch (_) {
      // GPS unavailable — driver marker simply won't be shown.
    }
  }

  /// Returns the initial map center: driver position if available, otherwise
  /// the first client stop, otherwise a default center (Kampala, Uganda).
  LatLng _initialCenter() {
    if (_driverPosition != null) return _driverPosition!;

    final clients = widget.routeData?.clients ?? [];
    for (final client in clients) {
      if (client.gpsLat != null && client.gpsLng != null) {
        return LatLng(client.gpsLat!, client.gpsLng!);
      }
    }

    // Default: Kampala, Uganda.
    return const LatLng(0.3476, 32.5825);
  }

  /// Builds the list of [Marker] widgets for each client stop.
  ///
  /// Each marker shows the stop's sequence number (1-based index) as a
  /// numbered pin. Stops without GPS coordinates are skipped.
  List<Marker> _buildClientMarkers() {
    final clients = widget.routeData?.clients ?? [];
    final markers = <Marker>[];

    for (int i = 0; i < clients.length; i++) {
      final client = clients[i];
      if (client.gpsLat == null || client.gpsLng == null) continue;

      final sequenceNumber =
          (client.sequenceOrder != null && client.sequenceOrder! > 0)
              ? client.sequenceOrder!
              : i + 1;

      markers.add(
        Marker(
          point: LatLng(client.gpsLat!, client.gpsLng!),
          width: 40,
          height: 48,
          child: _ClientStopMarker(
            sequenceNumber: sequenceNumber,
            clientName: client.clientName,
          ),
        ),
      );
    }

    return markers;
  }

  /// Builds the driver position [Marker] if GPS is available.
  List<Marker> _buildDriverMarker() {
    if (_driverPosition == null) return [];

    return [
      Marker(
        point: _driverPosition!,
        width: 36,
        height: 36,
        child: const _DriverPositionMarker(),
      ),
    ];
  }

  @override
  Widget build(BuildContext context) {
    final routeData = widget.routeData;

    if (routeData == null) {
      return Scaffold(
        appBar: AppBar(
          title: const Text('Route Map'),
          actions: const [
            Padding(
              padding: EdgeInsets.symmetric(horizontal: 8.0),
              child: Center(child: ConnectivityIndicator()),
            ),
          ],
        ),
        body: const Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.map_outlined, size: 64, color: Colors.grey),
              SizedBox(height: 16),
              Text(
                'No route data',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.w500),
              ),
              SizedBox(height: 8),
              Text(
                'No route has been assigned yet.',
                style: TextStyle(color: Colors.grey),
              ),
            ],
          ),
        ),
      );
    }

    final clientMarkers = _buildClientMarkers();
    final driverMarkers = _buildDriverMarker();
    final allMarkers = [...clientMarkers, ...driverMarkers];

    return Scaffold(
      appBar: AppBar(
        title: Text(routeData.route.name),
        actions: const [
          // Connectivity indicator (Requirement 3.5).
          Padding(
            padding: EdgeInsets.symmetric(horizontal: 8.0),
            child: Center(child: ConnectivityIndicator()),
          ),
        ],
      ),
      body: Stack(
        children: [
          FlutterMap(
            mapController: _mapController,
            options: MapOptions(
              initialCenter: _initialCenter(),
              initialZoom: 14.0,
              interactionOptions: const InteractionOptions(
                flags: InteractiveFlag.all,
              ),
            ),
            children: [
              // OpenStreetMap tile layer (Requirement 17.2).
              // NetworkTileProvider is used; tiles are served from OSM when
              // online. When offline, tiles that were previously loaded by the
              // OS HTTP cache may still render. Full offline tile caching
              // requires a separate package such as flutter_map_tile_caching
              // (Requirement 17.5 — graceful degradation).
              TileLayer(
                urlTemplate:
                    'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                userAgentPackageName: 'com.desheena.desheena_waste',
                tileProvider: NetworkTileProvider(),
              ),
              // Client stop markers and driver position marker.
              MarkerLayer(markers: allMarkers),
            ],
          ),

          // "Back to List" button overlaid at the bottom of the map.
          Positioned(
            bottom: 24,
            left: 16,
            right: 16,
            child: ElevatedButton.icon(
              icon: const Icon(Icons.list_alt),
              label: const Text('Back to List'),
              style: ElevatedButton.styleFrom(
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(10),
                ),
              ),
              onPressed: () => Navigator.of(context).pop(),
            ),
          ),

          // Legend overlay in the top-right corner.
          Positioned(
            top: 12,
            right: 12,
            child: _MapLegend(
              hasDriverPosition: _driverPosition != null,
              clientCount: clientMarkers.length,
            ),
          ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Client stop marker widget
// ---------------------------------------------------------------------------

/// A numbered pin marker for a client stop on the route map.
class _ClientStopMarker extends StatelessWidget {
  const _ClientStopMarker({
    required this.sequenceNumber,
    required this.clientName,
  });

  final int sequenceNumber;
  final String clientName;

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: '$sequenceNumber. $clientName',
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 32,
            height: 32,
            decoration: BoxDecoration(
              color: Colors.deepOrange,
              shape: BoxShape.circle,
              border: Border.all(color: Colors.white, width: 2),
              boxShadow: const [
                BoxShadow(
                  color: Colors.black26,
                  blurRadius: 4,
                  offset: Offset(0, 2),
                ),
              ],
            ),
            child: Center(
              child: Text(
                '$sequenceNumber',
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 13,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
          ),
          // Small triangle "pin" tail.
          CustomPaint(
            size: const Size(12, 8),
            painter: _PinTailPainter(color: Colors.deepOrange),
          ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Driver position marker widget
// ---------------------------------------------------------------------------

/// A distinct blue circle marker representing the driver's current position.
///
/// Implements Requirement 17.6.
class _DriverPositionMarker extends StatelessWidget {
  const _DriverPositionMarker();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 36,
      height: 36,
      decoration: BoxDecoration(
        color: Colors.blue.withOpacity(0.85),
        shape: BoxShape.circle,
        border: Border.all(color: Colors.white, width: 3),
        boxShadow: const [
          BoxShadow(
            color: Colors.black38,
            blurRadius: 6,
            offset: Offset(0, 3),
          ),
        ],
      ),
      child: const Icon(
        Icons.navigation,
        color: Colors.white,
        size: 18,
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Pin tail painter
// ---------------------------------------------------------------------------

class _PinTailPainter extends CustomPainter {
  const _PinTailPainter({required this.color});

  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()..color = color;
    final path = Path()
      ..moveTo(0, 0)
      ..lineTo(size.width / 2, size.height)
      ..lineTo(size.width, 0)
      ..close();
    canvas.drawPath(path, paint);
  }

  @override
  bool shouldRepaint(_PinTailPainter oldDelegate) =>
      oldDelegate.color != color;
}

// ---------------------------------------------------------------------------
// Map legend
// ---------------------------------------------------------------------------

class _MapLegend extends StatelessWidget {
  const _MapLegend({
    required this.hasDriverPosition,
    required this.clientCount,
  });

  final bool hasDriverPosition;
  final int clientCount;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.92),
        borderRadius: BorderRadius.circular(8),
        boxShadow: const [
          BoxShadow(color: Colors.black26, blurRadius: 4),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          _LegendItem(
            color: Colors.deepOrange,
            label: '$clientCount stop${clientCount == 1 ? '' : 's'}',
          ),
          if (hasDriverPosition) ...[
            const SizedBox(height: 4),
            const _LegendItem(
              color: Colors.blue,
              label: 'Your position',
            ),
          ],
        ],
      ),
    );
  }
}

class _LegendItem extends StatelessWidget {
  const _LegendItem({required this.color, required this.label});

  final Color color;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 12,
          height: 12,
          decoration: BoxDecoration(color: color, shape: BoxShape.circle),
        ),
        const SizedBox(width: 6),
        Text(label, style: const TextStyle(fontSize: 12)),
      ],
    );
  }
}
