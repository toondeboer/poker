import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    /**
     * Vitest's default is 5s **per test**, which is the wrong default for this
     * workspace: the first assertion synthesises the stack, and synthesising
     * runs esbuild over the Lambda. That is well under a second on a warm
     * machine and comfortably over five on a cold CI runner — so these tests
     * passed locally and timed out in CI, which is the second time that exact
     * mechanism has caught this repo out. The first was a whole-deck property
     * sweep in `@poker/core`, which now carries its own explicit timeout.
     *
     * Set here rather than per test because *any* test in this workspace can be
     * the one that triggers the synth, depending on which runs first.
     */
    testTimeout: 60_000,
  },
});
