/**
 * Encounter turn loop — strings the Phase 2 combat functions (combat.ts) into an
 * actual fight over an immutable EncounterState. Pure TypeScript: no React, no
 * backend. The app persists this state to encounters/encounter_combatants and
 * narrates it; the engine owns the sequencing and the mechanical outcomes.
 *
 * Cyberpunk RED death model: HP hitting 0 or below makes a combatant Mortally
 * Wounded, not dead. They keep acting and roll a Death Save at the start of each
 * of their Turns; a single failed save is death (CP:R pg. 186-187). So a 0-HP
 * combatant is still "in the fight" until a save fails or they are removed.
 */
import {
  applyDamage,
  resolveAttack,
  rollDamage,
  rollDeathSave,
  rollInitiative,
  woundActionPenalty,
  orderByInitiative,
  type ApplyDamageResult,
  type AttackResult,
  type DamageRoll,
  type DeathSaveResult,
  type InitiativeEntry,
} from "./combat";
import { woundStateFor, type WoundStateCode } from "./campaign";
import type { RollModifier } from "./rollLog";
import { defaultRng } from "./dice";
import type { RNG } from "./types";

export type CombatSide = "friendly" | "hostile" | "neutral";

export type Combatant = {
  id: string;
  name: string;
  side: CombatSide;
  isPlayer: boolean;
  ref: number;
  body: number;
  hpMax: number;
  hp: number;
  seriouslyWoundedThreshold: number;
  woundState: WoundStateCode;
  deathSavePenalty: number;
  spHead: number;
  spBody: number;
  /** Out of the fight: dead, unconscious, fled, or surrendered. */
  defeated: boolean;
  /** Initiative total (REF + 1d10); null until the encounter starts. */
  initiative: number | null;
};

export type EncounterStatus = "active" | "friendlies_won" | "friendlies_lost";

export type EncounterState = {
  round: number;
  /** Combatant ids in initiative order (highest first). */
  order: string[];
  /** Index into `order` for whose Turn it is. */
  activeIndex: number;
  status: EncounterStatus;
  combatants: Record<string, Combatant>;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clone(state: EncounterState): EncounterState {
  const combatants: Record<string, Combatant> = {};
  for (const [id, c] of Object.entries(state.combatants)) combatants[id] = { ...c };
  return { ...state, order: [...state.order], combatants };
}

function living(state: EncounterState, side: CombatSide): number {
  return Object.values(state.combatants).filter((c) => c.side === side && !c.defeated).length;
}

/** friendlies_won when no hostiles remain, friendlies_lost when no friendlies remain. */
export function outcome(state: EncounterState): EncounterStatus {
  if (living(state, "hostile") === 0) return "friendlies_won";
  if (living(state, "friendly") === 0) return "friendlies_lost";
  return "active";
}

export function combatantAt(state: EncounterState, index: number): Combatant | null {
  const id = state.order[index];
  return id ? (state.combatants[id] ?? null) : null;
}

/** The combatant whose Turn it currently is, or null if the encounter is over. */
export function currentCombatant(state: EncounterState): Combatant | null {
  if (state.status !== "active") return null;
  return combatantAt(state, state.activeIndex);
}

/** The player's combatant, for syncing HP / wound state back to campaign_vitals. */
export function playerCombatant(state: EncounterState): Combatant | null {
  return Object.values(state.combatants).find((c) => c.isPlayer) ?? null;
}

// ---------------------------------------------------------------------------
// Starting an encounter — roll initiative for everyone and order them.
// ---------------------------------------------------------------------------

export function startEncounter(combatants: Combatant[], rng: RNG = defaultRng): EncounterState {
  const entries: InitiativeEntry<Combatant>[] = combatants.map((combatant) => ({
    combatant,
    initiative: rollInitiative(combatant.ref, rng),
  }));
  const ordered = orderByInitiative(entries);

  const map: Record<string, Combatant> = {};
  for (const { combatant, initiative } of ordered) {
    map[combatant.id] = { ...combatant, initiative: initiative.total };
  }

  const state: EncounterState = {
    round: 1,
    order: ordered.map(({ combatant }) => combatant.id),
    activeIndex: 0,
    status: "active",
    combatants: map,
  };
  return { ...state, status: outcome(state) };
}

// ---------------------------------------------------------------------------
// Advancing the turn — skip defeated combatants, bump the round on wrap.
// ---------------------------------------------------------------------------

export function advanceTurn(state: EncounterState): EncounterState {
  const next = clone(state);
  if (next.status !== "active") return next;

  const count = next.order.length;
  for (let step = 1; step <= count; step++) {
    const rawIndex = state.activeIndex + step;
    const index = rawIndex % count;
    if (rawIndex >= count) next.round = state.round + Math.floor(rawIndex / count);
    const candidate = combatantAt(next, index);
    if (candidate && !candidate.defeated) {
      next.activeIndex = index;
      next.status = outcome(next);
      return next;
    }
  }
  // Everyone else is defeated; the encounter is over.
  next.status = outcome(next);
  return next;
}

// ---------------------------------------------------------------------------
// Death Saves at the start of a Mortally Wounded combatant's Turn.
// ---------------------------------------------------------------------------

export type BeginTurnResult = {
  state: EncounterState;
  deathSave: DeathSaveResult | null;
  died: boolean;
};

/**
 * Resolve the start of the current combatant's Turn. A Mortally Wounded
 * combatant rolls a Death Save; failing it defeats (kills) them. Advancing the
 * penalty is part of the save (CP:R pg. 187).
 */
export function beginTurn(state: EncounterState, rng: RNG = defaultRng): BeginTurnResult {
  const next = clone(state);
  const current = currentCombatant(next);
  if (!current || current.woundState !== "mortal") {
    return { state: next, deathSave: null, died: false };
  }

  const result = rollDeathSave(current.body, current.deathSavePenalty, rng);
  const updated = next.combatants[current.id]!;
  updated.deathSavePenalty = result.penaltyAfter;
  const died = !result.survived;
  if (died) updated.defeated = true;
  next.status = outcome(next);
  return { state: next, deathSave: result, died };
}

// ---------------------------------------------------------------------------
// Resolving an attack against a target combatant.
// ---------------------------------------------------------------------------

export type PerformAttackParams = {
  attackerId: string;
  targetId: string;
  /** "REF" for ranged, "DEX" for melee. */
  statLabel: string;
  statValue: number;
  skillLabel: string;
  skillValue: number;
  /** Range-table DV, or the defender's opposed roll. */
  dv: number;
  /** Weapon damage dice count (Nd6). */
  damageDice: number;
  /** Hit location; "head" is an Aimed head shot (×2 through head armor). */
  location?: "body" | "head";
  /** Extra situational modifiers (cover, aimed penalty, scope, ...). */
  modifiers?: RollModifier[];
  armorPiercing?: boolean;
  rubber?: boolean;
  bypassArmor?: boolean;
};

export type PerformAttackResult = {
  state: EncounterState;
  attack: AttackResult;
  damage: DamageRoll | null;
  applied: ApplyDamageResult | null;
  /** The target's wound state after the attack. */
  targetWoundState: WoundStateCode | null;
  targetDefeated: boolean;
};

export function performAttack(
  state: EncounterState,
  params: PerformAttackParams,
  rng: RNG = defaultRng,
): PerformAttackResult {
  const attacker = state.combatants[params.attackerId];
  const target = state.combatants[params.targetId];
  if (!attacker) throw new Error(`Unknown attacker "${params.attackerId}".`);
  if (!target) throw new Error(`Unknown target "${params.targetId}".`);

  // A wounded attacker takes their Wound State penalty on the Check (CP:R pg. 186).
  const woundPenalty = woundActionPenalty(attacker.woundState);
  const modifiers: RollModifier[] = [
    ...(params.modifiers ?? []),
    ...(woundPenalty !== 0 ? [{ label: "Wound", value: woundPenalty }] : []),
  ];

  const attack = resolveAttack(
    {
      statLabel: params.statLabel,
      statValue: params.statValue,
      skillLabel: params.skillLabel,
      skillValue: params.skillValue,
      dv: params.dv,
      modifiers,
    },
    rng,
  );

  if (!attack.hit) {
    return {
      state,
      attack,
      damage: null,
      applied: null,
      targetWoundState: target.woundState,
      targetDefeated: target.defeated,
    };
  }

  const damage = rollDamage(params.damageDice, rng);
  const location = params.location ?? "body";
  const aimedHead = location === "head";
  const sp = aimedHead ? target.spHead : target.spBody;

  // A Mortally Wounded target suffers a Critical Injury whenever damaged (pg. 186).
  const forcedCrit = target.woundState === "mortal";
  const criticalInjury = damage.criticalInjury || forcedCrit;

  const applied = applyDamage({
    hpBefore: target.hp,
    damage: damage.total,
    sp,
    aimedHead,
    criticalInjury,
    ...(params.armorPiercing !== undefined ? { armorPiercing: params.armorPiercing } : {}),
    ...(params.rubber !== undefined ? { rubber: params.rubber } : {}),
    ...(params.bypassArmor !== undefined ? { bypassArmor: params.bypassArmor } : {}),
  });

  const next = clone(state);
  const updated = next.combatants[params.targetId]!;
  const wasMortal = updated.woundState === "mortal";
  updated.hp = applied.hpAfter;
  if (aimedHead) updated.spHead = applied.spAfter;
  else updated.spBody = applied.spAfter;
  updated.woundState = woundStateFor(updated.hp, updated.hpMax, updated.seriouslyWoundedThreshold);
  // Damaging an already-Mortally-Wounded target raises their Death Save Penalty (pg. 186).
  if (wasMortal && applied.criticalInjury) updated.deathSavePenalty += 1;
  next.status = outcome(next);

  return {
    state: next,
    attack,
    damage,
    applied,
    targetWoundState: updated.woundState,
    targetDefeated: updated.defeated,
  };
}

/** Remove a combatant from the fight (flee, surrender, out-of-bounds). */
export function defeatCombatant(state: EncounterState, combatantId: string): EncounterState {
  const next = clone(state);
  const combatant = next.combatants[combatantId];
  if (!combatant) throw new Error(`Unknown combatant "${combatantId}".`);
  combatant.defeated = true;
  next.status = outcome(next);
  return next;
}
