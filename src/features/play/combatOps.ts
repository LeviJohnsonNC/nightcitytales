/** Shared combat operations for any campaign phase. No mission or narrator dependency. */
import {
  currentCombatant,
  judgeAction,
  remainingCombatTurn,
  previewAttack,
  BACKUP_TIERS,
  type CapabilitySnapshot,
  type Point,
  type BeginTurnResult,
  type PerformAttackResult,
} from "@/engine";
import {
  appendCampaignEvent,
  getCampaign,
  getCharacter,
  listCampaignEvents,
  updateCampaign,
  type Campaign,
  type CampaignVitals,
  type FullCharacter,
  type CampaignInventoryItem,
  type CampaignCyberware,
  type CampaignEvent,
  type Json,
} from "@/lib/backend";
import { logAttack, logDeathSave } from "@/features/campaign/combatLog";
import { reloadWeapon } from "@/features/campaign/shopping";
import {
  loadLiveEncounter,
  saveLiveEncounter,
  EncounterChangedError,
  type LiveEncounter,
} from "@/features/campaign/encounterState";
import {
  closeOutFight,
  describeAttack,
  movePlayerTo,
  runNpcTurns,
  settleNpcTurns,
} from "./combatFlow";
import { publishCombatFrames } from "./combatPlayback";
import {
  distanceToTarget,
  pendingAttackFrom,
  type AttackOption,
  type PendingAttack,
} from "./attackPrompt";
import { deathSaveOwed, type PendingDeathSave } from "./deathSavePrompt";
import {
  pendingBackup,
  withAbilityState,
  combatRoleEffects,
  withPlayerRoleEffects,
} from "./roleAbilityModel";
import { arriveBackup } from "./backupFlow";
import { ammoAfterShot, buildCapabilitySnapshot, withAttackSpent } from "./capabilityModel";
import { spendTurn } from "./encounterModel";
import { payLuck } from "./rollCosts";

/** The live inputs combat needs; a Life encounter has no beat. */
export type CombatBundle = {
  campaign: Campaign;
  vitals: CampaignVitals;
  character: FullCharacter;
  inventory: CampaignInventoryItem[];
  cyberware: CampaignCyberware[];
  events: CampaignEvent[];
  encounter: LiveEncounter | null;
  beat: { id: string } | null;
};

/** Load combat without resolving a mission, querying its runtime, or calling the GM. */
export async function loadCombat(campaignId: string) {
  const full = await getCampaign(campaignId);
  if (!full) throw new Error("Campaign not found.");
  if (!full.vitals) throw new Error("Campaign has no vitals to play with.");
  const character = await getCharacter(full.campaign.character_id);
  if (!character) throw new Error("This campaign's character no longer exists.");
  const events = await listCampaignEvents(campaignId);
  const encounter = withPlayerRoleEffects(
    await loadLiveEncounter(campaignId),
    combatRoleEffects(full.campaign, character),
  );
  return { ...full, vitals: full.vitals, character, events, encounter, beat: null };
}

export function snapshotFor(bundle: CombatBundle): CapabilitySnapshot {
  return buildCapabilitySnapshot({
    character: bundle.character,
    vitals: bundle.vitals,
    inventory: bundle.inventory,
    cyberware: bundle.cyberware,
    roleState: bundle.campaign.role_state,
    encounter: bundle.encounter,
    events: bundle.events,
    beatId: bundle.beat?.id ?? null,
  });
}

/**
 * Persist the rolled attack and its costs, preserving the player's remaining
 * choices. Only a finished turn advances hostiles and narrates the exchange.
 */
export async function commitAttack(
  bundle: CombatBundle,
  pending: PendingAttack,
  option: AttackOption,
  result: PerformAttackResult,
  luckSpent = 0,
): Promise<void> {
  if (!bundle.encounter) throw new Error("There is no encounter to attack in.");
  if (
    pending.encounterVersion !== undefined &&
    pending.encounterVersion !== bundle.encounter.version
  ) {
    throw new EncounterChangedError();
  }
  const preview = previewAttack(snapshotFor(bundle), pending.target.id, option.weapon.itemId);
  if (preview.gap) throw new Error(preview.gap);
  if (owesASave(bundle)) throw new Error("Resolve the Death Save before attacking.");
  const campaignId = bundle.campaign.id;
  const beatId = pending.beatId;

  // The Round's bookkeeping: the Action is spent, the shot counts against the
  // weapon's ROF, and a round comes out of the magazine.
  const live: LiveEncounter = {
    ...bundle.encounter,
    state: result.state,
    data: withAttackSpent(
      { ...bundle.encounter, state: result.state },
      pending.attacker.id,
      option.weapon.itemId,
    ),
  };
  const spent = ammoAfterShot(bundle.inventory, option.weapon.itemId);
  // The saved encounter, at its new version: the hostile Turns this attack
  // triggers save again, and sending the pre-attack token there would refuse
  // the fight's own next write.
  const saved = await saveLiveEncounter(
    live,
    spent ? { inventoryId: spent.inventoryId, loaded: spent.ammoLoaded } : null,
  );
  await logAttack(
    campaignId,
    { attack: result.attack, damage: result.damage, applied: result.applied },
    {
      attackerName: pending.attacker.name,
      targetName: pending.target.name,
      weapon: option.weapon.name,
      ...(spent
        ? {
            ammo: {
              inventoryId: spent.inventoryId,
              before: spent.ammoLoaded + 1,
              after: spent.ammoLoaded,
            },
          }
        : {}),
      ...(result.targetWoundState ? { targetWoundState: result.targetWoundState } : {}),
      beatId,
    },
  );
  await payLuck(bundle, luckSpent);
  publishCombatFrames(campaignId, [
    {
      live: saved,
      kind: "attack",
      actorId: pending.attacker.id,
      targetId: pending.target.id,
      targetHpBefore: pending.target.hp,
      hit: result.attack.hit,
      weaponRange: option.weapon.rangeType,
      attackStyle: option.weapon.melee ? "melee" : "ranged",
      text: describeAttack(pending.attacker.name, pending.target.name, option.weapon.name, result),
      impact: result.attack.hit
        ? `HIT · ${pending.target.hp} → ${result.state.combatants[pending.target.id]?.hp} HP`
        : "MISS",
    },
  ]);

  await finishCombatAction(bundle, saved, beatId, [
    describeAttack(pending.attacker.name, pending.target.name, option.weapon.name, result),
  ]);
}

/** Retain the player's remaining choices; only a spent turn advances initiative. */
export async function finishCombatAction(
  bundle: CombatBundle,
  live: LiveEncounter,
  beatId: string | null,
  lines: string[] = [],
): Promise<void> {
  if (live.state.status !== "active") {
    await closeOutFight(bundle.campaign.id, beatId, live);
    return;
  }
  if (deathSaveOwed(live)) return;
  // Re-read ammunition and vitals after the action. Previewing against the
  // pre-shot magazine would keep an empty weapon's second shot available.
  const full = await getCampaign(bundle.campaign.id);
  if (!full?.vitals) throw new Error("Campaign could not be reloaded after the action.");
  const fresh = { ...bundle, vitals: full.vitals, inventory: full.inventory, encounter: live };
  if (remainingCombatTurn(snapshotFor(fresh)).exhausted) {
    await handOverTheTurn(fresh, live, beatId, lines);
  }
}

/**
 * Is the player standing on their own Turn with a Death Save unrolled?
 *
 * CP:R pg. 187: a Mortally Wounded character makes the save at the start of
 * their Turn, before they do anything else. The board is disabled while one is
 * owed, but the rule belongs behind the buttons as well as on them — every
 * board action is a write, and a refusal that only lives in the component is
 * one stale render away from being no refusal at all.
 */
export function owesASave(bundle: CombatBundle): boolean {
  return Boolean(deathSaveOwed(bundle.encounter));
}

/**
 * The player walking to a spot they picked on the board.
 *
 * The first player action in the game that never goes near the model: the
 * board hands the engine a point, the engine prices and clamps it, and the GM
 * is told afterwards. An unused Action remains available; a move that spends
 * the final remaining choice hands the Turn over.
 */
export async function commitBoardMove(bundle: CombatBundle, to: Point): Promise<void> {
  if (!bundle.encounter) throw new Error("There is no fight to move in.");
  if (owesASave(bundle)) return;
  const beatId = bundle.beat?.id ?? null;
  const moved = await movePlayerTo({
    campaignId: bundle.campaign.id,
    beatId,
    live: bundle.encounter,
    capability: snapshotFor(bundle),
    to,
    intent: "moves on the board",
  });
  if (moved.refusal) {
    await appendCampaignEvent({
      campaign_id: bundle.campaign.id,
      type: "action_refused",
      // The same shape narrate()'s own refusals take, so the GM reads one
      // kind of refusal rather than two.
      summary: `Not possible: ${moved.refusal.reason}`,
      data: { code: moved.refusal.code } as unknown as Json,
      ...(beatId ? { beat_id: beatId } : {}),
    });
  } else {
    await finishCombatAction(bundle, moved.live, beatId);
  }
}

/**
 * The player calling a shot by clicking somebody on the board.
 *
 * Deliberately the SMALLEST possible change to how an attack happens: it posts
 * the same attack_prompt the GM's proposal posts, so the card, the dice, the
 * Luck stepper and the whole resolution path behind them are untouched. Only
 * who started it moves — from the model naming a target to the player pointing
 * at one — and the gate judges it either way.
 */
export async function commitCallShot(
  bundle: CombatBundle,
  targetId: string,
  weaponItemId: string,
): Promise<void> {
  const live = bundle.encounter;
  if (!live || live.state.status !== "active") return;
  if (owesASave(bundle)) return;
  const target = live.state.combatants[targetId];
  if (!target || target.defeated || target.isPlayer) return;

  // Clicking the same person twice is one shot, not two prompts.
  //
  // The ledger is append-only and the card reads the NEWEST unresolved prompt,
  // so a second identical row changed nothing anybody could see — it just sat
  // in the log, and in the eight lines of recent events the GM is handed, where
  // a few impatient clicks push the actual fiction out of the window. Asked
  // through the same function the card is rendered from, so "already prompted"
  // and "already showing" cannot mean two different things.
  const showing = pendingAttackFrom(
    bundle.events,
    bundle.character,
    live,
    bundle.inventory,
    bundle.vitals,
  );
  if (showing && showing.target.id === target.id) return;
  const campaignId = bundle.campaign.id;
  const beatId = bundle.beat?.id ?? null;
  const beatFields = beatId ? { beat_id: beatId } : {};

  // Measured, never asserted — the same distance the DV on the board was read
  // at, and the same one the card will re-measure when the trigger is pulled.
  const metres = distanceToTarget(live, targetId);
  const preview = previewAttack(snapshotFor(bundle), targetId, weaponItemId);
  const verdict = preview.verdict;
  if (preview.gap && verdict.ok) throw new Error(preview.gap);
  if (!verdict.ok) {
    await appendCampaignEvent({
      campaign_id: campaignId,
      type: "action_refused",
      summary: `Not possible: ${verdict.reason}`,
      data: { code: verdict.code } as unknown as Json,
      ...beatFields,
    });
    return;
  }

  await appendCampaignEvent({
    campaign_id: campaignId,
    type: "attack_prompt",
    summary: `Attack ${target.name} at ${metres}m`,
    data: {
      targetId: target.id,
      targetName: target.name,
      distance: metres,
      intent: "takes the shot",
    } as unknown as Json,
    ...beatFields,
  });
}

/**
 * Putting rounds back in the gun, mid-fight.
 *
 * Reloading existed only in Life's shop, where nothing budgets a Turn. In a
 * firefight it is an Action like any other, so it goes through the gate — which
 * refuses it when the Action is spent, the gun is full, or there is nothing
 * left to load — and then spends what the gate priced.
 */
export async function commitReload(bundle: CombatBundle, weaponItemId: string): Promise<void> {
  if (owesASave(bundle)) return;
  const campaignId = bundle.campaign.id;
  const beatId = bundle.beat?.id ?? null;
  const verdict = judgeAction(snapshotFor(bundle), { kind: "reload", weapon: weaponItemId });
  if (!verdict.ok) {
    await appendCampaignEvent({
      campaign_id: campaignId,
      type: "action_refused",
      summary: `Not possible: ${verdict.reason}`,
      data: { code: verdict.code } as unknown as Json,
      ...(beatId ? { beat_id: beatId } : {}),
    });
    return;
  }

  const row = bundle.inventory.find((r) => r.slot === "weapon" && r.item_id === weaponItemId);
  if (!row) return;
  const done = await reloadWeapon(campaignId, row.id);
  if (!done.ok) return;

  // The Action, charged out of the fight's own economy. Outside combat there is
  // no Turn to spend and nothing to write.
  const live = bundle.encounter;
  if (!live || live.state.status !== "active") return;
  const player = Object.values(live.state.combatants).find((c) => c.isPlayer);
  const existing = player ? live.data[player.id] : null;
  if (!player || !existing) return;
  const saved = await saveLiveEncounter({
    ...live,
    data: {
      ...live.data,
      [player.id]: {
        ...existing,
        turn: spendTurn(existing.turn, live.state.round, verdict.cost, weaponItemId),
      },
    },
  });
  publishCombatFrames(campaignId, [
    { live: saved, kind: "reload", actorId: player.id, text: `${player.name} reloads.` },
  ]);
  await finishCombatAction(bundle, saved, beatId);
}

/**
 * The player giving up the rest of their Turn.
 *
 * What `handOverTheTurn` was built for and nothing could call: until the board
 * existed, attacking was the only thing that advanced a Round, so a character
 * who moved and chose not to shoot left the hostiles standing still.
 */
export async function endPlayerTurn(bundle: CombatBundle): Promise<void> {
  const live = bundle.encounter;
  if (!live || live.state.status !== "active") return;
  const player = Object.values(live.state.combatants).find((c) => c.isPlayer);
  if (!player) return;
  // Only the player's own Turn is theirs to give up. The board disables the
  // button off-turn, but a Turn belonging to somebody else must not be endable
  // through any path — handing it over would walk the order past whoever is
  // actually on the clock.
  if (!currentCombatant(live.state)?.isPlayer) return;
  // A Mortally Wounded character rolls their Death Save before anything else
  // happens on their Turn (CP:R pg. 187). Handing the Turn over here would
  // walk the order straight past a save they owe.
  if (owesASave(bundle)) return;
  await handOverTheTurn(bundle, live, bundle.beat?.id ?? null, [
    `${player.name} takes no further action and ends their Turn.`,
  ]);
}

/**
 * Keys for player turns this session has already handed over.
 *
 * A double-submitted mutation would run the hostile Turns twice — free damage,
 * silently. The encounter version protects saves, while this guard also
 * avoids starting duplicate enemy work and ledger appends within this session.
 * The encounter's own (round, activeIndex) identifies the turn being ended, so
 * a second call with the same one is a duplicate and does nothing.
 *
 * Deliberately session-local and deliberately not a lock. It closes the
 * double-click and the retried mutation. Cross-tab writes also carry the
 * encounter version; the ledger still spans multiple writes (see AGENTS.md).
 */
const handedOver = new Set<string>();

/**
 * The player's Turn is over: the hostiles take theirs, Backup arrives if its
 * Round has come, the fight closes if it is finished, a Death Save is posted
 * if one is owed, and a deterministic exchange report records what happened.
 *
 * Extracted from commitAttack so that attacking is no longer the ONLY way a
 * Round can advance. Everything a player does that ends their Turn comes
 * through here, which is what stops a Move-and-pass from leaving the hostiles
 * standing still. `lines` is what the player just did, in the engine's own
 * words; every line this adds joins the same exchange report.
 */
async function handOverTheTurn(
  bundle: CombatBundle,
  from: LiveEncounter,
  beatId: string | null,
  lines: string[],
): Promise<void> {
  const campaignId = bundle.campaign.id;
  const key = `${from.id}:${from.state.round}:${from.state.activeIndex}`;
  if (handedOver.has(key)) return;
  handedOver.add(key);
  try {
    await runTheTurnOver(bundle, from, beatId, lines, campaignId);
  } catch (error) {
    // A turn that FAILED has not been handed over. Leaving the key behind
    // would make the fight unretryable — the player presses Retry, this
    // returns silently, and the hostiles never move again.
    handedOver.delete(key);
    throw error;
  }
}

async function runTheTurnOver(
  bundle: CombatBundle,
  from: LiveEncounter,
  beatId: string | null,
  lines: string[],
  campaignId: string,
): Promise<void> {
  let live = from;
  const npc = await runNpcTurns(campaignId, beatId, live);
  live = npc.live;
  lines.push(...npc.lines);
  await appendCampaignEvent({
    campaign_id: campaignId,
    beat_id: beatId,
    type: "turn_ended",
    data: { encounterId: from.id, round: from.state.round },
  });

  // Backup that was called earlier turns up once its Round comes round, and
  // joins the order from there. Checked after the hostile Turns, because that
  // is what advances the Round.
  const inbound = pendingBackup(bundle.campaign);
  if (inbound && live.state.status === "active" && live.state.round >= inbound.arrivesOnRound) {
    const tier = BACKUP_TIERS.find((t) => t.name === inbound.tierName) ?? null;
    if (tier) {
      const arrival = await arriveBackup({
        campaignId,
        beatId,
        live,
        tier,
        groups: inbound.groups,
      });
      live = arrival.live;
      lines.push(arrival.line);
    }
    await updateCampaign(campaignId, {
      role_state: withAbilityState(bundle.campaign, "backup", {}) as Json,
    });
  }

  // The fight's ending, and the Death Save a Mortally Wounded player owes
  // before they can act again — the same pair the opening writes.
  const { status, owed } = await settleNpcTurns(campaignId, beatId, live);

  // Routine exchanges have a complete deterministic report. No model round trip
  // is needed to tell the player who fired, what hit, or whose turn comes next.
  await appendCampaignEvent({
    campaign_id: campaignId,
    beat_id: beatId,
    type: "combat_exchange",
    summary: [...lines, status].filter(Boolean).join(" "),
    data: { encounterId: live.id, round: live.state.round },
  });
  publishCombatFrames(campaignId, [
    { live, kind: "turn", text: status || (owed ? "Death Save required." : "Your turn.") },
  ]);
}

/** The character died, regardless of where the fight began. */
async function settleDeath(bundle: CombatBundle): Promise<void> {
  const campaignId = bundle.campaign.id;
  await appendCampaignEvent({
    campaign_id: campaignId,
    type: "campaign_ended",
    summary: `${bundle.character.character.name} died in Night City.`,
    data: { reason: "death" } as unknown as Json,
  });
  await updateCampaign(campaignId, { status: "lost" });
}

/**
 * Persist the player's rolled Death Save. The engine already applied it; this
 * writes it down and reports the exact outcome without another model turn.
 */
export async function commitDeathSave(
  bundle: CombatBundle,
  pending: PendingDeathSave,
  result: BeginTurnResult,
): Promise<void> {
  if (!bundle.encounter) throw new Error("There is no encounter to save against.");
  if (pending.encounterVersion !== bundle.encounter.version) throw new EncounterChangedError();
  if (deathSaveOwed(bundle.encounter)?.id !== pending.combatant.id) {
    throw new Error("This Death Save is no longer owed.");
  }
  const campaignId = bundle.campaign.id;
  const beatId = pending.beatId;
  const save = result.deathSave;
  if (!save) throw new Error("The engine did not roll a Death Save.");

  const live = await saveLiveEncounter({
    ...bundle.encounter,
    state: result.state,
    data: result.died
      ? {
          ...bundle.encounter.data,
          [pending.combatant.id]: {
            ...bundle.encounter.data[pending.combatant.id]!,
            exitReason: "dead",
          },
        }
      : bundle.encounter.data,
  });
  await logDeathSave(campaignId, save, {
    combatantName: pending.combatant.name,
    died: result.died,
    beatId,
  });

  publishCombatFrames(campaignId, [
    {
      live,
      kind: "status",
      actorId: pending.combatant.id,
      text: result.died
        ? `${pending.combatant.name} failed the Death Save.`
        : `${pending.combatant.name} survived the Death Save.`,
    },
  ]);

  // closeOutFight alone, never settleNpcTurns: the save has just been ROLLED.
  // Surviving leaves the player Mortally Wounded on their own Turn. The saved
  // round marker prevents another obligation until their next Turn.
  const status = await closeOutFight(campaignId, beatId, live);
  const line = result.died
    ? `${pending.combatant.name} failed the Death Save and is DEAD (d10 ${save.roll} + ${save.penalty} = ${save.effective} vs BODY ${pending.body}${save.autoFail ? ", a natural 10" : ""}).`
    : `${pending.combatant.name} survived the Death Save (d10 ${save.roll} + ${save.penalty} = ${save.effective} vs BODY ${pending.body}); they are still Mortally Wounded and the next save is at +${save.penaltyAfter}.`;

  if (result.died) await settleDeath(bundle);

  await appendCampaignEvent({
    campaign_id: campaignId,
    beat_id: beatId,
    type: "combat_exchange",
    summary: `${line}${status ? ` ${status}` : ""}`,
    data: { encounterId: live.id, round: live.state.round },
  });
}
