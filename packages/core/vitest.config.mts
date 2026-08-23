import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",

      /**
       * **`all: true` is the point of this file.** Without it v8 only reports on
       * files a test actually imported, so a module with no test at all is
       * invisible rather than 0% — which read as 97% coverage here while six
       * modules were untested. Measured honestly the same suite was 86%.
       */
      all: true,
      include: ["src/**/*.ts"],
      exclude: [
        "src/**/*.test.ts",
        // Type-only modules: no statements to execute, so including them just
        // dilutes the number with files that can never be "covered".
        "src/types/**",
        "src/**/index.ts",
        "src/storage/StorageAdapter.ts",
        "src/monetization/EntitlementProvider.ts",
      ],

      /**
       * Thresholds fail the run, so this is the ratchet that stops coverage
       * drifting back down. They sit just under the current numbers rather than
       * at a round target — the point is to catch a regression, not to force
       * the next person to write filler tests to clear an arbitrary bar. Raise
       * them when real coverage rises.
       */
      thresholds: {
        statements: 98,
        branches: 96,
        functions: 100,
        lines: 99,
      },

      reporter: ["text", "html"],
    },
  },
});
