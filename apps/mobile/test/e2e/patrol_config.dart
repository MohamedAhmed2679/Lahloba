// Patrol test configuration for Lahloba
// Install: flutter pub add patrol --dev
// Run: patrol test --target integration_test/e2e_test.dart

// Patrol enables native interaction testing including:
// - System dialogs (permissions, alerts)
// - Notifications tap-through
// - Background/foreground app lifecycle
// - Native keyboard input

const patrolConfig = {
  'appId': 'com.lahloba.app',
  'bundleId': 'com.lahloba.app',
  'timeout': Duration(seconds: 60),
};
