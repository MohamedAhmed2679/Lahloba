import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Partner app config (chefs, suppliers, delivery partners). Name, identifiers and icons follow the brand kit PROPOSAL ("The Honest
 * Ladle"); trademark/name clearance is still pending, so identifiers may change before store release.
 * LAHLOBA_ALLOW_CLEARTEXT=1 is only for CI/emulator builds talking to a local http API.
 */
const cleartext = process.env.LAHLOBA_ALLOW_CLEARTEXT === '1';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Lahloba Partner',
  slug: 'lahloba-partner',
  scheme: 'lahloba-partner',
  version: '0.2.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  platforms: ['ios', 'android', 'web'],
  backgroundColor: '#F7F0E3',
  ios: {
    bundleIdentifier: 'com.lahloba.partner',
    supportsTablet: true,
    infoPlist: {
      NSAppTransportSecurity: { NSAllowsLocalNetworking: true },
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    package: 'com.lahloba.partner',
    adaptiveIcon: { foregroundImage: './assets/adaptive-icon.png', backgroundColor: '#2A1C17' },
    permissions: ['ACCESS_FINE_LOCATION', 'CAMERA'],
    blockedPermissions: ['ACCESS_BACKGROUND_LOCATION'],
  },
  web: { bundler: 'metro', output: 'single', favicon: './assets/favicon.png' },
  plugins: [
    'expo-router',
    'expo-localization',
    'expo-secure-store',
    'expo-font',
    ['expo-image-picker', { photosPermission: 'Lahloba uses your photos only when you choose a verification document to upload.', cameraPermission: 'Lahloba uses the camera only when you photograph a verification document or a delivery handoff.' }],
    ['expo-location', { locationWhenInUsePermission: 'Lahloba uses your location only during an active delivery job you accepted.' }],
    ['expo-splash-screen', { image: './assets/splash-icon.png', imageWidth: 160, backgroundColor: '#2A1C17', dark: { backgroundColor: '#1A1311' } }],
    ['expo-build-properties', { android: { usesCleartextTraffic: cleartext } }],
  ],
  extra: {
    brandStatus: 'PROPOSAL — brand kit v0.1, not founder-approved; name/trademark clearance pending',
    ...(process.env.EAS_PROJECT_ID ? { eas: { projectId: process.env.EAS_PROJECT_ID } } : {}),
  },
  ...(process.env.EAS_OWNER ? { owner: process.env.EAS_OWNER } : {}),
});
