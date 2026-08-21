/**
 * Skill point budgeting. Every constant is read from
 * src/data/rules/skills.json and src/data/rules/role-skill-packages.json.
 */
import {
  BASIC_SKILL_IDS,
  SKILL_PACKAGE_RULES,
  SKILL_RULES,
  findSkillByName,
  getRolePackage,
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
/**
 * A single skill line on the sheet. Specialized skills (Language, Science,
 * Martial Arts…) can appear more than once, each with its own specialization,
 * so the sheet is a list of entries rather than a map keyed by skill id.
 */
export type SkillEntry = {
  skillId: string;
  /** null for skills that take no specialization. */
  specialization: string | null;
  level: number;
  /** Granted entries (the free Cultural Origin Language) cost no points. */
  granted?: boolean;
};

/** Stable identity for an entry: skill id plus specialization. */
export function skillEntryKey(entry: Pick<SkillEntry, "skillId" | "specialization">): string {
  return entry.specialization ? `${entry.skillId}::${entry.specialization}` : entry.skillId;
}

/** Display name including the specialization, e.g. "Language (Streetslang)". */
export function skillEntryName(entry: Pick<SkillEntry, "skillId" | "specialization">): string {
  const name = getSkill(entry.skillId).name;
  return entry.specialization ? `${name} (${entry.specialization})` : name;
}

/** The Role's printed 20-skill package as sheet entries. */
export function rolePackageEntries(roleId: string): SkillEntry[] {
  return getRolePackage(roleId).skills.map((line) => {
    const skill = findSkillByName(line.skill);
    if (!skill) {
      throw new Error(
        `Role package skill "${line.skill}" has no entry in src/data/rules/skills.json`,
      );
    }
    return { skillId: skill.id, specialization: line.specialization, level: line.level };
  });
}

export type SkillEntryValidationInput = {
  method: "edgerunner" | "complete_package";
  /** Required for edgerunner: entries are restricted to this Role's list. */
  roleId?: string;
  entries: SkillEntry[];
};

/** Entry-aware validation. Same rules as the map validators, repeatable-skill safe. */
export function validateSkillEntries(input: SkillEntryValidationInput): SkillValidation {
  const rules = input.method === "edgerunner" ? EDGERUNNER : COMPLETE_PACKAGE;
  const budget = rules.skillPoints;
  const maxLevel = rules.maxLevel;
  const violations: string[] = [];
  const purchased = input.entries.filter((e) => !e.granted);

  const roleSkillIds =
    input.method === "edgerunner" && input.roleId ? new Set(getRoleSkillIds(input.roleId)) : null;

  for (const entry of purchased) {
    const name = skillEntryName(entry);
    if (roleSkillIds && !roleSkillIds.has(entry.skillId)) {
      violations.push(`${name} is not one of the ${input.roleId} Role's Skills and can't be taken`);
    }
    if (entry.level > maxLevel) {
      violations.push(`${name} is at ${entry.level} — the maximum Skill Level is ${maxLevel}`);
    }
    if (input.method === "edgerunner" && entry.level < EDGERUNNER.minLevel) {
      violations.push(
        `${name} is at ${entry.level} — Edgerunner Skills start at ${EDGERUNNER.minLevel}`,
      );
    }
    if (entry.level < 0) violations.push(`${name} cannot be negative`);
  }

  const minimum = SKILL_RULES.basicSkillMinimum;
  for (const basicId of BASIC_SKILLS) {
    const best = input.entries
      .filter((e) => e.skillId === basicId)
      .reduce((max, e) => Math.max(max, e.level), -1);
    if (best < minimum) {
      violations.push(
        best < 0
          ? `Basic Skill ${getSkill(basicId).name} is missing — every Basic Skill must be at least ${minimum}`
          : `Basic Skill ${getSkill(basicId).name} is at ${best} — Basic Skills must be at least ${minimum}`,
      );
    }
  }

  const pointsSpent = purchased.reduce(
    (sum, entry) => sum + skillPointCost(entry.skillId, 0, entry.level),
    0,
  );
  const pointsRemaining = budget - pointsSpent;
  if (pointsRemaining < 0) {
    violations.push(
      `You are ${-pointsRemaining} Skill Points over the ${budget} point budget — spend fewer points`,
    );
  } else if (pointsRemaining > 0) {
    violations.push(`You have ${pointsRemaining} Skill Points left to spend`);
  }

  return { valid: violations.length === 0, pointsSpent, pointsRemaining, violations };
}

/** Points spent by a set of entries (granted entries are free). */
export function skillPointsSpent(entries: SkillEntry[]): number {
  return entries
    .filter((e) => !e.granted)
    .reduce((sum, e) => sum + skillPointCost(e.skillId, 0, e.level), 0);
}

export type SkillLimitsInput = {
  method: "edgerunner" | "complete_package";
  roleId?: string | undefined;
  entries: SkillEntry[];
  entry: SkillEntry;
};

export type SkillLimits = {
  /** Lowest legal Level for this entry. */
  min: number;
  /** Highest Level reachable right now, given the remaining budget and the cap. */
  max: number;
  canIncrease: boolean;
  canDecrease: boolean;
  /** Plain-language reason the + button is unavailable, when it is. */
  increaseReason: string | null;
  /** Plain-language reason the − button is unavailable, when it is. */
  decreaseReason: string | null;
};

function rulesFor(method: "edgerunner" | "complete_package") {
  return method === "edgerunner" ? EDGERUNNER : COMPLETE_PACKAGE;
}

/** Lowest Level an entry may be lowered to under the given method. */
export function skillFloor(method: "edgerunner" | "complete_package", skillId: string): number {
  if (method === "edgerunner") return EDGERUNNER.minLevel;
  return BASIC_SKILLS.includes(skillId) ? SKILL_RULES.basicSkillMinimum : 0;
}

/**
 * What the ± controls may legally do to one entry right now. Pure: the UI
 * disables buttons from this rather than letting the player break a rule.
 */
export function skillEntryLimits(input: SkillLimitsInput): SkillLimits {
  const rules = rulesFor(input.method);
  const { entry } = input;
  const costPerLevel = getSkill(entry.skillId).doubleCost ? 2 : 1;
  const min = entry.granted ? entry.level : skillFloor(input.method, entry.skillId);
  const remaining = rules.skillPoints - skillPointsSpent(input.entries);
  const affordable = entry.level + Math.floor(Math.max(0, remaining) / costPerLevel);
  const max = entry.granted ? entry.level : Math.min(rules.maxLevel, affordable);

  const canIncrease = !entry.granted && entry.level < max;
  const canDecrease = !entry.granted && entry.level > min;

  let increaseReason: string | null = null;
  if (!canIncrease) {
    if (entry.granted) increaseReason = "Granted Skills can't be changed";
    else if (entry.level >= rules.maxLevel) {
      increaseReason = `The maximum Skill Level at creation is ${rules.maxLevel}`;
    } else {
      increaseReason =
        costPerLevel === 2
          ? "This ×2 Skill costs 2 points per Level and you don't have 2 left"
          : "No Skill Points left to spend";
    }
  }

  let decreaseReason: string | null = null;
  if (!canDecrease) {
    if (entry.granted) decreaseReason = "Granted Skills can't be changed";
    else if (input.method === "edgerunner") {
      decreaseReason = `Edgerunner Skills can't go below ${EDGERUNNER.minLevel}`;
    } else if (BASIC_SKILLS.includes(entry.skillId)) {
      decreaseReason = `Basic Skills must be at least ${SKILL_RULES.basicSkillMinimum}`;
    } else {
      decreaseReason = "Already at 0 — remove the Skill instead";
    }
  }

  return { min, max, canIncrease, canDecrease, increaseReason, decreaseReason };
}

/** Whether a new Skill line can be added to the sheet at `level`. */
export function canAddSkillEntry(input: {
  method: "edgerunner" | "complete_package";
  entries: SkillEntry[];
  skillId: string;
  specialization: string | null;
  level: number;
}): { allowed: boolean; reason: string | null } {
  const rules = rulesFor(input.method);
  const key = skillEntryKey({ skillId: input.skillId, specialization: input.specialization });
  if (input.entries.some((e) => skillEntryKey(e) === key)) {
    return { allowed: false, reason: "Already on your sheet" };
  }
  const skill = getSkill(input.skillId);
  if (skill.requiresSpecialization && !input.specialization) {
    return {
      allowed: false,
      reason: `Name the ${skill.specializationLabel ?? "specialization"} first`,
    };
  }
  const remaining = rules.skillPoints - skillPointsSpent(input.entries);
  const cost = skillPointCost(input.skillId, 0, input.level);
  if (cost > remaining) {
    return { allowed: false, reason: `Not enough Skill Points left — this costs ${cost}` };
  }
  return { allowed: true, reason: null };
}
