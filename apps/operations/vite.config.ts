import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// Protected operations console. Served separately from customer apps; never bundles secrets.
export default defineConfig({
  plugins: [react()],
  server: { host: '127.0.0.1', port: 5173 },
  test: { environment: 'jsdom', include: ['src/**/*.test.tsx'] },
});
