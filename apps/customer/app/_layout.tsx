import { Stack, useRouter } from 'expo-router';
import { getLocales } from 'expo-localization';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { createApiClient } from '@lahloba/contracts';
import { DevStubAuthProvider, NoAuthProvider, useAuth } from '@lahloba/app-shell';
import { ClerkAuthProvider } from '@lahloba/app-shell/clerk';
import { useBrandFonts } from '@lahloba/app-shell/fonts';
import { asyncStorageStore } from '@lahloba/app-shell/storage-native';
import { AppProviders, type Nav } from '../src/AppContext';
import { apiUrl, clerkPublishableKey, devStubEnabled } from '../src/config';
import { expoLocation } from '../src/expoLocation';

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

const publicApi = createApiClient({ baseUrl: apiUrl });

function AuthLayer(props: { children: ReactNode }) {
  if (clerkPublishableKey) return <ClerkAuthProvider publishableKey={clerkPublishableKey}>{props.children}</ClerkAuthProvider>;
  if (devStubEnabled) return <DevStubAuthProvider api={publicApi} store={asyncStorageStore}>{props.children}</DevStubAuthProvider>;
  return <NoAuthProvider>{props.children}</NoAuthProvider>;
}

function Shell() {
  const router = useRouter();
  const auth = useAuth();
  const authRef = useRef(auth);
  authRef.current = auth;
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  // Every request carries the current session token (refreshed by Clerk when needed).
  const api = useMemo(() => createApiClient({ baseUrl: apiUrl, getToken: () => authRef.current.getToken() }), []);
  const nav = useMemo<Nav>(() => ({
    push: (p) => router.push(p as never),
    replace: (p) => router.replace(p as never),
    back: () => (router.canGoBack() ? router.back() : router.replace('/home' as never)),
  }), [router]);
  const deviceLang = getLocales()[0]?.languageCode === 'ar' ? 'ar' : 'en';
  return (
    <AppProviders api={api} nav={nav} location={expoLocation} store={asyncStorageStore} initialLocale={deviceLang} scheme={scheme}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: scheme === 'dark' ? '#1A1311' : '#F7F0E3' } }} />
    </AppProviders>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useBrandFonts();
  const ready = fontsLoaded || !!fontError;
  useEffect(() => {
    if (ready) void SplashScreen.hideAsync().catch(() => undefined);
  }, [ready]);
  if (!ready) return null;
  return (
    <AuthLayer>
      <Shell />
    </AuthLayer>
  );
}
