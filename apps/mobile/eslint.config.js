// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    // Keep diagnostic logging out of production: use the `logger` wrapper
    // (gated behind `__DEV__`) instead of `console` directly.
    rules: {
      'no-console': 'error',
    },
  },
  {
    // The logger wrapper is the one place `console` is allowed.
    files: ['src/utils/logger.ts'],
    rules: {
      'no-console': 'off',
    },
  },
]);
