import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Every path that can spend AI credits must authenticate the caller.
 *
 * AGENTS.md states this rule outright — "Any new server function or HTTP route
 * that can consume paid AI resources or access user data must perform
 * server-side authentication. A browser route guard, an attached bearer token,
 * or CSRF protection is not by itself authorization." — and for a long time it
 * was kept by exactly one of the four AI endpoints. Nothing caught that,
 * because nothing was looking.
 *
 * This looks. It does not work from a list of known endpoints, because the
 * failure mode is a NEW endpoint: it finds every module that reads
 * LOVABLE_API_KEY and insists each one carries an auth mechanism. A fifth AI
 * path added tomorrow is covered the moment it reads the key.
 *
 * It is a source scan, so it proves the check is WIRED UP, not that it is
 * correct — the behaviour of the check itself belongs to the middleware.
 */
const SRC = join(process.cwd(), "src");

/**
 * READING the key is what makes a module an entry point, so that is the marker.
 * Not the bare name: the client-side callers mention LOVABLE_API_KEY in their
 * doc comments to explain why they go through a server function at all, and
 * matching those would flag files that never touch the gateway.
 */
const SPENDS_CREDITS = 'process.env["LOVABLE_API_KEY"]';

/**
 * The two ways this codebase authenticates.
 *
 * `requireSupabaseAuth` is function middleware and reaches server functions
 * only; an HTTP route handler gets a bare Request and has to call
 * `requireUserId` itself. See requestAuth.server.ts.
 */
const AUTH_MECHANISMS = ["requireSupabaseAuth", "requireUserId"];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      return entry === "__tests__" ? [] : sourceFiles(full);
    }
    return full.endsWith(".ts") || full.endsWith(".tsx") ? [full] : [];
  });
}

describe("paid AI endpoints", () => {
  const spenders = sourceFiles(SRC).filter((file) =>
    readFileSync(file, "utf8").includes(SPENDS_CREDITS),
  );

  it("finds the endpoints it is meant to be guarding", () => {
    // Guards the guard: a rename that made this list empty would turn every
    // assertion below green while checking nothing.
    expect(spenders.length).toBeGreaterThanOrEqual(5);
  });

  it("authenticates the caller on every path that spends credits", () => {
    const unguarded = spenders
      .filter((file) => {
        const source = readFileSync(file, "utf8");
        return !AUTH_MECHANISMS.some((mechanism) => source.includes(mechanism));
      })
      .map((file) => file.slice(SRC.length + 1));

    expect(unguarded, `paid AI endpoints with no auth: ${unguarded.join(", ")}`).toEqual([]);
  });
});

/**
 * The system prompt is the server's to choose.
 *
 * generateBackgroundFn used to take `{ system, user }` straight from the
 * browser, which made it a general-purpose model rather than a background
 * generator: the caller decided what it was. The job list is the closed
 * vocabulary that replaced it, and this is what stops the loose shape coming
 * back.
 */
describe("generated chargen prose", () => {
  const handler = readFileSync(join(SRC, "lib/background.functions.ts"), "utf8");

  it("does not accept a system prompt from the client", () => {
    expect(handler).not.toMatch(/system:\s*z\./);
    expect(handler).not.toMatch(/system:\s*data\./);
  });

  it("names the job from a closed list and reads the prompt server-side", () => {
    expect(handler).toContain("z.enum(BACKGROUND_JOBS)");
    expect(handler).toContain("systemPromptFor(data.job)");
  });
});
