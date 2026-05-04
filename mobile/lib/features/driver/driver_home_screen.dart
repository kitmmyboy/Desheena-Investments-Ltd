import 'package:flutter/material.dart';

import 'route_list_screen.dart';

/// Driver home screen — delegates entirely to [RouteListScreen].
///
/// Kept as a thin wrapper so that any existing references to
/// [DriverHomeScreen] (e.g. in [AppRouter]) continue to compile without
/// changes.
class DriverHomeScreen extends StatelessWidget {
  const DriverHomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const RouteListScreen();
  }
}
