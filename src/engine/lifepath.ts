/**
 * General Lifepath rules access and rolling.
 * Every table, entry, and rule comes from src/data/rules/lifepath-general.json.
 */
import { d10 } from "./dice";
import { buildRollResult, type RollResult } from "./rollLog";
import { LIFEPATH_GENERAL } from "./rulesData";
import type { RNG } from "./types";

export type LifepathTableEntry = {
  /** Inclusive roll range. Flat tables have rollMin === rollMax. */
  rollMin: number;
  rollMax: number;
  /** How the range prints, e.g. "7" or "1-2". */
  label: string;
  /** The canonical table value. */
  value: string;
  description?: string;
  /** Cultural Origin only: the languages available to that region. */
  languages?: string[];
};

export type LifepathTable = {
  id: string;
  label: string;
  prompt: string;
  die: string;
  allowChoose: boolean;
  usesRanges: boolean;
  entries: LifepathTableEntry[];
  grantsSkill?: { skill: string; level: number; free: boolean; note: string };
};

type RawEntry = {
  roll?: number;
  rollMin?: number;
  rollMax?: number;
  label?: string;
  value?: string;
  region?: string;
  description?: string;
  languages?: string[];
};

type RawTable = {
  id: string;
  label: string;
  prompt: string;
  die: string;
  allowChoose?: boolean;
  usesRanges?: boolean;
  entries: RawEntry[];
  grantsSkill?: LifepathTable["grantsSkill"];
};

const RAW_TABLES = LIFEPATH_GENERAL.tables as unknown as Record<string, RawTable>;

function normalizeEntry(tableId: string, raw: RawEntry): LifepathTableEntry {
  const rollMin = raw.rollMin ?? raw.roll;
  const rollMax = raw.rollMax ?? raw.roll;
  if (rollMin === undefined || rollMax === undefined) {
    throw new Error(
      `Lifepath table "${tableId}" has an entry without a roll (src/data/rules/lifepath-general.json)`,
    );
  }
  const value = raw.value ?? raw.region;
  if (value === undefined) {
    throw new Error(
      `Lifepath table "${tableId}" entry ${rollMin} has neither "value" nor "region" (src/data/rules/lifepath-general.json)`,
    );
  }
  const entry: LifepathTableEntry = {
    rollMin,
    rollMax,
    label: raw.label ?? String(rollMin),
    value,
  };
  if (raw.description) entry.description = raw.description;
  if (raw.languages) entry.languages = raw.languages;
  return entry;
}

const TABLES: Record<string, LifepathTable> = Object.fromEntries(
  Object.entries(RAW_TABLES).map(([id, raw]) => [
    id,
    {
      id: raw.id,
      label: raw.label,
      prompt: raw.prompt,
      die: raw.die,
      allowChoose: raw.allowChoose ?? false,
      usesRanges: raw.usesRanges ?? false,
      entries: raw.entries.map((e) => normalizeEntry(id, e)),
      ...(raw.grantsSkill ? { grantsSkill: raw.grantsSkill } : {}),
    },
  ]),
);

/** The 19 general Lifepath tables, in the printed order. */
export const LIFEPATH_ORDER: string[] = LIFEPATH_GENERAL._order as string[];

export const LIFEPATH_RULES = LIFEPATH_GENERAL._rules as {
  die: string;
  allowChoose: boolean;
  chooseNote: string;
  persistenceShape: string;
  repeatableTables: string[];
  countRoll: string;
  enemyNote: string;
};

export const REPEATABLE_LIFEPATH_TABLES: string[] = LIFEPATH_RULES.repeatableTables;

export function getLifepathTable(tableId: string): LifepathTable {
  const table = TABLES[tableId];
  if (!table) {
    throw new Error(
      `Unknown Lifepath table "${tableId}" (src/data/rules/lifepath-general.json)`,
    );
  }
  return table;
}

/** The entry whose printed range contains `roll`. Handles range tables. */
export function lifepathEntryForRoll(tableId: string, roll: number): LifepathTableEntry {
  const table = getLifepathTable(tableId);
  const entry = table.entries.find((e) => roll >= e.rollMin && roll <= e.rollMax);
  if (!entry) {
    throw new Error(
      `Lifepath table "${tableId}" has no entry for a roll of ${roll} (src/data/rules/lifepath-general.json)`,
    );
  }
  return entry;
}

/**
 * A single stored Lifepath answer. `method` records whether the dice or the
 * player produced it; `custom` is the player's own phrasing, never the canon value.
 */
export type LifepathEntryRecord = {
  tableId: string;
  value: string;
  method: "rolled" | "chosen";
  roll: number | null;
  /** Player rewording for display. The canonical `value` stays intact. */
  custom?: string | null;
};

export type LifepathRoll = {
  entry: LifepathEntryRecord;
  table: LifepathTableEntry;
  result: RollResult;
};

export function rollLifepathTable(
  tableId: string,
  rng: RNG,
  options: { now?: () => Date } = {},
): LifepathRoll {
  const table = getLifepathTable(tableId);
  const roll = d10(rng);
  const entry = lifepathEntryForRoll(tableId, roll);
  const result = buildRollResult({ dice: table.die, rolls: [roll], now: options.now });
  return {
    entry: { tableId, value: entry.value, method: "rolled", roll },
    table: entry,
    result,
  };
}

/** Record a deliberate pick. `roll` stays null: no dice were involved. */
export function chooseLifepathEntry(tableId: string, value: string): LifepathEntryRecord {
  const table = getLifepathTable(tableId);
  const known = table.entries.some((e) => e.value === value);
  if (!known) {
    throw new Error(`"${value}" is not an entry of Lifepath table "${tableId}"`);
  }
  return { tableId, value, method: "chosen", roll: null };
}

/** "roll 1d10 and subtract 7, minimum 0" — parsed from _rules.countRoll, never hardcoded. */
function parseCountRule(text: string): { subtract: number; minimum: number } {
  const subtract = text.match(/subtract\s+(\d+)/i);
  const minimum = text.match(/minimum\s+(\d+)/i);
  if (!subtract || !minimum) {
    throw new Error(
      "src/data/rules/lifepath-general.json → _rules.countRoll does not state a subtraction and a minimum",
    );
  }
  return { subtract: Number(subtract[1]), minimum: Number(minimum[1]) };
}

export const LIFEPATH_COUNT_RULE = parseCountRule(LIFEPATH_RULES.countRoll);

/** How many Friends / Enemies / Tragic Love Affairs the character has. */
export function rollLifepathCount(
  rng: RNG,
  options: { now?: () => Date } = {},
): { count: number; result: RollResult } {
  const roll = d10(rng);
  const count = Math.max(LIFEPATH_COUNT_RULE.minimum, roll - LIFEPATH_COUNT_RULE.subtract);
  const result = buildRollResult({
    dice: LIFEPATH_RULES.die,
    rolls: [roll],
    modifiers: [{ label: "count", value: -LIFEPATH_COUNT_RULE.subtract }],
    now: options.now,
  });
  return { count, result };
}

/** The languages listed for a Cultural Origin region. */
export function languagesForCulturalOrigin(region: string): string[] {
  const entry = getLifepathTable("cultural_origin").entries.find((e) => e.value === region);
  if (!entry?.languages) {
    throw new Error(
      `Cultural Origin "${region}" has no language list (src/data/rules/lifepath-general.json)`,
    );
  }
  return entry.languages;
}

/** The free Language grant attached to Cultural Origin. */
export function culturalOriginLanguageGrant(): {
  skill: string;
  level: number;
  free: boolean;
  note: string;
} {
  const grant = getLifepathTable("cultural_origin").grantsSkill;
  if (!grant) {
    throw new Error(
      "cultural_origin has no grantsSkill entry (src/data/rules/lifepath-general.json)",
    );
  }
  return grant;
}

/** One enemy: four linked table results plus the injured party, which is a choice. */
export type EnemyRecord = {
  who: LifepathEntryRecord;
  cause: LifepathEntryRecord;
  throwAtYou: LifepathEntryRecord;
  revenge: LifepathEntryRecord;
  /** Who wronged whom. A choice, never a roll. */
  injuredParty: "you" | "them" | null;
};

export function rollEnemy(rng: RNG, options: { now?: () => Date } = {}): EnemyRecord {
  return {
    who: rollLifepathTable("enemy_who", rng, options).entry,
    cause: rollLifepathTable("enemy_cause", rng, options).entry,
    throwAtYou: rollLifepathTable("enemy_throw", rng, options).entry,
    revenge: rollLifepathTable("sweet_revenge", rng, options).entry,
    injuredParty: null,
  };
}
