import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { defineConfig } from 'vitest/config';

// Components are tested through react-native-web in jsdom. Native rendering is covered by the
// Android/iOS Maestro flows in CI, not here.
const require = createRequire(import.meta.url);
const svgWeb = join(dirname(require.resolve('react-native-svg/package.json')), 'lib/module/ReactNativeSVG.web.js');

export default defineConfig({
  resolve: {
    extensions: ['.web.tsx', '.web.ts', '.web.js', '.tsx', '.ts', '.mjs', '.js', '.jsx', '.json'],
    alias: [
      { find: /^react-native$/, replacement: 'react-native-web' },
      { find: /^react-native-svg$/, replacement: svgWeb },
      { find: '@react-native/assets-registry/registry', replacement: new URL('../../tools/test-stubs/assets-registry.js', import.meta.url).pathname },
    ],
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.tsx', 'src/**/*.test.ts'],
    server: { deps: { inline: ['react-native-svg'] } },
  },
});
