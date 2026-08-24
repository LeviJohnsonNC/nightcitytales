/**
 * Opposed checks — a check made against another character rather than against a
 * fixed Difficulty Value. Persuading a fixer, sneaking past a guard who is
 * actively watching, or lying to someone reading your face are all resolved this
 * way: both sides roll STAT + Skill + 1d10 and the higher total wins.
 *
 * Two rules matter and both live in the rules data, not here:
 * - The acting character must EXCEED the opposing total; a tie goes to the side
 *   named by OPPOSED_CHECK_TIE_GOES_TO (the defender, as printed).
 * - Each side rolls its own d10 and takes its own criticals. A Critical Failure
 *   on the defender's die is the opening the player's roll walks through.
 *
 * Pure TypeScript, like the rest of the engine: mapping intent to a skill and
 * deciding who opposes it is the GM layer's job. By the time a check arrives
 * here, both sides' numbers are already chosen.
 */
import { defaultRng, statSkillCheck, type CheckResult } from "./dice";
import type { RollModifier } from "./rollLog";
import { getSkill, OPPOSED_CHECK_TIE_GOES_TO } from "./rulesData";
import type { RNG, StatKey } from "./types";
import type { SkillCheckActor, SkillCheckModifier, SkillCheckOptions } from "./skillCheck";

/** One side of an opposed check: who is rolling, and what they add to the die. */
export type OpposedSide = {
  /** Who this side is, for the roll log: "Vincent Kang", "Trace Santiago". */
  name: string;
  /** Display label for the governing STAT, e.g. "COOL". */
  statLabel: string;
  statValue: number;
  /** Display label for the Skill, e.g. "Persuasion". */
  skillLabel: string;
  /** Skill Level (0 when untrained — everyone rolls Basic Skills at 0). */
  skillValue: number;
  /** Situational modifiers: disposition, wounds, circumstance. */
  modifiers?: SkillCheckModifier[];
};

export type OpposedCheckResult = {
  /** The acting character's roll — the player, in this app. */
  actor: CheckResult;
  /** The opposing character's roll. */
  opponent: CheckResult;
  actorSide: OpposedSide;
  opponentSide: OpposedSide;
  /** True when the acting character beat the opposing total outright. */
  success: boolean;
  /** Set when the totals matched, so the UI can say the tie rule decided it. */
  tie: boolean;
  /** actor.total − opponent.total. Zero on a tie, which the actor loses. */
  margin: number;
};

function rollSide(side: OpposedSide, rng: RNG, options: SkillCheckOptions): CheckResult {
  const modifiers: RollModifier[] = [
    { label: side.statLabel, value: side.statValue },
    { label: side.skillLabel, value: side.skillValue },
    ...(side.modifiers ?? []),
  ];
  // No DV: an opposed check is settled by comparing the two totals, not by a
  // number set in advance.
  return statSkillCheck(modifiers, rng, {
    dv: null,
    ...(options.now ? { now: options.now } : {}),
  });
}

/**
 * Resolve a fully-specified opposed check. The actor rolls first so a replayed
 * seed produces the same two dice in the same order as the table saw them.
 */
export function resolveOpposedCheck(
  actorSide: OpposedSide,
  opponentSide: OpposedSide,
  rng: RNG = defaultRng,
  options: SkillCheckOptions = {},
): OpposedCheckResult {
  const actor = rollSide(actorSide, rng, options);
  const opponent = rollSide(opponentSide, rng, options);
  const tie = actor.total === opponent.total;
  // Beat, don't match: a tie goes to whichever side the rules data names.
  const success = tie ? OPPOSED_CHECK_TIE_GOES_TO === "actor" : actor.total > opponent.total;
  return {
    actor,
    opponent,
    actorSide,
    opponentSide,
    success,
    tie,
    margin: actor.total - opponent.total,
  };
}

/** What the opposing character brings to the check. */
export type Opposition = {
  name: string;
  /** The skill they resist with, as a printed skill id. */
  skillId: string;
  /** Their Level in it (0 when untrained). */
  skillLevel: number;
  /** Their value in the STAT that skill is printed under. */
  statValue: number;
};

/**
 * Resolve an opposed check for a saved character against an opposing NPC. Each
 * side's governing STAT comes from the rules data for its own skill — the
 * printed STAT link, never a pairing the caller invented.
 */
export function opposedCheckForCharacter(
  actor: SkillCheckActor,
  skillId: string,
  opposition: Opposition,
  rng: RNG = defaultRng,
  options: SkillCheckOptions & { actorName?: string; modifiers?: SkillCheckModifier[] } = {},
): OpposedCheckResult {
  const skill = getSkill(skillId);
  const stat = skill.stat as StatKey;
  const statValue = actor.stats[stat];
  if (typeof statValue !== "number") {
    throw new Error(`Character has no ${stat.toUpperCase()} value for a ${skill.name} check.`);
  }
  const opposingSkill = getSkill(opposition.skillId);

  return resolveOpposedCheck(
    {
      name: options.actorName ?? "You",
      statLabel: stat.toUpperCase(),
      statValue,
      skillLabel: skill.name,
      skillValue: actor.skills.find((entry) => entry.skillId === skillId)?.level ?? 0,
      ...(options.modifiers ? { modifiers: options.modifiers } : {}),
    },
    {
      name: opposition.name,
      statLabel: opposingSkill.stat.toUpperCase(),
      statValue: opposition.statValue,
      skillLabel: opposingSkill.name,
      skillValue: opposition.skillLevel,
    },
    rng,
    options.now ? { now: options.now } : {},
  );
}
