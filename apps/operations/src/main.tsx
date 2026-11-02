import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import { OpsApp } from './OpsApp';

// Public build-time values only (a Clerk publishable key is public by design).
// The server independently refuses the dev stub outside dev/test.
const apiUrl = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:4000';
const clerkKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined;
const devStubEnabled = import.meta.env.VITE_DEV_IDENTITY_STUB === 'true';
// Clerk is loaded only when a key is configured.
const ClerkOps = lazy(() => import('./ClerkOps').then((m) => ({ default: m.ClerkOps })));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {clerkKey
      ? <Suspense fallback={null}><ClerkOps apiUrl={apiUrl} publishableKey={clerkKey} /></Suspense>
      : <OpsApp apiUrl={apiUrl} devStubEnabled={devStubEnabled} />}
  </StrictMode>,
);
