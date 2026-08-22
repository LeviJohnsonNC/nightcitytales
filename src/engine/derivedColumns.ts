/**
 * The engine is the SOLE writer of the derived columns on character_stats.
 * Callers persist exactly what this returns; nothing computes these by hand.
 */
import { deriveStats } from "./derived";
import type { StatBlock } from "./types";

export type DerivedStatColumns = {
  hp_max: number;
  seriously_wounded_threshold: number;
  death_save: number;
  humanity_max: number;
};

export function derivedStatColumns(stats: StatBlock): DerivedStatColumns {
  const derived = deriveStats(stats);
  return {
    hp_max: derived.hpMax,
    seriously_wounded_threshold: derived.seriouslyWoundedThreshold,
    death_save: derived.deathSave,
    humanity_max: derived.humanityMax,
  };
}
