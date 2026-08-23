import { describe, expect, it } from "vitest";
import { deriveStats } from "../derived";
import {
  CAMPAIGN_START_CLOCK,
  CAMPAIGN_STATUSES,
  MISSION_STATUSES,
  NPC_STATUSES,
  WOUND_STATE_CODES,
  clampDisposition,
  formatClock,
  startingVitals,
  woundStateFor,
} from "../campaign";
import type { StatBlock } from "../types";

// A concrete character to make the wound-state boundaries meaningful:
// BODY 6, WILL 6 -> hpMax 40, seriouslyWoundedThreshold 20.
const stats: StatBlock = {
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
const derived = deriveStats(stats);

describe("status vocabularies mirror the DB CHECK constraints", () => {
  it("lists the exact allowed values", () => {
    expect([...CAMPAIGN_STATUSES]).toEqual(["active", "won", "lost", "abandoned"]);
    expect([...MISSION_STATUSES]).toEqual(["active", "completed", "failed", "abandoned"]);
    expect([...WOUND_STATE_CODES]).toEqual(["none", "light", "serious", "mortal"]);
    expect([...NPC_STATUSES]).toEqual(["alive", "dead", "fled", "unknown"]);
  });
});

describe("woundStateFor", () => {
  const { hpMax, seriouslyWoundedThreshold: swt } = derived; // 40, 20

  it("is 'none' only at full HP", () => {
    expect(woundStateFor(hpMax, hpMax, swt)).toBe("none");
  });

  it("is 'light' below max but above the Seriously Wounded threshold", () => {
    expect(woundStateFor(hpMax - 1, hpMax, swt)).toBe("light");
    expect(woundStateFor(swt + 1, hpMax, swt)).toBe("light");
  });

  it("is 'serious' at or below half HP but above zero", () => {
    expect(woundStateFor(swt, hpMax, swt)).toBe("serious");
    expect(woundStateFor(1, hpMax, swt)).toBe("serious");
  });

  it("is 'mortal' at zero HP or below", () => {
    expect(woundStateFor(0, hpMax, swt)).toBe("mortal");
    expect(woundStateFor(-8, hpMax, swt)).toBe("mortal");
  });
});

describe("startingVitals", () => {
  it("enters the world at full HP, unwounded, no failed saves", () => {
    const vitals = startingVitals({
      hpMax: derived.hpMax,
      seriouslyWoundedThreshold: derived.seriouslyWoundedThreshold,
      humanityCurrent: 58,
      humanityMax: derived.humanityMax,
      eurobucks: 1030,
    });

    expect(vitals).toEqual({
      hpCurrent: 40,
      hpMax: 40,
      seriouslyWoundedThreshold: 20,
      humanityCurrent: 58,
      humanityMax: 60,
      woundState: "none",
      mortalSaveFailures: 0,
      eurobucks: 1030,
    });
  });

  it("carries the character's reduced Humanity, not the max", () => {
    const vitals = startingVitals({
      hpMax: 40,
      seriouslyWoundedThreshold: 20,
      humanityCurrent: 44, // already cut by starting cyberware
      humanityMax: 60,
      eurobucks: 0,
    });
    expect(vitals.humanityCurrent).toBe(44);
    expect(vitals.humanityMax).toBe(60);
  });
});

describe("formatClock", () => {
  it("formats the default opening clock", () => {
    expect(formatClock(CAMPAIGN_START_CLOCK)).toBe("Day 1, 18:00");
  });

  it("zero-pads hours and minutes", () => {
    expect(formatClock({ day: 3, minute: 5 })).toBe("Day 3, 00:05");
    expect(formatClock({ day: 12, minute: 9 * 60 + 30 })).toBe("Day 12, 09:30");
  });
});

describe("clampDisposition", () => {
  it("clamps into [-3, 3] and rounds to a whole step", () => {
    expect(clampDisposition(9)).toBe(3);
    expect(clampDisposition(-9)).toBe(-3);
    expect(clampDisposition(2.4)).toBe(2);
    expect(clampDisposition(-2.6)).toBe(-3);
    expect(clampDisposition(0)).toBe(0);
  });
});
