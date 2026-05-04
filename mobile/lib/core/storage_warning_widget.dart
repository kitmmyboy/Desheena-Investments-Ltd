import 'package:flutter/material.dart';

import 'storage_monitor.dart';

/// A widget that wraps its [child] and performs a one-shot storage check on
/// first render.
///
/// If [StorageMonitor.isLowStorage] returns `true`, a [StorageWarningDialog]
/// is shown as a modal dialog after the first frame is drawn.  The check is
/// non-blocking — the [child] is always rendered regardless of the result.
///
/// Usage:
/// ```dart
/// StorageWarningWidget(
///   child: RouteListScreen(),
/// )
/// ```
///
/// Implements Requirement 21.5.
class StorageWarningWidget extends StatefulWidget {
  const StorageWarningWidget({super.key, required this.child});

  final Widget child;

  @override
  State<StorageWarningWidget> createState() => _StorageWarningWidgetState();
}

class _StorageWarningWidgetState extends State<StorageWarningWidget> {
  @override
  void initState() {
    super.initState();
    // Defer the check until after the first frame so that the BuildContext is
    // fully attached to the widget tree and dialogs can be shown safely.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        StorageMonitor.checkStorageAndWarn(context);
      }
    });
  }

  @override
  Widget build(BuildContext context) => widget.child;
}
