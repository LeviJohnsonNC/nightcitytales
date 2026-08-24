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
import { defaultRng, rollDie, statSkillCheck, type CheckResult } from "./dice";
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

// ---------------------------------------------------------------------------
// Lawman — Backup
// ---------------------------------------------------------------------------

export type BackupTier = {
  minRank: number;
  maxRank: number;
  name: string;
  count: number;
  /** Combined STAT+Skill base they add 1d10 to, for attack or defense. */
  combat: number;
  sp: number;
  hp: number;
  move: number;
  body: number;
  note: string;
};

type BackupMechanics = {
  call: {
    tierUpOnArrivalRoll: number;
    twoGroupsAtRank: number;
  };
  tiers: BackupTier[];
};

const BACKUP = mechanicsOf<BackupMechanics>("lawman");

export const BACKUP_TIERS: BackupTier[] = BACKUP?.tiers ?? [];

/** The group a Lawman of this Rank can call, or null below the lowest tier. */
export function backupTierFor(rank: number): BackupTier | null {
  return BACKUP_TIERS.find((tier) => rank >= tier.minRank && rank <= tier.maxRank) ?? null;
}

/** The next tier up, for the arrival roll that sends someone better. */
export function backupTierAbove(tier: BackupTier | null): BackupTier | null {
  if (!tier) return null;
  const index = BACKUP_TIERS.indexOf(tier);
  return index >= 0 && index < BACKUP_TIERS.length - 1 ? (BACKUP_TIERS[index + 1] ?? null) : null;
}

export type BackupCall = {
  /** The d10 rolled against the Rank. */
  responseRoll: number;
  responded: boolean;
  /** Rounds until they arrive, on a 1d6. Null when nobody answered. */
  arrivalRoll: number | null;
  roundsUntilArrival: number | null;
  /** Who is coming, after any tier bump. Null when nobody answered. */
  tier: BackupTier | null;
  /** True when the arrival roll sent someone better than the Rank calls for. */
  tierUp: boolean;
  /** How many groups arrive — two only at the Rank the rules name. */
  groups: number;
};

/**
 * Call it in. Roll equal to or under your Backup Rank on a d10 to get anyone at
 * all; then 1d6 for how many Rounds until they arrive, where a 6 sends a better
 * class of help. Nobody answering is not the end of it — the rules let you try
 * again next Turn, which is the caller's business, not this function's.
 */
export function callBackup(rank: number, rng: RNG = defaultRng): BackupCall {
  const responseRoll = rollDie(10, rng);
  const responded = responseRoll <= Math.max(0, Math.trunc(rank));
  if (!responded) {
    return {
      responseRoll,
      responded: false,
      arrivalRoll: null,
      roundsUntilArrival: null,
      tier: null,
      tierUp: false,
      groups: 0,
    };
  }

  const arrivalRoll = rollDie(6, rng);
  const base = backupTierFor(rank);
  const bumped = arrivalRoll === (BACKUP?.call.tierUpOnArrivalRoll ?? 6);
  const tier = (bumped ? backupTierAbove(base) : null) ?? base;
  return {
    responseRoll,
    responded: true,
    arrivalRoll,
    roundsUntilArrival: arrivalRoll,
    tier,
    tierUp: bumped && tier !== base,
    groups: rank >= (BACKUP?.call.twoGroupsAtRank ?? 10) ? 2 : 1,
  };
}

// ---------------------------------------------------------------------------
// Media — Credibility
// ---------------------------------------------------------------------------

export type RumorTier = { id: string; name: string; passiveDv: number; activeDv: number };
export type CredibilityRank = {
  maxRank: number;
  audience: string;
  believeIn10: number;
  impact: string;
};

type CredibilityMechanics = {
  rumors: { tiers: RumorTier[] };
  publishing: {
    evidenceBonus: { pieces: number; bonus: number }[];
    luckForbidden: boolean;
    byRank: CredibilityRank[];
  };
};

const CREDIBILITY = mechanicsOf<CredibilityMechanics>("media");

export const RUMOR_TIERS: RumorTier[] = CREDIBILITY?.rumors.tiers ?? [];
/** Luck can never be spent on a Believability Check. */
export const BELIEVABILITY_FORBIDS_LUCK: boolean = CREDIBILITY?.publishing.luckForbidden ?? false;

/** What a Media of this Rank reaches, and how often they are believed. */
export function credibilityFor(rank: number): CredibilityRank | null {
  return (CREDIBILITY?.publishing.byRank ?? []).find((row) => rank <= row.maxRank) ?? null;
}

/** The believe-chance bump hard evidence buys, per the printed thresholds. */
export function evidenceBonus(pieces: number): number {
  const count = Math.max(0, Math.trunc(pieces));
  let bonus = 0;
  for (const step of CREDIBILITY?.publishing.evidenceBonus ?? []) {
    if (count >= step.pieces) bonus += step.bonus;
  }
  return bonus;
}

export type BelievabilityResult = {
  roll: number;
  /** The chance in 10 this story had, evidence included. */
  chance: number;
  believed: boolean;
  audience: string;
  impact: string;
};

/**
 * Does the audience buy it? A d10 against the Rank's chance in ten, raised by
 * hard evidence. Luck cannot touch this roll, which is why it takes no
 * modifiers at all.
 */
export function believabilityCheck(
  rank: number,
  evidencePieces: number,
  rng: RNG = defaultRng,
): BelievabilityResult {
  const band = credibilityFor(rank);
  if (!band) throw new Error(`No Credibility band for Rank ${rank}.`);
  const chance = Math.min(10, band.believeIn10 + evidenceBonus(evidencePieces));
  const roll = rollDie(10, rng);
  return { roll, chance, believed: roll <= chance, audience: band.audience, impact: band.impact };
}

// ---------------------------------------------------------------------------
// Tech — Maker
// ---------------------------------------------------------------------------

export type MakerSpecialty = { id: string; name: string };

type MakerMechanics = {
  specialties: MakerSpecialty[];
  ranksPerMakerRank: number;
  fieldExpertise: {
    addsRankToSkills: string[];
    juryRig: { minRank: number; holdsMinutesPerRank: number };
  };
};

const MAKER = mechanicsOf<MakerMechanics>("tech");

export const MAKER_SPECIALTIES: MakerSpecialty[] = MAKER?.specialties ?? [];
export const MAKER_RANKS_PER_RANK: number = MAKER?.ranksPerMakerRank ?? 0;
export const FIELD_EXPERTISE_SKILLS: string[] = MAKER?.fieldExpertise.addsRankToSkills ?? [];

/** Specialty ranks a Tech has to spend: two for every Rank of Maker. */
export function makerSpecialtyPool(makerRank: number): number {
  return Math.max(0, Math.trunc(makerRank)) * MAKER_RANKS_PER_RANK;
}

/**
 * What Field Expertise adds to a Skill Check.
 *
 * The Rank rides on the listed Tech Skills and on nothing else, and only for
 * work that is not itself a Maker job — repairing a door is Field Expertise,
 * building a new one is Fabrication.
 */
export function fieldExpertiseBonus(input: {
  abilityId: string | null | undefined;
  specialtyRank: number;
  skillId: string;
}): number {
  if (input.abilityId !== "maker") return 0;
  if (!FIELD_EXPERTISE_SKILLS.includes(input.skillId)) return 0;
  return Math.max(0, Math.trunc(input.specialtyRank));
}

/** How long a jury-rig holds before the item reverts: 10 minutes a Rank. */
export function juryRigMinutes(specialtyRank: number): number {
  const rank = Math.max(0, Math.trunc(specialtyRank));
  if (rank < (MAKER?.fieldExpertise.juryRig.minRank ?? 1)) return 0;
  return rank * (MAKER?.fieldExpertise.juryRig.holdsMinutesPerRank ?? 0);
}

// ---------------------------------------------------------------------------
// Nomad — Moto
// ---------------------------------------------------------------------------

type MotoMechanics = { vehicleFamiliarity: { addsRankToSkills: string[] } };

export const VEHICLE_FAMILIARITY_SKILLS: string[] =
  mechanicsOf<MotoMechanics>("nomad")?.vehicleFamiliarity.addsRankToSkills ?? [];

/**
 * A Nomad adds their Moto Rank to anything with a steering wheel or a stick —
 * driving, piloting, and the Tech Skills for the same machines.
 */
export function vehicleFamiliarityBonus(input: {
  abilityId: string | null | undefined;
  rank: number;
  skillId: string;
}): number {
  if (input.abilityId !== "moto") return 0;
  if (!VEHICLE_FAMILIARITY_SKILLS.includes(input.skillId)) return 0;
  return Math.max(0, Math.trunc(input.rank));
}

// ---------------------------------------------------------------------------
// Medtech — Medicine
// ---------------------------------------------------------------------------

export type MedicineSpecialty = {
  id: string;
  name: string;
  skillId: string;
  skillPerPoint: number;
  maxSkill: number;
  maxPoints: number | null;
};

export type MedicalDrug = {
  id: string;
  name: string;
  effect: string;
  hpPerDayBonus?: number;
  days?: number;
  healsStats?: string[];
  perDay?: number;
};

type MedicineMechanics = {
  specialties: MedicineSpecialty[];
  medicalTechSkillIsSumOf: string[];
  synthesis: { dv: number; skillId: string; materialsCost: number; drugsUnlockedPerPoint: number };
  drugs: MedicalDrug[];
};

const MEDICINE = mechanicsOf<MedicineMechanics>("medtech");

export const MEDICINE_SPECIALTIES: MedicineSpecialty[] = MEDICINE?.specialties ?? [];
export const MEDICAL_DRUGS: MedicalDrug[] = MEDICINE?.drugs ?? [];
export const SYNTHESIS_DV: number = MEDICINE?.synthesis.dv ?? 0;
export const SYNTHESIS_MATERIALS_COST: number = MEDICINE?.synthesis.materialsCost ?? 0;

/** The most points a Specialty will take, or null where the rules set no cap. */
export function medicineSpecialtyCap(id: string): number | null {
  return MEDICINE_SPECIALTIES.find((s) => s.id === id)?.maxPoints ?? null;
}

/**
 * The Skill Levels a Medtech's Specialty points buy them.
 *
 * Surgery is two Skill points a Specialty point; Medical Tech is one, and both
 * Medical Tech Specialties feed the same Skill — which is why they are summed
 * rather than taken separately. Everything caps where the rules cap it.
 */
export function medicineSkillLevels(points: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const specialty of MEDICINE_SPECIALTIES) {
    const cap = specialty.maxPoints;
    const spent = Math.max(0, Math.trunc(points[specialty.id] ?? 0));
    const counted = cap === null ? spent : Math.min(spent, cap);
    const gained = counted * specialty.skillPerPoint;
    out[specialty.skillId] = Math.min(specialty.maxSkill, (out[specialty.skillId] ?? 0) + gained);
  }
  return out;
}

/** How many of the printed drugs this Medtech can synthesize. */
export function unlockedDrugs(pharmaceuticalPoints: number): MedicalDrug[] {
  const perPoint = MEDICINE?.synthesis.drugsUnlockedPerPoint ?? 1;
  const count = Math.max(0, Math.trunc(pharmaceuticalPoints)) * perPoint;
  return MEDICAL_DRUGS.slice(0, count);
}

/** Doses made from one 200eb batch: as many as the Medical Tech Skill Level. */
export function synthesisDoses(medicalTechSkill: number): number {
  return Math.max(0, Math.trunc(medicalTechSkill));
}

/** Speedheal restores BODY + WILL, and never to someone Mortally Wounded. */
export function speedhealAmount(stats: { body?: number; will?: number }): number {
  return Math.max(0, Math.trunc(stats.body ?? 0)) + Math.max(0, Math.trunc(stats.will ?? 0));
}

// ---------------------------------------------------------------------------
// Exec — Teamwork
// ---------------------------------------------------------------------------

export type LoyaltyChange = { id: string; label: string; delta: number };

type TeamworkMechanics = {
  teamMembers: {
    byRank: { rank: number; members: number }[];
    classes: string[];
  };
  loyalty: {
    capBetweenSessions: number;
    betrayAtOrBelow: number;
    gains: LoyaltyChange[];
    losses: LoyaltyChange[];
  };
  replacement: { startingLoyalty: number; hiringFee: number };
  perksByRank: { rank: number; perk: string }[];
};

const TEAMWORK = mechanicsOf<TeamworkMechanics>("exec");

export const TEAM_MEMBER_CLASSES: string[] = TEAMWORK?.teamMembers.classes ?? [];
export const LOYALTY_GAINS: LoyaltyChange[] = TEAMWORK?.loyalty.gains ?? [];
export const LOYALTY_LOSSES: LoyaltyChange[] = TEAMWORK?.loyalty.losses ?? [];
export const LOYALTY_CAP: number = TEAMWORK?.loyalty.capBetweenSessions ?? 10;
export const REPLACEMENT_FEE: number = TEAMWORK?.replacement.hiringFee ?? 0;

/** How many Team Members this Rank supports. */
export function teamMemberSlots(rank: number): number {
  let slots = 0;
  for (const step of TEAMWORK?.teamMembers.byRank ?? []) {
    if (rank >= step.rank) slots = Math.max(slots, step.members);
  }
  return slots;
}

/** The Corp perks this Rank has earned, in the order they were granted. */
export function execPerks(rank: number): string[] {
  return (TEAMWORK?.perksByRank ?? []).filter((row) => rank >= row.rank).map((row) => row.perk);
}

export type TeamMemberRoll = {
  /** 1d6 sets their STATs; the value is kept so a reroll is traceable. */
  statRoll: number;
  loyalty: number;
};

/** Roll up a new Team Member: 1d6 for STATs, 1d6+1 for starting Loyalty. */
export function rollTeamMember(rng: RNG = defaultRng): TeamMemberRoll {
  return { statRoll: rollDie(6, rng), loyalty: rollDie(6, rng) + 1 };
}

export type LoyaltySave = {
  roll: number;
  loyalty: number;
  /** True when they do the thing asked. */
  passed: boolean;
  /** True when Loyalty has fallen far enough that they work against you. */
  betrays: boolean;
};

/**
 * Asking a Team Member to do something: roll 1d6 under their current Loyalty.
 *
 * A failed Save is not simply a refusal — the rules let it be a refusal, a
 * botch, or worse — so this reports the failure and leaves what it looks like
 * to the GM. At or below zero Loyalty they are actively against you, which no
 * roll rescues.
 */
export function loyaltySave(loyalty: number, rng: RNG = defaultRng): LoyaltySave {
  const betrayAt = TEAMWORK?.loyalty.betrayAtOrBelow ?? 0;
  const roll = rollDie(6, rng);
  if (loyalty <= betrayAt) {
    return { roll, loyalty, passed: false, betrays: true };
  }
  return { roll, loyalty, passed: roll < loyalty, betrays: false };
}

/**
 * Loyalty after a shift. It caps at 10 between sessions and has no floor: a
 * member driven below zero is gone at the end of the session, which is the
 * caller's business to notice.
 */
export function loyaltyAfter(current: number, delta: number): number {
  return Math.min(LOYALTY_CAP, Math.trunc(current) + Math.trunc(delta));
}
