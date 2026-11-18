// Run from the game checkout after a production build. No route is added to the game.
import { readFile, readdir, mkdir, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { join, resolve, extname, sep } from "node:path";
import { tmpdir } from "node:os";
import { build } from "esbuild";
import { chromium } from "@playwright/test";

const root = process.cwd();
const rollMode = process.argv.includes("--roll");
const out = resolve(process.argv[2] ?? join(tmpdir(), "night-city-life"));
await mkdir(out, { recursive: true });
const seed = await readFile(new URL("./capture-state.ts", import.meta.url), "utf8");
const entry = `
import React from "react";
import {createRoot} from "react-dom/client";
import {RouterProvider,createRootRoute,createRoute,createRouter} from "@tanstack/react-router";
import {QueryClientProvider,QueryClient} from "@tanstack/react-query";
import {LifeScreen} from "@/features/life/LifeScreen";
const root=createRootRoute();
const route=createRoute({getParentRoute:()=>root,path:"/",component:()=> <LifeScreen campaignId="camp-1"/>});
const router=createRouter({routeTree:root.addChildren([route])});
const query = new QueryClient({ defaultOptions: { queries: { retry: false } } });
window.fixtureRefresh = () => query.invalidateQueries({ queryKey: ["life", "camp-1"] });
createRoot(document.getElementById("root")).render(<QueryClientProvider client={query}><RouterProvider router={router}/></QueryClientProvider>);`;
const bundle = await build({
  stdin: { contents: entry, loader: "tsx", resolveDir: root },
  tsconfig: join(root, "tsconfig.json"),
  bundle: true,
  write: false,
  jsx: "automatic",
  outfile: "fixture.js",
  loader: { ".css": "empty", ".png": "empty", ".webp": "empty", ".svg": "empty", ".mp3": "empty" },
  define: {
    "import.meta.glob": "emptyCatalog",
    "process.env.NODE_ENV": '"development"',
    "import.meta.env.VITE_SUPABASE_URL": '"https://fixture.invalid"',
    "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": '"fixture"',
  },
  banner: { js: "const emptyCatalog = () => ({});" },
  plugins: [
    {
      name: "local-campaign",
      setup(builder) {
        builder.onResolve({ filter: /^(?:\.\/lifeOps|life-capture-state)$/ }, (args) =>
          args.path === "life-capture-state" || args.importer.endsWith("/life/useLife.ts")
            ? { path: "campaign", namespace: "fixture" }
            : null,
        );
        builder.onResolve({ filter: /^@\/lib\/backend$/ }, (args) =>
          rollMode && args.importer.endsWith("/life/useLife.ts")
            ? { path: "roll-backend", namespace: "fixture" }
            : null,
        );
        builder.onResolve({ filter: /^@\/features\/play\/rollCheck$/ }, (args) =>
          rollMode && args.importer.endsWith("/life/LifeScreen.tsx")
            ? { path: "roll-engine", namespace: "fixture" }
            : null,
        );
        builder.onResolve({ filter: /\/usePortraitUrl$/ }, () => ({
          path: "portrait",
          namespace: "fixture",
        }));
        builder.onResolve({ filter: /^@tanstack\/react-start(?:\/server)?$/ }, () => ({
          path: "server",
          namespace: "fixture",
        }));
        builder.onLoad({ filter: /.*/, namespace: "fixture" }, ({ path }) => {
          if (path === "campaign")
            return {
              resolveDir: root,
              loader: "ts",
              contents:
                seed +
                '\nconst unsupported=()=>{throw Error("Outside the capture fixture")}; export {unsupported as acceptHook,unsupported as declineHook,unsupported as pushHook,unsupported as setPinnedGoals,unsupported as settleLifeIp};',
            };
          if (path === "roll-backend") {
            return {
              resolveDir: root,
              loader: "ts",
              contents:
                'export { findSavedLifeCheck } from "life-capture-state"; export { getCampaign } from "@/lib/backend";',
            };
          }
          if (path === "roll-engine") {
            return {
              resolveDir: root,
              loader: "ts",
              contents: `
import { rollPendingCheck as roll } from "@/features/play/rollCheck";
export { previewPendingCheck } from "@/features/play/rollCheck";
export function rollPendingCheck(input) {
  const faces = (new URLSearchParams(location.search).get("faces") ?? "2").split(",").map(Number);
  const random = Math.random;
  Math.random = () => ((faces.shift() ?? 2) - 0.5) / 10;
  try { return roll(input); } finally { Math.random = random; }
}
`,
            };
          }
          if (path === "portrait")
            return {
              contents:
                'export const usePortraitUrl = path => path ? "/images/flavor/auto-mechanic-male-young-face.webp" : null;',
            };
          return {
            contents:
              'const f=()=>new Proxy(()=>{throw Error("No server in the fixture")},{get:()=>f});export const createMiddleware=f,createServerFn=f,createServerOnlyFn=f,getRequest=f,getRequestHeader=f,setResponseStatus=f,setResponseHeader=f;',
          };
        });
      },
    },
  ],
});
const assets = process.env.CAPTURE_ASSETS ?? join(root, ".output/public/assets");
const styles = (await readdir(assets))
  .filter((name) => /^(styles|NCAmp|play|HoloDie|SpendIpCard)-.*\.css$/.test(name))
  .sort((a, b) => Number(b.startsWith("styles-")) - Number(a.startsWith("styles-")));
if (!styles.some((name) => name.startsWith("styles-"))) throw Error("Build the checkout first.");
const css = (await Promise.all(styles.map((name) => readFile(join(assets, name), "utf8")))).join(
  "\n",
);
const publicDir = join(root, "public");
const server = createServer(async (req, res) => {
  const path = new URL(req.url, "http://localhost").pathname;
  if (path === "/")
    return res.end(
      '<!doctype html><html lang="en"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/style.css"><div id="root"></div><script src="/app.js"></script></html>',
    );
  if (path === "/style.css") {
    res.setHeader("Content-Type", "text/css");
    return res.end(css);
  }
  if (path === "/app.js") {
    res.setHeader("Content-Type", "text/javascript");
    return res.end(bundle.outputFiles[0].contents);
  }
  const file = resolve(publicDir, "." + path);
  if (file.startsWith(publicDir + sep) && (await stat(file).catch(() => null))?.isFile()) {
    if (extname(file) === ".webp") res.setHeader("Content-Type", "image/webp");
    return res.end(await readFile(file));
  }
  res.writeHead(404).end();
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const url = "http://127.0.0.1:" + server.address().port;
let browser;
try {
  browser = await chromium.launch(
    process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
  );
  if (rollMode) {
    const { captureRoll } = await import("./capture-roll.mjs");
    await captureRoll(browser, url, out);
  } else {
    for (const [place, slug, draft] of [
      ["o3", "market", "I ask Mama Ishii what came in today."],
      ["p4", "apartment", "I check the tools on my bench."],
    ]) {
      for (const [width, height] of [
        [1366, 768],
        [390, 844],
      ]) {
        const page = await browser.newPage({
          viewport: { width, height },
          reducedMotion: "reduce",
        });
        await page.route("**/*", (route) =>
          new URL(route.request().url()).origin === url ? route.continue() : route.abort(),
        );
        await page.goto(url + "/?place=" + place);
        const input = page.locator("textarea:visible").first();
        await input.fill(draft);
        await input.blur();
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.evaluate(async () => {
          await Promise.all([...document.images].map((image) => image.decode().catch(() => {})));
        });
        await page.screenshot({ path: join(out, slug + "-" + width + ".png") });
        const suggest = page.getByRole("button", { name: "Suggest actions", exact: true });
        if (place === "o3" && width === 390 && (await suggest.count())) {
          await input.fill("I ask who brought in the parts.");
          await suggest.click();
          const option = page.getByRole("button", { name: /Inspect the parts/ });
          await option.waitFor();
          await page.getByRole("button", { name: "Act", exact: true }).scrollIntoViewIfNeeded();
          await page.screenshot({ path: join(out, "suggestions.png") });
          await option.click();
          await page.getByRole("button", { name: /Roll 1d10 for/ }).scrollIntoViewIfNeeded();
          await page.screenshot({ path: join(out, "check.png") });
        }
        await page.close();
      }
    }
  }
} finally {
  await browser?.close();
  server.close();
}
