import { describe, expect, it } from "vitest";
import { assembleCharacter } from "../characterSheet";
import { packageCyberwareHumanityRolls } from "../gearPackages";
import { EMPTY_LOADOUT } from "../loadout";
import type { StatBlock } from "../types";

const STATS: StatBlock = {
  int: 6,
  ref: 6,
  dex: 6,
  tech: 6,
  cool: 6,
  will: 6,
  luck: 6,
  move: 6,
  body: 6,
  emp: 6,
};

/**
 * Streetrat/Edgerunner Roles are issued fixed cyberware (pg. 117) that costs
 * Humanity at creation. The per-role totals here are the book's own printed
 * numbers and double as extraction checksums.
 */
describe("package cyberware Humanity Loss", () => {
  const EXPECTED: Record<string, number> = {
    rockerboy: 9,
    solo: 14,
    netrunner: 14,
    tech: 12,
    medtech: 12,
    media: 10,
    lawman: 10,
    exec: 12,
    fixer: 16,
    nomad: 14,
  };

  it("matches every Role's printed Humanity Loss total", () => {
    for (const [role, total] of Object.entries(EXPECTED)) {
      const rolls = packageCyberwareHumanityRolls(role, "streetrat", {});
      expect(rolls.reduce((a, b) => a + b, 0)).toBe(total);
    }
  });

  it("applies package Humanity Loss to the assembled sheet", () => {
    const sheet = assembleCharacter({
      method: "streetrat",
      roleId: "solo",
      roleAbility: null,
      name: "Test",
      handle: "",
      pronouns: "",
      selfDescription: "",
      portraitId: null,
      stats: STATS,
      skills: [],
      loadout: EMPTY_LOADOUT,
      lifestyleLocation: null,
    });
    expect(sheet.humanity?.humanityLost).toBe(14);
    expect(sheet.humanity?.humanitySheet).toBe((sheet.derived?.humanityMax ?? 0) - 14);
  });

  it("charges no package Humanity to Complete Package characters", () => {
    expect(packageCyberwareHumanityRolls("solo", "complete_package", {})).toEqual([]);
  });

  it("resolves an either/or choice to the selected option", () => {
    // Solo choice cyberware.1 is Sandevistan or Wolvers; both cost 7, so the
    // total is stable, but the selection must still resolve to a real piece.
    const withWolvers = packageCyberwareHumanityRolls("solo", "streetrat", {
      "cyberware.1": "Wolvers",
    });
    expect(withWolvers.reduce((a, b) => a + b, 0)).toBe(14);
  });
});
