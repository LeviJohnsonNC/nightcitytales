/**
 * Typed access to the static rules JSON in /src/data/rules.
 * The engine never hardcodes a rules value: every constant is read from here.
 */
import creationRules from "@/data/rules/creation-rules.json";
import dvTable from "@/data/rules/dv-table.json";
import hpTable from "@/data/rules/hp-table.json";
import ipAwards from "@/data/rules/ip-awards.json";
import lifepathGeneral from "@/data/rules/lifepath-general.json";
import lifepathRoles from "@/data/rules/lifepath-roles.json";
import roleSkillPackages from "@/data/rules/role-skill-packages.json";
import skillsData from "@/data/rules/skills.json";
import ipCosts from "@/data/rules/ip-costs.json";
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

/**
 * The band a STAT actually occupies in the printed Role templates: the lowest
 * and highest value that appears for it across every Role row. Nothing is
 * invented here — it is read straight out of stat-templates.json — so the sheet
 * can show where a Character sits without inventing a rules-wide STAT ceiling.
 */
export function statTemplateRange(stat: StatKey): { min: number; max: number } {
  let min = Infinity;
  let max = -Infinity;
  for (const template of Object.values(TEMPLATES)) {
    for (const row of Object.values(template.rows)) {
      const value = row[stat];
      if (value === undefined) continue;
      if (value < min) min = value;
      if (value > max) max = value;
    }
  }
  if (min === Infinity) {
    throw new Error(`No template values for STAT "${stat}" (src/data/rules/stat-templates.json)`);
  }
  return { min, max };
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

/** What advancement costs in I.P., read from ip-costs.json. */
export const IP_COSTS = ipCosts as unknown as {
  _rules: { skill: string; levelling: string; maximum: string };
  skillCostPerLevel: number;
  doubleCostMultiplier: number;
};

export type IpTier = {
  ip: number;
  group: string;
  warrior: string;
  socializer: string;
  explorer: string;
  roleplayer: string;
};

/** The end-of-session I.P. award table, read from ip-awards.json. */
export const IP_AWARDS = ipAwards as unknown as {
  _rules: { finished: string; unfinished: string };
  playstyles: { id: string; name: string }[];
  tiers: IpTier[];
};

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
