import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * What may import what.
 *
 * This replaces `engine/__tests__/architecture.test.ts`, which checked one of
 * these rules in one direction and matched one import syntax. The rules are
 * stated in AGENTS.md; this is the part that notices when they stop being true.
 *
 * All three currently pass, and that is the point: they are cheap to keep and
 * expensive to rediscover. The engine's purity is the claim the README leads
 * with, the backend adapter is the reason RLS is the only authorization story
 * that has to be right, and the server-only rule is what keeps LOVABLE_API_KEY
 * out of a bundle the browser downloads.
 */

const SRC = join(process.cwd(), "src");

function sourceFiles(dir: string, opts: { tests?: boolean } = {}): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "__tests__" && !opts.tests) return [];
      return sourceFiles(full, opts);
    }
    return full.endsWith(".ts") || full.endsWith(".tsx") ? [full] : [];
  });
}

const shortName = (file: string) => relative(SRC, file);

/**
 * Comments out, so prose cannot look like code.
 *
 * `socialRead.ts` carries the line `// sentence from "they have nothing left"`,
 * which a bare /from "…"/ reads as an import of a package by that name. The
 * `(?<!:)` keeps a URL inside a string from being truncated at its "//".
 */
function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(?<!:)\/\/.*$/gm, "");
}

/**
 * Every module specifier a file reaches for, by any of the three syntaxes.
 *
 * The old test read only `from "…"`, so `await import("react")` and
 * `require("react")` were both invisible to it — and dynamic import is exactly
 * how a module that must not be in the client bundle gets pulled into it.
 */
function importsOf(raw: string): string[] {
  const source = withoutComments(raw);
  const specs: string[] = [];
  for (const m of source.matchAll(/\bfrom\s+["']([^"']+)["']/g)) specs.push(m[1]!);
  for (const m of source.matchAll(/\bimport\s*\(\s*["']([^"']+)["']/g)) specs.push(m[1]!);
  for (const m of source.matchAll(/\brequire\s*\(\s*["']([^"']+)["']/g)) specs.push(m[1]!);
  // `import "./styles.css"` — side-effect imports have no `from`.
  for (const m of source.matchAll(/^\s*import\s+["']([^"']+)["']/gm)) specs.push(m[1]!);
  return specs;
}

/** Only the statically-linked ones: these are always in the importer's bundle. */
function staticImportsOf(raw: string): string[] {
  const source = withoutComments(raw);
  const specs: string[] = [];
  for (const m of source.matchAll(/\bfrom\s+["']([^"']+)["']/g)) specs.push(m[1]!);
  for (const m of source.matchAll(/^\s*import\s+["']([^"']+)["']/gm)) specs.push(m[1]!);
  return specs;
}

// ---------------------------------------------------------------------------

describe("the engine is pure", () => {
  /**
   * AGENTS.md: "src/engine/ is pure TypeScript. It must not import React,
   * feature modules, Supabase, or backend adapters."
   */
  const FORBIDDEN = ["react", "@/integrations", "@/lib/backend", "@/features", "supabase"];

  const engineFiles = sourceFiles(join(SRC, "engine"));

  it("finds the engine it is meant to be guarding", () => {
    expect(engineFiles.length).toBeGreaterThan(50);
  });

  it("never imports React, the backend, Supabase or feature code", () => {
    const offenders: string[] = [];
    for (const file of engineFiles) {
      for (const spec of importsOf(readFileSync(file, "utf8"))) {
        const bad = FORBIDDEN.find((f) => spec === f || spec.startsWith(`${f}/`));
        if (bad) offenders.push(`${shortName(file)} imports ${spec}`);
      }
    }
    expect(offenders, offenders.join("; ")).toEqual([]);
  });

  it("imports no third-party package at all", () => {
    /**
     * Stricter than AGENTS.md's list, and deliberately so: the engine currently
     * depends on nothing but itself and `src/data`, which is what makes "plain
     * objects in, plain objects out" a fact rather than an aspiration. It is
     * also why `engine/ledger.ts` narrows payloads by hand instead of reaching
     * for zod. If a package genuinely belongs in here, this test is the
     * conversation about it.
     */
    const offenders: string[] = [];
    for (const file of engineFiles) {
      for (const spec of importsOf(readFileSync(file, "utf8"))) {
        const relativeImport = spec.startsWith(".");
        const ownAlias = spec.startsWith("@/");
        const nodeBuiltin = spec.startsWith("node:");
        if (!relativeImport && !ownAlias && !nodeBuiltin) {
          offenders.push(`${shortName(file)} imports ${spec}`);
        }
      }
    }
    expect(offenders, offenders.join("; ")).toEqual([]);
  });
});

// ---------------------------------------------------------------------------

describe("the backend adapter is the only door to Supabase", () => {
  /**
   * AGENTS.md: "Application and feature code must use its exported functions
   * instead of importing the generated Supabase client directly."
   *
   * This is load-bearing beyond tidiness. Every table is protected by RLS, and
   * RLS only protects what goes through an authenticated client — a component
   * reaching for its own client is how that stops being true in one place
   * nobody looks at.
   */
  const ALLOWED_TO_TOUCH_SUPABASE = [
    "lib/backend/",
    "integrations/supabase/",
    "integrations/lovable/",
  ];

  it("is the only place outside integrations that imports a Supabase client", () => {
    const offenders: string[] = [];
    for (const file of sourceFiles(SRC)) {
      const name = shortName(file);
      if (ALLOWED_TO_TOUCH_SUPABASE.some((prefix) => name.replace(/\\/g, "/").startsWith(prefix))) {
        continue;
      }
      for (const spec of importsOf(readFileSync(file, "utf8"))) {
        if (spec === "@supabase/supabase-js" || spec.includes("integrations/supabase/client")) {
          offenders.push(`${name} imports ${spec}`);
        }
      }
    }
    expect(offenders, offenders.join("; ")).toEqual([]);
  });
});

// ---------------------------------------------------------------------------

describe("server-only modules stay on the server", () => {
  /**
   * A `*.server.ts` module comes in two kinds, and only one of them is safe to
   * name from client code:
   *
   *  - a SERVER FUNCTION module (`createServerFn`) is meant to be imported by
   *    the browser. The framework replaces the handler with an RPC stub, so
   *    `usePlay.ts` importing `gmTurn.server` is the intended pattern.
   *  - everything else is server INTERNALS — the AI gateway, the service-role
   *    client, the bearer-token check, the rate limiter. Those read secrets and
   *    must only ever be reached by `await import(...)` from inside a handler,
   *    which is what keeps them out of the bundle the browser downloads.
   *
   * client.server.ts says it in its own header: "Top-level import is safe only
   * in other .server.ts modules — route files and *.functions.ts ship to the
   * client bundle."
   */
  const serverModules = sourceFiles(SRC).filter((f) => f.endsWith(".server.ts"));

  const internals = serverModules.filter(
    (f) => !readFileSync(f, "utf8").includes("createServerFn"),
  );

  it("finds both kinds", () => {
    expect(serverModules.length).toBeGreaterThan(serverModules.length - internals.length);
    expect(internals.length).toBeGreaterThan(0);
  });

  it("never lets a server-internal module be statically imported", () => {
    // The specifier a file would be imported by, without extension.
    const internalSpecifiers = internals.map((f) =>
      shortName(f).replace(/\\/g, "/").replace(/\.ts$/, ""),
    );

    const offenders: string[] = [];
    for (const file of sourceFiles(SRC, { tests: true })) {
      const source = readFileSync(file, "utf8");
      for (const spec of staticImportsOf(source)) {
        const normalized = spec.replace(/^@\//, "").replace(/\\/g, "/");
        const hit = internalSpecifiers.find(
          (internal) => normalized === internal || normalized.endsWith(internal),
        );
        // A module may statically import itself's own siblings only if it is
        // itself a .server.ts — that code never reaches the browser either.
        if (hit && !file.endsWith(".server.ts")) {
          offenders.push(`${shortName(file)} statically imports ${spec}`);
        }
      }
    }
    expect(offenders, offenders.join("; ")).toEqual([]);
  });

  it("keeps the service-role client out of every static import", () => {
    // The sharpest case: this client bypasses RLS entirely.
    const offenders: string[] = [];
    for (const file of sourceFiles(SRC, { tests: true })) {
      if (file.endsWith("client.server.ts")) continue;
      for (const spec of staticImportsOf(readFileSync(file, "utf8"))) {
        if (spec.includes("client.server")) offenders.push(`${shortName(file)} imports ${spec}`);
      }
    }
    expect(offenders, offenders.join("; ")).toEqual([]);
  });
});

// ---------------------------------------------------------------------------

describe("turn operations are free of React", () => {
  /**
   * `*Ops.ts` is the repository's name for "what the game DOES", separate from
   * the component that calls it — `downtimeOps.ts` established it, and
   * `playOps.ts` and `lifeOps.ts` followed when the play and Life turn logic
   * came out from under their hooks.
   *
   * The rule is what makes the split worth having. Turn logic that imports
   * React can only be exercised through React, which is how 4,500 lines of the
   * most consequential code in the project came to have three tests between
   * them, each needing four mock factories to reach it.
   */
  const opsModules = sourceFiles(SRC).filter((f) => /Ops\.ts$/.test(f));

  it("finds the ops modules", () => {
    expect(opsModules.map(shortName).sort()).toEqual([
      "features/downtime/downtimeOps.ts",
      "features/life/lifeOps.ts",
      "features/play/playOps.ts",
    ]);
  });

  it("never imports React or the query client", () => {
    const offenders: string[] = [];
    for (const file of opsModules) {
      for (const spec of importsOf(readFileSync(file, "utf8"))) {
        if (spec === "react" || spec.startsWith("@tanstack/react")) {
          offenders.push(`${shortName(file)} imports ${spec}`);
        }
      }
    }
    expect(offenders, offenders.join("; ")).toEqual([]);
  });
});
