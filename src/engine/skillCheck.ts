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
import { areaLabel, coversArea, isAreaScoped } from "./localExpert";
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
 *
 * A Skill line carries its SPECIALIZATION as well as its Level, and the actor
 * carries the two district keys needed to read one: where the character is
 * standing, and where they live. Without those, every caller reduced the sheet
 * to `{ skillId, level }` and a check took the first line with a matching
 * Skill id — which is how Local Expert (Little China) 6 rolled at +6 in
 * Pacifica. See `localExpert.ts`.
 */
export type SkillCheckActor = {
  stats: Partial<StatBlock>;
  skills: { skillId: string; level: number; specialization?: string | null }[];
  /**
   * The district the character is standing in, so a place-scoped Skill is read
   * for the neighbourhood they are actually in. A check may name somewhere else
   * explicitly (`options.area`) — asking about Pacifica from a bar in Watson is
   * a real question — but where they stand is the default, so the honest answer
   * is what a caller gets by forgetting rather than by remembering.
   */
  districtKey?: string | null;
  /** The character's home district, which is what "Your Home" resolves to. */
  homeDistrictKey?: string | null;
};

/** Reduce an assembled sheet to the pieces a check needs. */
export function actorFromSheet(sheet: AssembledCharacter): SkillCheckActor {
  return {
    stats: sheet.stats,
    skills: sheet.skills.map((line) => ({
      skillId: line.skillId,
      level: line.level,
      specialization: line.specialization,
    })),
    homeDistrictKey: sheet.finance.homeDistrictKey,
  };
}

/**
 * The area a check is about: what the caller named, or where they are standing.
 *
 * Only ever consulted for a place-scoped Skill. Language is specialized too,
 * and the district a character happens to be in says nothing about which tongue
 * they are speaking, so it keeps reading the best line it has.
 */
export function areaForCheck(
  actor: SkillCheckActor,
  skillId: string,
  area?: string | null,
): string | null {
  if (area !== undefined) return area;
  return isAreaScoped(skillId) ? (actor.districtKey ?? null) : null;
}

/**
 * This character's Level in a Skill, for the area the check is about.
 *
 * The one lookup every check goes through. For an unspecialized Skill it is the
 * line they hold. For a specialized one:
 *
 *  - no area named — the best line they hold, which is what callers got before
 *    specializations were read at all, and the right answer for a Skill whose
 *    specialization the engine cannot resolve.
 *  - an area named and a line covers it — that line's Level.
 *  - an area named and no line covers it — ZERO. Everyone rolls a Basic Skill
 *    at Level 0, and a character who knows Little China does not know Pacifica.
 */
export function skillLevelFor(
  actor: SkillCheckActor,
  skillId: string,
  area?: string | null,
): number {
  const lines = actor.skills.filter((line) => line.skillId === skillId);
  if (!lines.length) return 0;
  const best = (of: typeof lines) => of.reduce((max, line) => Math.max(max, line.level), 0);

  if (!getSkill(skillId).requiresSpecialization) return best(lines);

  const asked = (area ?? "").trim();
  if (!asked) return best(lines);

  const covering = lines.filter((line) =>
    coversArea({
      skillId,
      specialization: line.specialization,
      area: asked,
      ...(actor.homeDistrictKey === undefined ? {} : { homeDistrictKey: actor.homeDistrictKey }),
    }),
  );
  return covering.length ? best(covering) : 0;
}

/**
 * How a Skill should be named on the roll, including the area when it has one.
 *
 * "Local Expert (Little China)" rather than "Local Expert", so the roll log
 * says which neighbourhood the +6 was for — and so a 0 rolled in the wrong
 * district explains itself on the card instead of looking like a bug.
 */
export function skillCheckLabel(
  actor: SkillCheckActor,
  skillId: string,
  area?: string | null,
): string {
  const name = getSkill(skillId).name;
  if (!isAreaScoped(skillId)) return name;
  const asked = (area ?? "").trim();
  const label = asked
    ? areaLabel(asked, actor.homeDistrictKey)
    : areaLabel(
        actor.skills.find((line) => line.skillId === skillId)?.specialization,
        actor.homeDistrictKey,
      );
  return label ? `${name} (${label})` : name;
}

/**
 * Resolve a check for a character by skill id. The governing STAT comes from the
 * rules data (getSkill); an untrained skill rolls at Level 0. Throws if the
 * character has no value for the governing STAT (a check that can't be made).
 *
 * `options.area` names what a place-scoped Skill is being asked about, and
 * defaults to the district the actor is standing in.
 */
export function skillCheckForCharacter(
  actor: SkillCheckActor,
  skillId: string,
  dv: number,
  rng: RNG = defaultRng,
  options: SkillCheckOptions & {
    modifiers?: SkillCheckModifier[];
    area?: string | null;
  } = {},
): SkillCheckResult {
  const skill = getSkill(skillId);
  const stat = skill.stat as StatKey;
  const statValue = actor.stats[stat];
  if (typeof statValue !== "number") {
    throw new Error(`Character has no ${stat.toUpperCase()} value for a ${skill.name} check.`);
  }
  const area = areaForCheck(actor, skillId, options.area);
  return resolveSkillCheck(
    {
      statLabel: stat.toUpperCase(),
      statValue,
      skillLabel: skillCheckLabel(actor, skillId, area),
      skillValue: skillLevelFor(actor, skillId, area),
      dv,
      ...(options.modifiers ? { modifiers: options.modifiers } : {}),
    },
    rng,
    options.now ? { now: options.now } : {},
  );
}
