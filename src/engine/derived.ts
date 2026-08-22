import type { DerivedStats, StatBlock } from "./types";

/** HP = 10 + 5 x ceil((BODY + WILL) / 2) */
export function hitPointsMax(body: number, will: number): number {
  return 10 + 5 * Math.ceil((body + will) / 2);
}

/** Seriously Wounded at half max HP, rounded up. */
export function seriouslyWoundedThreshold(hpMax: number): number {
  return Math.ceil(hpMax / 2);
}

/** Base Death Save equals BODY. */
export function deathSave(body: number): number {
  return body;
}

/** Humanity = EMP x 10. */
export function humanityMax(emp: number): number {
  return emp * 10;
}

/** EMP is Humanity / 10, rounded down. */
export function empFromHumanity(humanityCurrent: number): number {
  return Math.floor(humanityCurrent / 10);
}

export function deriveStats(stats: StatBlock): DerivedStats {
  const hpMax = hitPointsMax(stats.body, stats.will);
  return {
    hpMax,
    seriouslyWoundedThreshold: seriouslyWoundedThreshold(hpMax),
    deathSave: deathSave(stats.body),
    humanityMax: humanityMax(stats.emp),
  };
}
