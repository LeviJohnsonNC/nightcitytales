/**
 * Difficulty Values, read from src/data/rules/dv-table.json.
 */
import { DV_TABLE_DATA } from "./rulesData";

export type DifficultyValue = { name: string; dv: number; description: string };

export const DIFFICULTY_VALUES: DifficultyValue[] =
  DV_TABLE_DATA.difficultyValues as DifficultyValue[];

export const DV_RULES = DV_TABLE_DATA._rules;

/** Look up a DV by its published name ("Simple", "Everyday", ...). */
export function getDV(name: string): number {
  const entry = DIFFICULTY_VALUES.find((d) => d.name.toLowerCase() === name.toLowerCase());
  if (!entry) {
    throw new Error(`Unknown Difficulty Value "${name}" (src/data/rules/dv-table.json)`);
  }
  return entry.dv;
}

export function getDifficulty(name: string): DifficultyValue {
  const entry = DIFFICULTY_VALUES.find((d) => d.name.toLowerCase() === name.toLowerCase());
  if (!entry) {
    throw new Error(`Unknown Difficulty Value "${name}" (src/data/rules/dv-table.json)`);
  }
  return entry;
}

/** The published difficulty band a numeric DV corresponds to, if any. */
export function describeDV(dv: number): DifficultyValue | null {
  return DIFFICULTY_VALUES.find((d) => d.dv === dv) ?? null;
}

export function meetsDV(total: number, dv: number): boolean {
  return total >= dv;
}

/** Positive when the check beats the DV, negative when it misses. */
export function dvMargin(total: number, dv: number): number {
  return total - dv;
}
