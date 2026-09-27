import { describe, expect, it } from "vitest";
import rolesData from "@/data/rules/roles.json";
import {
  PRESET_ROLES,
  SKILL_PACKAGE_RULES,
  SKILL_PRESETS_ARE_HOUSE_RULE,
  checkOdds,
  checkPercent,
  getRoleSkillIds,
  matchingPreset,
  presetEntries,
  presetSkillId,
  presetsFor,
  rolePackageEntries,
  validateSkillEntries,
} from "@/engine";

const ROLE_IDS = Object.keys(rolesData.roles);
const METHODS = ["edgerunner", "complete_package"] as const;

describe("skill presets", () => {
  it("covers every Role with three, and is a house rule", () => {
    expect(SKILL_PRESETS_ARE_HOUSE_RULE).toBe(true);
    expect([...PRESET_ROLES].sort()).toEqual([...ROLE_IDS].sort());
    for (const role of ROLE_IDS) expect(presetsFor(role), role).toHaveLength(3);
  });

  it("names only Skills on that Role's printed list", () => {
    for (const role of ROLE_IDS) {
      const list = new Set(getRoleSkillIds(role));
      for (const preset of presetsFor(role)) {
        for (const name of [...preset.focus, ...preset.support]) {
          const id = presetSkillId(name);
          expect(id, `${role}/${preset.id}: ${name}`).toBeDefined();
          expect(list.has(id!), `${role}/${preset.id}: ${name}`).toBe(true);
        }
        expect(new Set([...preset.focus, ...preset.support]).size).toBe(
          preset.focus.length + preset.support.length,
        );
      }
    }
  });

  it("makes a sheet the printed validators accept, for every Role, preset and method", () => {
    for (const role of ROLE_IDS) {
      for (const preset of presetsFor(role)) {
        for (const method of METHODS) {
          const entries = presetEntries({ method, roleId: role, preset });
          const result = validateSkillEntries({ method, roleId: role, entries });
          expect(result.violations, `${role}/${preset.id}/${method}`).toEqual([]);
          expect(result.pointsSpent).toBe(SKILL_PACKAGE_RULES.edgerunner.skillPoints);
        }
      }
    }
  });

  it("puts what the preset is about at the top", () => {
    for (const role of ROLE_IDS) {
      for (const preset of presetsFor(role)) {
        const entries = presetEntries({ method: "edgerunner", roleId: role, preset });
        const level = (name: string) =>
          entries.find((e) => e.skillId === presetSkillId(name))!.level;
        for (const name of preset.focus) {
          expect(level(name), `${role}/${preset.id}: ${name}`).toBe(
            SKILL_PACKAGE_RULES.edgerunner.maxLevel,
          );
        }
        for (const name of preset.support) {
          expect(level(name), `${role}/${preset.id}: ${name}`).toBeGreaterThanOrEqual(4);
        }
      }
    }
  });

  it("makes three genuinely different characters per Role", () => {
    for (const role of ROLE_IDS) {
      const sheets = presetsFor(role).map((preset) =>
        presetEntries({ method: "edgerunner", roleId: role, preset })
          .map((e) => e.level)
          .join(),
      );
      expect(new Set(sheets).size, role).toBe(3);
    }
  });

  it("keeps a specialization the player already chose", () => {
    const current = rolePackageEntries("rockerboy").map((e) =>
      e.skillId === presetSkillId("Play Instrument") ? { ...e, specialization: "Guitar" } : e,
    );
    const preset = presetsFor("rockerboy")[0]!;
    const entries = presetEntries({ method: "edgerunner", roleId: "rockerboy", preset, current });
    expect(
      entries.find((e) => e.skillId === presetSkillId("Play Instrument"))!.specialization,
    ).toBe("Guitar");
  });

  it("recognises its own sheet, and stops the moment a point moves", () => {
    const preset = presetsFor("solo")[1]!;
    const entries = presetEntries({ method: "edgerunner", roleId: "solo", preset });
    expect(matchingPreset({ method: "edgerunner", roleId: "solo", entries })?.id).toBe(preset.id);
    const moved = entries.map((e, i) => (i === 0 ? { ...e, level: e.level + 1 } : e));
    expect(matchingPreset({ method: "edgerunner", roleId: "solo", entries: moved })).toBeNull();
  });
});

describe("check odds", () => {
  /** Every (die, critical die) pair, rolled out the long way. */
  function bruteForce(base: number, dv: number): number {
    let hits = 0;
    for (let d = 1; d <= 10; d += 1) {
      for (let c = 1; c <= 10; c += 1) {
        let total = base + d;
        if (d === 10) total += c;
        if (d === 1) total -= c;
        if (total >= dv) hits += 1;
      }
    }
    return hits / 100;
  }

  it("matches the dice for every base and DV a character can meet", () => {
    for (let base = 0; base <= 20; base += 1) {
      for (const dv of [9, 13, 15, 17, 21, 24, 29]) {
        expect(checkOdds(base, dv)).toBeCloseTo(bruteForce(base, dv), 10);
      }
    }
  });

  it("reads the way a table would expect", () => {
    // STAT 6 + Skill 6 against Professional: an 5 or better on the die.
    expect(checkPercent(12, 17)).toBe(60);
    // Nothing is certain: a natural 1 can still sink a strong hand.
    expect(checkOdds(20, 13)).toBeLessThan(1);
    // And nothing is hopeless while a 10 can explode.
    expect(checkOdds(0, 13)).toBeGreaterThan(0);
  });
});
