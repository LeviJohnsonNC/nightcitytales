import { beforeEach, describe, expect, it } from "vitest";
import { resetRateLimits, takeToken } from "../rate-limit.server";

const LIMIT = { limit: 3, windowMs: 60_000 };

beforeEach(() => resetRateLimits());

describe("takeToken", () => {
  it("allows calls up to the limit and refuses the next one", () => {
    const now = 1_000_000;
    expect(takeToken("a", LIMIT, now)).toEqual({ allowed: true, remaining: 2 });
    expect(takeToken("a", LIMIT, now)).toEqual({ allowed: true, remaining: 1 });
    expect(takeToken("a", LIMIT, now)).toEqual({ allowed: true, remaining: 0 });

    const refused = takeToken("a", LIMIT, now);
    expect(refused.allowed).toBe(false);
  });

  it("meters each key separately, so one user cannot spend another's allowance", () => {
    const now = 1_000_000;
    for (let i = 0; i < LIMIT.limit; i++) takeToken("a", LIMIT, now);
    expect(takeToken("a", LIMIT, now).allowed).toBe(false);
    expect(takeToken("b", LIMIT, now).allowed).toBe(true);
  });

  it("slides: a call falls out of the window once it is older than windowMs", () => {
    const start = 1_000_000;
    for (let i = 0; i < LIMIT.limit; i++) takeToken("a", LIMIT, start);
    expect(takeToken("a", LIMIT, start).allowed).toBe(false);

    // Still inside the window: refused.
    expect(takeToken("a", LIMIT, start + LIMIT.windowMs - 1).allowed).toBe(false);
    // Exactly windowMs old has aged out — the window is [now - windowMs, now].
    expect(takeToken("a", LIMIT, start + LIMIT.windowMs).allowed).toBe(true);
  });

  it("reports when to come back, rounded up to a whole second and never zero", () => {
    const start = 1_000_000;
    for (let i = 0; i < LIMIT.limit; i++) takeToken("a", LIMIT, start);

    const refused = takeToken("a", LIMIT, start + 30_000);
    expect(refused.allowed).toBe(false);
    if (refused.allowed) return;
    expect(refused.retryAfterSeconds).toBe(30);

    // A refusal on the very last millisecond still asks for at least a second,
    // so a client honouring Retry-After never busy-loops on 0.
    const edge = takeToken("a", LIMIT, start + LIMIT.windowMs - 1);
    expect(edge.allowed).toBe(false);
    if (edge.allowed) return;
    expect(edge.retryAfterSeconds).toBeGreaterThanOrEqual(1);
  });

  it("does not let a refused call count against the caller", () => {
    const start = 1_000_000;
    for (let i = 0; i < LIMIT.limit; i++) takeToken("a", LIMIT, start);
    // Hammering while refused must not keep pushing the window forward.
    for (let i = 0; i < 20; i++) takeToken("a", LIMIT, start + 1_000);
    expect(takeToken("a", LIMIT, start + LIMIT.windowMs + 1).allowed).toBe(true);
  });
});
