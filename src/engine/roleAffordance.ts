/**
 * What a Role REACHES FOR — the half of a Role Ability the model was never told.
 *
 * The capability block describes a Role Ability exactly once, as a ceiling:
 * "Role Ability: Operator at Rank 4 — nothing above that Rank." Everything else
 * the narrator knows about being a Fixer is that the sheet says Fixer. So when
 * the player asked what they could do, a Fixer, a Nomad and a Lawman standing
 * in the same alley were offered the same three things, and the Role was a word
 * on a character sheet rather than a way of looking at a room.
 *
 * This module is the other half. It grants nothing and changes no number: what
 * a Role Ability DOES, and how far a Rank reaches, stay entirely in roles.json
 * and roleAbility.ts, and the capability ceiling still refuses anything above
 * the Rank. This only says what kind of move this person thinks of first.
 *
 * The data is a house rule and is flagged as one.
 */
import affordanceData from "@/data/rules/role-affordances.json";

export type RoleAffordance = {
  roleId: string;
  /** One line on who this person is in a room. */
  reach: string;
  /** Shapes of move only this Role thinks of first. Examples, never a script. */
  options: string[];
};

type RawAffordance = { reach?: string; options?: string[] };

const AFFORDANCES = (affordanceData as unknown as { roles: Record<string, RawAffordance> }).roles;

/** What this Role reaches for, or null for a Role the data does not know. */
export function roleAffordance(roleId: string | null | undefined): RoleAffordance | null {
  if (!roleId) return null;
  const raw = AFFORDANCES[roleId];
  if (!raw?.reach) return null;
  return { roleId, reach: raw.reach, options: raw.options ?? [] };
}

/**
 * The context block the narrator reads, or [] when the Role has no entry.
 *
 * Deliberately phrased as what to REACH FOR rather than what is permitted. The
 * permission question is already answered, in the capability block, by a line
 * that can only ever take things away.
 */
export function renderRoleAffordanceLines(roleId: string | null | undefined): string[] {
  const affordance = roleAffordance(roleId);
  if (!affordance) return [];
  const lines = [affordance.reach];
  if (affordance.options.length) {
    lines.push(
      "Moves this Role thinks of first — shapes to think with, never lines to read back:",
      ...affordance.options.map((option) => `  - ${option}`),
    );
  }
  return lines;
}
