import { describe, expect, it } from "vitest";
import { deriveStats, empFromHumanity, hitPointsMax } from "../derived";
import { derivedStatColumns } from "../derivedColumns";
import { HP_TABLE_DATA } from "../rulesData";
import { humanityMax } from "../derived";
import type { StatBlock } from "../types";

const stats: StatBlock = {
  int: 6,
  ref: 7,
  dex: 6,
  tech: 4,
  cool: 5,
  will: 6,
  luck: 5,
  move: 6,
  body: 7,
  emp: 6,
};

describe("derived stats", () => {
  it("computes HP from BODY and WILL", () => {
    expect(hitPointsMax(7, 6)).toBe(45);
    expect(hitPointsMax(2, 2)).toBe(20);
  });

  it("derives the whole block", () => {
    expect(deriveStats(stats)).toEqual({
      hpMax: 45,
      seriouslyWoundedThreshold: 23,
      deathSave: 7,
      humanityMax: 60,
    });
  });

  it("floors EMP from remaining Humanity", () => {
    expect(empFromHumanity(59)).toBe(5);
    expect(empFromHumanity(60)).toBe(6);
  });

  it("matches every cell of the published Hit Points table", () => {
    const table = HP_TABLE_DATA.table as unknown as Record<string, Record<string, number>>;
    for (const [body, row] of Object.entries(table)) {
      for (const [will, hp] of Object.entries(row)) {
        expect(hitPointsMax(Number(body), Number(will))).toBe(hp);
      }
    }
  });

  it("gives BODY 6 / WILL 6 → 40 HP, SW 20, Death Save 6", () => {
    const block: StatBlock = { ...stats, body: 6, will: 6 };
    const derived = deriveStats(block);
    expect(derived.hpMax).toBe(40);
    expect(derived.seriouslyWoundedThreshold).toBe(20);
    expect(derived.deathSave).toBe(6);
  });

  it("gives EMP 5 → 50 Humanity, and 39 Humanity → EMP 3", () => {
    expect(humanityMax(5)).toBe(50);
    expect(empFromHumanity(39)).toBe(3);
  });

  it("emits the exact column shape the backend persists", () => {
    const block: StatBlock = { ...stats, body: 6, will: 6, emp: 5 };
    expect(derivedStatColumns(block)).toEqual({
      hp_max: 40,
      seriously_wounded_threshold: 20,
      death_save: 6,
      humanity_max: 50,
    });
  });
});