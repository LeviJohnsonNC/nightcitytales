import { defineConfig } from "vitest/config";
import tsConfigPaths from "vite-tsconfig-paths";

/**
 * The eval suite, which calls a real model and is NEVER part of `bun run test`.
 *
 * Separate from vitest.config.ts on purpose rather than by a runtime guard. The
 * default config includes `src/**` and these files live in `evals/` and end in
 * `.eval.ts`, so they are two kinds of not-matching away from being picked up
 * by CI — where they would need a key CI does not have and would bill the
 * gateway on every push.
 *
 * Runs are slow (a model call each) and must not be parallelised into a
 * thundering herd against the gateway, so the suites run one at a time.
 */
export default defineConfig({
  plugins: [tsConfigPaths()],
  test: {
    environment: "node",
    include: ["evals/**/*.eval.ts"],
    testTimeout: 120_000,
    hookTimeout: 180_000,
    fileParallelism: false,
  },
});
