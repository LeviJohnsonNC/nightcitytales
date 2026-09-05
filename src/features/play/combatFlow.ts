import { publishCombatFrames, type CombatFrame } from "./combatPlayback";
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
  combatGoalFor,
  defeatCombatant,
  describeGoalMet,
  describeMorale,
  describeVerdict,
  goalSatisfiedBy,
  judgeAction,
  mentalityFor,
  moraleTriggerFor,
  rollMorale,
  metresBetween,
  previewMovement,
  walkingPath,
  walkRoute,
  placeHostiles,
  singleShotDV,
  startEncounter as rollInitiativeOrder,
  rollDamage,
  stepToRange,
  tacticalStep,
  threatFor,
  weighForce,
  type ActionCost,
  type CapabilitySnapshot,
  type CombatGoal,
  type Combatant,
  type CombatantRoleEffects,
  type EncounterState,
  type LegalityVerdict,
  type PerformAttackResult,
  type Point,
  type WeaponRangeType,
  type WoundStateCode,
} from "@/engine";
import { logAttack, logCoverDamage, logDeathSave, logMorale } from "@/features/campaign/combatLog";
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
import { deathSaveOwed } from "./deathSavePrompt";
import {
  hostileCombatant,
  metresApart,
  moveAllowance,
  playerCombatant as buildPlayerCombatant,
  spendTurn,
  type CombatantData,
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
   * What the opposition came for. Decides when they stop: a crew that came to
   * rob you has what it wanted once you are down, and leaves. Omitted, they
   * came to kill, which is what every fight here used to assume.
   */
  goal?: CombatGoal;
  /**
   * What the player's Role Ability brings into the fight — a Solo's Combat
   * Awareness division. Carried on their combatant so the engine applies it on
   * their own attacks AND on the ones they take.
   */
  roleEffects?: CombatantRoleEffects;
}): Promise<{ live: LiveEncounter; lines: string[] }> {
  const data: Record<string, CombatantData> = {};
  const combatants: Combatant[] = [];

  // The place decides the opening ranges, and so the opening DVs. It is the
  // engine's arena, chosen from a closed list — not a number the GM sent.
  const arena = arenaFor(input.arena);
  const spots = placeHostiles(arena, input.enemies.length);
  // Why they are here. The caller knows — a force template carries it, and a
  // GM-composed fight falls back to the old implicit answer rather than
  // silently acquiring a mercy nobody asked for.
  const goal = combatGoalFor(input.goal);

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
    const hostile = hostileCombatant(enemy, crypto.randomUUID(), spot, goal);
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

  // Everyone who beat the player on Initiative acts before the player does.
  //
  // startEncounter parks the order on its highest roll, which is usually NOT
  // the player. Nothing else advances it: handOverTheTurn only runs off an
  // action the player takes, and they cannot take one when it is not their
  // turn. So a fight opened on a hostile and stayed there — the board was inert
  // because the order said so, and the only way out was the GM path, which
  // never checked whose turn it was and so let the player act out of order.
  //
  // Handing over HERE means a fight always arrives at the player's own Turn
  // with the initiative order already honoured, whoever rolled highest.
  const opened = await runNpcTurns(input.campaignId, input.beatId, live, "current");

  // What the player has walked into, weighed against what one Edgerunner can
  // take, and said OUT LOUD.
  //
  // The engine never refuses a fight over this — Night City is entitled to put
  // four Tyger Claws around a corner. What it may not do is present that as an
  // encounter and let the player find out over four Rounds, which is exactly
  // what happened in playtesting: four hostiles, four Actions to the player's
  // one, and 5 HP left by Round 3. The verdict goes in the ledger where the GM
  // reads it, so the narration can carry the weight the numbers already have.
  const weight = weighForce(
    input.enemies.map((e) => ({ key: e.key, name: e.name, profile: threatFor(e.profile) })),
  );

  // Written after the opening, so one event carries the whole start of the
  // fight: who rolled what, and what the people who won the roll did with it.
  await appendCampaignEvent({
    campaign_id: input.campaignId,
    type: "encounter_started",
    summary:
      `${input.name} — initiative: ${state.order
        .map((id) => `${state.combatants[id]!.name} (${state.combatants[id]!.initiative ?? 0})`)
        .join(", ")} — ${describeVerdict(weight.verdict)}.` +
      (opened.lines.length > 0 ? ` ${opened.lines.join(" ")}` : ""),
    data: {
      encounterId: live.id,
      verdict: weight.verdict,
      load: weight.load,
      mooks: weight.mooks,
      lieutenants: weight.lieutenants,
      bosses: weight.bosses,
    } as unknown as Json,
    ...(input.beatId ? { beat_id: input.beatId } : {}),
  });

  // The same bookkeeping any stretch of NPC Turns earns — the opening is just
  // the one that happens before the player has acted once.
  //
  // Without it, a fight that opens on a Mortally Wounded character arrives at
  // their Turn owing a Death Save with nothing to roll it: the card renders off
  // a `death_save_prompt` row in the ledger, and no path had written one. The
  // board said it was their Turn and every action was refused, with no card and
  // no explanation. Seed a mortal character from /combat and it is the first
  // thing that happens.
  await settleNpcTurns(input.campaignId, input.beatId, opened.live);

  return opened;
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
  /**
   * Whether the combatant currently on the clock acts, or the next one does.
   *
   * "next" is the ordinary case: the player has just taken their Turn, so the
   * order moves off them first. "current" is how a fight OPENS — initiative has
   * been rolled, nobody has acted, and whoever is at the top of the order is
   * owed their Turn rather than skipped.
   */
  from: "current" | "next" = "next",
): Promise<{ live: LiveEncounter; lines: string[] }> {
  let state = live.state;
  // Positions change during these turns, so the data map is carried the same
  // way state is rather than mutated in place.
  let data = live.data;
  // So does the cover, once somebody starts shooting it.
  let cover = live.cover;
  const arena = arenaFor(live.arena);
  const lines: string[] = [];
  const frames: CombatFrame[] = [];
  const capture = (kind: CombatFrame["kind"], text: string, details: Partial<CombatFrame> = {}) =>
    frames.push({ live: { ...live, state, data, cover }, kind, text, ...details });

  for (let i = 0; i < MAX_NPC_TURNS; i += 1) {
    if (state.status !== "active") break;
    // Everyone after the first, always. The first only when the caller says the
    // combatant on the clock has not acted yet.
    if (i > 0 || from === "next") state = advanceTurn(state);
    const actor = currentCombatant(state);
    if (!actor) break;
    if (actor.isPlayer) break;
    capture("turn", `${actor.name} is acting.`, { actorId: actor.id });

    const begun = beginTurn(state);
    state = begun.state;
    if (begun.deathSave) {
      if (begun.died) data = { ...data, [actor.id]: { ...data[actor.id]!, exitReason: "dead" } };
      await logDeathSave(campaignId, begun.deathSave, {
        combatantName: actor.name,
        died: begun.died,
        beatId,
      });
      lines.push(`${actor.name} Death Save: ${begun.died ? "failed and is dead" : "survived"}.`);
      capture("status", lines.at(-1)!, { actorId: actor.id });
    }
    const live_actor = state.combatants[actor.id];
    if (!live_actor || live_actor.defeated) continue;

    // Do they still want to be here?
    //
    // Checked at the top of their own Turn, before they act: a Mook who has
    // just watched half their crew go down gets to leave BEFORE taking another
    // shot at the player, which is the entire point. The engine decides only
    // that they are out — bolted or surrendered are both "no longer shooting at
    // you", and which of the two it was is the narrator's to say.
    const spent = (data[actor.id]?.moraleSpent ?? []) as string[];
    const trigger = moraleTriggerFor(state, live_actor, spent);
    if (trigger) {
      const check = rollMorale(mentalityFor(data[actor.id]?.threatRole ?? "mook"), trigger);
      data = {
        ...data,
        [actor.id]: { ...data[actor.id]!, moraleSpent: [...spent, trigger] },
      };
      await logMorale(campaignId, actor.name, check, beatId);
      lines.push(describeMorale(actor.name, check));
      if (check.broke) {
        state = defeatCombatant(state, actor.id);
        data = { ...data, [actor.id]: { ...data[actor.id]!, exitReason: "withdrawn" } };
        capture("status", lines.at(-1)!, { actorId: actor.id });
        continue;
      }
    }

    let stats = data[actor.id];

    const target = targetFor(state, live_actor);
    if (!target || target.defeated) break;

    // Do they still have a reason to shoot this person?
    //
    // Every fight here used to answer "yes, always": the opposition existed to
    // reduce the player to zero and then keep going. For a character with no
    // Medtech and no crew to drag them out, that is not grit — it is the only
    // failure state there is. A force that came to rob you has what it came for
    // once you are on the ground, and leaves.
    //
    // They leave THE FIGHT, not the fiction: what they take with them is the
    // narrator's, the same line drawn everywhere else in this module.
    const goal = combatGoalFor(stats?.combatGoal);
    if (target.isPlayer && goalSatisfiedBy(goal, target)) {
      state = defeatCombatant(state, actor.id);
      lines.push(describeGoalMet(actor.name, goal));
      capture("status", lines.at(-1)!, { actorId: actor.id });
      continue;
    }

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
      const path = walkingPath(arena, cover, stats.position, step.position);
      const walked = path
        ? walkRoute(path, moveAllowance(stats.move, live_actor.woundState))
        : null;
      if (walked && walked.metres > 0) {
        stats = { ...stats, position: walked.position };
        data = { ...data, [actor.id]: stats };
        lines.push(
          `${actor.name} moves ${walked.metres} m, now ${metresApart(stats, targetStats)} m from ${target.name}.`,
        );
        capture("move", lines.at(-1)!, { actorId: actor.id, path: walked.path });
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
      const coverBefore = cover;
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
      capture("cover", lines.at(-1)!, {
        actorId: actor.id,
        aim: aimPoint,
        hit: shot.hit,
        weaponRange: stats.rangeType,
        coverPieceId: shielding.id,
        coverBefore,
        impact: hit
          ? hit.destroyed
            ? "COVER DESTROYED"
            : `COVER ${hit.hpBefore} → ${hit.hpAfter} HP`
          : "MISS",
      });
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
    capture("attack", lines.at(-1)!, {
      actorId: actor.id,
      targetId: target.id,
      targetHpBefore: target.hp,
      hit: result.attack.hit,
      weaponRange: stats.rangeType,
      attackStyle: stats.rangeType ? "ranged" : "melee",
      impact: result.attack.hit
        ? `HIT · ${target.hp} → ${state.combatants[target.id]?.hp} HP`
        : "MISS",
    });
  }

  const next = await saveLiveEncounter({ ...live, state, data, cover });
  // No visual result escapes until the authoritative save succeeds.
  publishCombatFrames(
    campaignId,
    frames.map((frame) => ({ ...frame, live: { ...frame.live, version: next.version } })),
  );
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
// The bookkeeping that follows a stretch of NPC Turns.
//
// Both callers need it: the play loop after the player ends their Turn, and
// beginEncounter after the OPENING Turns. It lives here rather than in
// usePlay.ts because the opening is not a hook — the harness seeds a fight
// through combatFlow alone — and a fight that ends, or a save that comes due,
// must be written down whichever door it came through.
// ---------------------------------------------------------------------------

/**
 * What the ledger owes after a stretch of NPC Turns has run.
 *
 * Two things, and they are the same two whether the stretch was the OPENING —
 * everyone who beat the player on Initiative, before the player has acted once
 * — or the ordinary handover after the player ends their Turn. A fight that
 * finished gets said so; a Mortally Wounded player whose Turn has come round
 * gets the prompt their Death Save card is rendered from.
 *
 * The opening did neither, and the second one was reachable: seed a Mortally
 * Wounded character from /combat and the fight arrived at their Turn owing a
 * save with no card to roll it and every action silently refused.
 *
 * Returns what the caller needs to tell the GM: the closing line, if the fight
 * closed, and the combatant who owes a save, if one does.
 */
export async function settleNpcTurns(
  campaignId: string,
  beatId: string | null,
  live: LiveEncounter,
): Promise<{ status: string; owed: Combatant | null }> {
  const status = await closeOutFight(campaignId, beatId, live);
  const owed = deathSaveOwed(live);
  if (owed) await promptDeathSave(campaignId, beatId, owed.name);
  return { status, owed };
}

/** Announce a finished fight in the ledger, and describe it for the GM. */
export async function closeOutFight(
  campaignId: string,
  beatId: string | null,
  live: LiveEncounter,
): Promise<string> {
  if (live.state.status === "active") return "";
  const won = live.state.status === "friendlies_won";
  // "All down" is no longer true of every win. They may have broken and run,
  // or taken what they came for and gone — and the ledger already carries which
  // it was, line by line. This says only the thing that is true in all three.
  const summary = won
    ? "The opposition is finished; the fight is over."
    : "The player is down; the fight is over.";
  await appendCampaignEvent({
    campaign_id: campaignId,
    type: "encounter_ended",
    summary,
    data: { encounterId: live.id, status: live.state.status } as unknown as Json,
    ...(beatId ? { beat_id: beatId } : {}),
  });
  return ` ${summary}`;
}

/** Post the prompt the DeathSaveCard renders. */
async function promptDeathSave(
  campaignId: string,
  beatId: string | null,
  name: string,
): Promise<void> {
  await appendCampaignEvent({
    campaign_id: campaignId,
    type: "death_save_prompt",
    summary: `${name} must roll a Death Save`,
    data: {} as Json,
    ...(beatId ? { beat_id: beatId } : {}),
  });
}

// ---------------------------------------------------------------------------
// The player going somewhere.
// ---------------------------------------------------------------------------

/** The Move and the refusal it might have earned. */
export type MovePlayerResult = {
  live: LiveEncounter;
  refusal: Extract<LegalityVerdict, { ok: false }> | null;
};

/** A Move the gate allowed, priced and clamped — or the refusal it earned. */
type PlannedStep =
  | { ok: true; position: Point; path: Point[]; moved: number; cost: ActionCost }
  | { ok: false; refusal: Extract<LegalityVerdict, { ok: false }> };

/** Adapt live encounter state to the same engine planner the board previews. */
function planStep(input: {
  live: LiveEncounter;
  capability: CapabilitySnapshot;
  from: Point;
  to: Point;
}): PlannedStep {
  const plan = previewMovement({
    arena: arenaFor(input.live.arena),
    cover: input.live.cover,
    from: input.from,
    to: input.to,
    capability: input.capability,
  });
  return plan.ok ? plan : { ok: false, refusal: plan };
}

/**
 * The character breaking for somewhere, relative to somebody.
 *
 * What the model can ask for: a person and a direction. A Move here spends the
 * whole allowance, because "closer" without a destination has no other natural
 * length. The board's own path (movePlayerTo) is where a player picks the spot.
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

  const allowance = moveAllowance(input.capability.move, player.woundState);
  const before = metresApart(from, to);
  // Closing walks toward them; backing off walks the same distance the other
  // way. Either way it is bounded by MOVE and clamped to the arena, so a player
  // cannot back out of a room that has walls.
  const wanted = input.towards === "closer" ? Math.max(0, before - allowance) : before + allowance;
  const aim = stepToRange(from.position, to.position, wanted, allowance);
  const plan = planStep({
    live,
    capability: input.capability,
    from: from.position,
    to: clampToArena(arenaFor(live.arena), aim.position),
  });
  if (!plan.ok) return { live, refusal: plan.refusal };
  const { position, moved } = plan;

  const movedData = {
    ...from,
    position,
    turn: spendTurn(from.turn, live.state.round, plan.cost),
  };
  const next = await saveLiveEncounter({
    ...live,
    data: { ...live.data, [player.id]: movedData },
  });

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

  publishCombatFrames(input.campaignId, [
    {
      live: next,
      kind: "move",
      text: `${player.name} moves ${moved} m.`,
      actorId: player.id,
      path: plan.path,
    },
  ]);
  return { live: next, refusal: null };
}

/**
 * The character going to a spot the player picked on the board.
 *
 * The other half of cover, finally reachable. RED's cover is not a stance you
 * adopt (engine/cover.ts, pg. 182: "if they have line of sight on you, you
 * aren't in cover"), so taking cover deliberately is not a flag — it is
 * STANDING somewhere a piece of cover is between you and them, and the engine
 * answering that question the same way it always has. Which is why this
 * function has no notion of cover in it at all: it moves them, and then asks
 * coverBlocking what that changed.
 */
export async function movePlayerTo(input: {
  campaignId: string;
  beatId: string | null;
  live: LiveEncounter;
  capability: CapabilitySnapshot;
  /** Where on the board they were sent, in metres. */
  to: Point;
  intent: string;
}): Promise<MovePlayerResult> {
  const { live } = input;
  const player = Object.values(live.state.combatants).find((c) => c.isPlayer);
  if (!player) return { live, refusal: null };
  const from = live.data[player.id];
  if (!from) return { live, refusal: null };

  const arena = arenaFor(live.arena);
  const wanted = input.to;
  const plan = planStep({
    live,
    capability: input.capability,
    from: from.position,
    to: wanted,
  });
  if (!plan.ok) return { live, refusal: plan.refusal };
  const { position, moved } = plan;

  const movedData = {
    ...from,
    position,
    turn: spendTurn(from.turn, live.state.round, plan.cost),
  };
  const next = await saveLiveEncounter({
    ...live,
    data: { ...live.data, [player.id]: movedData },
  });

  // What the ground they chose is worth: who can still see them, and what is
  // standing in the way of everyone who cannot. Measured after the fact by the
  // same function the attack gate reads, so the board, the refusal and the
  // ledger cannot disagree about whether there is a shot.
  const blocked: string[] = [];
  let shielding: string | null = null;
  for (const other of Object.values(live.state.combatants)) {
    if (other.isPlayer || other.defeated || other.side !== "hostile") continue;
    const theirs = live.data[other.id];
    if (!theirs) continue;
    const between = coverBlocking(arena, position, theirs.position, live.cover);
    if (between.length === 0) continue;
    blocked.push(other.name);
    shielding = shielding ?? between[0]!.label;
  }

  await appendCampaignEvent({
    campaign_id: input.campaignId,
    type: MOVE_EVENT,
    summary:
      `${player.name} moves ${moved} m.` +
      (shielding
        ? ` ${shielding} is now between them and ${blocked.join(", ")} — no shot either way.`
        : ""),
    data: {
      metres: moved,
      to: position,
      path: plan.path,
      intent: input.intent,
      ...(blocked.length > 0 ? { coveredFrom: blocked, behind: shielding } : {}),
    } as unknown as Json,
    ...(input.beatId ? { beat_id: input.beatId } : {}),
  });

  publishCombatFrames(input.campaignId, [
    {
      live: next,
      kind: "move",
      text: `${player.name} moves ${moved} m.`,
      actorId: player.id,
      path: plan.path,
    },
  ]);
  return { live: next, refusal: null };
}

/** The ledger type a Move is written under. */
export const MOVE_EVENT = "move";
