import { describe, expect, it } from "vitest";
import type { SkillCheckActor } from "@/engine";
import { resolveProposedAction } from "../resolveAction";

const seq = (faces: number[], sides: number) => {
  let i = 0;
  return () => (faces[i++]! - 1) / sides;
};

const actor: SkillCheckActor = { stats: { ref: 6 }, skills: [{ skillId: "handgun", level: 4 }] };

describe("resolveProposedAction", () => {
  it("resolves a skill_check proposal into a real, traceable roll", () => {
    const r = resolveProposedAction(
      { kind: "skill_check", skillId: "handgun", dv: 15, intent: "shoot the guard" },
      actor,
      seq([9], 10),
    );
    expect(r.kind).toBe("skill_check");
    if (r.kind === "skill_check") {
      expect(r.result.total).toBe(19); // d10(9) + REF(6) + Handgun(4)
      expect(r.result.success).toBe(true);
      expect(r.intent).toBe("shoot the guard");
    }
  });

  it("passes non-check actions through unresolved", () => {
    const r = resolveProposedAction({ kind: "advance_beat", to: "epilogue" }, actor);
    expect(r.kind).toBe("unresolved");
    if (r.kind === "unresolved") expect(r.action.kind).toBe("advance_beat");
  });
});
