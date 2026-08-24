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

describe("opposed checks", () => {
  const opposed = {
    kind: "opposed_check",
    skillId: "persuasion",
    npcKey: "trace-santiago",
    npcName: "Trace Santiago",
    opposingSkillId: "human_perception",
    opposingSkillLevel: 3,
    opposingStatValue: 5,
    intent: "talk her round",
  };

  it("keeps a well-formed opposed check", () => {
    const out = normalizeGmResponse(wire([opposed]), quiet);
    expect(out.proposedActions[0]).toEqual({ ...opposed, kind: "opposed_check" });
  });

  it("reads it under the spellings a model drifts to", () => {
    expect(actionKindOf({ kind: "opposedCheck" })).toBe("opposed_check");
    expect(actionKindOf({ type: "contested_check" })).toBe("opposed_check");
    expect(actionKindOf({ kind: "Opposed Check" })).toBe("opposed_check");
  });

  it("infers an opposed check over a plain one when an opposing side is present", () => {
    // Both a skillId and an opposing skill: reading this as a DV check would
    // invent a difficulty nobody set.
    expect(actionKindOf({ skillId: "persuasion", opposingSkillId: "human_perception" })).toBe(
      "opposed_check",
    );
  });

  it("accepts snake_case field names and an opponent named instead of keyed", () => {
    const out = normalizeGmResponse(
      wire([
        {
          type: "opposed",
          skill: "persuasion",
          opposing_skill_id: "human_perception",
          opponent: "Trace Santiago",
          opposing_skill_level: 4,
          opposing_stat_value: 6,
          intent: "lean on her",
        },
      ]),
      quiet,
    );
    expect(out.proposedActions[0]).toMatchObject({
      kind: "opposed_check",
      skillId: "persuasion",
      npcName: "Trace Santiago",
      npcKey: "Trace Santiago", // falls back to the name when no key is given
      opposingSkillLevel: 4,
      opposingStatValue: 6,
    });
  });

  it("clamps improvised NPC numbers into the human band", () => {
    const out = normalizeGmResponse(
      wire([{ ...opposed, opposingSkillLevel: 99, opposingStatValue: 40 }]),
      quiet,
    );
    expect(out.proposedActions[0]).toMatchObject({
      opposingSkillLevel: 10,
      opposingStatValue: 10,
    });
  });

  it("warns rather than dropping an opposed check in silence", () => {
    const onWarn = vi.fn();
    const out = normalizeGmResponse(
      wire([{ kind: "opposed_check", skillId: "persuasion", npcName: "Trace" }]),
      { onWarn },
    );
    expect(out.proposedActions).toEqual([]);
    expect(onWarn).toHaveBeenCalledWith(expect.stringContaining("missing a side"));
  });
});
