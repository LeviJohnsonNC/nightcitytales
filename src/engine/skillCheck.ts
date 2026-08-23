/**
 * Skill checks — the façade the mission runtime and GM layer call to resolve a
 * player action. Pure TypeScript: it wraps the low-level statSkillCheck roll
 * (see dice.ts) with the labels, situational modifiers, and DV comparison a
 * caller needs, and returns the full traceable RollResult plus the margin.
 *
 * Fiction-first: mapping a player's stated intent to *which* skill and DV is the
 * GM/parser's job (a later phase). By the time a check reaches here, the skill,
 * the governing STAT, and the DV are already chosen.
 */
import { defaultRng, statSkillCheck, type CheckResult } from "./dice";
import type { RollModifier } from "./rollLog";
import { getSkill } from "./rulesData";
import type { RNG, StatBlock, StatKey } from "./types";
import type { AssembledCharacter } from "./characterSheet";

export type SkillCheckModifier = { label: string; value: number };

export type SkillCheckInput = {
  /** Display label for the governing STAT, e.g. "REF". */
  statLabel: string;
  statValue: number;
  /** Display label for the Skill, e.g. "Handgun". */
  skillLabel: string;
  /** Skill Level (0 when untrained). */
  skillValue: number;
  /** The Difficulty Value the check is rolled against. */
  dv: number;
  /** Situational modifiers: cover, range, wound penalties, etc. */
  modifiers?: SkillCheckModifier[];
};

export type SkillCheckResult = CheckResult & {
  /** total − DV. Positive: succeeded by; negative: failed by. */
  margin: number;
};

export type SkillCheckOptions = {
  /** Injectable clock so tests stay deterministic. */
  now?: () => Date;
};

/**
 * Resolve a fully-specified check: d10 + STAT + Skill (+ modifiers) vs DV, with
 * the exploding/imploding crit handled by statSkillCheck.
 */
export function resolveSkillCheck(
  input: SkillCheckInput,
  rng: RNG = defaultRng,
  options: SkillCheckOptions = {},
): SkillCheckResult {
  const modifiers: RollModifier[] = [
    { label: input.statLabel, value: input.statValue },
    { label: input.skillLabel, value: input.skillValue },
    ...(input.modifiers ?? []),
  ];
  const result = statSkillCheck(modifiers, rng, {
    dv: input.dv,
    ...(options.now ? { now: options.now } : {}),
  });
  return { ...result, margin: result.total - input.dv };
}

/**
 * The minimal actor a check needs: the STATs and the Skill Levels. Both come
 * straight from the persisted character (character_stats + character_skills) or
 * from an assembled sheet via actorFromSheet.
 */
export type SkillCheckActor = {
  stats: Partial<StatBlock>;
  skills: { skillId: string; level: number }[];
};

/** Reduce an assembled sheet to the pieces a check needs. */
export function actorFromSheet(sheet: AssembledCharacter): SkillCheckActor {
  return {
    stats: sheet.stats,
    skills: sheet.skills.map((line) => ({ skillId: line.skillId, level: line.level })),
  };
}

/**
 * Resolve a check for a character by skill id. The governing STAT comes from the
 * rules data (getSkill); an untrained skill rolls at Level 0. Throws if the
 * character has no value for the governing STAT (a check that can't be made).
 */
export function skillCheckForCharacter(
  actor: SkillCheckActor,
  skillId: string,
  dv: number,
  rng: RNG = defaultRng,
  options: SkillCheckOptions & { modifiers?: SkillCheckModifier[] } = {},
): SkillCheckResult {
  const skill = getSkill(skillId);
  const stat = skill.stat as StatKey;
  const statValue = actor.stats[stat];
  if (typeof statValue !== "number") {
    throw new Error(`Character has no ${stat.toUpperCase()} value for a ${skill.name} check.`);
  }
  const level = actor.skills.find((entry) => entry.skillId === skillId)?.level ?? 0;
  return resolveSkillCheck(
    {
      statLabel: stat.toUpperCase(),
      statValue,
      skillLabel: skill.name,
      skillValue: level,
      dv,
      ...(options.modifiers ? { modifiers: options.modifiers } : {}),
    },
    rng,
    options.now ? { now: options.now } : {},
  );
}
