/**
 * The harness's only real logic. Everything else in seedEncounter.ts is
 * orchestration of calls the play loop already makes; these two are the places
 * it could be quietly wrong.
 */
import { describe, expect, it, vi } from "vitest";

// The module reaches the backend adapter at import time. Nothing here calls it.
vi.mock("@/lib/backend", () => ({
  getActiveCampaignForCharacter: vi.fn(),
  getActiveEncounter: vi.fn(),
  getCampaign: vi.fn(),
  getCharacter: vi.fn(),
  setCampaignPhase: vi.fn(),
  setInventoryAmmo: vi.fn(),
  updateCampaign: vi.fn(),
  updateCampaignVitals: vi.fn(),
  updateEncounter: vi.fn(),
}));
vi.mock("@/features/campaign/missionState", () => ({ saveMissionRuntime: vi.fn() }));
vi.mock("@/features/campaign/newCampaign", () => ({ startCampaignForCharacter: vi.fn() }));
vi.mock("@/features/play/combatFlow", () => ({ beginEncounter: vi.fn() }));

const { enemiesFrom, hpForWound, previewForce } = await import("../seedEncounter");
const { woundStateFor } = await import("@/engine");

describe("hpForWound", () => {
  // A spread of real-ish sheets: RED thresholds are ceil(hpMax / 2).
  const sheets = [
    { hpMax: 25, threshold: 13 },
    { hpMax: 35, threshold: 18 },
    { hpMax: 40, threshold: 20 },
    { hpMax: 60, threshold: 30 },
  ];

  it("lands on the wound state it was asked for, on every sheet", () => {
    for (const { hpMax, threshold } of sheets) {
      for (const wound of ["none", "light", "serious", "mortal"] as const) {
        const hp = hpForWound(wound, hpMax, threshold);
        // Checked against the engine, not against a second copy of the rule:
        // this is the whole reason the helper asks rather than asserts.
        expect(woundStateFor(hp, hpMax, threshold)).toBe(wound);
      }
    }
  });

  it("starts an unhurt character at full HP", () => {
    expect(hpForWound("none", 40, 20)).toBe(40);
  });

  it("puts a Mortally Wounded character on 0, where the Death Save lives", () => {
    expect(hpForWound("mortal", 40, 20)).toBe(0);
  });

  it("puts a Seriously Wounded character below the threshold", () => {
    expect(hpForWound("serious", 40, 20)).toBeLessThan(20);
  });

  it("puts a Lightly Wounded character at or above it, but hurt", () => {
    const hp = hpForWound("light", 40, 20);
    expect(hp).toBeGreaterThanOrEqual(20);
    expect(hp).toBeLessThan(40);
  });

  it("throws rather than seeding a fight that disagrees with the rules", () => {
    // A degenerate sheet where "light" has nowhere to sit: hpMax equals the
    // threshold, so anything at or above it is unhurt. Better to fail loudly
    // here than to start a fight labelled one thing and playing as another.
    expect(() => hpForWound("light", 1, 1)).toThrow();
  });
});

describe("enemiesFrom", () => {
  it("hands beginEncounter the keys, names and profiles a GM would", () => {
    const members = previewForce("street_crew", "standard");
    const enemies = enemiesFrom(members);
    expect(enemies).toHaveLength(members.length);
    expect(enemies.length).toBeGreaterThan(0);
    for (const [i, enemy] of enemies.entries()) {
      expect(enemy.key).toBe(members[i]!.key);
      expect(enemy.name).toBe(members[i]!.name);
      // The PROFILE key, never stats: the engine owns what a profile is worth,
      // exactly as it does when the model casts a fight.
      expect(enemy.profile).toBe(members[i]!.profile.key);
      expect(Object.keys(enemy).sort()).toEqual(["key", "name", "profile"]);
    }
  });

  it("scales with the force size, so the picker's preview is the truth", () => {
    const small = previewForce("street_crew", "small").length;
    const heavy = previewForce("street_crew", "heavy").length;
    expect(heavy).toBeGreaterThan(small);
  });
});
