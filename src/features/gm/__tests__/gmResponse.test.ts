import { describe, expect, it } from "vitest";
import { GmResponseSchema, MAX_REST_DAYS, normalizeGmResponse } from "../gmResponse";

describe("GmResponseSchema", () => {
  it("parses a bare narration and applies defaults", () => {
    const parsed = GmResponseSchema.parse({ narration: "The rain hisses off the neon." });
    expect(parsed.proposedActions).toEqual([]);
    expect(parsed.stateDeltas).toEqual([]);
    expect(parsed.endsWithDecision).toBe(false);
  });

  it("accepts proposed actions and state deltas", () => {
    const parsed = GmResponseSchema.parse({
      narration: "You size up the guard.",
      proposedActions: [
        { kind: "skill_check", skillId: "handgun", dv: 15, intent: "shoot the guard" },
      ],
      stateDeltas: [{ kind: "set_flag", flag: "spooked_guard" }],
      endsWithDecision: true,
    });
    expect(parsed.proposedActions[0]).toMatchObject({
      kind: "skill_check",
      skillId: "handgun",
      dv: 15,
    });
    expect(parsed.stateDeltas[0]).toMatchObject({ kind: "set_flag", flag: "spooked_guard" });
    expect(parsed.endsWithDecision).toBe(true);
  });

  it("rejects an unknown proposed-action kind", () => {
    expect(() =>
      GmResponseSchema.parse({ narration: "x", proposedActions: [{ kind: "teleport" }] }),
    ).toThrow();
  });
});

describe("rest proposals", () => {
  it("accepts a rest with whole days", () => {
    const out = normalizeGmResponse({
      narration: "You hole up.",
      proposedActions: [{ kind: "rest", days: 3, intent: "lie low and heal" }],
    } as never);
    expect(out.proposedActions[0]).toEqual({
      kind: "rest",
      days: 3,
      intent: "lie low and heal",
    });
  });

  it("defaults to a single day when none is stated", () => {
    const out = normalizeGmResponse({
      narration: "",
      proposedActions: [{ kind: "rest", intent: "sleep it off" }],
    } as never);
    expect(out.proposedActions[0]).toMatchObject({ kind: "rest", days: 1 });
  });

  it("floors a fractional day rather than healing for half of one", () => {
    const out = normalizeGmResponse({
      narration: "",
      proposedActions: [{ kind: "rest", days: 2.8, intent: "" }],
    } as never);
    expect(out.proposedActions[0]).toMatchObject({ days: 2 });
  });

  it("caps a hallucinated stretch of downtime", () => {
    const out = normalizeGmResponse({
      narration: "",
      proposedActions: [{ kind: "rest", days: 900, intent: "" }],
    } as never);
    expect(out.proposedActions[0]).toMatchObject({ days: MAX_REST_DAYS });
  });

  it("never proposes zero or negative days", () => {
    for (const days of [0, -4]) {
      const out = normalizeGmResponse({
        narration: "",
        proposedActions: [{ kind: "rest", days, intent: "" }],
      } as never);
      expect(out.proposedActions[0]).toMatchObject({ days: 1 });
    }
  });
});
