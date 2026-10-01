import { describe, expect, it } from "vitest";
import {
  FLASH_FADE_MS,
  STORM_HORIZON_MS,
  STORM_SEED,
  flashAt,
  stormIntensity,
  strikeTimes,
} from "../landingStorm";

describe("strikeTimes", () => {
  const strikes = strikeTimes(STORM_SEED, 120_000);

  it("is the same night every visit", () => {
    expect(strikeTimes(STORM_SEED, 120_000)).toEqual(strikes);
    expect(strikeTimes(STORM_SEED + 1, 120_000)).not.toEqual(strikes);
  });

  it("waits a few seconds, then strikes every so often, in order", () => {
    expect(strikes[0]!.at).toBeGreaterThan(3000);
    expect(strikes.length).toBeGreaterThan(5);
    for (let i = 1; i < strikes.length; i++) {
      expect(strikes[i]!.at).toBeGreaterThan(strikes[i - 1]!.at);
    }
    for (const s of strikes) {
      expect(s.power).toBeGreaterThan(0.3);
      expect(s.power).toBeLessThanOrEqual(1);
    }
  });

  it("never lets a quiet stretch run longer than half a minute", () => {
    const main = strikes.filter((s) => s.power >= 0.7);
    for (let i = 1; i < main.length; i++) {
      expect(main[i]!.at - main[i - 1]!.at).toBeLessThan(15_500);
    }
    expect(strikeTimes(STORM_SEED, STORM_HORIZON_MS).length).toBeLessThan(2000);
  });
});

describe("flashAt", () => {
  const strikes = strikeTimes(STORM_SEED, 60_000);
  it("is dark between strikes and brightest as one lands", () => {
    expect(flashAt(0, strikes)).toBe(0);
    const first = strikes[0]!;
    expect(flashAt(first.at, strikes)).toBeCloseTo(first.power, 5);
    expect(flashAt(first.at + FLASH_FADE_MS / 2, strikes)).toBeLessThan(first.power);
    expect(flashAt(first.at - 1, strikes)).toBe(0);
  });
  it("stays in 0..1 throughout", () => {
    for (let ms = 0; ms < 60_000; ms += 20) {
      const v = flashAt(ms, strikes);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });
});

describe("stormIntensity", () => {
  it("is a steady downpour, never a drizzle and never everything", () => {
    for (let ms = 0; ms < 120_000; ms += 500) {
      expect(stormIntensity(ms)).toBeGreaterThan(0.4);
      expect(stormIntensity(ms)).toBeLessThan(0.7);
    }
  });
});
