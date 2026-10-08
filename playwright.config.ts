/**
 * Real-browser tests.
 *
 * The unit suite runs in Node, so it can hold what the engine decides and what a
 * component's markup says, and it cannot see what a browser does with either:
 * text that runs off a phone, a page that scrolls sideways, a script that throws
 * on load, a control with no name. Those have each been found by looking at a
 * rendered page, which is the thing this automates — for the routes that need no
 * account (`/`, `/login`, `/style`, `/scene-review`). The signed-in game needs a
 * Supabase session and is not covered here.
 *
 *   bun run test:browser                  # needs a Chromium: `bunx playwright install chromium`
 *
 * Not part of `bun run test` (vitest includes `src/**` only) and not a CI gate
 * yet: a browser job is its own cost, and a check nobody has watched go green
 * on the runner is a check that teaches people to ignore checks.
 */
import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env["PW_PORT"] ?? 5174);

export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: !!process.env["CI"],
  retries: process.env["CI"] ? 1 : 0,
  reporter: process.env["CI"] ? [["github"], ["list"]] : "list",
  // Actions already records the exact revision. Avoid optional Git diff/commit
  // collection (including network fetches) consuming the bounded capture budget.
  captureGitInfo: { commit: false, diff: false },
  outputDir: "e2e/.results",
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
    },
    {
      name: "phone",
      // Chromium with a phone's viewport and touch, not WebKit: one engine to install.
      use: { ...devices["Pixel 7"] },
    },
  ],
  webServer: {
    // 127.0.0.1 rather than localhost: some sandboxes have no IPv6 loopback.
    command: `bunx vite dev --host 127.0.0.1 --port ${PORT}`,
    url: `http://127.0.0.1:${PORT}/style`,
    reuseExistingServer: !process.env["CI"],
    timeout: 120_000,
  },
});
