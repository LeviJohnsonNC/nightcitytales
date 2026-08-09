/**
 * Skill point budgeting. Every constant is read from
 * src/data/rules/skills.json and src/data/rules/role-skill-packages.json.
 */
import {
  BASIC_SKILL_IDS,
  SKILL_PACKAGE_RULES,
  SKILL_RULES,
  getRoleSkillIds,
  getSkill,
} from "./rulesData";

/** The Basic Skills, as skill ids, read from skills.json (never typed by hand). */
export const BASIC_SKILLS: readonly string[] = BASIC_SKILL_IDS;

const EDGERUNNER = SKILL_PACKAGE_RULES.edgerunner;
const COMPLETE_PACKAGE = SKILL_PACKAGE_RULES.completePackage;

/** A skill allocation, keyed by skill id. */
export type SkillAllocation = Record<string, number>;

export type SkillValidationOptions = {
  /**
   * Skill id of the free Cultural Origin Language. It is granted, not
   * purchased, so it is excluded from the point budget and level caps.
   */
  culturalOriginLanguageSkillId?: string;
};

export type SkillValidation = {
  valid: boolean;
  pointsSpent: number;
  pointsRemaining: number;
  violations: string[];
};

/** Cost of raising a skill from one level to another. Double-cost skills cost 2 per level. */
export function skillPointCost(skillId: string, fromLevel: number, toLevel: number): number {
  const skill = getSkill(skillId);
  const multiplier = skill.doubleCost ? 2 : 1;
  return (toLevel - fromLevel) * multiplier;
}

/** Base value of a check before the die: STAT + Skill Level. */
export function skillBase(statValue: number, skillLevel: number): number {
  return statValue + skillLevel;
}

function costOf(allocation: SkillAllocation, ignoreSkillId?: string): number {
  return Object.entries(allocation).reduce((sum, [skillId, level]) => {
    if (skillId === ignoreSkillId) return sum;
    return sum + skillPointCost(skillId, 0, level);
  }, 0);
}

function checkBasicSkillMinimum(
  allocation: SkillAllocation,
  minimum: number,
  options: SkillValidationOptions,
  violations: string[],
): void {
  for (const basicId of BASIC_SKILLS) {
    if (basicId === options.culturalOriginLanguageSkillId) continue;
    const level = allocation[basicId] ?? 0;
    if (level < minimum) {
      violations.push(
        `Basic Skill ${getSkill(basicId).name} is ${level}; Basic Skills must be at least ${minimum}`,
      );
    }
  }
}

/** Edgerunner: a fixed budget spread across the Role's own skill list only. */
export function validateEdgerunnerSkills(
  roleId: string,
  allocation: SkillAllocation,
  options: SkillValidationOptions = {},
): SkillValidation {
  const budget = EDGERUNNER.skillPoints;
  const roleSkillIds = new Set(getRoleSkillIds(roleId));
  const violations: string[] = [];

  for (const [skillId, level] of Object.entries(allocation)) {
    if (skillId === options.culturalOriginLanguageSkillId) continue;
    const skill = getSkill(skillId);
    if (!roleSkillIds.has(skillId)) {
      violations.push(`${skill.name} is not in the ${roleId} skill package`);
    }
    if (level > EDGERUNNER.maxLevel) {
      violations.push(`${skill.name} is ${level}; the maximum at creation is ${EDGERUNNER.maxLevel}`);
    }
    if (level < EDGERUNNER.minLevel) {
      violations.push(`${skill.name} is ${level}; the minimum is ${EDGERUNNER.minLevel}`);
    }
  }

  checkBasicSkillMinimum(allocation, SKILL_RULES.basicSkillMinimum, options, violations);

  const pointsSpent = costOf(allocation, options.culturalOriginLanguageSkillId);
  const pointsRemaining = budget - pointsSpent;
  if (pointsRemaining < 0) {
    violations.push(`${-pointsRemaining} Skill Points over the ${budget} point budget`);
  }

  return { valid: violations.length === 0, pointsSpent, pointsRemaining, violations };
}

/** Complete Package: same budget, but any skill may be taken. */
export function validateCompletePackageSkills(
  allocation: SkillAllocation,
  options: SkillValidationOptions = {},
): SkillValidation {
  const budget = COMPLETE_PACKAGE.skillPoints;
  const violations: string[] = [];

  for (const [skillId, level] of Object.entries(allocation)) {
    if (skillId === options.culturalOriginLanguageSkillId) continue;
    const skill = getSkill(skillId);
    if (level > COMPLETE_PACKAGE.maxLevel) {
      violations.push(
        `${skill.name} is ${level}; the maximum at creation is ${COMPLETE_PACKAGE.maxLevel}`,
      );
    }
    if (level < 0) violations.push(`${skill.name} cannot be negative`);
  }

  checkBasicSkillMinimum(allocation, COMPLETE_PACKAGE.basicSkillMinimum, options, violations);

  const pointsSpent = costOf(allocation, options.culturalOriginLanguageSkillId);
  const pointsRemaining = budget - pointsSpent;
  if (pointsRemaining < 0) {
    violations.push(`${-pointsRemaining} Skill Points over the ${budget} point budget`);
  }

  return { valid: violations.length === 0, pointsSpent, pointsRemaining, violations };
}