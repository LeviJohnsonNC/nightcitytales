import { describe, expect, it } from "vitest";
import {
  applyDamage,
  autofireDamage,
  rollDeathSave,
  orderByInitiative,
  resolveAttack,
  rollDamage,
  rollInitiative,
  woundActionPenalty,
  woundMovePenalty,
  type InitiativeEntry,
} from "../combat";

/** Scripted RNG returning exact die faces for `sides`-sided dice. */
const scripted = (faces: number[], sides: number) => {
  let i = 0;
  return () => (faces[i++]! - 1) / sides;
};

describe("initiative", () => {
  it("rolls REF + 1d10", () => {
    const init = rollInitiative(8, scripted([5], 10));
    expect(init).toEqual({ roll: 5, ref: 8, total: 13 });
  });

  it("orders high-to-low, breaking ties by REF then stable order", () => {
    const entries: InitiativeEntry<string>[] = [
      { combatant: "A", initiative: { roll: 5, ref: 6, total: 14 } },
      { combatant: "B", initiative: { roll: 8, ref: 5, total: 14 } }, // tie total, lower REF
      { combatant: "C", initiative: { roll: 9, ref: 8, total: 17 } },
    ];
    expect(orderByInitiative(entries).map((e) => e.combatant)).toEqual(["C", "A", "B"]);
  });
});

describe("resolveAttack", () => {
  it("hits when the total exceeds the DV (Royal's Single Shot, CP:R pg. 170)", () => {
    // REF 8 + Shoulder Arms 6 + d10(4) = 18 vs DV15 -> hit, beat by 3.
    const r = resolveAttack(
      { statLabel: "REF", statValue: 8, skillLabel: "Shoulder Arms", skillValue: 6, dv: 15 },
      scripted([4], 10),
    );
    expect(r.total).toBe(18);
    expect(r.hit).toBe(true);
    expect(r.margin).toBe(3);
  });

  it("misses on a tie — the Defender wins ties (CP:R pg. 172)", () => {
    // REF 5 + Handgun 5 + d10(5) = 15 vs DV15 -> tie -> miss.
    const r = resolveAttack(
      { statLabel: "REF", statValue: 5, skillLabel: "Handgun", skillValue: 5, dv: 15 },
      scripted([5], 10),
    );
    expect(r.total).toBe(15);
    expect(r.margin).toBe(0);
    expect(r.hit).toBe(false);
  });
});

describe("rollDamage", () => {
  it("flags a Critical Injury on two or more 6s", () => {
    const r = rollDamage(3, scripted([6, 6, 2], 6));
    expect(r.total).toBe(14);
    expect(r.sixes).toBe(2);
    expect(r.criticalInjury).toBe(true);
  });

  it("does not crit on a single 6", () => {
    const r = rollDamage(3, scripted([6, 2, 3], 6));
    expect(r.sixes).toBe(1);
    expect(r.criticalInjury).toBe(false);
  });
});

describe("autofireDamage", () => {
  it("multiplies 2d6 by the amount beaten, capped by the weapon (Royal, CP:R pg. 173)", () => {
    // AR, beat DV by 4, 2d6 = 10 -> x4 = 40.
    const r = autofireDamage("assault_rifle", 4, scripted([5, 5], 6));
    expect(r.base).toBe(10);
    expect(r.multiplier).toBe(4);
    expect(r.total).toBe(40);
  });

  it("caps the multiplier (SMG cap 3) and crits on double 6", () => {
    const r = autofireDamage("smg", 5, scripted([6, 6], 6));
    expect(r.multiplier).toBe(3); // min(5, 3)
    expect(r.total).toBe(36);
    expect(r.criticalInjury).toBe(true);
  });
});

describe("applyDamage", () => {
  it("subtracts SP, takes the rest off HP, and ablates by 1", () => {
    const r = applyDamage({ hpBefore: 40, damage: 25, sp: 11 });
    expect(r.damageThroughArmor).toBe(14);
    expect(r.hpAfter).toBe(26);
    expect(r.ablated).toBe(true);
    expect(r.spAfter).toBe(10);
  });

  it("ablates by 2 with Armor-Piercing (CP:R pg. 345)", () => {
    const r = applyDamage({ hpBefore: 40, damage: 25, sp: 11, armorPiercing: true });
    expect(r.spAfter).toBe(9);
  });

  it("does not ablate when nothing gets through", () => {
    const r = applyDamage({ hpBefore: 40, damage: 8, sp: 11 });
    expect(r.damageThroughArmor).toBe(0);
    expect(r.hpAfter).toBe(40);
    expect(r.ablated).toBe(false);
    expect(r.spAfter).toBe(11);
  });

  it("adds 5 Bonus Damage for a Critical Injury even if armor stopped the shot", () => {
    const r = applyDamage({ hpBefore: 40, damage: 10, sp: 11, criticalInjury: true });
    expect(r.damageThroughArmor).toBe(0);
    expect(r.bonusDamage).toBe(5);
    expect(r.hpAfter).toBe(35);
    expect(r.ablated).toBe(false); // bonus damage never ablates
    expect(r.criticalInjury).toBe(true);
  });

  it("doubles the damage through head armor on an aimed head shot", () => {
    const r = applyDamage({ hpBefore: 40, damage: 10, sp: 4, aimedHead: true });
    expect(r.damageThroughArmor).toBe(12); // (10 - 4) x 2
    expect(r.hpAfter).toBe(28);
  });

  it("ignores and does not ablate armor when the damage bypasses it", () => {
    const r = applyDamage({ hpBefore: 40, damage: 10, sp: 11, bypassArmor: true });
    expect(r.damageThroughArmor).toBe(10);
    expect(r.ablated).toBe(false);
    expect(r.spAfter).toBe(11);
  });

  it("Rubber ammo cannot crit, cannot ablate, and floors at 1 HP", () => {
    const r = applyDamage({ hpBefore: 5, damage: 20, sp: 0, rubber: true, criticalInjury: true });
    expect(r.hpAfter).toBe(1);
    expect(r.totalHpLoss).toBe(4);
    expect(r.ablated).toBe(false);
    expect(r.criticalInjury).toBe(false);
    expect(r.bonusDamage).toBe(0);
  });
});

describe("wound penalties (CP:R pg. 186)", () => {
  it("applies -2 Seriously, -4 Mortally to Actions", () => {
    expect(woundActionPenalty("none")).toBe(0);
    expect(woundActionPenalty("light")).toBe(0);
    expect(woundActionPenalty("serious")).toBe(-2);
    expect(woundActionPenalty("mortal")).toBe(-4);
  });

  it("applies -6 MOVE only when Mortally Wounded", () => {
    expect(woundMovePenalty("serious")).toBe(0);
    expect(woundMovePenalty("mortal")).toBe(-6);
  });
});

describe("rollDeathSave (CP:R pg. 187)", () => {
  it("survives on a roll under BODY", () => {
    const r = rollDeathSave(6, 0, scripted([3], 10));
    expect(r.survived).toBe(true);
    expect(r.penaltyAfter).toBe(1);
  });

  it("dies on a roll at or over BODY", () => {
    expect(rollDeathSave(6, 0, scripted([7], 10)).survived).toBe(false);
    expect(rollDeathSave(6, 0, scripted([6], 10)).survived).toBe(false); // "under BODY" is strict
  });

  it("auto-fails on a natural 10 regardless of BODY", () => {
    const r = rollDeathSave(10, 0, scripted([10], 10));
    expect(r.autoFail).toBe(true);
    expect(r.survived).toBe(false);
  });

  it("adds the accumulated penalty to the roll", () => {
    // BODY 8, penalty 2, roll 5 -> effective 7 < 8 -> survive.
    const r = rollDeathSave(8, 2, scripted([5], 10));
    expect(r.effective).toBe(7);
    expect(r.survived).toBe(true);
    expect(r.penaltyAfter).toBe(3);
  });
});
