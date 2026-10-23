import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { OpsApp } from './OpsApp';

// Public build-time values only. The server independently refuses the dev stub outside dev/test.
const apiUrl = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:4000';
const devStubEnabled = import.meta.env.VITE_DEV_IDENTITY_STUB === 'true';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <OpsApp apiUrl={apiUrl} devStubEnabled={devStubEnabled} />
  </StrictMode>,
);
