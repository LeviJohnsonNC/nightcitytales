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

describe("the question the turn could not answer itself", () => {
  it("keeps a real yes/no question", () => {
    const result = normalizeGmResponse(
      { narration: "n", question: " Is the side door already unlocked? " } as GmWireResponse,
      quiet,
    );
    expect(result.question).toBe("Is the side door already unlocked?");
  });

  it("asks nothing on an ordinary turn", () => {
    expect(normalizeGmResponse({ narration: "n" } as GmWireResponse, quiet).question).toBeNull();
  });

  it("drops a question no yes/no table could answer", () => {
    for (const question of ["How many guards are inside?", "Is it?", 7]) {
      const result = normalizeGmResponse(
        { narration: "n", question } as unknown as GmWireResponse,
        quiet,
      );
      expect(result.question).toBeNull();
    }
  });
});

describe("distance is not the model's to give", () => {
  it("drops a distance the model sent with an attack", () => {
    // Not clamped, not taken under advisement: DROPPED. Range is the DV, so a
    // number here would be the narrator setting how hard the shot is.
    const out = normalizeGmResponse(
      wire([{ kind: "attack", targetId: "scav_1", intent: "two to the chest", distance: 4 }]),
      quiet,
    );
    expect(out.proposedActions).toEqual([
      { kind: "attack", targetId: "scav_1", intent: "two to the chest" },
    ]);
  });

  it("drops a distance the model sent with a hostile", () => {
    const out = normalizeGmResponse(
      wire([
        {
          kind: "start_encounter",
          name: "Ambush",
          arena: "alley",
          enemies: [{ key: "scav_1", name: "Scav", rangeType: "pistol", distance: 3 }],
        },
      ]),
      quiet,
    );
    const started = out.proposedActions[0] as { enemies: Record<string, unknown>[] };
    expect(started.enemies[0]).not.toHaveProperty("distance");
  });
});

describe("where a fight happens", () => {
  it("keeps an arena the engine knows", () => {
    const out = normalizeGmResponse(
      wire([
        {
          kind: "start_encounter",
          name: "Ambush",
          arena: "club_interior",
          enemies: [{ key: "s", name: "Scav" }],
        },
      ]),
      quiet,
    );
    expect(out.proposedActions[0]).toMatchObject({ arena: "club_interior" });
  });

  it("falls back to open ground for a place it invented", () => {
    const out = normalizeGmResponse(
      wire([
        {
          kind: "start_encounter",
          name: "Ambush",
          arena: "a floating casino above the bay",
          enemies: [{ key: "s", name: "Scav" }],
        },
      ]),
      quiet,
    );
    expect(out.proposedActions[0]).toMatchObject({ arena: "open_ground" });
  });

  it("falls back when no arena was named at all", () => {
    const out = normalizeGmResponse(
      wire([{ kind: "start_encounter", name: "Ambush", enemies: [{ key: "s", name: "Scav" }] }]),
      quiet,
    );
    expect(out.proposedActions[0]).toMatchObject({ arena: "open_ground" });
  });
});

describe("moving", () => {
  it("reads a move", () => {
    const out = normalizeGmResponse(
      wire([{ kind: "move", targetId: "scav_1", towards: "closer", intent: "breaks for the bar" }]),
      quiet,
    );
    expect(out.proposedActions).toEqual([
      { kind: "move", targetId: "scav_1", towards: "closer", intent: "breaks for the bar" },
    ]);
  });

  it("defaults an unreadable direction to closing", () => {
    const out = normalizeGmResponse(
      wire([{ kind: "move", targetId: "scav_1", towards: "sideways", intent: "moves" }]),
      quiet,
    );
    expect(out.proposedActions[0]).toMatchObject({ towards: "closer" });
  });

  it("does not read a move as an attack just because it names a target", () => {
    // Both carry a targetId. Reading this as an attack would fire a gun the
    // player never raised.
    expect(actionKindOf({ targetId: "scav_1", towards: "away" })).toBe("move");
    expect(actionKindOf({ targetId: "scav_1" })).toBe("attack");
  });

  it("drops a move with nobody to move relative to", () => {
    const warn = vi.fn();
    const out = normalizeGmResponse(wire([{ kind: "move", towards: "closer" }]), { onWarn: warn });
    expect(out.proposedActions).toEqual([]);
    expect(warn).toHaveBeenCalled();
  });
});

describe("enemy stats are not the model's to give", () => {
  const encounter = (enemies: unknown[]) =>
    normalizeGmResponse(
      wire([{ kind: "start_encounter", name: "Ambush", arena: "alley", enemies }]),
      quiet,
    ).proposedActions[0] as { enemies: Record<string, unknown>[] };

  it("keeps only the name, the key and the profile", () => {
    const started = encounter([
      {
        key: "royce",
        name: "Royce",
        profile: "solo",
        ref: 10,
        body: 12,
        hp: 80,
        sp: 20,
        attackSkill: 10,
        weaponName: "Railgun",
        damageDice: 8,
        rangeType: "sniper_rifle",
      },
    ]);
    expect(started.enemies[0]).toEqual({ key: "royce", name: "Royce", profile: "solo" });
  });

  it("drops the stats rather than clamping them", () => {
    // Clamping would still let the model choose where inside the range a fight
    // sits, which is the whole of the problem this replaced.
    const started = encounter([{ key: "s", name: "Scav", profile: "scavver", hp: 25 }]);
    expect(started.enemies[0]).not.toHaveProperty("hp");
    expect(started.enemies[0]).not.toHaveProperty("ref");
  });

  it("reads a profile the engine knows", () => {
    expect(encounter([{ key: "c", name: "Guard", profile: "corp_security" }]).enemies[0]).toEqual({
      key: "c",
      name: "Guard",
      profile: "corp_security",
    });
  });

  it("falls back for a threat it invented", () => {
    const started = encounter([{ key: "d", name: "Cyber-Dragon", profile: "cyber_dragon" }]);
    expect(started.enemies[0]).toMatchObject({ profile: "street_thug" });
  });

  it("falls back when no profile was named at all", () => {
    expect(encounter([{ key: "x", name: "Somebody" }]).enemies[0]).toMatchObject({
      profile: "street_thug",
    });
  });

  it("still drops a hostile with no name to call them by", () => {
    const warn = vi.fn();
    const out = normalizeGmResponse(
      wire([
        { kind: "start_encounter", name: "Ambush", arena: "alley", enemies: [{ profile: "solo" }] },
      ]),
      { onWarn: warn },
    );
    expect(out.proposedActions).toEqual([]);
    expect(warn).toHaveBeenCalled();
  });
});
