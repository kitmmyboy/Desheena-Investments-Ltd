import 'dart:io';

import 'package:flutter/material.dart';
import 'package:path_provider/path_provider.dart';

/// Monitors device storage and surfaces a warning when storage is low.
///
/// Implements Requirement 21.5 — display a low-storage warning when the
/// device has less than 100 MB of free storage remaining.
///
/// ## Implementation note
/// Flutter does not expose a direct cross-platform "free disk space" API.
/// This class uses a best-effort heuristic: it attempts to write a 100 MB
/// temporary probe file inside the app's documents directory.  If the write
/// fails (e.g. with a [FileSystemException] whose OS error indicates
/// insufficient storage), the device is considered low on storage.  The probe
/// file is deleted immediately after a successful write so no persistent space
/// is consumed.
///
/// This approach is intentionally conservative — a failed write is treated as
/// "low storage" even when the underlying cause might be a different I/O error.
/// The warning is non-blocking and dismissible, so a false positive is
/// acceptable.
class StorageMonitor {
  StorageMonitor._();

  /// Size of the probe file used to test available space (100 MB).
  static const int _probeBytes = 100 * 1024 * 1024; // 100 MB

  /// Returns `true` when the device appears to have less than 100 MB of free
  /// storage, `false` otherwise.
  ///
  /// The check is performed by attempting to write a 100 MB probe file to the
  /// app's documents directory.  If the write succeeds the file is deleted and
  /// `false` is returned.  If the write fails the method returns `true`.
  static Future<bool> isLowStorage() async {
    try {
      final dir = await getApplicationDocumentsDirectory();
      final probeFile = File('${dir.path}/.storage_probe_tmp');

      // Write 100 MB of zeroed bytes as a probe.
      final sink = probeFile.openWrite();
      sink.add(List<int>.filled(_probeBytes, 0));
      await sink.flush();
      await sink.close();

      // Probe succeeded — storage is sufficient.  Clean up immediately.
      await probeFile.delete();
      return false;
    } on FileSystemException {
      // Write failed — treat as low storage.
      return true;
    } catch (_) {
      // Any other unexpected error: assume storage is fine to avoid
      // false-positive warnings blocking the user.
      return false;
    }
  }

  /// Checks storage and, if low, shows a [StorageWarningDialog] anchored to
  /// the given [BuildContext].
  ///
  /// This is a fire-and-forget helper intended for use in `initState` or
  /// `didChangeDependencies`.  It does not block the caller.
  static Future<void> checkStorageAndWarn(BuildContext context) async {
    final low = await isLowStorage();
    if (low && context.mounted) {
      await showDialog<void>(
        context: context,
        barrierDismissible: true,
        builder: (_) => const StorageWarningDialog(),
      );
    }
  }
}

/// A dismissible dialog that warns the user about low device storage.
///
/// Implements Requirement 21.5.
class StorageWarningDialog extends StatelessWidget {
  const StorageWarningDialog({super.key});

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      icon: const Icon(Icons.storage_outlined, color: Colors.orange, size: 40),
      title: const Text('Low Storage'),
      content: const Text(
        'Less than 100 MB of free storage remaining. '
        'Please free up space to continue recording collections.',
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('Dismiss'),
        ),
      ],
    );
  }
}
