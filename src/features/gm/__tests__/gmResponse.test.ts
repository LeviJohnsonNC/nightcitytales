import { describe, expect, it } from "vitest";
import { GmResponseSchema } from "../gmResponse";

describe("GmResponseSchema", () => {
  it("parses a bare narration and applies defaults", () => {
    const parsed = GmResponseSchema.parse({ narration: "The rain hisses off the neon." });
    expect(parsed.proposedActions).toEqual([]);
    expect(parsed.stateDeltas).toEqual([]);
    expect(parsed.endsWithDecision).toBe(false);
    expect(parsed.walkOns).toEqual([]);
  });

  it("accepts walk-on mentions", () => {
    const parsed = GmResponseSchema.parse({
      narration: "x",
      walkOns: [{ subject: "dive-bar-tender", gender: "male" }],
    });
    expect(parsed.walkOns).toEqual([{ subject: "dive-bar-tender", gender: "male" }]);
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
