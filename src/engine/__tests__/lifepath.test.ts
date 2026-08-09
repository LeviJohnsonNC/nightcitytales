import { describe, expect, it } from "vitest";
import {
  LIFEPATH_COUNT_RULE,
  LIFEPATH_ORDER,
  chooseLifepathEntry,
  getLifepathTable,
  languagesForCulturalOrigin,
  lifepathEntryForRoll,
  rollEnemy,
  rollLifepathCount,
  rollLifepathTable,
  seededRng,
} from "..";

describe("general lifepath data", () => {
  it("exposes every table named in _order", () => {
    expect(LIFEPATH_ORDER).toHaveLength(19);
    for (const id of LIFEPATH_ORDER) expect(getLifepathTable(id).entries.length).toBeGreaterThan(0);
  });

  it("resolves sweet_revenge through its printed ranges", () => {
    const table = getLifepathTable("sweet_revenge");
    expect(table.usesRanges).toBe(true);
    expect(table.entries).toHaveLength(6);
    expect(lifepathEntryForRoll("sweet_revenge", 1).value).toBe(
      lifepathEntryForRoll("sweet_revenge", 2).value,
    );
    expect(lifepathEntryForRoll("sweet_revenge", 9).label).toBe("9");
    for (let roll = 1; roll <= 10; roll += 1) {
      expect(lifepathEntryForRoll("sweet_revenge", roll).value).toBeTruthy();
    }
  });

  it("reads flat tables as 1-10", () => {
    for (let roll = 1; roll <= 10; roll += 1) {
      expect(lifepathEntryForRoll("personality", roll).rollMin).toBe(roll);
    }
  });

  it("lists languages for a Cultural Origin region", () => {
    const region = lifepathEntryForRoll("cultural_origin", 6);
    expect(languagesForCulturalOrigin(region.value).length).toBeGreaterThan(0);
  });
});

describe("lifepath rolling", () => {
  it("records rolled vs chosen", () => {
    const rolled = rollLifepathTable("personality", seededRng(7)).entry;
    expect(rolled.method).toBe("rolled");
    expect(typeof rolled.roll).toBe("number");

    const value = getLifepathTable("personality").entries[3]!.value;
    const chosen = chooseLifepathEntry("personality", value);
    expect(chosen).toEqual({ tableId: "personality", value, method: "chosen", roll: null });
  });

  it("rejects a choice that is not on the table", () => {
    expect(() => chooseLifepathEntry("personality", "Nope")).toThrow();
  });

  it("applies the 1d10 - 7, minimum 0 count roll", () => {
    expect(LIFEPATH_COUNT_RULE).toEqual({ subtract: 7, minimum: 0 });
    for (let seed = 0; seed < 40; seed += 1) {
      const { count, result } = rollLifepathCount(seededRng(seed));
      expect(count).toBe(Math.max(0, result.rolls[0]! - 7));
      expect(count).toBeGreaterThanOrEqual(0);
    }
  });

  it("builds an enemy from four linked rolls plus a choice", () => {
    const enemy = rollEnemy(seededRng(3));
    expect(enemy.who.tableId).toBe("enemy_who");
    expect(enemy.cause.tableId).toBe("enemy_cause");
    expect(enemy.throwAtYou.tableId).toBe("enemy_throw");
    expect(enemy.revenge.tableId).toBe("sweet_revenge");
    expect(enemy.injuredParty).toBeNull();
  });

  it("is reproducible under a seeded rng", () => {
    expect(rollLifepathTable("life_goals", seededRng(11)).entry).toEqual(
      rollLifepathTable("life_goals", seededRng(11)).entry,
    );
  });
});
