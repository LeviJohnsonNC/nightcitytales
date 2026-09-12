import { describe, expect, it } from "vitest";
import {
  attackEventData,
  deathSaveEventData,
  payloadOf,
  readAttackEventData,
  readBackupCalledEventData,
  readDeathSaveEventData,
  readSkillCheckEventData,
} from "../ledger";

/**
 * The drift guard.
 *
 * `campaign_events.data` is jsonb. The writer casts through `as unknown as
 * Json` and the reader narrows by hand, so nothing in the type system connects
 * them: rename a field on one side and the other does not fail, it returns
 * nothing, and the job settles with no HP cost on a receipt that reads as
 * authoritative.
 *
 * The round-trip below is the assertion that matters — whatever the writer
 * produces, the reader reads back. Every other test here pins a decision the
 * parser makes about a payload that is NOT well-formed, because those are the
 * ones a future change is most likely to get quietly wrong.
 */

const APPLIED = {
  damageThroughArmor: 9,
  bonusDamage: 0,
  hpAfter: 31,
  totalHpLoss: 9,
  spBefore: 11,
  spAfter: 10,
  ablated: true,
  criticalInjury: false,
  armorLocation: "body" as const,
};

describe("an attack survives the round trip", () => {
  it("reads back everything a full hit wrote", () => {
    const wire = attackEventData({
      attacker: "Vex",
      target: "V",
      hit: true,
      margin: 4,
      weapon: "Very Heavy Pistol",
      ammo: { inventoryId: "weapon-1", before: 8, after: 7 },
      targetWoundState: "serious",
      damage: 16,
      applied: APPLIED,
    });

    const read = readAttackEventData(wire);
    expect(read).not.toBeNull();
    expect(read).toEqual({
      attacker: "Vex",
      target: "V",
      hit: true,
      margin: 4,
      weapon: "Very Heavy Pistol",
      damage: 16,
      throughArmor: 9,
      bonusDamage: 0,
      // hp_before is reconstructed by the writer from what was lost.
      hpBefore: 40,
      hpAfter: 31,
      spBefore: 11,
      spAfter: 10,
      ablated: true,
      armorLocation: "body",
      criticalInjury: false,
      targetWoundState: "serious",
      ammo: { inventoryId: "weapon-1", before: 8, after: 7 },
    });
  });

  it("reads back a miss, which carries no damage half at all", () => {
    const wire = attackEventData({
      attacker: "V",
      target: "Vex",
      hit: false,
      margin: -3,
      weapon: "Heavy Pistol",
      ammo: { inventoryId: "weapon-2", before: 6, after: 5 },
    });

    const read = readAttackEventData(wire);
    expect(read?.hit).toBe(false);
    // A miss still spends a round, and the receipt has to show that.
    expect(read?.ammo).toEqual({ inventoryId: "weapon-2", before: 6, after: 5 });
    // Absent, not zero: nothing was applied, so there is no number to report.
    expect(read?.hpBefore).toBeNull();
    expect(read?.hpAfter).toBeNull();
    expect(read?.spBefore).toBeNull();
    expect(read?.throughArmor).toBeNull();
    expect(read?.ablated).toBe(false);
    expect(read?.criticalInjury).toBe(false);
  });

  it("carries a head hit as a head hit", () => {
    const wire = attackEventData({
      attacker: "Vex",
      target: "V",
      hit: true,
      margin: 9,
      applied: { ...APPLIED, armorLocation: "head" },
    });
    expect(readAttackEventData(wire)?.armorLocation).toBe("head");
  });

  it("carries a critical injury", () => {
    const wire = attackEventData({
      attacker: "Vex",
      target: "V",
      hit: true,
      margin: 12,
      applied: { ...APPLIED, criticalInjury: true },
    });
    expect(readAttackEventData(wire)?.criticalInjury).toBe(true);
  });
});

describe("the attack parser on payloads that are not well-formed", () => {
  it("refuses a row with no attacker or no target", () => {
    // These two are the identity of the row. Without them there is nothing to
    // price and no way to tell whose HP moved.
    expect(readAttackEventData({ target: "V", hit: true })).toBeNull();
    expect(readAttackEventData({ attacker: "Vex", hit: true })).toBeNull();
    expect(readAttackEventData({ attacker: 7, target: "V" })).toBeNull();
  });

  it("refuses something that is not an object", () => {
    expect(readAttackEventData(null)).toBeNull();
    expect(readAttackEventData("attack")).toBeNull();
    expect(readAttackEventData([{ attacker: "Vex", target: "V" }])).toBeNull();
  });

  it("keeps the damage of a row that never said whether it hit", () => {
    // The regression this file exists to prevent, in miniature: dropping the
    // row because one field is missing loses the HP with it, and the job then
    // settles as though the player was never shot.
    const read = readAttackEventData({
      attacker: "Vex",
      target: "V",
      hp_before: 40,
      hp_after: 34,
      sp_before: 11,
      sp_after: 10,
    });
    expect(read).not.toBeNull();
    expect(read?.hit).toBeNull();
    expect(read?.hpBefore).toBe(40);
    expect(read?.hpAfter).toBe(34);
  });

  it("ignores a half-written ammo bag rather than inventing a magazine", () => {
    const read = readAttackEventData({
      attacker: "V",
      target: "Vex",
      hit: true,
      ammo: { inventoryId: "weapon-1", before: 8 },
    });
    expect(read?.ammo).toBeNull();
  });

  it("treats a non-finite number as absent", () => {
    // JSON has no NaN, but a payload assembled in memory can carry one, and a
    // NaN in the receipt arithmetic is worse than a missing row.
    const read = readAttackEventData({
      attacker: "Vex",
      target: "V",
      hit: true,
      hp_before: Number.NaN,
      hp_after: 34,
    });
    expect(read?.hpBefore).toBeNull();
    expect(read?.hpAfter).toBe(34);
  });

  it("defaults an unlocated hit to the body", () => {
    const read = readAttackEventData({ attacker: "Vex", target: "V", hit: true });
    expect(read?.armorLocation).toBe("body");
    expect(
      readAttackEventData({ attacker: "Vex", target: "V", armor_location: "leg" })?.armorLocation,
    ).toBe("body");
  });
});

describe("a Death Save survives the round trip", () => {
  it("reads back a death", () => {
    const read = readDeathSaveEventData(deathSaveEventData({ combatant: "Vex", died: true }));
    expect(read).toEqual({ combatant: "Vex", died: true, survived: false });
  });

  it("reads back a survival", () => {
    const read = readDeathSaveEventData(deathSaveEventData({ combatant: "V", died: false }));
    expect(read).toEqual({ combatant: "V", died: false, survived: true });
  });

  it("refuses a row with no combatant or no verdict", () => {
    expect(readDeathSaveEventData({ died: true })).toBeNull();
    expect(readDeathSaveEventData({ combatant: "Vex" })).toBeNull();
    expect(readDeathSaveEventData(undefined)).toBeNull();
  });
});

describe("the read-only payloads", () => {
  it("reads a skill check under either spelling of the skill id", () => {
    // The ledger has rows in both, so the parser takes both rather than one
    // half of the history reading as no check at all.
    expect(readSkillCheckEventData({ skill_id: "stealth", success: false })).toEqual({
      skillId: "stealth",
      success: false,
    });
    expect(readSkillCheckEventData({ skillId: "stealth", success: true })).toEqual({
      skillId: "stealth",
      success: true,
    });
  });

  it("reports an undecided check as null rather than as a failure", () => {
    // A prompt that was never rolled is not a blown Stealth check, and pricing
    // it as one would put heat on the player for something they never did.
    expect(readSkillCheckEventData({ skill_id: "stealth" })?.success).toBeNull();
  });

  it("refuses a skill check with no skill", () => {
    expect(readSkillCheckEventData({ success: false })).toBeNull();
  });

  it("reads whether backup answered", () => {
    expect(readBackupCalledEventData({ responded: true })).toEqual({ responded: true });
    expect(readBackupCalledEventData({ responded: false })).toEqual({ responded: false });
    // A call with no answer recorded is not a call that was answered.
    expect(readBackupCalledEventData({})).toBeNull();
  });
});

describe("payloadOf", () => {
  it("reads the data bag off an event", () => {
    expect(payloadOf({ data: { a: 1 } })).toEqual({ a: 1 });
  });

  it("treats a missing, null or array payload as empty rather than throwing", () => {
    expect(payloadOf({})).toEqual({});
    expect(payloadOf({ data: null })).toEqual({});
    expect(payloadOf({ data: [1, 2] })).toEqual({});
    expect(payloadOf({ data: "words" })).toEqual({});
  });
});
