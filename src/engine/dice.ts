import type { RNG } from "./types";

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
 * a natural 1 subtracts another d10. Only one critical step, per the rules.
 */
export type CheckResult = {
  base: number;
  critical: "success" | "failure" | null;
  criticalDie: number | null;
  modifier: number;
  total: number;
};

export function statSkillCheck(modifier: number, rng: RNG = defaultRng): CheckResult {
  const base = d10(rng);
  if (base === 10) {
    const criticalDie = d10(rng);
    return {
      base,
      critical: "success",
      criticalDie,
      modifier,
      total: base + criticalDie + modifier,
    };
  }
  if (base === 1) {
    const criticalDie = d10(rng);
    return {
      base,
      critical: "failure",
      criticalDie,
      modifier,
      total: base - criticalDie + modifier,
    };
  }
  return { base, critical: null, criticalDie: null, modifier, total: base + modifier };
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