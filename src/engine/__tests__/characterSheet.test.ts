import { describe, expect, it } from "vitest";
import { assembleCharacter } from "../characterSheet";
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
  emp: 5,
};

function build(overrides: Partial<Parameters<typeof assembleCharacter>[0]> = {}) {
  return assembleCharacter({
    method: "complete_package",
    roleId: "solo",
    roleAbility: null,
    name: "Test",
    handle: "",
    pronouns: "",
    selfDescription: "",
    portraitId: null,
    stats: STATS,
    skills: [{ skillId: "athletics", level: 4, specialization: null }],
    loadout: EMPTY_LOADOUT,
    lifestyleLocation: null,
    ...overrides,
  });
}

describe("assembleCharacter", () => {
  it("derives from the engine, not by hand", () => {
    const sheet = build();
    expect(sheet.statsComplete).toBe(true);
    expect(sheet.derived?.hpMax).toBe(40);
    expect(sheet.derivedColumns?.seriously_wounded_threshold).toBe(20);
    expect(sheet.derived?.humanityMax).toBe(50);
  });

  it("computes Skill Base as STAT + Level", () => {
    const line = build().skills[0]!;
    expect(line.stat).toBe("dex");
    expect(line.base).toBe(STATS.dex + 4);
  });

  it("reports incomplete STATs instead of guessing", () => {
    const sheet = build({ stats: { body: 6 } });
    expect(sheet.statsComplete).toBe(false);
    expect(sheet.derived).toBeNull();
    expect(sheet.skills[0]!.base).toBeNull();
  });
});
