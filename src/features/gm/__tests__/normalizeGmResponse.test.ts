/**
 * The model→engine handoff. A proposal the normalizer cannot name is a check the
 * player never gets to roll, so these cases are the ones that matter: the field
 * spellings a model actually drifts to, and the guarantee that nothing is
 * dropped in silence.
 */
import { describe, expect, it, vi } from "vitest";
import { actionKindOf, normalizeGmResponse, type GmWireResponse } from "../gmResponse";

const wire = (proposedActions: unknown[]): GmWireResponse => ({
  narration: "The rain hisses off the neon.",
  proposedActions,
});

const quiet = { onWarn: () => {} };

describe("actionKindOf", () => {
  it("reads the printed discriminator", () => {
    expect(actionKindOf({ kind: "skill_check" })).toBe("skill_check");
  });

  it("reads the spellings a model drifts to", () => {
    expect(actionKindOf({ type: "skill_check" })).toBe("skill_check");
    expect(actionKindOf({ action: "skill_check" })).toBe("skill_check");
    expect(actionKindOf({ kind: "skillCheck" })).toBe("skill_check");
    expect(actionKindOf({ kind: "Skill Check" })).toBe("skill_check");
    expect(actionKindOf({ kind: "check" })).toBe("skill_check");
    expect(actionKindOf({ type: "start_combat" })).toBe("start_encounter");
    expect(actionKindOf({ kind: "ranged_attack" })).toBe("attack");
    expect(actionKindOf({ kind: "advance" })).toBe("advance_beat");
  });

  it("infers the kind from the payload when the model names none", () => {
    expect(actionKindOf({ skillId: "persuasion", dv: 15 })).toBe("skill_check");
    expect(actionKindOf({ targetId: "mook-1", distance: 8 })).toBe("attack");
    expect(actionKindOf({ enemies: [] })).toBe("start_encounter");
    expect(actionKindOf({ to: "beat-2" })).toBe("advance_beat");
  });

  it("names nothing it cannot recognize", () => {
    expect(actionKindOf({ narration: "x" })).toBeNull();
  });
});

describe("normalizeGmResponse", () => {
  it("keeps a check the model spelled with the printed discriminator", () => {
    const out = normalizeGmResponse(
      wire([{ kind: "skill_check", skillId: "persuasion", dv: 15, intent: "talk her round" }]),
      quiet,
    );
    expect(out.proposedActions).toEqual([
      { kind: "skill_check", skillId: "persuasion", dv: 15, intent: "talk her round" },
    ]);
  });

  it('keeps a check the model spelled with "type" instead of "kind"', () => {
    const out = normalizeGmResponse(
      wire([{ type: "skill_check", skill: "persuasion", dv: 15, intent: "talk her round" }]),
      quiet,
    );
    expect(out.proposedActions).toEqual([
      { kind: "skill_check", skillId: "persuasion", dv: 15, intent: "talk her round" },
    ]);
  });

  it("keeps a check that names no kind at all", () => {
    const out = normalizeGmResponse(
      wire([{ skill_id: "persuasion", dv: 17, description: "lean on the fixer" }]),
      quiet,
    );
    expect(out.proposedActions).toEqual([
      { kind: "skill_check", skillId: "persuasion", dv: 17, intent: "lean on the fixer" },
    ]);
  });

  it("warns rather than silently dropping an unrecognizable action", () => {
    const onWarn = vi.fn();
    const out = normalizeGmResponse(wire([{ narration: "she folds" }]), { onWarn });
    expect(out.proposedActions).toEqual([]);
    expect(onWarn).toHaveBeenCalledWith(expect.stringContaining("no recognizable kind"));
    expect(onWarn).toHaveBeenCalledWith(expect.stringContaining("none survived normalization"));
  });

  it("warns when a check arrives with no skill to roll", () => {
    const onWarn = vi.fn();
    const out = normalizeGmResponse(wire([{ kind: "skill_check", dv: 15 }]), { onWarn });
    expect(out.proposedActions).toEqual([]);
    expect(onWarn).toHaveBeenCalledWith(expect.stringContaining("no skill"));
  });

  it("says nothing when the GM proposed nothing", () => {
    const onWarn = vi.fn();
    normalizeGmResponse(wire([]), { onWarn });
    expect(onWarn).not.toHaveBeenCalled();
  });
});
