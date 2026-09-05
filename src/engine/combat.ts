/**
 * Combat resolution — the deterministic, rules-accurate math of a Cyberpunk RED
 * firefight. Pure TypeScript (no React, no backend): initiative, To-Hit, damage,
 * armor mitigation + ablation, wound penalties, and Death Saves. Every rule here
 * is transcribed from the core book's Friday Night Firefight section (pg. 170-188)
 * and cited inline. The LLM never does this math; it narrates what these return.
 *
 * NOT yet modeled (Phase 2b / later, flagged so nothing is silently assumed):
 * the specific Critical Injury table roll and ongoing injury effects (we detect a
 * Critical Injury and apply its +5 Bonus Damage, but not *which* injury); shields;
 * Suppressive Fire; melee/Brawling BODY-based damage scaling; and non-Basic ammo
 * beyond the Armor-Piercing and Rubber flags supported here.
 */
import { d10, defaultRng, rollDice, statSkillCheck, type CheckResult } from "./dice";
import type { RollModifier } from "./rollLog";
import type { RNG } from "./types";
import { AUTOFIRE_MAX_MULTIPLIER, type AutofireRangeType } from "./combatTables";
import type { WoundStateCode } from "./campaign";

// ===========================================================================
// Initiative — REF + 1d10, acting from highest to lowest (CP:R pg. 165).
// ===========================================================================

export type InitiativeRoll = { roll: number; ref: number; total: number };

export function rollInitiative(ref: number, rng: RNG = defaultRng): InitiativeRoll {
  const roll = d10(rng);
  return { roll, ref, total: ref + roll };
}

export type InitiativeEntry<T> = { combatant: T; initiative: InitiativeRoll };

/**
 * Order combatants high-to-low by initiative total, breaking ties by REF and
 * then by original order (a stable house-rule tiebreak for equal-REF ties).
 */
export function orderByInitiative<T>(entries: InitiativeEntry<T>[]): InitiativeEntry<T>[] {
  return entries
    .map((entry, index) => ({ entry, index }))
    .sort(
      (a, b) =>
        b.entry.initiative.total - a.entry.initiative.total ||
        b.entry.initiative.ref - a.entry.initiative.ref ||
        a.index - b.index,
    )
    .map(({ entry }) => entry);
}

// ===========================================================================
// To-Hit. Ranged: REF + Weapon Skill + 1d10 vs the range-table DV. The Defender
// wins ties (CP:R pg. 172: "you damage the Defender if you beat the DV; Defender
// wins in a tie"), so a hit requires the total to EXCEED the DV.
// ===========================================================================

/** Aimed Shot: -8 to the Check, at a maximum of 1 ROF (CP:R pg. 170). */
export const AIMED_SHOT_PENALTY = -8;

export type AttackInput = {
  /** "REF" for ranged, "DEX" for melee. */
  statLabel: string;
  statValue: number;
  /** "Handgun", "Shoulder Arms", "Autofire", "Brawling", ... */
  skillLabel: string;
  skillValue: number;
  /** From the range table (ranged) or the defender's opposed roll (dodge/melee). */
  dv: number;
  /** Situational modifiers: aimed shot, cover, wound penalty, scope, etc. */
  modifiers?: RollModifier[];
  now?: () => Date;
  /** Solo's Fumble Recovery: a natural 1 does not implode. */
  ignoreCriticalFailure?: boolean;
};

export type AttackResult = CheckResult & {
  /**
   * Combat rule: the Defender wins ties, so a hit needs total > DV. Same
   * answer as `success`, which is told the tie rule rather than assuming the
   * Check one — a log line saying MISS must not carry a formula saying
   * SUCCESS.
   */
  hit: boolean;
  /** total − DV. On a hit this is the amount you beat the DV by. */
  margin: number;
};

export function resolveAttack(input: AttackInput, rng: RNG = defaultRng): AttackResult {
  const modifiers: RollModifier[] = [
    { label: input.statLabel, value: input.statValue },
    { label: input.skillLabel, value: input.skillValue },
    ...(input.modifiers ?? []),
  ];
  const result = statSkillCheck(modifiers, rng, {
    dv: input.dv,
    tieGoesTo: "defender",
    ...(input.now ? { now: input.now } : {}),
    ...(input.ignoreCriticalFailure ? { ignoreCriticalFailure: true } : {}),
  });
  const margin = result.total - input.dv;
  return { ...result, margin, hit: result.success === true };
}

// ===========================================================================
// Damage. Weapon damage is Nd6. Two or more 6s among the damage dice inflict a
// Critical Injury (CP:R pg. 187).
// ===========================================================================

export type DamageRoll = {
  dice: number;
  rolls: number[];
  total: number;
  sixes: number;
  criticalInjury: boolean;
};

export function rollDamage(dice: number, rng: RNG = defaultRng): DamageRoll {
  const rolls = rollDice(dice, 6, rng);
  const sixes = rolls.filter((n) => n === 6).length;
  const total = rolls.reduce((sum, n) => sum + n, 0);
  return { dice, rolls, total, sixes, criticalInjury: sixes >= 2 };
}

// ===========================================================================
// Autofire. Roll 2d6, multiply by the amount you beat the DV by, capped by the
// weapon's Autofire number (SMG 3, AR 4). Both dice 6 → Critical Injury.
// (CP:R pg. 173.)
// ===========================================================================

export type AutofireDamage = {
  base: number;
  rolls: number[];
  multiplier: number;
  total: number;
  criticalInjury: boolean;
};

export function autofireDamage(
  weaponType: AutofireRangeType,
  marginBeatBy: number,
  rng: RNG = defaultRng,
): AutofireDamage {
  const rolls = rollDice(2, 6, rng);
  const base = rolls[0]! + rolls[1]!;
  const cap = AUTOFIRE_MAX_MULTIPLIER[weaponType];
  const multiplier = Math.max(0, Math.min(marginBeatBy, cap));
  return {
    base,
    rolls,
    multiplier,
    total: base * multiplier,
    criticalInjury: rolls[0] === 6 && rolls[1] === 6,
  };
}

// ===========================================================================
// Armor + applying damage (CP:R pg. 186). Subtract SP from the damage; the rest
// comes off HP. If any of the attack's damage got through, the armor ablates
// (SP −1, or −2 with Armor-Piercing, pg. 345). A Critical Injury adds 5 Bonus
// Damage directly to HP, which bypasses armor and never ablates it (pg. 187).
// ===========================================================================

export const CRITICAL_INJURY_BONUS_DAMAGE = 5;

export type ApplyDamageInput = {
  hpBefore: number;
  /** Rolled weapon damage (before armor). */
  damage: number;
  /** Armor SP at the hit location. */
  sp: number;
  /** Armor-Piercing ammo: ablate by 2 instead of 1 (CP:R pg. 345). */
  armorPiercing?: boolean;
  /** Rubber ammo: no Critical Injury, no ablation, never drops below 1 HP (pg. 346). */
  rubber?: boolean;
  /** Aimed head shot: ×2 the damage that gets through head armor (pg. 170). */
  aimedHead?: boolean;
  /** Fire/poison etc. ignore armor and do not ablate it (pg. 186). */
  bypassArmor?: boolean;
  /** Whether the damage roll inflicted a Critical Injury (2+ sixes). */
  criticalInjury?: boolean;
};

export type ApplyDamageResult = {
  damageThroughArmor: number;
  bonusDamage: number;
  totalHpLoss: number;
  hpAfter: number;
  spBefore: number;
  spAfter: number;
  ablated: boolean;
  criticalInjury: boolean;
};

export function applyDamage(input: ApplyDamageInput): ApplyDamageResult {
  const rubber = input.rubber ?? false;
  const bypass = input.bypassArmor ?? false;
  const effectiveSP = bypass ? 0 : Math.max(0, input.sp);

  let through = Math.max(0, input.damage - effectiveSP);
  if (input.aimedHead) through *= 2;

  const criticalInjury = (input.criticalInjury ?? false) && !rubber;
  const bonus = criticalInjury ? CRITICAL_INJURY_BONUS_DAMAGE : 0;

  let totalHpLoss = through + bonus;
  let hpAfter = input.hpBefore - totalHpLoss;
  if (rubber && input.hpBefore > 1 && hpAfter < 0) {
    hpAfter = 1;
    totalHpLoss = input.hpBefore - 1;
  }

  // Armor ablates only when the weapon's own damage got through — never from
  // bypassing damage or the Critical Injury bonus, and never for Rubber ammo.
  const ablates = !rubber && !bypass && through > 0;
  const spAfter = ablates ? Math.max(0, input.sp - (input.armorPiercing ? 2 : 1)) : input.sp;

  return {
    damageThroughArmor: through,
    bonusDamage: bonus,
    totalHpLoss,
    hpAfter,
    spBefore: input.sp,
    spAfter,
    ablated: ablates,
    criticalInjury,
  };
}

// ===========================================================================
// Wound-state penalties (CP:R pg. 186). Seriously Wounded −2 to all Actions;
// Mortally Wounded −4 to all Actions and −6 MOVE (minimum 1). Use woundStateFor
// (engine/campaign.ts) to derive the state from current HP.
// ===========================================================================

export function woundActionPenalty(state: WoundStateCode): number {
  switch (state) {
    case "serious":
      return -2;
    case "mortal":
      return -4;
    default:
      return 0;
  }
}

/** MOVE penalty for the wound state; the −6 has a floor of MOVE 1, applied by the caller. */
export function woundMovePenalty(state: WoundStateCode): number {
  return state === "mortal" ? -6 : 0;
}

// ===========================================================================
// Death Saves (CP:R pg. 187). At the start of each Turn while Mortally Wounded,
// roll 1d10; roll UNDER your BODY to live. A natural 10 always fails. Each save
// raises your Death Save Penalty by 1, added to every future save. One failed
// save is death — permanent.
// ===========================================================================

export type DeathSaveResult = {
  roll: number;
  penalty: number;
  effective: number;
  autoFail: boolean;
  survived: boolean;
  /** The Death Save Penalty to apply on the next save. */
  penaltyAfter: number;
};

export function rollDeathSave(
  body: number,
  penalty: number,
  rng: RNG = defaultRng,
): DeathSaveResult {
  const roll = d10(rng);
  const effective = roll + penalty;
  const autoFail = roll === 10;
  const survived = !autoFail && effective < body;
  return { roll, penalty, effective, autoFail, survived, penaltyAfter: penalty + 1 };
}

/** Retains the existing MOVE allowance; rules conversion is not a rendering decision. */
export function combatMoveAllowance(move: number, wound: WoundStateCode): number {
  return move <= 0 ? 0 : Math.max(1, move + woundMovePenalty(wound));
}
