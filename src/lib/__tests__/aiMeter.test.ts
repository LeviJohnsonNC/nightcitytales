import { afterEach, describe, expect, it } from "vitest";
import { MAX_TURN_PROMPT_CHARS, TURN_LIMITS, meterTurn } from "../aiMeter";
import { resetRateLimits } from "../rate-limit.server";

afterEach(() => resetRateLimits());

describe("a game turn's meter", () => {
  it("allows a caller's allowance and refuses the next call", async () => {
    for (let i = 0; i < TURN_LIMITS.opening.limit; i++) await meterTurn("opening", "u1");
    await expect(meterTurn("opening", "u1")).rejects.toThrow(/Try again in \d+ seconds/);
  });

  it("keeps callers and kinds of turn apart", async () => {
    for (let i = 0; i < TURN_LIMITS.opening.limit; i++) await meterTurn("opening", "u1");
    await expect(meterTurn("opening", "u2")).resolves.toBeUndefined();
    await expect(meterTurn("life", "u1")).resolves.toBeUndefined();
  });

  it("leaves room for the largest packet the renderers produce", () => {
    // packetBudget.test.ts holds the GM packet under 13,000 characters.
    expect(MAX_TURN_PROMPT_CHARS).toBeGreaterThan(13_000 * 3);
  });
});
