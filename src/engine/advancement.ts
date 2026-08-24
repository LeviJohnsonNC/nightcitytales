/**
 * Spending Improvement Points between sessions. The counterpart to
 * improvementPoints.ts, which only ever awards them.
 *
 * Every number comes from src/data/rules/ip-costs.json and skills.json; nothing
 * is invented here. The rule, as printed: raising a Skill to a new Level costs
 * that new Level times the per-level cost, doubled for a Skill the sheet flags
 * x2. Levels are bought one at a time, so raising a Skill several Levels costs
 * the sum of each step and the price climbs as the Skill does.
 */
import { getSkill, IP_COSTS, SKILL_RULES } from "./rulesData";

/** The highest Skill Level reachable in play (skills.json _rules). */
export const MAX_SKILL_LEVEL: number = SKILL_RULES.maxLevelInPlay;

/**
 * What it costs to raise a Skill from `newLevel - 1` to `newLevel`.
 *
 * Throws on a level outside 1..MAX_SKILL_LEVEL — there is no printed price for a
 * Level that cannot exist, and silently returning 0 would let a caller buy it.
 */
export function skillRaiseCost(skillId: string, newLevel: number): number {
  if (!Number.isInteger(newLevel)) {
    throw new Error(`A Skill Level must be a whole number, got ${newLevel}.`);
  }
  if (newLevel < 1 || newLevel > MAX_SKILL_LEVEL) {
    throw new Error(`Level ${newLevel} is outside the printed range 1-${MAX_SKILL_LEVEL}.`);
  }
  const multiplier = getSkill(skillId).doubleCost ? IP_COSTS.doubleCostMultiplier : 1;
  return newLevel * IP_COSTS.skillCostPerLevel * multiplier;
}

/** The total to take a Skill from `fromLevel` to `toLevel`, one Level at a time. */
export function skillRaiseTotal(skillId: string, fromLevel: number, toLevel: number): number {
  if (toLevel <= fromLevel) return 0;
  let total = 0;
  for (let level = fromLevel + 1; level <= toLevel; level += 1) {
    total += skillRaiseCost(skillId, level);
  }
  return total;
}

/** Identity of a Skill line: repeatable Skills (Language, Science, ...) exist once per specialization. */
export function skillLineKey(skillId: string, specialization?: string | null): string {
  return `${skillId}::${specialization ?? ""}`;
}

export type SkillRaise = {
  skillId: string;
  /** The specialization this line is for, when the Skill is a repeatable one. */
  specialization: string | null;
  /** Stable identity for this line — skillId alone is not unique. */
  key: string;
  /** Display name, including the specialization where there is one. */
  skillName: string;
  /** The Level the character has now (0 when untrained). */
  currentLevel: number;
  /** The Level this raise would buy. */
  nextLevel: number;
  /** I.P. for this one Level. */
  cost: number;
  /** True when the character has the points for it. */
  affordable: boolean;
  /** True when the Skill is already at the in-play ceiling. */
  atMax: boolean;
  /** True when the sheet flags this Skill x2. */
  doubleCost: boolean;
};

/** Describe the next Level of one Skill against a pool of I.P. */
export function describeSkillRaise(
  skillId: string,
  currentLevel: number,
  availableIp: number,
  specialization: string | null = null,
): SkillRaise {
  const skill = getSkill(skillId);
  const atMax = currentLevel >= MAX_SKILL_LEVEL;
  const nextLevel = atMax ? currentLevel : currentLevel + 1;
  const cost = atMax ? 0 : skillRaiseCost(skillId, nextLevel);
  return {
    skillId,
    specialization,
    key: skillLineKey(skillId, specialization),
    skillName: specialization ? `${skill.name} (${specialization})` : skill.name,
    currentLevel,
    nextLevel,
    cost,
    affordable: !atMax && cost <= availableIp,
    atMax,
    doubleCost: skill.doubleCost,
  };
}

export type SkillLine = { skillId: string; level: number; specialization?: string | null };

/**
 * Every Skill the character could raise, cheapest first, so the spend screen can
 * show what this session's points actually buy. Skills already at the ceiling
 * come last — they are shown, not hidden, so their state is legible.
 */
export function availableSkillRaises(skills: SkillLine[], availableIp: number): SkillRaise[] {
  return skills
    .map((line) =>
      describeSkillRaise(line.skillId, line.level, availableIp, line.specialization ?? null),
    )
    .sort((a, b) => {
      if (a.atMax !== b.atMax) return a.atMax ? 1 : -1;
      if (a.cost !== b.cost) return a.cost - b.cost;
      return a.skillName.localeCompare(b.skillName);
    });
}

export type SpendResult = {
  skillId: string;
  specialization: string | null;
  newLevel: number;
  spent: number;
  /** I.P. left after the purchase. */
  remaining: number;
};

/**
 * Validate a purchase and return what it costs. Pure — the caller persists it.
 * Throws rather than clamping: a raise the character cannot afford or is not
 * entitled to should fail loudly, not quietly become a smaller one.
 */
export function spendOnSkill(
  skills: SkillLine[],
  availableIp: number,
  skillId: string,
  specialization: string | null = null,
): SpendResult {
  const skill = getSkill(skillId); // throws on an unknown id
  const key = skillLineKey(skillId, specialization);
  const currentLevel =
    skills.find((line) => skillLineKey(line.skillId, line.specialization ?? null) === key)?.level ??
    0;
  const label = specialization ? `${skill.name} (${specialization})` : skill.name;
  if (currentLevel >= MAX_SKILL_LEVEL) {
    throw new Error(`${label} is already at Level ${MAX_SKILL_LEVEL}, the in-play maximum.`);
  }
  const newLevel = currentLevel + 1;
  const cost = skillRaiseCost(skillId, newLevel);
  if (cost > availableIp) {
    throw new Error(
      `Raising ${label} to Level ${newLevel} costs ${cost} I.P.; only ${availableIp} available.`,
    );
  }
  return { skillId, specialization, newLevel, spent: cost, remaining: availableIp - cost };
}
