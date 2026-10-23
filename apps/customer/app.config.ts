import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Customer app config. Name, identifiers and icons follow the brand kit PROPOSAL ("The Honest
 * Ladle"); trademark/name clearance is still pending, so identifiers may change before store release.
 * LAHLOBA_ALLOW_CLEARTEXT=1 is only for CI/emulator builds talking to a local http API.
 */
const cleartext = process.env.LAHLOBA_ALLOW_CLEARTEXT === '1';
const LOCATION_COPY = 'Lahloba can suggest your area. You can always choose your area manually instead.';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Lahloba',
  slug: 'lahloba-customer',
  scheme: 'lahloba',
  version: '0.2.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  platforms: ['ios', 'android', 'web'],
  backgroundColor: '#F7F0E3',
  ios: {
    bundleIdentifier: 'com.lahloba.customer',
    supportsTablet: true,
    infoPlist: {
      NSLocationWhenInUseUsageDescription: LOCATION_COPY,
      NSAppTransportSecurity: { NSAllowsLocalNetworking: true },
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    package: 'com.lahloba.customer',
    adaptiveIcon: { foregroundImage: './assets/adaptive-icon.png', backgroundColor: '#8E2443' },
    permissions: ['ACCESS_COARSE_LOCATION'],
    blockedPermissions: ['ACCESS_BACKGROUND_LOCATION'],
  },
  web: { bundler: 'metro', output: 'single', favicon: './assets/favicon.png' },
  plugins: [
    'expo-router',
    'expo-localization',
    'expo-secure-store',
    'expo-font',
    ['expo-location', { locationWhenInUsePermission: LOCATION_COPY }],
    ['expo-splash-screen', { image: './assets/splash-icon.png', imageWidth: 160, backgroundColor: '#8E2443', dark: { backgroundColor: '#1A1311' } }],
    ['expo-build-properties', { android: { usesCleartextTraffic: cleartext } }],
  ],
  extra: {
    brandStatus: 'PROPOSAL — brand kit v0.1, not founder-approved; name/trademark clearance pending',
    ...(process.env.EAS_PROJECT_ID ? { eas: { projectId: process.env.EAS_PROJECT_ID } } : {}),
  },
  ...(process.env.EAS_OWNER ? { owner: process.env.EAS_OWNER } : {}),
});
