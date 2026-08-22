import { defineConfig } from "vitest/config";
import tsConfigPaths from "vite-tsconfig-paths";

// Standalone from vite.config.ts: engine tests are pure TypeScript and need
// none of the app's SSR/router plugins.
export default defineConfig({
  plugins: [tsConfigPaths()],
  test: {
    environment: "node",
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
});
