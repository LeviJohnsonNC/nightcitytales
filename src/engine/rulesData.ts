/**
 * Typed access to the static rules JSON in /src/data/rules.
 * The engine never hardcodes a rules value: every constant is read from here.
 */
import creationRules from "@/data/rules/creation-rules.json";
import dvTable from "@/data/rules/dv-table.json";
import hpTable from "@/data/rules/hp-table.json";
import lifepathGeneral from "@/data/rules/lifepath-general.json";
import lifepathRoles from "@/data/rules/lifepath-roles.json";
import roleSkillPackages from "@/data/rules/role-skill-packages.json";
import skillsData from "@/data/rules/skills.json";
import statTemplates from "@/data/rules/stat-templates.json";
import type { StatBlock, StatKey } from "./types";

export type SkillDefinition = {
  id: string;
  name: string;
  category: string;
  stat: string;
  doubleCost: boolean;
  isBasicSkill: boolean;
  requiresSpecialization: boolean;
  specializationLabel: string | null;
  repeatable: boolean;
};

export const SKILLS: SkillDefinition[] = (skillsData.skills as SkillDefinition[]).map((s) => ({
  id: s.id,
  name: s.name,
  category: s.category,
  stat: s.stat,
  doubleCost: s.doubleCost,
  isBasicSkill: s.isBasicSkill,
  requiresSpecialization: s.requiresSpecialization,
  specializationLabel: s.specializationLabel,
  repeatable: s.repeatable,
}));

const SKILLS_BY_ID = new Map(SKILLS.map((s) => [s.id, s]));
const SKILLS_BY_NAME = new Map(SKILLS.map((s) => [s.name.toLowerCase(), s]));

export function getSkill(skillId: string): SkillDefinition {
  const skill = SKILLS_BY_ID.get(skillId);
  if (!skill) throw new Error(`Unknown skill id "${skillId}" (src/data/rules/skills.json)`);
  return skill;
}

export function findSkillByName(name: string): SkillDefinition | undefined {
  return SKILLS_BY_NAME.get(name.toLowerCase());
}

/**
 * A normalized lookup key for loose skill references: lowercased, with the words
 * "check"/"skill"/"roll" removed and all punctuation and whitespace stripped. So
 * "Melee Weapon", "melee_weapon", and "Melee Weapon check" all collapse to the
 * same key. Used only by resolveSkillId — the canonical id is always the output.
 */
function normalizeSkillKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/\b(check|skill|roll)\b/g, " ")
    .replace(/[^a-z0-9]+/g, "");
}

const SKILLS_BY_NORMALIZED = new Map<string, SkillDefinition>();
for (const skill of SKILLS) {
  // Set the name key first, then the id key, so an id spelling wins any collision.
  SKILLS_BY_NORMALIZED.set(normalizeSkillKey(skill.name), skill);
  SKILLS_BY_NORMALIZED.set(normalizeSkillKey(skill.id), skill);
}

/**
 * Resolve a loosely-specified skill reference to a canonical skill id. Accepts an
 * exact id, a case-insensitive id or name, or a lightly-normalized name (spaces,
 * punctuation and a trailing "check"/"skill"/"roll" stripped). Returns null when
 * nothing matches, so the caller can decide whether that is a dropped action
 * rather than trusting a bad id. This is the safety net that keeps a GM proposal
 * like "Perception" or "perception check" from being silently thrown away.
 */
export function resolveSkillId(reference: string): string | null {
  if (!reference) return null;
  if (SKILLS_BY_ID.has(reference)) return reference;
  const byName = SKILLS_BY_NAME.get(reference.toLowerCase());
  if (byName) return byName.id;
  return SKILLS_BY_NORMALIZED.get(normalizeSkillKey(reference))?.id ?? null;
}

export const SKILL_RULES = skillsData._rules;

/** The 13 Basic Skills, as skill ids, read from skills.json. */
export const BASIC_SKILL_IDS: string[] = (skillsData.basicSkills as string[]).map((name) => {
  const skill = findSkillByName(name);
  if (!skill) throw new Error(`Basic Skill "${name}" has no entry in skills.json skills[]`);
  return skill.id;
});

export const STAT_ORDER = statTemplates._statOrder as StatKey[];

type TemplateRows = Record<string, Record<string, number>>;
const TEMPLATES = statTemplates.templates as unknown as Record<string, { rows: TemplateRows }>;

export function getStatTemplateRows(roleId: string): TemplateRows {
  const template = TEMPLATES[roleId];
  if (!template) {
    throw new Error(`No STAT template for role "${roleId}" (src/data/rules/stat-templates.json)`);
  }
  return template.rows;
}

export function getStatTemplateRow(roleId: string, row: number): StatBlock {
  const rows = getStatTemplateRows(roleId);
  const values = rows[String(row)];
  if (!values) {
    throw new Error(
      `STAT template for role "${roleId}" has no row ${row} (src/data/rules/stat-templates.json)`,
    );
  }
  const block = {} as StatBlock;
  for (const stat of STAT_ORDER) {
    const value = values[stat];
    if (value === undefined) {
      throw new Error(
        `STAT template ${roleId} row ${row} is missing "${stat}" (src/data/rules/stat-templates.json)`,
      );
    }
    block[stat] = value;
  }
  return block;
}

export type RolePackageSkill = { skill: string; specialization: string | null; level: number };

const ROLE_PACKAGES = roleSkillPackages.roles as unknown as Record<
  string,
  { skillCount: number; skills: RolePackageSkill[] }
>;

export function getRolePackage(roleId: string): {
  skillCount: number;
  skills: RolePackageSkill[];
} {
  const pkg = ROLE_PACKAGES[roleId];
  if (!pkg) {
    throw new Error(
      `No skill package for role "${roleId}" (src/data/rules/role-skill-packages.json)`,
    );
  }
  return pkg;
}

/** The skill ids that make up a Role's package. */
export function getRoleSkillIds(roleId: string): string[] {
  return getRolePackage(roleId).skills.map((entry) => {
    const skill = findSkillByName(entry.skill);
    if (!skill) {
      throw new Error(
        `Role package skill "${entry.skill}" has no entry in src/data/rules/skills.json`,
      );
    }
    return skill.id;
  });
}

export const CREATION_RULES = creationRules;
export const CREATION_METHODS = creationRules.methods;

export type WoundState = {
  state: string;
  threshold: string;
  effect: string;
  stabilizationDV: number | null;
  note?: string;
};

/** The Wound State ladder, read from creation-rules.json. */
export const WOUND_STATES = creationRules.woundStates as WoundState[];

export type StatDescription = {
  stat: string;
  name: string;
  group: string;
  description: string;
  drives: string;
};

/** Per-STAT in-game meaning, read from creation-rules.json. */
export const STAT_DESCRIPTIONS = creationRules.statDescriptions.stats as unknown as Partial<
  Record<StatKey, StatDescription>
>;

export const HUMANITY_RULES = creationRules.humanity;

export type ReputationLevel = { level: number; whoKnows: string };

/** Improvement Points, read from creation-rules.json. */
export const IMPROVEMENT_POINTS = creationRules.improvementPoints;

/** Reputation starting value, recognition rule, and the 10-level ladder. */
export const REPUTATION = creationRules.reputation as {
  startingValue: number;
  note: string;
  encounterRule: string;
  levels: ReputationLevel[];
};

export const DV_TABLE_DATA = dvTable;
export const HP_TABLE_DATA = hpTable;
export const LIFEPATH_GENERAL = lifepathGeneral;
export const LIFEPATH_ROLES = lifepathRoles;
export const SKILL_PACKAGE_RULES = roleSkillPackages._rules;
