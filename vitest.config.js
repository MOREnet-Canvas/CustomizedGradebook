import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
  },
  define: {
    // Mock build-time constants from esbuild
    ENV_DEV: true,
    ENV_PROD: false,
    ENV_NAME: '"test"',
    BUILD_VERSION: '"test-version"',
  },
});

