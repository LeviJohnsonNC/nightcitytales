/**
 * Role Abilities — the thing that makes a Solo play differently from a Fixer.
 *
 * Every value here is read from roles.json, where each ability carries the
 * book's transcribed mechanicalText and a `mechanics` block that restates the
 * same numbers in a shape the engine can use. Nothing is typed in this file.
 *
 * Three abilities are modelled so far:
 * - Solo, Combat Awareness: a pool of points equal to Rank, divided among six
 *   named options, re-divisible when combat begins or outside combat.
 * - Fixer, Operator: the Rank rides on a Haggle — a Trading deal — as the
 *   printed formula says.
 * - Rockerboy, Charismatic Impact: winning people over against a DV set by how
 *   many of them there are, with what you can ask gated by Rank.
 *
 * The other seven Roles are transcribed in the rules data but not modelled;
 * roleAbilityMechanics returns null for them rather than inventing anything.
 */
import { defaultRng, statSkillCheck, type CheckResult } from "./dice";
import type { RNG } from "./types";
import rolesData from "@/data/rules/roles.json";

type RawAbility = {
  id: string;
  name: string;
  startingRank?: number;
  mechanicalText?: string;
  mechanics?: unknown;
};
type RawRole = { id: string; name: string; roleAbility?: RawAbility };

const ROLES = (rolesData as unknown as { roles: Record<string, RawRole> }).roles;

export type RoleAbilityInfo = {
  roleId: string;
  roleName: string;
  abilityId: string;
  abilityName: string;
  startingRank: number;
};

/** The Role Ability a Role has, or null for a Role the data does not know. */
export function roleAbilityOf(roleId: string | null | undefined): RoleAbilityInfo | null {
  if (!roleId) return null;
  const role = ROLES[roleId];
  const ability = role?.roleAbility;
  if (!role || !ability) return null;
  return {
    roleId: role.id,
    roleName: role.name,
    abilityId: ability.id,
    abilityName: ability.name,
    startingRank: ability.startingRank ?? 0,
  };
}

function mechanicsOf<T>(roleId: string): T | null {
  const raw = ROLES[roleId]?.roleAbility?.mechanics;
  return raw ? (raw as T) : null;
}

// ---------------------------------------------------------------------------
// Solo — Combat Awareness
// ---------------------------------------------------------------------------

export type CombatAwarenessStep = { cost: number; value: number };

export type CombatAwarenessOption = {
  id: string;
  name: string;
  /** Fixed price points: the option is bought at one of these costs. */
  steps?: CombatAwarenessStep[];
  /** Or it scales one-for-one with points spent. */
  perPoint?: number;
  /** What the option modifies, as named in the rules data. */
  applies: string;
  effect: string;
};

type CombatAwarenessMechanics = { poolEqualsRank: boolean; options: CombatAwarenessOption[] };

export const COMBAT_AWARENESS_OPTIONS: CombatAwarenessOption[] =
  mechanicsOf<CombatAwarenessMechanics>("solo")?.options ?? [];

export function combatAwarenessOption(id: string): CombatAwarenessOption | null {
  return COMBAT_AWARENESS_OPTIONS.find((option) => option.id === id) ?? null;
}

/** Points assigned to each option id. */
export type CombatAwarenessAllocation = Record<string, number>;

/**
 * What a number of points spent on one option actually buys.
 *
 * Stepped options pay for the highest step the points cover: 5 points in
 * Precision Attack is +1 (the 3-point step) with 2 points doing nothing, which
 * is why the UI shows the steps rather than a slider.
 */
export function combatAwarenessValue(optionId: string, points: number): number {
  const option = combatAwarenessOption(optionId);
  if (!option || points <= 0) return 0;
  if (option.perPoint) return Math.trunc(points) * option.perPoint;
  const steps = option.steps ?? [];
  let value = 0;
  for (const step of steps) if (points >= step.cost) value = Math.max(value, step.value);
  return value;
}

/** Points a character has to divide: their Combat Awareness Rank. */
export function combatAwarenessPool(rank: number): number {
  return Math.max(0, Math.trunc(rank));
}

export type CombatAwarenessEffects = {
  /** Added to Initiative rolls. */
  initiative: number;
  /** Added to attack rolls. */
  attack: number;
  /** Added to Perception Checks. */
  perception: number;
  /** Subtracted from the first damage taken each Round. */
  damageDeflection: number;
  /** Added to the damage of the first successful attack each Round. */
  spotWeakness: number;
  /** True when natural 1s while attacking are ignored. */
  fumbleRecovery: boolean;
  /** Points assigned in total, and how many the pool holds. */
  spent: number;
  pool: number;
};

/** Resolve an allocation into the effects the rest of the engine applies. */
export function combatAwarenessEffects(
  allocation: CombatAwarenessAllocation,
  rank: number,
): CombatAwarenessEffects {
  const pool = combatAwarenessPool(rank);
  let spent = 0;
  const value = (id: string) => {
    const points = Math.max(0, Math.trunc(allocation[id] ?? 0));
    spent += points;
    return combatAwarenessValue(id, points);
  };
  const effects = {
    damageDeflection: value("damage_deflection"),
    fumbleRecovery: value("fumble_recovery") > 0,
    initiative: value("initiative_reaction"),
    attack: value("precision_attack"),
    spotWeakness: value("spot_weakness"),
    perception: value("threat_detection"),
  };
  return { ...effects, spent, pool };
}

/** Whether an allocation fits the pool. Over-spending is not a legal division. */
export function combatAwarenessFits(allocation: CombatAwarenessAllocation, rank: number): boolean {
  const { spent, pool } = combatAwarenessEffects(allocation, rank);
  return spent <= pool;
}

// ---------------------------------------------------------------------------
// Fixer — Operator
// ---------------------------------------------------------------------------

type OperatorMechanics = {
  haggle: { formula: string; skillId: string; addsRankToRoll: boolean };
};

export const OPERATOR_HAGGLE = mechanicsOf<OperatorMechanics>("fixer")?.haggle ?? null;

/**
 * The bonus a Fixer's Operator Rank adds to a deal.
 *
 * The printed Haggle formula is COOL + Trading + Operator Rank + 1d10, so the
 * Rank rides on the roll itself — it is not a discount applied afterwards.
 * Anyone who is not a Fixer adds nothing.
 */
export function operatorHaggleBonus(input: {
  abilityId: string | null | undefined;
  rank: number;
  skillId: string;
}): number {
  if (!OPERATOR_HAGGLE?.addsRankToRoll) return 0;
  if (input.abilityId !== "operator") return 0;
  if (input.skillId !== OPERATOR_HAGGLE.skillId) return 0;
  return Math.max(0, Math.trunc(input.rank));
}

// ---------------------------------------------------------------------------
// Rockerboy — Charismatic Impact
// ---------------------------------------------------------------------------

export type CharismaticAudience = { id: string; name: string; dv: number; maxSize?: number };

type CharismaticMechanics = {
  audiences: CharismaticAudience[];
  formula: string;
  failureLockoutDays: number;
  favorsByRank: {
    maxRank: number;
    single: string | null;
    small_group: string | null;
    huge_group: string | null;
  }[];
};

const CHARISMATIC = mechanicsOf<CharismaticMechanics>("rockerboy");

export const CHARISMATIC_AUDIENCES: CharismaticAudience[] = CHARISMATIC?.audiences ?? [];
export const CHARISMATIC_LOCKOUT_DAYS: number = CHARISMATIC?.failureLockoutDays ?? 0;

export function charismaticAudience(id: string): CharismaticAudience | null {
  return CHARISMATIC_AUDIENCES.find((audience) => audience.id === id) ?? null;
}

/**
 * What a Rockerboy of this Rank can ask of that size of audience, or null when
 * their Rank does not reach that far. A favour beyond your Rank is an automatic
 * failure in the rules, so the UI never offers one.
 */
export function charismaticFavor(rank: number, audienceId: string): string | null {
  const tier = (CHARISMATIC?.favorsByRank ?? []).find((row) => rank <= row.maxRank);
  if (!tier) return null;
  const key = audienceId as "single" | "small_group" | "huge_group";
  return tier[key] ?? null;
}

export type CharismaticImpactResult = CheckResult & {
  audience: CharismaticAudience;
  /** What this Rank can ask of that audience, or null when it reaches no further. */
  favor: string | null;
};

/**
 * Winning a crowd over: Charismatic Impact Rank + 1d10 against the DV their
 * numbers set. There is no STAT and no Skill in this roll — the Rank is the
 * whole of it, which is what makes it the Rockerboy's own.
 */
export function charismaticImpactCheck(
  rank: number,
  audienceId: string,
  rng: RNG = defaultRng,
): CharismaticImpactResult {
  const audience = charismaticAudience(audienceId);
  if (!audience) throw new Error(`Unknown audience "${audienceId}".`);
  const result = statSkillCheck([{ label: "Charismatic Impact", value: Math.max(0, rank) }], rng, {
    dv: audience.dv,
  });
  return { ...result, audience, favor: charismaticFavor(rank, audienceId) };
}
