/**
 * The shape of the general Lifepath as it lives in the chargen store and the
 * chargen_drafts row. Every answer keeps its canonical table value, how it was
 * produced, and the player's own phrasing separately.
 */
import {
  LIFEPATH_ORDER,
  REPEATABLE_LIFEPATH_TABLES,
  type EnemyRecord,
  type LifepathEntryRecord,
} from "@/engine";

export type EnemyEntry = EnemyRecord & { id: string };

export type LanguageGrant = {
  /** The language name. Either from the region list or player supplied. */
  value: string;
  rank: number;
  free: true;
  source: "list" | "custom";
};

export type GeneralLifepath = {
  /** One answer per non-repeatable table, keyed by table id. */
  entries: Record<string, LifepathEntryRecord>;
  friends: LifepathEntryRecord[];
  enemies: EnemyEntry[];
  tragicLove: LifepathEntryRecord[];
  language: LanguageGrant | null;
};

/** Tables answered once, in printed order. Enemy sub-tables are handled per enemy. */
export const SINGLE_LIFEPATH_TABLES: string[] = LIFEPATH_ORDER.filter(
  (id) =>
    !REPEATABLE_LIFEPATH_TABLES.includes(id) &&
    !["enemy_who", "enemy_cause", "enemy_throw", "sweet_revenge"].includes(id),
);

export const emptyGeneralLifepath = (): GeneralLifepath => ({
  entries: {},
  friends: [],
  enemies: [],
  tragicLove: [],
  language: null,
});

/** Drafts are plain JSON, so normalize whatever came back from the backend. */
export function readGeneralLifepath(raw: unknown): GeneralLifepath {
  const base = emptyGeneralLifepath();
  if (!raw || typeof raw !== "object") return base;
  const value = raw as Partial<GeneralLifepath>;
  return {
    entries: value.entries ?? base.entries,
    friends: value.friends ?? base.friends,
    enemies: value.enemies ?? base.enemies,
    tragicLove: value.tragicLove ?? base.tragicLove,
    language: value.language ?? base.language,
  };
}

/** What the player sees: their own wording when present, the table value otherwise. */
export function displayValue(entry: LifepathEntryRecord): string {
  return entry.custom?.trim() ? entry.custom.trim() : entry.value;
}

export function generalLifepathComplete(lifepath: GeneralLifepath): string[] {
  const violations: string[] = [];
  for (const tableId of SINGLE_LIFEPATH_TABLES) {
    if (!lifepath.entries[tableId]) return ["Some Lifepath tables have no answer yet."];
  }
  if (!lifepath.language) {
    violations.push("Pick the free Language your Cultural Origin grants at Rank 4.");
  }
  lifepath.enemies.forEach((enemy, i) => {
    if (!enemy.injuredParty) {
      violations.push(`Enemy ${i + 1}: choose who was the injured party.`);
    }
  });
  return violations;
}
