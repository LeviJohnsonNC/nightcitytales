// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Public backend coordinates, committed on purpose.
//
// These three values are inlined into the browser bundle by Vite, so they are
// visible to anyone who loads the site — they are public by design, and
// row-level security is what protects the data, not secrecy of these strings.
//
// They live here because `.env` (and `.env.*`) is git-ignored, while the
// publish build runs from the committed tree only. Without a committed copy,
// the production bundle ships with no backend address and every page that
// touches the database throws "Missing Supabase environment variable(s)".
//
// Vite's env loader picks up VITE_-prefixed keys already present on
// process.env, so seeding them here is equivalent to having them in a .env
// file. A real .env still wins: we only fill in what is missing.
//
// NEVER add SUPABASE_SERVICE_ROLE_KEY, LOVABLE_API_KEY, or any other secret
// here. Those stay in the git-ignored `.env` and in the host's runtime
// secrets, and are read server-side via process.env at request time.
const PUBLIC_BACKEND_ENV: Record<string, string> = {
  VITE_SUPABASE_PROJECT_ID: "vkgunavjsgmwnfiikavd",
  VITE_SUPABASE_URL: "https://vkgunavjsgmwnfiikavd.supabase.co",
  VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_2gAi66YQaGOIUQlzEnxBlg_JBGnTlYf",
};

for (const [key, value] of Object.entries(PUBLIC_BACKEND_ENV)) {
  if (!process.env[key]) process.env[key] = value;
}

// The server half reads the unprefixed names. In the deployed worker these
// come from the host's runtime environment; during a build (SSR prerender,
// for instance) the URL and publishable key are the same public pair.
if (!process.env["SUPABASE_URL"])
  process.env["SUPABASE_URL"] = PUBLIC_BACKEND_ENV["VITE_SUPABASE_URL"]!;
if (!process.env["SUPABASE_PUBLISHABLE_KEY"])
  process.env["SUPABASE_PUBLISHABLE_KEY"] = PUBLIC_BACKEND_ENV["VITE_SUPABASE_PUBLISHABLE_KEY"]!;

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
