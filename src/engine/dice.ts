import type { RNG } from "./types";
import { buildRollResult, type RollModifier, type RollResult } from "./rollLog";

export const defaultRng: RNG = () => Math.random();

/** Roll a single die with `sides` faces. */
export function rollDie(sides: number, rng: RNG = defaultRng): number {
  if (!Number.isInteger(sides) || sides < 1) {
    throw new Error(`rollDie: sides must be a positive integer, got ${sides}`);
  }
  return Math.floor(rng() * sides) + 1;
}

/** Roll `count` dice with `sides` faces and return each result. */
export function rollDice(count: number, sides: number, rng: RNG = defaultRng): number[] {
  if (!Number.isInteger(count) || count < 0) {
    throw new Error(`rollDice: count must be a non-negative integer, got ${count}`);
  }
  return Array.from({ length: count }, () => rollDie(sides, rng));
}

export function roll(count: number, sides: number, rng: RNG = defaultRng): number {
  return rollDice(count, sides, rng).reduce((sum, n) => sum + n, 0);
}

export const d6 = (rng: RNG = defaultRng) => rollDie(6, rng);
export const d10 = (rng: RNG = defaultRng) => rollDie(10, rng);

/**
 * Cyberpunk RED exploding/imploding d10 check: a natural 10 adds another d10,
 * a natural 1 subtracts another d10. Only one critical step, per the rules —
 * a second 10 or 1 on the critical die does NOT chain.
 */
export type CheckResult = RollResult & {
  base: number;
  critical: "success" | "failure" | null;
  criticalDie: number | null;
  /** Sum of the supplied modifiers, excluding the critical die. */
  modifier: number;
};

export type CheckOptions = {
  dv?: number | null;
  now?: () => Date;
};

export function statSkillCheck(
  modifier: number | RollModifier[],
  rng: RNG = defaultRng,
  options: CheckOptions = {},
): CheckResult {
  const supplied: RollModifier[] =
    typeof modifier === "number"
      ? modifier === 0
        ? []
        : [{ label: "Modifier", value: modifier }]
      : modifier;
  const modifierTotal = supplied.reduce((sum, m) => sum + m.value, 0);

  const base = d10(rng);
  const rolls = [base];
  const modifiers = [...supplied];
  let critical: "success" | "failure" | null = null;
  let criticalDie: number | null = null;

  if (base === 10 || base === 1) {
    criticalDie = d10(rng); // single step only — crits never chain
    critical = base === 10 ? "success" : "failure";
    rolls.push(criticalDie);
    modifiers.push({
      label: critical === "success" ? "Critical Success 1d10" : "Critical Failure 1d10",
      value: critical === "success" ? criticalDie : -criticalDie,
    });
  }

  const result = buildRollResult({
    dice: "1d10",
    rolls,
    modifiers,
    dv: options.dv ?? null,
    ...(options.now ? { now: options.now } : {}),
  });

  return { ...result, base, critical, criticalDie, modifier: modifierTotal };
}

/** Deterministic RNG for tests and reproducible generation (mulberry32). */
export function seededRng(seed: number): RNG {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}