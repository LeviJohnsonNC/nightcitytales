/**
 * Role Abilities, read from the rules data. The rules under test: a Solo's pool
 * is their Rank and stepped options pay for the step they cover (not a point
 * short of it), a Fixer's Rank rides on a Trading deal and on nothing else, and
 * a Rockerboy cannot ask a favour their Rank does not reach.
 */
import { describe, expect, it } from "vitest";
import {
  CHARISMATIC_AUDIENCES,
  CHARISMATIC_LOCKOUT_DAYS,
  COMBAT_AWARENESS_OPTIONS,
  charismaticFavor,
  charismaticImpactCheck,
  combatAwarenessEffects,
  combatAwarenessFits,
  combatAwarenessPool,
  combatAwarenessValue,
  operatorHaggleBonus,
  roleAbilityOf,
} from "../roleAbility";

describe("reading a Role's ability", () => {
  it("names the ability and its starting Rank", () => {
    expect(roleAbilityOf("solo")).toMatchObject({
      abilityId: "combat_awareness",
      abilityName: "Combat Awareness",
      startingRank: 4,
    });
  });

  it("returns nothing for a Role the data does not know", () => {
    expect(roleAbilityOf("gunslinger")).toBeNull();
    expect(roleAbilityOf(null)).toBeNull();
  });
});

describe("Solo — Combat Awareness", () => {
  it("has all six printed options", () => {
    expect(COMBAT_AWARENESS_OPTIONS.map((o) => o.id).sort()).toEqual([
      "damage_deflection",
      "fumble_recovery",
      "initiative_reaction",
      "precision_attack",
      "spot_weakness",
      "threat_detection",
    ]);
  });

  it("gives a pool equal to Rank", () => {
    expect(combatAwarenessPool(4)).toBe(4);
    expect(combatAwarenessPool(0)).toBe(0);
  });

  it("scales the per-point options one for one", () => {
    expect(combatAwarenessValue("initiative_reaction", 3)).toBe(3);
    expect(combatAwarenessValue("threat_detection", 2)).toBe(2);
    expect(combatAwarenessValue("spot_weakness", 1)).toBe(1);
  });

  it("pays a stepped option only for the step the points cover", () => {
    // Precision Attack is 3/6/9 for +1/+2/+3.
    expect(combatAwarenessValue("precision_attack", 2)).toBe(0);
    expect(combatAwarenessValue("precision_attack", 3)).toBe(1);
    expect(combatAwarenessValue("precision_attack", 5)).toBe(1); // two points idle
    expect(combatAwarenessValue("precision_attack", 9)).toBe(3);
  });

  it("prices Damage Deflection at 2 points a level", () => {
    expect(combatAwarenessValue("damage_deflection", 1)).toBe(0);
    expect(combatAwarenessValue("damage_deflection", 2)).toBe(1);
    expect(combatAwarenessValue("damage_deflection", 10)).toBe(5);
  });

  it("turns an allocation into the effects the engine applies", () => {
    const effects = combatAwarenessEffects(
      { precision_attack: 3, threat_detection: 2, fumble_recovery: 4 },
      10,
    );
    expect(effects).toMatchObject({
      attack: 1,
      perception: 2,
      fumbleRecovery: true,
      initiative: 0,
      spent: 9,
      pool: 10,
    });
  });

  it("knows when a division does not fit the pool", () => {
    expect(combatAwarenessFits({ initiative_reaction: 4 }, 4)).toBe(true);
    expect(combatAwarenessFits({ initiative_reaction: 5 }, 4)).toBe(false);
  });

  it("ignores an option that does not exist rather than letting it eat the pool", () => {
    const effects = combatAwarenessEffects({ bullet_time: 4 }, 4);
    expect(effects.attack).toBe(0);
    expect(effects.spent).toBe(0); // junk is not an assignment; the pool is untouched
    expect(combatAwarenessFits({ bullet_time: 4, initiative_reaction: 4 }, 4)).toBe(true);
  });
});

describe("Fixer — Operator", () => {
  it("adds the Rank to a Trading deal", () => {
    expect(operatorHaggleBonus({ abilityId: "operator", rank: 4, skillId: "trading" })).toBe(4);
  });

  it("adds nothing to a check that is not the deal", () => {
    expect(operatorHaggleBonus({ abilityId: "operator", rank: 4, skillId: "persuasion" })).toBe(0);
  });

  it("adds nothing for anyone who is not a Fixer", () => {
    expect(
      operatorHaggleBonus({ abilityId: "combat_awareness", rank: 9, skillId: "trading" }),
    ).toBe(0);
    expect(operatorHaggleBonus({ abilityId: null, rank: 4, skillId: "trading" })).toBe(0);
  });
});

describe("Rockerboy — Charismatic Impact", () => {
  it("sets the DV by how many of them there are", () => {
    expect(CHARISMATIC_AUDIENCES.map((a) => [a.id, a.dv])).toEqual([
      ["single", 8],
      ["small_group", 10],
      ["huge_group", 12],
    ]);
  });

  it("locks a refused favour out for a week", () => {
    expect(CHARISMATIC_LOCKOUT_DAYS).toBe(7);
  });

  it("offers what the Rank actually reaches", () => {
    expect(charismaticFavor(4, "single")).toContain("major favour");
    expect(charismaticFavor(10, "huge_group")).toContain("private army");
  });

  it("offers a low Rank nothing from a huge crowd", () => {
    // Ranks 1-2 have no Huge Group entry: there is no following yet.
    expect(charismaticFavor(2, "huge_group")).toBeNull();
  });
});

describe("rolling Charismatic Impact", () => {
  const face = (value: number) => () => (value - 1) / 10 + 0.001;

  it("rolls Rank + 1d10 against the audience's DV", () => {
    // Rank 4 + a 5 is 9, which clears DV8 for one person.
    const result = charismaticImpactCheck(4, "single", face(5));
    expect(result.total).toBe(9);
    expect(result.dv).toBe(8);
    expect(result.success).toBe(true);
    expect(result.formula).toContain("Charismatic Impact");
  });

  it("is harder the more of them there are", () => {
    // The same 9 does not move a Huge Group at DV12.
    expect(charismaticImpactCheck(4, "huge_group", face(5)).success).toBe(false);
  });

  it("carries what that Rank can ask of them", () => {
    expect(charismaticImpactCheck(4, "single", face(5)).favor).toContain("major favour");
    expect(charismaticImpactCheck(2, "huge_group", face(5)).favor).toBeNull();
  });

  it("refuses an audience the rules do not describe", () => {
    expect(() => charismaticImpactCheck(4, "stadium", face(5))).toThrow(/Unknown audience/);
  });
});
