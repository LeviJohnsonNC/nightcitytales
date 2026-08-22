/**
 * The Role-specific Lifepath as it lives in the chargen store and the
 * chargen_drafts row. Same persistence shape as the general Lifepath.
 */
import { getRoleLifepathOrder, isRoleTableRevealed, getRoleLifepathTable } from "@/engine";
import type { LifepathEntryRecord } from "@/engine";

export type RoleLifepath = {
  roleId: string | null;
  entries: Record<string, LifepathEntryRecord>;
};

export const emptyRoleLifepath = (): RoleLifepath => ({ roleId: null, entries: {} });

export function readRoleLifepath(raw: unknown, roleId: string | null): RoleLifepath {
  const base = emptyRoleLifepath();
  if (!raw || typeof raw !== "object") return { ...base, roleId };
  const value = raw as Partial<RoleLifepath>;
  // A different Role's answers never carry over.
  if (value.roleId && value.roleId !== roleId) return { ...base, roleId };
  return { roleId, entries: value.entries ?? base.entries };
}

export function roleLifepathComplete(lifepath: RoleLifepath): string[] {
  if (!lifepath.roleId) return ["Pick a Role before running its Lifepath."];
  const missing = getRoleLifepathOrder(lifepath.roleId).filter((tableId) => {
    const table = getRoleLifepathTable(lifepath.roleId!, tableId);
    return isRoleTableRevealed(table, lifepath.entries) && !lifepath.entries[tableId];
  });
  return missing.length > 0
    ? [`Your Role Lifepath still has ${missing.length} unanswered table(s).`]
    : [];
}
