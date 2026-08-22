/**
 * Plain-object types used by the rules engine.
 * The engine is pure TypeScript: no React, no backend, no feature imports.
 */
export type StatKey =
  "int" | "ref" | "dex" | "tech" | "cool" | "will" | "luck" | "move" | "body" | "emp";

export type StatBlock = Record<StatKey, number>;

export type DerivedStats = {
  hpMax: number;
  seriouslyWoundedThreshold: number;
  deathSave: number;
  humanityMax: number;
};

export type CreationMethod = "streetrat" | "edgerunner" | "complete_package";

/** Injectable randomness so every engine function stays deterministic in tests. */
export type RNG = () => number;
