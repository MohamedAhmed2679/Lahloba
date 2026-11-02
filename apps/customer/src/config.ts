// Public configuration only. EXPO_PUBLIC_* values ship inside the app bundle: never put secrets here.
export const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? 'http://127.0.0.1:4000';
/** Clerk publishable key (public by design). When absent, sign-in falls back to the dev stub or is off. */
export const clerkPublishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? '';
/** Development only. The server independently refuses the dev stub outside development/test. */
export const devStubEnabled = process.env.EXPO_PUBLIC_DEV_IDENTITY_STUB === 'true';
