/**
 * Role-specific Lifepath access and rolling.
 * Every table, entry, die, and reveal condition comes from
 * src/data/rules/lifepath-roles.json, read through rulesData.ts.
 */
import { rollDie } from "./dice";
import type { LifepathEntryRecord } from "./lifepath";
import { buildRollResult, type RollResult } from "./rollLog";
import { LIFEPATH_ROLES } from "./rulesData";
import type { RNG } from "./types";

export type RoleLifepathEntry = { roll: number | null; value: string };

export type RoleLifepathTable = {
  id: string;
  label: string;
  prompt: string;
  /** "1d10", "1d6", or null when the table is choice-only. */
  die: string | null;
  diePrinted: string | null;
  isChoiceOnly: boolean;
  allowChoose: boolean;
  conditional: boolean;
  dependsOn: { tableId: string; revealWhen: string[] } | null;
  houseRule: boolean;
  sourceDiscrepancy: string | null;
  entries: RoleLifepathEntry[];
};

type RoleRecord = { id: string; _order: string[]; tables: Record<string, RoleLifepathTable> };

const ROLES = LIFEPATH_ROLES.roles as unknown as Record<string, RoleRecord>;

export const ROLE_LIFEPATH_RULES = LIFEPATH_ROLES._rules;

function getRole(roleId: string): RoleRecord {
  const role = ROLES[roleId];
  if (!role) {
    throw new Error(`No Role Lifepath for role "${roleId}" (src/data/rules/lifepath-roles.json)`);
  }
  return role;
}

/** The Role's table ids in corrected order — never the book's printed order. */
export function getRoleLifepathOrder(roleId: string): string[] {
  return getRole(roleId)._order;
}

export function getRoleLifepathTable(roleId: string, tableId: string): RoleLifepathTable {
  const table = getRole(roleId).tables[tableId];
  if (!table) {
    throw new Error(
      `Role "${roleId}" has no Lifepath table "${tableId}" (src/data/rules/lifepath-roles.json)`,
    );
  }
  return table;
}

/** "1d6" → 6. The die string is authoritative; never assumed. */
export function roleLifepathDieSides(table: RoleLifepathTable): number {
  if (!table.die) {
    throw new Error(`Role Lifepath table "${table.id}" is choice-only and cannot be rolled`);
  }
  const match = table.die.match(/^1d(\d+)$/i);
  if (!match) {
    throw new Error(
      `Role Lifepath table "${table.id}" has an unreadable die "${table.die}" (src/data/rules/lifepath-roles.json)`,
    );
  }
  return Number(match[1]);
}

export function rollRoleLifepathTable(
  roleId: string,
  tableId: string,
  rng: RNG,
  options: { now?: () => Date } = {},
): { entry: LifepathEntryRecord; result: RollResult } {
  const table = getRoleLifepathTable(roleId, tableId);
  const roll = rollDie(roleLifepathDieSides(table), rng);
  const found = table.entries.find((e) => e.roll === roll);
  if (!found) {
    throw new Error(
      `Role Lifepath table "${tableId}" has no entry for a roll of ${roll} (src/data/rules/lifepath-roles.json)`,
    );
  }
  const result = buildRollResult({
    dice: table.die!,
    rolls: [roll],
    ...(options.now ? { now: options.now } : {}),
  });
  return { entry: { tableId, value: found.value, method: "rolled", roll }, result };
}

export function chooseRoleLifepathEntry(
  roleId: string,
  tableId: string,
  value: string,
): LifepathEntryRecord {
  const table = getRoleLifepathTable(roleId, tableId);
  if (!table.entries.some((e) => e.value === value)) {
    throw new Error(`"${value}" is not an entry of Role Lifepath table "${tableId}"`);
  }
  return { tableId, value, method: "chosen", roll: null };
}

/** A conditional table is hidden until its gate answer is one of revealWhen. */
export function isRoleTableRevealed(
  table: RoleLifepathTable,
  answers: Record<string, LifepathEntryRecord>,
): boolean {
  if (!table.dependsOn) return true;
  const gate = answers[table.dependsOn.tableId];
  return !!gate && table.dependsOn.revealWhen.includes(gate.value);
}

/** Drop answers whose gate no longer reveals them. Run after every change. */
export function pruneRoleLifepathAnswers(
  roleId: string,
  answers: Record<string, LifepathEntryRecord>,
): Record<string, LifepathEntryRecord> {
  const out: Record<string, LifepathEntryRecord> = {};
  for (const tableId of getRoleLifepathOrder(roleId)) {
    const answer = answers[tableId];
    if (answer && isRoleTableRevealed(getRoleLifepathTable(roleId, tableId), answers)) {
      out[tableId] = answer;
    }
  }
  return out;
}

/** The tables currently visible for a Role, in _order. */
export function visibleRoleLifepathTables(
  roleId: string,
  answers: Record<string, LifepathEntryRecord>,
): RoleLifepathTable[] {
  return getRoleLifepathOrder(roleId)
    .map((tableId) => getRoleLifepathTable(roleId, tableId))
    .filter((table) => isRoleTableRevealed(table, answers));
}