# Desheena Waste — Flutter Mobile App

Offline-first Flutter application for the Desheena Investments Ltd Waste Management System.

## Platforms
- Android (min API 26)
- iOS (min iOS 12)

## Getting Started

1. Install dependencies:
   ```bash
   flutter pub get
   ```

2. Run code generation (Drift + Riverpod):
   ```bash
   dart run build_runner build --delete-conflicting-outputs
   ```

3. Run the app:
   ```bash
   flutter run
   ```

## Project Structure

```
lib/
  core/           # Shared utilities, constants, theme
  db/             # Drift database definitions and DAOs
  features/
    auth/         # Authentication screens and logic
    driver/       # Driver app screens and logic
    customer/     # Customer portal screens and logic
    sync/         # Offline sync engine
  main.dart       # App entry point
```

## Key Dependencies

| Package | Purpose |
|---|---|
| `drift` + `drift_flutter` | Local SQLite ORM |
| `supabase_flutter` | Cloud backend client |
| `flutter_riverpod` | State management |
| `connectivity_plus` | Network state monitoring |
| `geolocator` | GPS coordinates |
| `flutter_map` + `latlong2` | OpenStreetMap rendering |
| `uuid` | UUID v4 generation |
| `path_provider` | App directory paths (used by storage monitor) |

## Build Optimizations

These steps keep the APK within the 30 MB limit required by Requirement 21.6 and
ensure the app runs well on low-end Android devices (2 GB RAM, API 26+).

### Split APKs (recommended for Play Store distribution)

```bash
flutter build apk --release --split-per-abi
```

Generates one APK per CPU architecture (`armeabi-v7a`, `arm64-v8a`, `x86_64`).
Each split APK is typically **15–25 MB**, well under the 30 MB target.  Users
only download the APK matching their device's ABI.

### Universal APK (single file for sideloading)

```bash
flutter build apk --release
```

Bundles all ABIs into one file.  Expect **25–40 MB** depending on native
libraries.  Use split APKs for distribution whenever possible.

### Tree-shaking

Tree-shaking is **enabled by default** in every `--release` build.  Unused Dart
code and Flutter framework widgets are removed automatically — no extra flags
needed.

### Deferred loading (lazy imports)

Heavy features such as the route map and charts can be loaded on demand using
Dart's deferred import syntax, reducing the initial startup footprint:

```dart
import 'package:desheena_waste/features/driver/route_map_screen.dart'
    deferred as routeMap;

// Later, when the user navigates to the map:
await routeMap.loadLibrary();
Navigator.push(context, MaterialPageRoute(
  builder: (_) => routeMap.RouteMapScreen(routeData: data),
));
```

### Verifying APK size

After building, check the output size:

```bash
ls -lh build/app/outputs/flutter-apk/
```

If any split APK exceeds 30 MB, investigate large assets or native libraries
with `flutter build apk --analyze-size`.
