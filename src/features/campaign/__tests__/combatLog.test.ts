import { describe, expect, it } from "vitest";
import type { ApplyDamageResult, AttackResult, DamageRoll, DeathSaveResult } from "@/engine";
import { attackEvent, deathSaveEvent } from "../combatLog";

const attack: AttackResult = {
  formula: "1d10(4) + REF(8) + Handgun(6) = 18 vs DV15 → SUCCESS by 3",
  rolls: [4],
  modifiers: [],
  total: 18,
  dv: 15,
  success: true,
  timestamp: "2026-08-23T00:00:00.000Z",
  base: 4,
  critical: null,
  criticalDie: null,
  modifier: 14,
  hit: true,
  margin: 3,
};

const damage: DamageRoll = {
  dice: 3,
  rolls: [5, 5, 4],
  total: 14,
  sixes: 0,
  criticalInjury: false,
};

const applied: ApplyDamageResult = {
  damageThroughArmor: 3,
  bonusDamage: 0,
  totalHpLoss: 3,
  hpAfter: 37,
  spBefore: 11,
  spAfter: 10,
  ablated: true,
  criticalInjury: false,
};

describe("attackEvent", () => {
  it("records a hit with its full trace and outcome", () => {
    const e = attackEvent(
      "camp-1",
      { attack, damage, applied },
      {
        attackerName: "Vincent",
        targetName: "Scav",
        targetWoundState: "light",
        beatId: "c3",
        weapon: "very_heavy_pistol",
      },
    );
    expect(e.type).toBe("attack");
    expect(e.summary).toBe(attack.formula);
    expect(e.beat_id).toBe("c3");
    expect(e.roll).toEqual(attack);
    expect(e.data).toMatchObject({
      attacker: "Vincent",
      target: "Scav",
      hit: true,
      damage: 14,
      through_armor: 3,
      hp_after: 37,
      ablated: true,
      target_wound_state: "light",
      weapon: "very_heavy_pistol",
    });
  });

  it("records a miss with no damage fields and no beat", () => {
    const miss: AttackResult = { ...attack, hit: false, success: false, total: 12, margin: -3 };
    const e = attackEvent(
      "camp-1",
      { attack: miss },
      { attackerName: "Vincent", targetName: "Scav" },
    );
    expect(e.data).toMatchObject({ hit: false });
    expect(e.data).not.toHaveProperty("damage");
    expect(e.beat_id).toBeUndefined();
  });
});

describe("deathSaveEvent", () => {
  const save: DeathSaveResult = {
    roll: 3,
    penalty: 0,
    effective: 3,
    autoFail: false,
    survived: true,
    penaltyAfter: 1,
  };

  it("records a survived Death Save", () => {
    const e = deathSaveEvent("camp-1", save, { combatantName: "Vincent", died: false });
    expect(e.type).toBe("death_save");
    expect(e.summary).toContain("survives");
    expect(e.data).toMatchObject({ combatant: "Vincent", survived: true, died: false });
  });
});
