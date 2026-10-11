import { describe, expect, it } from "vitest";
import {
  MAX_ACTION_MINUTES,
  TIME_COSTS,
  advanceClock,
  clampActionMinutes,
  formatDuration,
  formatLifeClock,
  formatTimeOfDay,
  partOfDay,
  weekdayFor,
} from "../clock";

describe("the campaign clock", () => {
  it("rolls over midnight into the next day", () => {
    expect(advanceClock({ day: 1, minute: 23 * 60 + 30 }, 45)).toEqual({ day: 2, minute: 15 });
    expect(advanceClock({ day: 1, minute: 0 }, 3 * 24 * 60)).toEqual({ day: 4, minute: 0 });
  });

  it("never runs backwards, and a duration that is not a number moves nothing", () => {
    const at = { day: 3, minute: 600 };
    expect(advanceClock(at, -90)).toEqual(at);
    expect(advanceClock(at, Number.NaN)).toEqual(at);
    expect(advanceClock(at, Number.POSITIVE_INFINITY)).toEqual(at);
  });

  it("clamps what one action may cost", () => {
    expect(clampActionMinutes(Number.NaN)).toBe(TIME_COSTS.quick);
    expect(clampActionMinutes(-5)).toBe(0);
    expect(clampActionMinutes(10_000)).toBe(MAX_ACTION_MINUTES);
    expect(clampActionMinutes(12.6)).toBe(13);
  });

  it("names the day of the week, day 1 being a Monday, for any day", () => {
    expect(weekdayFor(1)).toBe("Monday");
    expect(weekdayFor(7)).toBe("Sunday");
    expect(weekdayFor(8)).toBe("Monday");
    expect(weekdayFor(0)).toBe("Sunday");
    expect(weekdayFor(-6)).toBe("Monday");
  });

  it("formats the time of day and the clock line", () => {
    expect(formatTimeOfDay(0)).toBe("12:00 AM");
    expect(formatTimeOfDay(12 * 60 + 5)).toBe("12:05 PM");
    expect(formatTimeOfDay(-60)).toBe("11:00 PM");
    expect(formatLifeClock({ day: 2, minute: 9 * 60 })).toBe("TUESDAY · 9:00 AM");
  });

  it("says how long something took", () => {
    expect(formatDuration(0)).toBe("no time");
    expect(formatDuration(45)).toBe("45 min");
    expect(formatDuration(60)).toBe("1 hr");
    expect(formatDuration(150)).toBe("2 hrs 30 min");
  });

  it("splits the day at six, noon and six", () => {
    expect(partOfDay(5 * 60 + 59)).toBe("night");
    expect(partOfDay(6 * 60)).toBe("morning");
    expect(partOfDay(12 * 60)).toBe("afternoon");
    expect(partOfDay(18 * 60)).toBe("evening");
    expect(partOfDay(23 * 60 + 59)).not.toBe("morning");
  });
});
