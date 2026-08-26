import { describe, expect, it } from "vitest";
import { describeReload, planReload } from "../reload";
import { WEAPONS } from "../catalog";
import { weaponProfile } from "../weaponProfile";

/** A weapon that actually prints a magazine, and one that does not. */
const GUN = WEAPONS.find((w) => w.magazine !== null && w.magazine >= 6)!;
const MELEE = WEAPONS.find((w) => w.category === "melee")!;
const MAG = weaponProfile(GUN.id).magazine!;

describe("planReload", () => {
  it("fills an empty magazine from spare rounds", () => {
    const plan = planReload({ itemId: GUN.id, loaded: 0, spareRounds: 100 });
    expect(plan).toMatchObject({
      possible: true,
      rounds: MAG,
      loadedAfter: MAG,
      spareAfter: 100 - MAG,
      magazine: MAG,
      reason: null,
    });
  });

  it("tops up a partly full magazine without overfilling it", () => {
    const plan = planReload({ itemId: GUN.id, loaded: MAG - 2, spareRounds: 100 });
    expect(plan.rounds).toBe(2);
    expect(plan.loadedAfter).toBe(MAG);
  });

  it("loads only what the character is actually carrying", () => {
    const plan = planReload({ itemId: GUN.id, loaded: 0, spareRounds: 3 });
    expect(plan.rounds).toBe(3);
    expect(plan.loadedAfter).toBe(3);
    expect(plan.spareAfter).toBe(0);
  });

  it("refuses when the gun is already full, and says so", () => {
    const plan = planReload({ itemId: GUN.id, loaded: MAG, spareRounds: 100 });
    expect(plan.possible).toBe(false);
    expect(plan.rounds).toBe(0);
    expect(plan.reason).toMatch(/already full/);
  });

  it("refuses when there is nothing to load, and says so", () => {
    const plan = planReload({ itemId: GUN.id, loaded: 0, spareRounds: 0 });
    expect(plan.possible).toBe(false);
    expect(plan.reason).toMatch(/No spare rounds/);
  });

  it("treats a magazine nobody has ever tracked as full", () => {
    // A campaign that predates ammunition counting must not have its guns
    // retroactively emptied by the feature that starts counting.
    const plan = planReload({ itemId: GUN.id, loaded: null, spareRounds: 100 });
    expect(plan.possible).toBe(false);
    expect(plan.reason).toMatch(/already full/);
  });

  it("refuses a weapon with nothing to reload", () => {
    const plan = planReload({ itemId: MELEE.id, loaded: null, spareRounds: 100 });
    expect(plan.possible).toBe(false);
    expect(plan.magazine).toBeNull();
    expect(plan.reason).toMatch(/nothing to reload/);
  });

  it("refuses something that is not a weapon at all", () => {
    const plan = planReload({ itemId: "a_ham_sandwich", loaded: 0, spareRounds: 10 });
    expect(plan.possible).toBe(false);
    expect(plan.reason).toMatch(/not a weapon/);
  });

  it("never invents rounds, whatever nonsense it is handed", () => {
    for (const [loaded, spare] of [
      [-5, 10],
      [999, 10],
      [0, -10],
      [MAG + 50, 0],
    ]) {
      const plan = planReload({ itemId: GUN.id, loaded: loaded!, spareRounds: spare! });
      expect(plan.rounds).toBeGreaterThanOrEqual(0);
      expect(plan.loadedAfter).toBeLessThanOrEqual(MAG);
      expect(plan.loadedAfter).toBeGreaterThanOrEqual(0);
      expect(plan.spareAfter).toBeGreaterThanOrEqual(0);
    }
  });

  it("conserves rounds: what leaves the pocket enters the gun", () => {
    for (let loaded = 0; loaded <= MAG; loaded += 1) {
      for (const spare of [0, 1, 5, 500]) {
        const plan = planReload({ itemId: GUN.id, loaded, spareRounds: spare });
        expect(plan.loadedAfter - loaded).toBe(plan.rounds);
        expect(spare - plan.spareAfter).toBe(plan.rounds);
      }
    }
  });
});

describe("describeReload", () => {
  it("reads as a ledger line with the arithmetic in it", () => {
    const plan = planReload({ itemId: GUN.id, loaded: 0, spareRounds: 100 });
    const line = describeReload(GUN.id, plan);
    expect(line).toContain(weaponProfile(GUN.id).name);
    expect(line).toContain(`${MAG}/${MAG}`);
  });

  it("says round, not rounds, for one", () => {
    const plan = planReload({ itemId: GUN.id, loaded: MAG - 1, spareRounds: 5 });
    expect(describeReload(GUN.id, plan)).toContain("1 round,");
  });

  it("falls back to the id rather than throwing on something unknown", () => {
    const plan = planReload({ itemId: "nope", loaded: 0, spareRounds: 1 });
    expect(describeReload("nope", plan)).toContain("nope");
  });
});
