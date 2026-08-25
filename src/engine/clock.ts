/**
 * The in-world clock as a real resource.
 *
 * Campaigns already carry {day, minute} (see campaign.ts); this module is the
 * single place minutes are added to it, so every Life action, rest and sleep
 * moves the same clock the same way.
 *
 * TIME_COSTS are APP PACING CONSTANTS, not Cyberpunk RED rules values. No
 * printed rule states how long a phone call takes; these numbers exist purely
 * so that time can be spent, and they are never presented as rules.
 */
import type { GameClock } from "./campaign";

export const MINUTES_PER_DAY = 24 * 60;

export const WEEKDAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;
export type Weekday = (typeof WEEKDAYS)[number];

/** Day 1 is a Monday. */
export function weekdayFor(day: number): Weekday {
  const index = ((Math.trunc(day) - 1) % 7 + 7) % 7;
  return WEEKDAYS[index] as Weekday;
}

/** Named pacing costs, in minutes. App constants — see the module note. */
export const TIME_COSTS = {
  quick: 5,
  call: 15,
  conversation: 20,
  errand: 45,
  travel: 40,
  shopping: 90,
  repair: 180,
  evening: 240,
  sleep: 480,
} as const;
export type TimeCostKey = keyof typeof TIME_COSTS;

/** Longest single action the Life loop will accept, so one turn cannot eat a week. */
export const MAX_ACTION_MINUTES = 12 * 60;

export function clampActionMinutes(minutes: number): number {
  if (!Number.isFinite(minutes)) return TIME_COSTS.quick;
  return Math.max(0, Math.min(MAX_ACTION_MINUTES, Math.round(minutes)));
}

/** Advance the clock, rolling minutes into whole days. */
export function advanceClock(clock: GameClock, minutes: number): GameClock {
  const total = clock.day * MINUTES_PER_DAY + clock.minute + Math.max(0, Math.round(minutes));
  return {
    day: Math.floor(total / MINUTES_PER_DAY),
    minute: total % MINUTES_PER_DAY,
  };
}

/** Whole days between two clocks (never negative). */
export function daysBetween(from: GameClock, to: GameClock): number {
  return Math.max(0, to.day - from.day);
}

/** "8:40 PM" */
export function formatTimeOfDay(minute: number): string {
  const m = ((Math.round(minute) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const hours24 = Math.floor(m / 60);
  const mins = m % 60;
  const suffix = hours24 < 12 ? "AM" : "PM";
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${hours12}:${String(mins).padStart(2, "0")} ${suffix}`;
}

/** "TUESDAY · 8:40 PM" — the status bar's clock. */
export function formatLifeClock(clock: GameClock): string {
  return `${weekdayFor(clock.day).toUpperCase()} · ${formatTimeOfDay(clock.minute)}`;
}

/** "20 min" / "2 hrs" / "3 hrs 30 min" — how long an action will take. */
export function formatDuration(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  if (m === 0) return "no time";
  if (m < 60) return `${m} min`;
  const hours = Math.floor(m / 60);
  const rest = m % 60;
  const hourPart = `${hours} hr${hours === 1 ? "" : "s"}`;
  return rest ? `${hourPart} ${rest} min` : hourPart;
}

/** Roughly what part of the day it is — used to keep Life situations plausible. */
export function partOfDay(minute: number): "night" | "morning" | "afternoon" | "evening" {
  const hour = Math.floor((((minute % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY) / 60);
  if (hour < 6) return "night";
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  if (hour < 23) return "evening";
  return "night";
}
