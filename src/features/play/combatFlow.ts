/**
 * Sequencing a fight: the engine resolves, this module persists and logs.
 * No dice are rolled here and no hit/miss is decided here — every mechanical
 * answer comes from src/engine/encounter.ts.
 */
import {
  advanceTurn,
  applyCoverDamage,
  arenaFor,
  coverBlocking,
  nearestPointOn,
  rangeMetres,
  resolveAttack,
  woundActionPenalty,
  beginTurn,
  currentCombatant,
  performAttack,
  clampToArena,
  judgeAction,
  metresBetween,
  placeHostiles,
  singleShotDV,
  startEncounter as rollInitiativeOrder,
  rollDamage,
  stepToRange,
  tacticalStep,
  type CapabilitySnapshot,
  type Combatant,
  type CombatantRoleEffects,
  type EncounterState,
  type LegalityVerdict,
  type PerformAttackResult,
  type WeaponRangeType,
} from "@/engine";
import { logAttack, logCoverDamage, logDeathSave } from "@/features/campaign/combatLog";
import {
  createLiveEncounter,
  saveLiveEncounter,
  type LiveEncounter,
} from "@/features/campaign/encounterState";
import type { GmEnemy } from "@/features/gm/gmResponse";
import {
  appendCampaignEvent,
  type CampaignInventoryItem,
  type CampaignVitals,
  type FullCharacter,
  type Json,
} from "@/lib/backend";
import {
  hostileCombatant,
  metresApart,
  moveAllowance,
  playerCombatant as buildPlayerCombatant,
  type CombatantData,
  type CombatantTurnState,
} from "./encounterModel";

const MAX_NPC_TURNS = 24;

/** Roll initiative for a GM-proposed fight and persist it. */
export async function beginEncounter(input: {
  campaignId: string;
  characterId: string;
  beatId: string | null;
  name: string;
  character: FullCharacter;
  vitals: CampaignVitals;
  /** The campaign's kit, so armor bought mid-campaign actually protects. */
  inventory?: CampaignInventoryItem[];
  enemies: GmEnemy[];
  /** Which of the engine's arenas this is happening in. */
  arena?: string;
  /**
   * What the player's Role Ability brings into the fight — a Solo's Combat
   * Awareness division. Carried on their combatant so the engine applies it on
   * their own attacks AND on the ones they take.
   */
  roleEffects?: CombatantRoleEffects;
}): Promise<LiveEncounter> {
  const data: Record<string, CombatantData> = {};
  const combatants: Combatant[] = [];

  // The place decides the opening ranges, and so the opening DVs. It is the
  // engine's arena, chosen from a closed list — not a number the GM sent.
  const arena = arenaFor(input.arena);
  const spots = placeHostiles(arena, input.enemies.length);

  const player = buildPlayerCombatant(
    input.character,
    input.vitals,
    crypto.randomUUID(),
    input.inventory,
    arena,
  );
  if (input.roleEffects) player.combatant.roleEffects = input.roleEffects;
  combatants.push(player.combatant);
  data[player.combatant.id] = player.data;

  input.enemies.forEach((enemy, index) => {
    // Never the player's own start: a hostile at 0 m would read a melee DV off
    // a rifle and put somebody inside the character. placeHostiles always
    // returns one spot per enemy, so this is a floor, not a path.
    const spot = spots[index] ??
      arena.hostileSlots[0] ?? { x: arena.playerStart.x, y: arena.extent.height };
    const hostile = hostileCombatant(enemy, crypto.randomUUID(), spot);
    combatants.push(hostile.combatant);
    data[hostile.combatant.id] = hostile.data;
  });

  const state = rollInitiativeOrder(combatants);
  const live = await createLiveEncounter({
    campaignId: input.campaignId,
    characterId: input.characterId,
    beatId: input.beatId,
    name: input.name,
    state,
    data,
    arena: arena.key,
  });

  await appendCampaignEvent({
    campaign_id: input.campaignId,
    type: "encounter_started",
    summary: `${input.name} — initiative: ${state.order
      .map((id) => `${state.combatants[id]!.name} (${state.combatants[id]!.initiative ?? 0})`)
      .join(", ")}`,
    data: { encounterId: live.id } as unknown as Json,
    ...(input.beatId ? { beat_id: input.beatId } : {}),
  });

  return live;
}

/**
 * Who an NPC on their Turn shoots at.
 *
 * Until Backup existed every non-player combatant was hostile, so "the target"
 * was always the player. Friendly NPCs changed that: a Lawman's Backup takes
 * its Turn through the same loop, and must shoot the people it came to shoot.
 */
function targetFor(state: EncounterState, actor: Combatant): Combatant | null {
  const standing = Object.values(state.combatants).filter((c) => !c.defeated);
  if (actor.side === "hostile") {
    // Hostiles go for the player first, and for their friends when the player
    // is already down.
    const player = standing.find((c) => c.isPlayer);
    return player ?? standing.find((c) => c.side === "friendly") ?? null;
  }
  return standing.find((c) => c.side === "hostile") ?? null;
}

/**
 * Run every hostile turn until it is the player's turn again (or the fight is
 * over). Returns the updated encounter and plain lines describing what the
 * engine decided, for the GM to narrate.
 */
export async function runNpcTurns(
  campaignId: string,
  beatId: string | null,
  live: LiveEncounter,
): Promise<{ live: LiveEncounter; lines: string[] }> {
  let state = live.state;
  // Positions change during these turns, so the data map is carried the same
  // way state is rather than mutated in place.
  let data = live.data;
  // So does the cover, once somebody starts shooting it.
  let cover = live.cover;
  const arena = arenaFor(live.arena);
  const lines: string[] = [];

  for (let i = 0; i < MAX_NPC_TURNS; i += 1) {
    if (state.status !== "active") break;
    state = advanceTurn(state);
    const actor = currentCombatant(state);
    if (!actor) break;
    if (actor.isPlayer) break;

    const begun = beginTurn(state);
    state = begun.state;
    if (begun.deathSave) {
      await logDeathSave(campaignId, begun.deathSave, {
        combatantName: actor.name,
        died: begun.died,
        beatId,
      });
      lines.push(`${actor.name} Death Save: ${begun.died ? "failed and is dead" : "survived"}.`);
    }
    const live_actor = state.combatants[actor.id];
    if (!live_actor || live_actor.defeated) continue;

    const target = targetFor(state, live_actor);
    if (!target || target.defeated) break;

    let stats = data[actor.id];
    const targetStats = data[target.id];
    if (!stats || !targetStats) continue;

    // MOVE first, then shoot. A hostile with a pistol at 40m is standing in a
    // band it can barely hit from; walking in is the difference between a fight
    // and two people who happen to be outdoors. Deterministic and engine-owned
    // — WHICH target, when to run and whether to beg is #07's problem.
    if (stats.rangeType) {
      const step = tacticalStep({
        from: stats.position,
        target: targetStats.position,
        rangeType: stats.rangeType as WeaponRangeType,
        allowance: moveAllowance(stats.move, live_actor.woundState),
        arena,
      });
      if (step.metres > 0) {
        stats = { ...stats, position: step.position };
        data = { ...data, [actor.id]: stats };
        lines.push(
          `${actor.name} moves ${step.metres} m, now ${metresApart(stats, targetStats)} m from ${target.name}.`,
        );
      }
    }

    // The DV is MEASURED. This used to read a number the model wrote into its
    // response, which made the narrator the author of every DV in the fight.
    const dv = stats.rangeType
      ? singleShotDV(stats.rangeType as WeaponRangeType, metresApart(stats, targetStats))
      : null;
    if (dv === null) continue; // No printed DV: the engine will not invent one.

    // Something in the way takes the round instead. This is what stops a
    // player who steps behind concrete from being unkillable: the cover is
    // what gets shot, and eventually it stops being cover.
    //
    // CP:R pg. 182: a section of cover "can be attacked just like you can", and
    // the printed example rolls a Shoulder Arms Check against a DV read off the
    // weapon and the range. So this is a real attack that can MISS, taken at
    // the DV for the distance to the COVER rather than to the person behind it.
    const blocking = coverBlocking(arena, stats.position, targetStats.position, cover);
    const shielding = blocking[0];
    if (shielding) {
      const aimPoint = nearestPointOn(shielding.rect, stats.position);
      const coverDv = singleShotDV(
        stats.rangeType as WeaponRangeType,
        rangeMetres(stats.position, aimPoint),
      );
      if (coverDv === null) continue;
      const woundPenalty = woundActionPenalty(live_actor.woundState);
      const shot = resolveAttack({
        statLabel: "REF",
        statValue: live_actor.ref,
        skillLabel: stats.weaponName,
        skillValue: stats.attackSkill,
        dv: coverDv,
        ...(woundPenalty !== 0 ? { modifiers: [{ label: "Wound", value: woundPenalty }] } : {}),
      });
      const hit = shot.hit
        ? applyCoverDamage(shielding, cover, rollDamage(stats.damageDice).total)
        : null;
      if (hit) cover = hit.damageMap;
      await logCoverDamage(
        campaignId,
        { attack: shot, hit },
        {
          attackerName: actor.name,
          targetName: target.name,
          weapon: stats.weaponName,
          beatId,
        },
      );
      lines.push(
        !hit
          ? `${actor.name} fires at ${target.name} and hits nothing but the air around ` +
              `${shielding.label} (${shot.formula}).`
          : hit.destroyed
            ? `${actor.name} fires at ${target.name}; ${hit.label} comes apart and is gone.`
            : `${actor.name} fires at ${target.name}; ${hit.label} takes it ` +
              `(${hit.hpBefore} to ${hit.hpAfter}).`,
      );
      continue;
    }

    const result = performAttack(state, {
      attackerId: actor.id,
      targetId: target.id,
      statLabel: "REF",
      statValue: live_actor.ref,
      skillLabel: stats.weaponName,
      skillValue: stats.attackSkill,
      dv,
      damageDice: stats.damageDice,
    });
    state = result.state;

    await logAttack(
      campaignId,
      { attack: result.attack, damage: result.damage, applied: result.applied },
      {
        attackerName: actor.name,
        targetName: target.name,
        weapon: stats.weaponName,
        ...(result.targetWoundState ? { targetWoundState: result.targetWoundState } : {}),
        beatId,
      },
    );
    lines.push(describeAttack(actor.name, target.name, stats.weaponName, result));
  }

  const next: LiveEncounter = { ...live, state, data, cover };
  await saveLiveEncounter(next);
  return { live: next, lines };
}

/** A flat, factual line the GM must narrate rather than re-decide. */
export function describeAttack(
  attackerName: string,
  targetName: string,
  weapon: string,
  result: PerformAttackResult,
): string {
  if (!result.attack.hit) {
    return `${attackerName} attacks ${targetName} with ${weapon}: MISS (${result.attack.formula}).`;
  }
  const applied = result.applied;
  const parts = [
    `${attackerName} attacks ${targetName} with ${weapon}: HIT (${result.attack.formula})`,
  ];
  if (result.damage && applied) {
    parts.push(
      `${result.damage.total} damage rolled, ${applied.damageThroughArmor} through armor` +
        (applied.criticalInjury ? " plus a Critical Injury (+5 to HP)" : "") +
        `, ${targetName} is at ${applied.hpAfter} HP`,
    );
  }
  if (result.targetWoundState && result.targetWoundState !== "none") {
    parts.push(`${targetName} is ${result.targetWoundState.replace("_", " ")}`);
  }
  if (result.targetDefeated) parts.push(`${targetName} is out of the fight`);
  return `${parts.join("; ")}.`;
}

// ---------------------------------------------------------------------------
// The player going somewhere.
// ---------------------------------------------------------------------------

/** The Move and the refusal it might have earned. */
export type MovePlayerResult = {
  live: LiveEncounter;
  refusal: Extract<LegalityVerdict, { ok: false }> | null;
};

/**
 * The character breaking for somewhere, relative to somebody.
 *
 * There is no board to click a destination on yet (#05), so the two things a
 * player can say are "closer" and "away", and a Move spends the whole
 * allowance. What matters is that the METRES are the engine's: the model names
 * an intent and a person, and the distance that comes out of it — and therefore
 * the Range DV of every shot after it — is measured here.
 *
 * The Move gate in engine/legality.ts has existed since the legality layer
 * shipped and had never once been called, because nothing in the app could
 * move. It is what refuses a second Move in the same Round.
 */
export async function movePlayer(input: {
  campaignId: string;
  beatId: string | null;
  live: LiveEncounter;
  capability: CapabilitySnapshot;
  targetId: string;
  targetName: string;
  towards: "closer" | "away";
  intent: string;
}): Promise<MovePlayerResult> {
  const { live } = input;
  const player = Object.values(live.state.combatants).find((c) => c.isPlayer);
  if (!player) return { live, refusal: null };
  const from = live.data[player.id];
  const to = live.data[input.targetId];
  if (!from || !to) return { live, refusal: null };

  // The LIVE sheet value, not the one frozen into the encounter when it
  // started: judgeAction validates against snapshot.move, and two sources for
  // one number is how they end up disagreeing.
  const allowance = moveAllowance(input.capability.move, player.woundState);
  if (allowance <= 0) {
    return {
      live,
      refusal: { ok: false, code: "move_exceeded", reason: "They have no MOVE to spend." },
    };
  }
  const verdict = judgeAction(input.capability, { kind: "move", metres: allowance });
  if (!verdict.ok) return { live, refusal: verdict };

  const arena = arenaFor(live.arena);
  const before = metresApart(from, to);
  // Closing walks toward them; backing off walks the same distance the other
  // way. Either way it is bounded by MOVE and clamped to the arena, so a player
  // cannot back out of a room that has walls.
  const wanted = input.towards === "closer" ? Math.max(0, before - allowance) : before + allowance;
  const step = stepToRange(from.position, to.position, wanted, allowance);
  const position = clampToArena(arena, step.position);
  const moved = Math.round(metresBetween(from.position, position));
  if (moved <= 0) {
    return {
      live,
      refusal: {
        ok: false,
        code: "move_exceeded",
        reason: `There is nowhere to go — they are already at the edge of ${arena.label}.`,
      },
    };
  }

  const movedData = { ...from, position, turn: spentMove(from.turn, live.state.round, moved) };
  const next: LiveEncounter = {
    ...live,
    data: { ...live.data, [player.id]: movedData },
  };
  await saveLiveEncounter(next);

  const after = metresApart(movedData, to);
  await appendCampaignEvent({
    campaign_id: input.campaignId,
    type: MOVE_EVENT,
    summary:
      `${player.name} moves ${moved} m ${input.towards === "closer" ? "toward" : "away from"} ` +
      `${input.targetName} — ${before} m to ${after} m.`,
    data: {
      targetId: input.targetId,
      metres: moved,
      towards: input.towards,
      from: before,
      to: after,
      intent: input.intent,
    } as unknown as Json,
    ...(input.beatId ? { beat_id: input.beatId } : {}),
  });

  return { live: next, refusal: null };
}

/** The ledger type a Move is written under. */
export const MOVE_EVENT = "move";

/** Spend a Move out of this Round's economy, starting a fresh Round if needed. */
function spentMove(
  turn: CombatantTurnState | undefined,
  round: number,
  metres: number,
): CombatantTurnState {
  const prior = turn?.round === round ? turn : null;
  return {
    round,
    actionUsed: prior?.actionUsed ?? false,
    shotsThisRound: prior?.shotsThisRound ?? 0,
    shotWeaponId: prior?.shotWeaponId ?? null,
    metresMoved: (prior?.metresMoved ?? 0) + metres,
  };
}
