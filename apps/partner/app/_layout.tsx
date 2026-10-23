import { Stack, useRouter } from 'expo-router';
import { getLocales } from 'expo-localization';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { createApiClient } from '@lahloba/contracts';
import { DevStubAuthProvider, NoAuthProvider } from '@lahloba/app-shell';
import { ClerkAuthProvider } from '@lahloba/app-shell/clerk';
import { useBrandFonts } from '@lahloba/app-shell/fonts';
import { asyncStorageStore } from '@lahloba/app-shell/storage-native';
import { PartnerProviders, type Nav } from '../src/PartnerContext';

// Public configuration only; never put secrets in EXPO_PUBLIC_* variables.
const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? 'http://127.0.0.1:4000';
const clerkPublishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? '';
// Development only; the server independently refuses the dev stub outside development/test.
const devStubEnabled = process.env.EXPO_PUBLIC_DEV_IDENTITY_STUB === 'true';
const publicApi = createApiClient({ baseUrl: apiUrl });

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

function AuthLayer(props: { children: ReactNode }) {
  if (clerkPublishableKey) return <ClerkAuthProvider publishableKey={clerkPublishableKey}>{props.children}</ClerkAuthProvider>;
  if (devStubEnabled) return <DevStubAuthProvider api={publicApi} store={asyncStorageStore}>{props.children}</DevStubAuthProvider>;
  return <NoAuthProvider>{props.children}</NoAuthProvider>;
}

function Shell() {
  const router = useRouter();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const nav = useMemo<Nav>(() => ({
    push: (p) => router.push(p as never),
    replace: (p) => router.replace(p as never),
    back: () => (router.canGoBack() ? router.back() : router.replace('/roles' as never)),
  }), [router]);
  return (
    <PartnerProviders apiUrl={apiUrl} nav={nav} store={asyncStorageStore} scheme={scheme} initialLocale={getLocales()[0]?.languageCode === 'ar' ? 'ar' : 'en'}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: scheme === 'dark' ? '#1A1311' : '#F7F0E3' } }} />
    </PartnerProviders>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useBrandFonts();
  const ready = fontsLoaded || !!fontError;
  useEffect(() => { if (ready) void SplashScreen.hideAsync().catch(() => undefined); }, [ready]);
  if (!ready) return null;
  return <AuthLayer><Shell /></AuthLayer>;
}
