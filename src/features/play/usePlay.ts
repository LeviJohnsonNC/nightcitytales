import { publishCombatFrames } from "./combatPlayback";
import { useCombatPlayback } from "./useCombatPlayback";
/**
 * The play loop. Loads a campaign's live state, and runs a turn: the player's
 * intent goes to the GM (gmTurnFn), the engine resolves any proposed skill
 * checks, and everything is appended to the campaign ledger. The engine owns the
 * dice and the beat position; this hook just sequences the calls and persists.
 */
import { useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { GmSuggestedActionSchema, type GmSuggestedAction } from "@/features/gm/gmResponse";
import {
  advance,
  availableExits,
  awardImprovementPoints,
  beginTurn,
  currentBeat,
  getBeat,
  arenaForPlace,
  findMission,
  getMission,
  failMission,
  getSkill,
  currentCombatant,
  judgeAction,
  remainingCombatTurn,
  previewAttack,
  type CapabilitySnapshot,
  type LegalityVerdict,
  type Point,
  clampDisposition,
  missionPayout,
  type IpAward,
  type IpPlaystyle,
  clampLuckSpend,
  luckAfterSpend,
  luckModifier,
  TIME_COSTS,
  advanceClock,
  luckPoolMax,
  nextPhase,
  phaseOf,
  luckRemaining,
  opposedCheckForCharacter,
  performAttack,
  BACKUP_TIERS,
  backupTierFor,
  callBackup,
  charismaticImpactCheck,
  resolveSkillId,
  woundActionPenalty,
  skillCheckForCharacter,
  type Beat,
  type BeatExit,
  type BeginTurnResult,
  type Mission,
  type MissionRuntime,
  type OpposedCheckResult,
  type Opposition,
  type BackupCall,
  type CharismaticImpactResult,
  type PerformAttackResult,
  type WoundStateCode,
  findFactionIn,
  type FactionId,
  type ObservationReport,
  type FactionStanding,
  DEFAULT_START,
  areaOf,
  describePosition,
  getDistrict,
  isCombatZone,
  resolvePosition,
  directionName,
  neighboursOf,
} from "@/engine";

import {
  addImprovementPoints,
  appendCampaignEvent,
  closeAftermath,
  getCampaign,
  getCharacter,
  listCampaignEvents,
  findCampaignNpc,
  saveCampaignNpc,
  setCampaignClock,
  listClocks,
  setCampaignFlag,
  type CampaignFlag,
  setCampaignPhase,
  setNpcDisposition,
  updateCampaign,
  updateCampaignVitals,
  type Campaign,
  type CampaignEvent,
  type CampaignInventoryItem,
  type CampaignCyberware,
  type CampaignNpc,
  type CampaignVitals,
  type FullCharacter,
  type Json,
} from "@/lib/backend";
import { loadMissionRuntime, saveMissionRuntime } from "@/features/campaign/missionState";
import { logBeatAdvanced } from "@/features/campaign/missionLog";
import { logOpposedCheck, logSkillCheck } from "@/features/campaign/skillCheckLog";
import {
  oppositionProfileOf,
  reconcileOpposition,
  rememberOpposition,
} from "@/features/campaign/npcOpposition";
import { logAttack, logDeathSave } from "@/features/campaign/combatLog";
import { reloadWeapon } from "@/features/campaign/shopping";
import {
  loadLiveEncounter,
  EncounterChangedError,
  saveLiveEncounter,
  type LiveEncounter,
} from "@/features/campaign/encounterState";
import { buildGmContext, renderGmUserPrompt } from "@/features/gm/gmContext";
import { settleAftermath } from "@/features/campaign/aftermath";
import { chronicleFor } from "@/features/campaign/chronicleModel";
import { tallyFrom, type CampaignTally } from "@/features/campaign/tally";
import {
  answerPendingQuestion,
  askOracle,
  revealComplication,
  secretComplicationFor,
  type ComplicationMemory,
} from "@/features/campaign/oracles";
import { gmTurnFn } from "@/features/gm/gmTurn.server";
import { renderIpJudgementPrompt, type IpJudgement } from "@/features/gm/ipJudgement";
import { ipJudgementFn } from "@/features/gm/ipJudgement.server";
import {
  actorFor,
  characterSummary,
  findNpcByKey,
  npcDispositionAfter,
  statsRecord,
  npcSummaries,
  jobOutcome,
  recentEventLines,
} from "./playModel";
import {
  beginEncounter,
  closeOutFight,
  describeAttack,
  movePlayer,
  movePlayerTo,
  runNpcTurns,
  settleNpcTurns,
} from "./combatFlow";
import {
  distanceToTarget,
  findTarget,
  pendingAttackFrom,
  type AttackOption,
  type PendingAttack,
} from "./attackPrompt";
import {
  dvBandName,
  oppositionFor,
  pendingChecksFrom,
  rollHistory,
  snapToPublishedDv,
  type CheckRoll,
  type PendingCheck,
} from "./checkPrompt";
import { deathSaveOwed, pendingDeathSaveFrom, type PendingDeathSave } from "./deathSavePrompt";
import {
  combatAwarenessAllocation,
  combatAwarenessFor,
  execTeam,
  liveRoleAbility,
  medicineDoses,
  medicineSpecialties,
  makerSpecialties,
  makerSpecialtyBudget,
  pendingBackup,
  roleCheckModifiers,
  withAbilityState,
} from "./roleAbilityModel";
import { arriveBackup, pendingBackupFrom } from "./backupFlow";
import { JOB_PAYOUT_FLAG } from "@/features/life/hookOffer";
import {
  applyPressure,
  notableFrom,
  pressureFrom,
  pressureLines,
  readObservations,
  spendFiredClock,
  standingLines,
  type LivePressure,
} from "@/features/campaign/pressure";
import {
  ammoAfterShot,
  buildCapabilitySnapshot,
  renderCapabilityLines,
  withAttackSpent,
} from "./capabilityModel";
import { spendTurn } from "./encounterModel";

/**
 * How many checks one turn may put on the table at once. Two lets a compound
 * intent ("pick the lock while she watches the hall") be the two rolls it would
 * be at a table; more than that stops being a turn and starts being a queue.
 */
export const MAX_CHECKS_PER_TURN = 2;

export type PlayBundle = {
  campaign: Campaign;
  vitals: CampaignVitals;
  character: FullCharacter;
  mission: Mission | null;
  runtime: MissionRuntime | null;
  beat: Beat | null;
  availableExits: BeatExit[];
  events: CampaignEvent[];
  npcs: CampaignNpc[];
  /** The campaign's live kit — what is carried, loaded, and left. */
  inventory: CampaignInventoryItem[];
  cyberware: CampaignCyberware[];
  /** The fight in progress, if the GM has started one. */
  encounter: LiveEncounter | null;
  /**
   * The fee agreed when this job was taken, when the player argued it up from
   * the printed reward. Null on a job nobody negotiated.
   */
  agreedPayout: number | null;
  /** Clocks the engine recognises, worst first. */
  pressure: LivePressure[];
  /** Organisations with an opinion, already worded. */
  standings: string[];
  /** The same opinions unworded, for the chronicle to rank and count. */
  factionStandings: FactionStanding[];
  /** Running totals that outlive a turn's ledger window. */
  tally: CampaignTally;
  /**
   * What this job's brief left out, rolled in secret when the player took the
   * work. Present only while it is still a secret; the GM builds the job around
   * it and the player meets it as a discovery.
   */
  complication: ComplicationMemory | null;
};

async function loadPlay(campaignId: string): Promise<PlayBundle> {
  const full = await getCampaign(campaignId);
  if (!full) throw new Error("Campaign not found.");
  if (!full.vitals) throw new Error("Campaign has no vitals to play with.");

  const character = await getCharacter(full.campaign.character_id);
  if (!character) throw new Error("This campaign's character no longer exists.");

  let mission: Mission | null = null;
  let runtime: MissionRuntime | null = null;
  let beat: Beat | null = null;
  let exits: BeatExit[] = [];
  if (full.campaign.current_mission_id) {
    mission = getMission(full.campaign.current_mission_id);
    runtime = await loadMissionRuntime(campaignId, mission);
    beat = currentBeat(mission, runtime);
    exits = availableExits(mission, runtime);
  }

  const events = await listCampaignEvents(campaignId);
  const encounter = await loadLiveEncounter(campaignId);
  return {
    campaign: full.campaign,
    vitals: full.vitals,
    character,
    mission,
    runtime,
    beat,
    availableExits: exits,
    events,
    npcs: full.npcs,
    inventory: full.inventory,
    cyberware: full.cyberware,
    encounter,
    agreedPayout: agreedPayoutFrom(full.flags),
    pressure: pressureFrom(await listClocks(campaignId)),
    standings: standingLines(notableFrom(full.factions)),
    factionStandings: notableFrom(full.factions),
    tally: tallyFrom(full.flags),
    complication: secretComplicationFor(full.flags, full.campaign.current_mission_id),
  };
}

/** The negotiated fee on the campaign's books, if this job carries one. */
/**
 * What the character can actually do right now, off one bundle.
 *
 * One builder for every caller — the GM's context, the cards' greying-out, and
 * the board's own actions. Three copies of these seven fields is three chances
 * for one of them to be reading a different beat than the gate it feeds.
 */
function snapshotFor(bundle: PlayBundle): CapabilitySnapshot {
  return buildCapabilitySnapshot({
    character: bundle.character,
    vitals: bundle.vitals,
    inventory: bundle.inventory,
    cyberware: bundle.cyberware,
    encounter: bundle.encounter,
    events: bundle.events,
    beatId: bundle.beat?.id ?? null,
  });
}

function agreedPayoutFrom(flags: CampaignFlag[]): number | null {
  const value = flags.find((f) => f.flag === JOB_PAYOUT_FLAG)?.value;
  return typeof value === "number" && Number.isFinite(value) ? Math.round(value) : null;
}

async function narrate(
  bundle: PlayBundle,
  input: string,
  options: { logInput?: boolean; optionsRequested?: boolean; fixedResult?: boolean } = {},
): Promise<void> {
  const campaignId = bundle.campaign.id;
  const beatId = bundle.beat?.id ?? null;
  const beatFields = beatId ? { beat_id: beatId } : {};

  if (options.logInput !== false) {
    await appendCampaignEvent({
      campaign_id: campaignId,
      type: "player_input",
      summary: input,
      data: {} as Json,
      ...beatFields,
    });
  }

  if (!bundle.mission || !bundle.runtime || !bundle.beat) {
    throw new Error("There is no active mission to play right now.");
  }

  // What the character can actually do right now. The GM sees it so it stops
  // proposing the impossible; the gate below still refuses anything that slips
  // through, because a model is not an enforcement layer.
  let capability = snapshotFor(bundle);

  /**
   * Refuse an impossible action in the fiction rather than silently dropping
   * it: the reason goes on the ledger, so the player is told why and the GM's
   * next turn narrates it instead of proposing it again.
   */
  const refuse = async (verdict: Extract<LegalityVerdict, { ok: false }>): Promise<void> => {
    await appendCampaignEvent({
      campaign_id: campaignId,
      type: "action_refused",
      summary: `Not possible: ${verdict.reason}`,
      data: { code: verdict.code } as unknown as Json,
      ...beatFields,
    });
  };

  // Pressure that has come due arrives NOW, in this scene. Held back while a
  // fight is already running: a second threat walking in mid-firefight is not
  // tension, it is two encounters wearing one coat, and the engine has no way
  // to fold the newcomers into an initiative order that is already turning.
  const fightRunning = bundle.encounter?.state.status === "active";
  const arrived =
    fightRunning || options.fixedResult ? null : await spendFiredClock(campaignId, { beatId });

  // Whatever the GM asked last turn, answered by dice it never saw. Skipped on
  // an options turn: the player is thinking, and nobody lived through anything.
  const answered =
    options.optionsRequested || options.fixedResult
      ? null
      : await answerPendingQuestion(campaignId);

  const jobPosition = resolvePosition(bundle.campaign.location_key ?? DEFAULT_START);
  const jobDistrict = jobPosition ? getDistrict(jobPosition.districtKey) : undefined;
  const context = buildGmContext({
    ...(jobDistrict
      ? {
          place: {
            where: describePosition(bundle.campaign.location_key ?? DEFAULT_START),
            district: jobDistrict.name,
            area: areaOf(jobDistrict.key)?.name ?? "Night City",
            security: jobDistrict.security,
            gangs: jobDistrict.gangs,
            combatZone: isCombatZone(jobDistrict.key),
            nearby: jobDistrict.locations.slice(0, 8).map((l) => l.name),
            neighbours: neighboursOf(bundle.campaign.location_key ?? DEFAULT_START).map(
              (n) => `${n.name} — ${directionName(n.direction)}, ${n.minutes} min`,
            ),
          },
        }
      : {}),
    mission: bundle.mission,
    beat: bundle.beat,
    availableExits: bundle.availableExits,
    character: characterSummary(bundle.character, bundle.vitals, bundle.inventory),
    objectives: bundle.runtime.objectives,
    npcsPresent: npcSummaries(bundle.npcs),
    recentEvents: recentEventLines(bundle.events),
    capabilities: renderCapabilityLines(capability),
    pressure: pressureLines(bundle.pressure),
    standings: bundle.standings,
    chronicle: chronicleFor({
      day: bundle.campaign.day,
      events: bundle.events,
      standings: bundle.factionStandings,
      pressure: pressureLines(bundle.pressure),
      npcs: bundle.npcs,
      situationKeys: [],
      tally: bundle.tally,
    }),
    ...(arrived ? { arrived: arrived.payoff } : {}),
    ...(bundle.complication ? { complication: bundle.complication.text } : {}),
    ...(answered ? { oracle: { question: answered.question, answer: answered.answer } } : {}),
    ...(options.optionsRequested ? { optionsRequested: true } : {}),
  });

  const gm = await gmTurnFn({ data: { userPrompt: renderGmUserPrompt(context, input) } });

  await appendCampaignEvent({
    campaign_id: campaignId,
    type: "gm_narration",
    summary: gm.narration,
    data: {
      endsWithDecision: gm.endsWithDecision,
      suggestedActions: options.fixedResult ? [] : gm.suggestedActions,
    } as unknown as Json,
    ...beatFields,
  });
  if (options.fixedResult) return;

  // Held, not answered: the dice are thrown on the next turn, so the turn that
  // asked was written without knowing.
  if (!options.optionsRequested && !options.fixedResult) await askOracle(campaignId, gm.question);

  // The city keeps its own time during a job, not only between them. Each turn
  // costs a few minutes, so rent, bills and the calendar stay real while the
  // player is working. TIME_COSTS are app pacing, not published rules.
  let clock = advanceClock(
    { day: bundle.campaign.day, minute: bundle.campaign.minute },
    TIME_COSTS.quick,
  );

  // What the city noticed. The model reported; engine/clocks.ts prices it.
  //
  // One player action narrates more than once (the attempt, then the check it
  // proposed, then the result), and a model describing the same body each time
  // would be charged for it each time. An identical report to the one just
  // recorded is treated as the same event restated, not a second one.
  const observed = readObservations(gm.observations);
  if (observed.length) {
    await applyPressure(campaignId, observed, {
      beatId,
      notAgainAfter: bundle.events,
      districtKey:
        resolvePosition(bundle.campaign.location_key ?? DEFAULT_START)?.districtKey ?? null,
    });
  }

  // A proposed check or attack is NOT rolled here: it is posted to the ledger as
  // a prompt and waits for the player's dice (see commitCheck / commitAttack).
  //
  // Up to MAX_CHECKS_PER_TURN checks may be posted, so "pick the lock while she
  // watches the hall" is the two rolls it would be at a table — but only for
  // genuinely distinct skills, and never alongside an attack, which stays
  // strictly one at a time because combat resolves in sequence.
  const postedSkillIds = new Set<string>();
  let attackPosted = false;
  let live = bundle.encounter;

  // Resolving a check narrates again, which can propose more. Budget against the
  // prompts already outstanding so a chain of turns cannot grow the queue without
  // bound — the player should always be able to clear the table.
  const outstanding = pendingChecksFrom(
    bundle.events,
    bundle.character,
    bundle.vitals.wound_state as WoundStateCode,
    { vitals: bundle.vitals, inventory: bundle.inventory },
  ).length;
  const checkBudget = Math.max(0, (fightRunning ? 1 : MAX_CHECKS_PER_TURN) - outstanding);

  for (const action of gm.proposedActions) {
    if (action.kind === "skill_check") {
      if (attackPosted || postedSkillIds.size >= checkBudget) {
        console.warn(
          `GM proposed a "${action.skillId}" check with no room left this turn ` +
            `(budget ${checkBudget}, ${outstanding} already on the table) — not offered.`,
        );
        continue;
      }
      // The model names skills in prose; the engine only knows printed ids.
      const skillId = resolveSkillId(action.skillId);
      if (!skillId) {
        console.warn(`GM proposed an unknown skill: "${action.skillId}" — no check offered.`);
        continue;
      }
      if (postedSkillIds.has(skillId)) continue; // the same skill twice is one roll
      const legal = judgeAction(capability, {
        kind: "skill_check",
        skillId,
        intent: action.intent,
      });
      if (!legal.ok) {
        await refuse(legal);
        continue;
      }
      const skillName = getSkill(skillId).name;
      const dv = snapToPublishedDv(action.dv);
      const band = dvBandName(dv);
      postedSkillIds.add(skillId);
      await appendCampaignEvent({
        campaign_id: campaignId,
        type: "check_prompt",
        summary: `${skillName} check — DV ${dv}${band ? ` (${band})` : ""}`,
        data: {
          skillId,
          skillName,
          dv,
          intent: action.intent,
        } as unknown as Json,
        ...beatFields,
      });
    } else if (action.kind === "opposed_check") {
      if (attackPosted || postedSkillIds.size >= checkBudget) {
        console.warn(
          `GM proposed an opposed "${action.skillId}" check with no room left this turn ` +
            `(budget ${checkBudget}, ${outstanding} already on the table) — not offered.`,
        );
        continue;
      }
      const skillId = resolveSkillId(action.skillId);
      const opposingSkillId = resolveSkillId(action.opposingSkillId);
      if (!skillId || !opposingSkillId) {
        console.warn(
          `GM proposed an opposed check naming an unknown skill ` +
            `("${action.skillId}" vs "${action.opposingSkillId}") — no check offered.`,
        );
        continue;
      }
      if (postedSkillIds.has(skillId)) continue; // the same skill twice is one roll
      const legalOpposed = judgeAction(capability, {
        kind: "opposed_check",
        skillId,
        intent: action.intent,
      });
      if (!legalOpposed.ok) {
        await refuse(legalOpposed);
        continue;
      }
      postedSkillIds.add(skillId);

      // The world remembers: an NPC the campaign has already measured opposes
      // with the numbers it measured, not with whatever the model says today.
      const npc = findNpcByKey(bundle.npcs, action.npcKey, action.npcName);
      const { opposition, remembered } = reconcileOpposition(
        {
          name: action.npcName,
          skillId: opposingSkillId,
          skillLevel: action.opposingSkillLevel,
          statValue: action.opposingStatValue,
        },
        oppositionProfileOf(npc),
      );

      const skillName = getSkill(skillId).name;
      const opposingSkill = getSkill(opposingSkillId);
      await appendCampaignEvent({
        campaign_id: campaignId,
        type: "check_prompt",
        summary: `${skillName} check — opposed by ${action.npcName} (${opposingSkill.name})`,
        data: {
          skillId,
          skillName,
          intent: action.intent,
          opposition: {
            npcKey: action.npcKey,
            npcName: action.npcName,
            skillId: opposingSkillId,
            skillLevel: opposition.skillLevel,
            statValue: opposition.statValue,
            remembered,
          },
        } as unknown as Json,
        ...beatFields,
      });
    } else if (action.kind === "advance_beat") {
      // Only the model's proposed advancement is allowed to be wrong. Everything
      // after it is our own bookkeeping, and a failure there must surface — a
      // catch around the settlement is what hid a job silently failing to close.
      let next: MissionRuntime | null = null;
      try {
        next = advance(bundle.mission, bundle.runtime, action.to);
      } catch {
        next = null; // the model named an exit that is not available; stay put
      }
      if (next) {
        await saveMissionRuntime(campaignId, next);
        await logBeatAdvanced(campaignId, {
          mission: bundle.mission,
          fromBeatId: bundle.beat.id,
          toBeat: getBeat(bundle.mission, action.to),
        });
        // Moving between beats is travel, legwork, waiting — an errand's worth
        // of the evening, not a heartbeat.
        clock = advanceClock(clock, TIME_COSTS.errand);
        if (next.status === "completed") {
          await settleMission({ ...bundle, runtime: next }, next, bundle.mission);
        }
      }
    } else if (action.kind === "start_encounter") {
      if (live) continue; // one fight at a time
      const standingIn = resolvePosition(bundle.campaign.location_key ?? DEFAULT_START);
      const jobPlace = bundle.campaign.current_mission_id
        ? findMission(bundle.campaign.current_mission_id)?.offer?.placeKey
        : undefined;
      const arenaHere = standingIn?.placeKey
        ? arenaForPlace(standingIn.placeKey)
        : jobPlace
          ? arenaForPlace(jobPlace)
          : undefined;
      // A Solo brings their Combat Awareness division into the fight with them.
      const awareness = combatAwarenessFor(bundle.campaign, bundle.character);
      const opened = await beginEncounter({
        campaignId,
        characterId: bundle.campaign.character_id,
        beatId,
        name: action.name,
        character: bundle.character,
        vitals: bundle.vitals,
        inventory: bundle.inventory,
        enemies: action.enemies,
        // Where the fight is decides its geometry. The model may still name an
        // arena — it can see the room and this cannot — but when it does not,
        // the ground answers instead of falling through to open ground: a club
        // interior at a bar, a parking structure under a garage.
        arena: action.arena ?? arenaHere,
        goal: action.goal,
        ...(awareness
          ? {
              roleEffects: {
                initiative: awareness.initiative,
                damageDeflection: awareness.damageDeflection,
                spotWeakness: awareness.spotWeakness,
                fumbleRecovery: awareness.fumbleRecovery,
              },
            }
          : {}),
      });
      // Anyone who beat the player on Initiative has already acted; what they
      // did is on the encounter_started event, so the GM reads it with the
      // scene rather than having it surface a turn late.
      live = opened.live;
    } else if (action.kind === "attack") {
      if (attackPosted || postedSkillIds.size > 0) continue;
      if (!live || live.state.status !== "active") continue;
      const target = findTarget(live, action.targetId);
      if (!target || target.defeated || target.isPlayer) continue;
      // The range is measured off positions, not taken from the proposal. The
      // model names WHO is being shot at; the engine knows how far away they are.
      const metres = distanceToTarget(live, target.id);
      const legalAttack = judgeAction(capability, {
        kind: "attack",
        targetKey: action.targetId,
        distance: metres,
      });
      if (!legalAttack.ok) {
        await refuse(legalAttack);
        continue;
      }
      attackPosted = true;
      await appendCampaignEvent({
        campaign_id: campaignId,
        type: "attack_prompt",
        summary: `Attack ${target.name} at ${metres}m`,
        data: {
          targetId: target.id,
          targetName: target.name,
          distance: metres,
          intent: action.intent,
        } as unknown as Json,
        ...beatFields,
      });
    } else if (action.kind === "move") {
      if (!live || live.state.status !== "active") continue;
      const target = findTarget(live, action.targetId);
      if (!target) continue;
      const moved = await movePlayer({
        campaignId,
        beatId,
        live,
        capability,
        targetId: target.id,
        targetName: target.name,
        towards: action.towards,
        intent: action.intent,
      });
      if (moved.refusal) await refuse(moved.refusal);
      live = moved.live;
      capability = snapshotFor({ ...bundle, encounter: live });
    }
  }

  // The world remembers. Every one of these was being parsed and thrown away:
  // the GM proposes "the alarm was raised" and "she trusts you less" most turns,
  // and a campaign that forgets them is the reset-button amnesia the brief
  // forbids.
  for (const delta of gm.stateDeltas) {
    if (delta.kind === "note") {
      await appendCampaignEvent({
        campaign_id: campaignId,
        type: "gm_note",
        summary: delta.text,
        data: {} as Json,
        ...beatFields,
      });
    } else if (delta.kind === "set_flag") {
      await setCampaignFlag(campaignId, delta.flag);
      await appendCampaignEvent({
        campaign_id: campaignId,
        type: "flag_set",
        summary: `Night City noted: ${delta.flag.replace(/_/g, " ")}`,
        data: { flag: delta.flag } as unknown as Json,
        ...beatFields,
      });
    } else if (delta.kind === "npc_disposition") {
      const npc = findNpcByKey(bundle.npcs, delta.npcKey);
      const { disposition } = npcDispositionAfter(npc, delta.delta);
      // An NPC the campaign has never filed still gets one, so the shift
      // sticks; a later opposed check corrects the name.
      const row = npc ?? (await saveCampaignNpc(campaignId, delta.npcKey, { name: delta.npcKey }));
      await setNpcDisposition(row.id, disposition);
      await appendCampaignEvent({
        campaign_id: campaignId,
        type: "npc_disposition",
        summary:
          `${npc?.name ?? delta.npcKey} ${delta.delta >= 0 ? "warms to" : "cools on"} you ` +
          `(${delta.delta >= 0 ? "+" : ""}${delta.delta}).`,
        data: { npcKey: delta.npcKey, delta: delta.delta } as unknown as Json,
        ...beatFields,
      });
    }
  }

  await setCampaignClock(campaignId, clock);
  if (live && live !== bundle.encounter && !attackPosted && postedSkillIds.size === 0) {
    await finishCombatAction(bundle, live, beatId);
  }
}

/**
 * Take the Luck a roll was made with out of the pool.
 *
 * Called when the roll is committed, not when the stepper moves: Luck is
 * dedicated before the dice and paid for once the dice have been thrown, so a
 * card the player abandons mid-turn costs them nothing.
 */
async function payLuck(bundle: PlayBundle, spend: number): Promise<void> {
  if (spend <= 0) return;
  const remaining = luckRemaining(bundle.vitals.luck_current, statsRecord(bundle.character));
  await updateCampaignVitals(bundle.campaign.id, {
    luck_current: luckAfterSpend(remaining, spend),
  });
}

function critNote(critical: "success" | "failure" | null): string {
  if (critical === "success") return " (Critical Success: an extra d10 was added)";
  if (critical === "failure") return " (Critical Failure: an extra d10 was subtracted)";
  return "";
}

/**
 * Persist a rolled opposed check: the two rolls to the ledger, the NPC's numbers
 * to their row so the same face opposes the same way next time, and then the
 * result to the GM to narrate exactly as it landed.
 */
async function commitOpposedCheck(
  bundle: PlayBundle,
  pending: PendingCheck,
  result: OpposedCheckResult,
  luckSpent: number,
): Promise<void> {
  const campaignId = bundle.campaign.id;
  const opposition = pending.opposition;
  if (!opposition) throw new Error("That check has no opposing side to resolve.");

  await logOpposedCheck(campaignId, result, {
    luckSpent,
    skillId: pending.skillId,
    skillName: pending.skillName,
    intent: pending.intent,
    promptEventId: pending.eventId,
    npcKey: opposition.npcKey,
    ...(pending.beatId ? { beatId: pending.beatId } : {}),
  });
  // Paid after the roll is on the ledger. If this write is the one that fails,
  // the player keeps points they have already had the benefit of — better than
  // charging them for a roll no record was kept of.
  await payLuck(bundle, luckSpent);

  const engineOpposition: Opposition = {
    name: opposition.npcName,
    skillId: opposition.skillId,
    skillLevel: opposition.skillLevel,
    statValue: opposition.statValue,
  };
  await rememberOpposition({
    campaignId,
    npcKey: opposition.npcKey,
    npcName: opposition.npcName,
    npc: findNpcByKey(bundle.npcs, opposition.npcKey, opposition.npcName),
    opposition: engineOpposition,
  });

  const verdict = result.success
    ? `SUCCESS by ${result.margin}`
    : result.tie
      ? "FAILURE on a tie — the totals matched and a tie goes to the one resisting"
      : `FAILURE by ${Math.abs(result.margin)}`;

  const fresh: PlayBundle = { ...bundle, events: await listCampaignEvents(campaignId) };
  await narrate(
    fresh,
    `(ENGINE: the opposed ${pending.skillName} check against ${opposition.npcName} is RESOLVED. ` +
      `Player: ${result.actor.formula} = ${result.actor.total}${critNote(result.actor.critical)}. ` +
      `${opposition.npcName} (${opposition.skillName}): ${result.opponent.formula} = ${result.opponent.total}${critNote(result.opponent.critical)}. ` +
      `Outcome: ${verdict}. Narrate this exact outcome for the intent "${pending.intent}", showing how ${opposition.npcName} met it. ` +
      `Do not re-decide it, do not soften a failure, do not propose the same check again. End on a decision.)`,
    { logInput: false, fixedResult: bundle.encounter?.state.status === "active" },
  );
}

/**
 * Record a Rockerboy working a crowd, and hand the result to the GM.
 *
 * Charismatic Impact is not a Skill Check — it is Rank + 1d10 against a DV set
 * by how many of them there are — so it gets its own ledger row rather than
 * pretending to be a skill_check.
 */
async function commitCharismaticImpact(
  bundle: PlayBundle,
  result: CharismaticImpactResult,
): Promise<void> {
  const campaignId = bundle.campaign.id;
  const beatId = bundle.beat?.id ?? null;
  const verdict = result.success ? "WON THEM OVER" : "FAILED";
  await appendCampaignEvent({
    campaign_id: campaignId,
    type: "role_ability",
    summary: `Charismatic Impact on ${result.audience.name}: ${result.formula} → ${verdict}`,
    roll: result as unknown as Json,
    data: {
      ability: "charismatic_impact",
      audience: result.audience.id,
      success: result.success,
    } as unknown as Json,
    ...(beatId ? { beat_id: beatId } : {}),
  });

  const fresh: PlayBundle = { ...bundle, events: await listCampaignEvents(campaignId) };
  await narrate(
    fresh,
    `(ENGINE: the player used their Rockerboy Charismatic Impact on ${result.audience.name}. ` +
      `${result.formula}. Outcome: ${verdict}. ` +
      (result.success
        ? `They are Fans now, and at this Rank a fan will ${result.favor ?? "do very little"}. ` +
          `Narrate the crowd turning, and what that buys the player right now.`
        : `Narrate the room not buying it. They cannot be worked again for a week.`) +
      ` Do not re-decide the outcome. End on a decision.)`,
    { logInput: false },
  );
}

/**
 * Record a Lawman calling it in. A call that lands is not help yet — it is help
 * on its way, so what gets stored is the Round it turns up on.
 */
async function commitBackupCall(bundle: PlayBundle, call: BackupCall): Promise<void> {
  const campaignId = bundle.campaign.id;
  const beatId = bundle.beat?.id ?? null;
  const round = bundle.encounter?.state.round ?? 0;
  const pending = pendingBackupFrom(call, round);

  await appendCampaignEvent({
    campaign_id: campaignId,
    type: "backup_called",
    summary: call.responded
      ? `Called for Backup (rolled ${call.responseRoll}) — ${call.tier?.name} inbound, ` +
        `${call.roundsUntilArrival} Round${call.roundsUntilArrival === 1 ? "" : "s"} out` +
        (call.tierUp ? ", and they are sending better" : "") +
        (call.groups > 1 ? ", two groups" : "")
      : `Called for Backup (rolled ${call.responseRoll}) — nobody answers.`,
    roll: call as unknown as Json,
    data: { responded: call.responded } as unknown as Json,
    ...(beatId ? { beat_id: beatId } : {}),
  });

  if (pending) {
    await updateCampaign(campaignId, {
      role_state: withAbilityState(bundle.campaign, "backup", { pending }) as Json,
    });
  }

  const fresh: PlayBundle = { ...bundle, events: await listCampaignEvents(campaignId) };
  await narrate(
    fresh,
    `(ENGINE: the player called for Backup. ${
      call.responded
        ? `Someone answered: ${call.tier?.name} is ${call.roundsUntilArrival} Round(s) out. Narrate the call going out and the wait, and do NOT narrate them arriving yet.`
        : `Nobody answered. Narrate the silence on the line. They can try again next Turn.`
    } Do not re-decide it. End on a decision.)`,
    { logInput: false },
  );
}

/** Checks use the same Action budget as shooting and reloading. */
export async function commitCheck(
  bundle: PlayBundle,
  pending: PendingCheck,
  roll: CheckRoll,
): Promise<void> {
  let live = bundle.encounter;
  if (live?.state.status === "active") {
    if (owesASave(bundle)) throw new Error("Resolve the Death Save first.");
    const legal = judgeAction(snapshotFor(bundle), {
      kind: roll.kind === "opposed" ? "opposed_check" : "skill_check",
      skillId: pending.skillId,
      intent: pending.intent,
    });
    if (!legal.ok) throw new Error(legal.reason);
    const player = currentCombatant(live.state)!;
    const data = live.data[player.id]!;
    live = await saveLiveEncounter({
      ...live,
      data: {
        ...live.data,
        [player.id]: { ...data, turn: spendTurn(data.turn, live.state.round, legal.cost) },
      },
    });
    bundle = { ...bundle, encounter: live };
  }
  await resolveCheck(bundle, pending, roll);
  if (live?.state.status === "active") await finishCombatAction(bundle, live, pending.beatId);
}

/** Persist a rolled check and have the GM narrate the result, win or lose. */
async function resolveCheck(
  bundle: PlayBundle,
  pending: PendingCheck,
  roll: CheckRoll,
): Promise<void> {
  const luckSpent = roll.luckSpent;
  if (roll.kind === "opposed") {
    return commitOpposedCheck(bundle, pending, roll.result, luckSpent);
  }
  const result = roll.result;
  const campaignId = bundle.campaign.id;
  if (pending.dv === null) throw new Error("That check has no DV to resolve against.");
  await logSkillCheck(campaignId, result, {
    luckSpent,
    skillId: pending.skillId,
    skillName: pending.skillName,
    intent: pending.intent,
    promptEventId: pending.eventId,
    ...(pending.beatId ? { beatId: pending.beatId } : {}),
  });
  await payLuck(bundle, luckSpent);

  const verdict = result.success ? "SUCCESS" : "FAILURE";
  const crit = critNote(result.critical);
  const fresh: PlayBundle = {
    ...bundle,
    events: await listCampaignEvents(campaignId),
  };
  await narrate(
    fresh,
    `(ENGINE: the ${pending.skillName} check is RESOLVED. ${result.formula}${crit}. Outcome: ${verdict} by ${Math.abs(result.total - pending.dv)}. Narrate this exact outcome for the intent "${pending.intent}". Do not re-decide it, do not soften a failure, do not propose the same check again. End on a decision.)`,
    { logInput: false, fixedResult: bundle.encounter?.state.status === "active" },
  );
}

/**
 * Persist the rolled attack and its costs, preserving the player's remaining
 * choices. Only a finished turn advances hostiles and narrates the exchange.
 */
export async function commitAttack(
  bundle: PlayBundle,
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
  bundle: PlayBundle,
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
function owesASave(bundle: PlayBundle): boolean {
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
export async function commitBoardMove(bundle: PlayBundle, to: Point): Promise<void> {
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
async function commitCallShot(
  bundle: PlayBundle,
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
export async function commitReload(bundle: PlayBundle, weaponItemId: string): Promise<void> {
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
export async function endPlayerTurn(bundle: PlayBundle): Promise<void> {
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
 * if one is owed, and the GM narrates the lot — once.
 *
 * Extracted from commitAttack so that attacking is no longer the ONLY way a
 * Round can advance. Everything a player does that ends their Turn comes
 * through here, which is what stops a Move-and-pass from leaving the hostiles
 * standing still. `lines` is what the player just did, in the engine's own
 * words; every line this adds joins it, and the model narrates the whole
 * exchange in one call rather than one call per action.
 */
async function handOverTheTurn(
  bundle: PlayBundle,
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
  bundle: PlayBundle,
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

/**
 * A finished job: pay the printed reward into the campaign's eurobucks, write
 * the wrap-up to the ledger, and close the campaign. Every number comes from
 * the mission's own reward block — nothing is invented here.
 */
async function settleMission(
  bundle: PlayBundle,
  runtime: MissionRuntime,
  mission: Mission,
): Promise<void> {
  const campaignId = bundle.campaign.id;
  const printed = missionPayout(mission);
  // A fee argued upwards at the offer is what this job pays. The printed reward
  // is the floor, never a cap the negotiation is quietly reverted to.
  const total =
    bundle.agreedPayout !== null && printed
      ? Math.max(printed.total, bundle.agreedPayout)
      : (printed?.total ?? bundle.agreedPayout ?? 0);
  const payout = printed ? { ...printed, total } : null;
  const done = runtime.objectives.filter((o) => o.status === "done").length;
  // What was AGREED, not what arrived: the settlement receipt records the
  // amount that actually lands. Completion and settlement are committed in the
  // same transaction so a retry cannot duplicate either ledger row.
  const completionSummary = payout
    ? `${mission.title} complete — ${payout.total}eb agreed (${payout.upfront}eb up front, ${payout.onCompletion}eb on delivery); ${done}/${runtime.objectives.length} objectives closed.`
    : `${mission.title} complete — ${done}/${runtime.objectives.length} objectives closed. This job records no printed payout.`;

  // The trip home. What the job cost is read off its own ledger, the money is
  // rolled for, whoever walked away becomes somebody the campaign remembers,
  // and what is left over is written into Life with a day attached.
  const aftermath = await settleAftermath({
    campaignId,
    missionId: mission.id,
    playerName: bundle.character.character.name,
    agreed: total,
    messy: done < runtime.objectives.length,
    factionId: missionFaction(mission),
    completion: {
      summary: completionSummary,
      beatId: runtime.currentBeatId,
      data: { missionId: mission.id, payout } as unknown as Json,
    },
  });

  // A null report means this job had already been settled. The phase fallback
  // below can repair an older campaign that was stranded before Aftermath.
  // Now that it is over, show the player the die that was thrown before it
  // began. A complication they never noticed is worth showing too, and so is a
  // clean brief: it is the evidence that the job's shape was rolled, not
  // written to suit how the job was going.
  await revealComplication(campaignId, mission.id);

  // The campaign stays active: it is the character's run, not this one job.
  // The phase moves to aftermath — the wrap-up screen — and only the player's
  // press moves it on to Life. The AI never performs this transition.
  // The settlement transaction owns the normal phase transition. The fallback
  // only repairs an older already-settled campaign that was left in Job.
  if (!aftermath) {
    const after = nextPhase(phaseOf(bundle.campaign.phase), "end_job");
    if (after) await setCampaignPhase(campaignId, after);
  }
}

/**
 * Which faction a job's opposition belongs to, when it names one.
 *
 * Scans authored mission text ("a Tyger Claws crew, and they are not new at
 * this"), which is this project's own content, so findFactionIn is the right
 * tool for it. A job whose opposition is nobody in particular returns null, and
 * the bodies still raise Heat.
 */
function missionFaction(mission: Mission): FactionId | null {
  const named = [mission.offer?.opposition, ...mission.beats.flatMap((b) => b.opposition ?? [])];
  for (const text of named) {
    const factionId = findFactionIn(text);
    if (factionId) return factionId;
  }
  return null;
}

/**
 * The end-of-session I.P. award. The GM judges the session against the printed
 * table; the engine turns that judgement into the number, and it is written to
 * the campaign and to the character's permanent total exactly once.
 */
export type IpTally = { award: IpAward; judgement: IpJudgement; total: number };

async function settleIp(
  bundle: PlayBundle,
  playstyles: { primary: IpPlaystyle; secondary: IpPlaystyle },
): Promise<IpTally> {
  const campaignId = bundle.campaign.id;
  if (bundle.campaign.ip_awarded !== null && bundle.campaign.ip_awarded !== undefined) {
    throw new Error("This job's Improvement Points have already been awarded.");
  }
  const missionFinished = bundle.runtime?.status === "completed";
  const outcome =
    bundle.campaign.status === "lost"
      ? `${bundle.character.character.name} died in Night City; the job was left unfinished.`
      : missionFinished
        ? "The job was seen through to its resolution."
        : "The session ended with the job unfinished.";

  const judgement = await ipJudgementFn({
    data: {
      userPrompt: renderIpJudgementPrompt({
        missionTitle: bundle.mission?.title ?? bundle.campaign.name,
        missionFinished,
        outcome,
        objectives: (bundle.runtime?.objectives ?? []).map((o) => ({
          text: o.text,
          status: o.status,
        })),
        primary: playstyles.primary,
        secondary: playstyles.secondary,
        log: bundle.events.slice(-60).map((e) => `[${e.type}] ${e.summary ?? ""}`),
        rollCount: rollHistory(bundle.events).length,
      }),
    },
  });

  const award = awardImprovementPoints({
    missionFinished,
    groupIp: judgement.groupIp,
    primary: playstyles.primary,
    secondary: playstyles.secondary,
    primaryIp: judgement.primaryIp,
    secondaryIp: judgement.secondaryIp,
    standout: judgement.standout,
  });

  await appendCampaignEvent({
    campaign_id: campaignId,
    type: "ip_awarded",
    summary: `${award.ip} I.P. awarded (${award.source} column${award.fromStandout ? ", standout" : ""}): ${award.descriptor}`,
    data: { award, judgement, playstyles } as unknown as Json,
  });
  await updateCampaign(campaignId, { ip_awarded: award.ip });
  const total = await addImprovementPoints(bundle.campaign.character_id, award.ip);
  return { award, judgement, total };
}

/** The character died: fail the job and close the campaign. */
async function settleDeath(bundle: PlayBundle): Promise<void> {
  const campaignId = bundle.campaign.id;
  if (bundle.mission && bundle.runtime) {
    await saveMissionRuntime(campaignId, failMission(bundle.runtime));
  }
  await appendCampaignEvent({
    campaign_id: campaignId,
    type: "campaign_ended",
    summary: `${bundle.character.character.name} died in Night City. The job is over.`,
    data: { reason: "death" } as unknown as Json,
  });
  await updateCampaign(campaignId, { status: "lost" });
}

/**
 * Back to the street.
 *
 * Wrap-up is done, so the campaign returns to Life. The run continues:
 * eurobucks, HP, wounds and inventory all carry over, which is the whole point
 * of the campaign outliving the job. The mission pointer is cleared and
 * ip_awarded reset, so the next session is judged on its own merits — and the
 * next job has to arrive as an offer the player accepts, never as a screen they
 * are dropped into.
 */
async function returnToLife(bundle: PlayBundle): Promise<void> {
  await closeAftermath(bundle.campaign.id, luckPoolMax(statsRecord(bundle.character)));
}

/**
 * Persist the player's rolled Death Save. The engine already applied it; this
 * writes it down and hands the GM the exact outcome to narrate.
 */
export async function commitDeathSave(
  bundle: PlayBundle,
  pending: PendingDeathSave,
  result: BeginTurnResult,
): Promise<void> {
  if (!bundle.encounter) throw new Error("There is no encounter to save against.");
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
  // Surviving one leaves the player Mortally Wounded and still on their own
  // Turn, so asking for the prompt again here would owe them a second save for
  // passing the first, forever.
  const status = await closeOutFight(campaignId, beatId, live);
  const line = result.died
    ? `${pending.combatant.name} failed the Death Save and is DEAD (d10 ${save.roll} + ${save.penalty} = ${save.effective} vs BODY ${pending.body}${save.autoFail ? ", a natural 10" : ""}).`
    : `${pending.combatant.name} survived the Death Save (d10 ${save.roll} + ${save.penalty} = ${save.effective} vs BODY ${pending.body}); they are still Mortally Wounded and the next save is at +${save.penaltyAfter}.`;

  if (result.died) await settleDeath(bundle);

  const fresh: PlayBundle = {
    ...bundle,
    events: await listCampaignEvents(campaignId),
    encounter: live,
  };
  await narrate(
    fresh,
    `(ENGINE: the Death Save is RESOLVED. ${line}${status} Narrate exactly this. Do not revive them, do not soften it, do not re-roll it. ${
      result.died ? "Close the scene on that death." : "End on a decision."
    })`,
    { logInput: false },
  );
}

async function takeExit(bundle: PlayBundle, exit: BeatExit): Promise<void> {
  if (!bundle.mission || !bundle.runtime || !bundle.beat) return;
  const campaignId = bundle.campaign.id;
  const next = advance(bundle.mission, bundle.runtime, exit.to);
  await saveMissionRuntime(campaignId, next);
  const toBeat = getBeat(bundle.mission, exit.to);
  await logBeatAdvanced(campaignId, {
    mission: bundle.mission,
    fromBeatId: bundle.beat.id,
    toBeat,
    choiceLabel: exit.label,
  });
  if (next.status === "completed") {
    await settleMission({ ...bundle, runtime: next }, next, bundle.mission);
  }

  // Narrate the new scene from the fresh beat.
  const advanced: PlayBundle = {
    ...bundle,
    runtime: next,
    beat: toBeat,
    availableExits: availableExits(bundle.mission, next),
  };
  await narrate(advanced, `(You choose: ${exit.label}. Set the new scene.)`);
}

/** True when the current beat has never been narrated (fresh campaign or beat). */
export function needsOpeningScene(bundle: PlayBundle): boolean {
  if (!bundle.mission || !bundle.beat) return false;
  return !bundle.events.some((e) => e.type === "gm_narration" && e.beat_id === bundle.beat?.id);
}

/** Ask the GM to open the current beat, without logging a fake player action. */
async function openScene(bundle: PlayBundle): Promise<void> {
  await narrate(
    bundle,
    "(ENGINE: open this scene. Dramatize the beat's read-aloud and brief, make clear how the character knows what they know and why they are involved, place them somewhere concrete, and end on a decision.)",
    { logInput: false },
  );
}

/** The clickable suggestions from the most recent GM narration. */
export function latestSuggestions(bundle: PlayBundle): GmSuggestedAction[] {
  for (let i = bundle.events.length - 1; i >= 0; i -= 1) {
    const event = bundle.events[i];
    if (!event || event.type !== "gm_narration") continue;
    const data = event.data as { suggestedActions?: unknown } | null;
    const parsed = z.array(GmSuggestedActionSchema).safeParse(data?.suggestedActions ?? []);
    return parsed.success ? parsed.data : [];
  }
  return [];
}

/**
 * Which unresolved prompt is the live one. A stale check from an earlier turn
 * must never share the screen with a fresh attack: the newest ledger row wins.
 */
export function newestPrompt(
  events: CampaignEvent[],
  check: { eventId: string } | null,
  attack: { eventId: string } | null,
): "check" | "attack" | null {
  if (!check) return attack ? "attack" : null;
  if (!attack) return "check";
  const index = (id: string) => events.findIndex((e) => e.id === id);
  return index(attack.eventId) >= index(check.eventId) ? "attack" : "check";
}

export function usePlay(campaignId: string) {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["play", campaignId], queryFn: () => loadPlay(campaignId) });

  const playback = useCombatPlayback(campaignId, query.data?.encounter ?? null);
  const invalidate = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["play", campaignId] }),
      queryClient.invalidateQueries({ queryKey: ["campaign-phase", campaignId] }),
      queryClient.invalidateQueries({ queryKey: ["life", campaignId] }),
    ]);

  const turn = useMutation({
    mutationFn: (input: string) => {
      if (!query.data) throw new Error("Still loading.");
      return narrate(query.data, input);
    },
    onSuccess: invalidate,
  });

  /**
   * "What are my options?" — a turn that does not advance the scene. The GM
   * names angles it can already see; the fiction stays exactly where it was.
   */
  const options = useMutation({
    mutationFn: () => {
      if (!query.data) throw new Error("Still loading.");
      return narrate(query.data, "(What are my options here?)", { optionsRequested: true });
    },
    onSuccess: invalidate,
  });

  const choose = useMutation({
    mutationFn: (exit: BeatExit) => {
      if (!query.data) throw new Error("Still loading.");
      return takeExit(query.data, exit);
    },
    onSuccess: invalidate,
  });

  const open = useMutation({
    mutationFn: (bundle: PlayBundle) => openScene(bundle),
    onSuccess: invalidate,
  });

  const check = useMutation({
    mutationFn: ({ pending, roll }: { pending: PendingCheck; roll: CheckRoll }) => {
      if (!query.data) throw new Error("Still loading.");
      return commitCheck(query.data, pending, roll);
    },
    onSuccess: invalidate,
  });

  /**
   * A write the fight moved on past.
   *
   * The state it was computed from is gone, so the answer is never to retry the
   * same payload — it is to re-read. Invalidating here is what makes the next
   * attempt work; without it the bundle keeps its stale version token and every
   * retry refuses itself.
   */
  const onWriteError = () => {
    // A later ledger write may fail after an encounter save succeeded. Refresh
    // on every error so playback cannot leave the screen waiting on stale state.
    void invalidate();
  };

  const combat = useMutation({
    onError: onWriteError,
    mutationFn: ({
      pending,
      option,
      result,
      luckSpent,
    }: {
      pending: PendingAttack;
      option: AttackOption;
      result: PerformAttackResult;
      luckSpent: number;
    }) => {
      if (!query.data) throw new Error("Still loading.");
      return commitAttack(query.data, pending, option, result, luckSpent);
    },
    onSuccess: invalidate,
  });

  // The board's own actions. Neither goes near the model on the way in: the
  // engine prices and resolves them, and the GM is told what happened after.
  const boardMove = useMutation({
    onError: onWriteError,
    mutationFn: (to: Point) => {
      if (!query.data) throw new Error("Still loading.");
      return commitBoardMove(query.data, to);
    },
    onSuccess: invalidate,
  });

  const callShot = useMutation({
    onError: onWriteError,
    mutationFn: ({ targetId, weaponItemId }: { targetId: string; weaponItemId: string }) => {
      if (!query.data) throw new Error("Still loading.");
      return commitCallShot(query.data, targetId, weaponItemId);
    },
    onSuccess: invalidate,
  });

  const cancelShot = useMutation({
    mutationFn: async (promptId: string) => {
      if (!query.data) throw new Error("Still loading.");
      await appendCampaignEvent({
        campaign_id: campaignId,
        type: "attack_cancelled",
        data: { promptId },
      });
    },
    onSuccess: invalidate,
  });

  const reload = useMutation({
    onError: onWriteError,
    mutationFn: (weaponItemId: string) => {
      if (!query.data) throw new Error("Still loading.");
      return commitReload(query.data, weaponItemId);
    },
    onSuccess: invalidate,
  });

  const endTurn = useMutation({
    onError: onWriteError,
    mutationFn: () => {
      if (!query.data) throw new Error("Still loading.");
      return endPlayerTurn(query.data);
    },
    onSuccess: invalidate,
  });

  const death = useMutation({
    onError: onWriteError,
    mutationFn: ({ pending, result }: { pending: PendingDeathSave; result: BeginTurnResult }) => {
      if (!query.data) throw new Error("Still loading.");
      return commitDeathSave(query.data, pending, result);
    },
    onSuccess: invalidate,
  });

  const ip = useMutation({
    mutationFn: (playstyles: { primary: IpPlaystyle; secondary: IpPlaystyle }) => {
      if (!query.data) throw new Error("Still loading.");
      return settleIp(query.data, playstyles);
    },
    onSuccess: invalidate,
  });

  // Open a fresh beat automatically, once, so the player never faces a blank scene.
  const opened = useRef<string | null>(null);
  const bundle = query.data;
  useEffect(() => {
    if (!bundle || open.isPending || turn.isPending || choose.isPending) return;
    if (open.error) return; // A failed opening waits for an explicit retry.
    if (!needsOpeningScene(bundle)) return;
    const key = `${bundle.campaign.id}:${bundle.beat?.id ?? ""}`;
    if (opened.current === key) return;
    opened.current = key;
    open.mutate(bundle);
  }, [bundle, open, turn.isPending, choose.isPending]);

  const actionError =
    (turn.error as Error | null) ??
    (options.error as Error | null) ??
    (choose.error as Error | null) ??
    (open.error as Error | null) ??
    (check.error as Error | null) ??
    (combat.error as Error | null) ??
    // The board's own actions failed silently before this: they were never in
    // the list the screen reads.
    (boardMove.error as Error | null) ??
    (endTurn.error as Error | null) ??
    (reload.error as Error | null) ??
    (cancelShot.error as Error | null) ??
    (callShot.error as Error | null) ??
    (death.error as Error | null);

  // Exactly one card is ever live: a Death Save outranks everything (you cannot
  // act until you have made it), then whichever prompt the GM posted last.
  const pendingDeathSave = bundle ? pendingDeathSaveFrom(bundle.events, bundle.encounter) : null;
  const checkQueue =
    bundle && !pendingDeathSave
      ? pendingChecksFrom(
          bundle.events,
          bundle.character,
          bundle.vitals.wound_state as WoundStateCode,
          { vitals: bundle.vitals, inventory: bundle.inventory },
        )
      : [];
  const checkCandidate = checkQueue[0] ?? null;
  const attackCandidate =
    bundle && !pendingDeathSave
      ? pendingAttackFrom(
          bundle.events,
          bundle.character,
          bundle.encounter,
          bundle.inventory,
          bundle.vitals,
        )
      : null;
  const newest = bundle ? newestPrompt(bundle.events, checkCandidate, attackCandidate) : null;
  const pendingCheck = newest === "check" ? checkCandidate : null;
  const pendingAttack = newest === "attack" ? attackCandidate : null;

  // A Solo re-divides their Combat Awareness when combat begins or outside it,
  // and the division persists until they change it — so it is campaign state,
  // not something the card holds.
  const awarenessMutation = useMutation({
    mutationFn: (allocation: Record<string, number>) => {
      if (!query.data) throw new Error("Still loading.");
      const campaign = query.data.campaign;
      return updateCampaign(campaign.id, {
        role_state: withAbilityState(campaign, "combat_awareness", { allocation }) as Json,
      });
    },
    onSuccess: invalidate,
  });

  const backupMutation = useMutation({
    mutationFn: (call: BackupCall) => {
      if (!query.data) throw new Error("Still loading.");
      return commitBackupCall(query.data, call);
    },
    onSuccess: invalidate,
  });

  const specialtyMutation = useMutation({
    mutationFn: (specialties: Record<string, number>) => {
      if (!query.data) throw new Error("Still loading.");
      const campaign = query.data.campaign;
      return updateCampaign(campaign.id, {
        role_state: withAbilityState(campaign, "maker", { specialties }) as Json,
      });
    },
    onSuccess: invalidate,
  });

  // Specialty divisions and team rosters are all one shape: a blob under the
  // ability's own key in role_state.
  const abilityStateMutation = useMutation({
    mutationFn: ({ abilityId, state }: { abilityId: string; state: Record<string, unknown> }) => {
      if (!query.data) throw new Error("Still loading.");
      const campaign = query.data.campaign;
      return updateCampaign(campaign.id, {
        role_state: withAbilityState(campaign, abilityId, state) as Json,
      });
    },
    onSuccess: invalidate,
  });

  const charismaMutation = useMutation({
    mutationFn: (result: CharismaticImpactResult) => {
      if (!query.data) throw new Error("Still loading.");
      return commitCharismaticImpact(query.data, result);
    },
    onSuccess: invalidate,
  });

  const nextJobMutation = useMutation({
    mutationFn: () => {
      if (!query.data) throw new Error("Still loading.");
      return returnToLife(query.data);
    },
    onSuccess: invalidate,
  });

  const retry = () => {
    if (!bundle) return;
    if (open.error) {
      open.reset();
      open.mutate(bundle);
      return;
    }
    if (turn.error) {
      const last = turn.variables;
      turn.reset();
      if (last) turn.mutate(last);
      return;
    }
    if (choose.error) {
      const last = choose.variables;
      choose.reset();
      if (last) choose.mutate(last);
    }
  };

  return {
    bundle,
    isPending: query.isPending,
    error: query.error as Error | null,
    /** Resolves true when the turn landed, false when it failed. */
    submit: async (input: string) => {
      try {
        await turn.mutateAsync(input);
        return true;
      } catch {
        return false;
      }
    },
    choose: (exit: BeatExit) => choose.mutate(exit),
    askOptions: () => options.mutate(),
    suggestions:
      pendingCheck || pendingAttack || pendingDeathSave
        ? []
        : bundle
          ? latestSuggestions(bundle)
          : [],

    /**
     * What the character can actually do right now, so the cards can grey out
     * the impossible instead of letting the player roll for it.
     */
    capability: bundle
      ? snapshotFor(playback.frame ? { ...bundle, encounter: playback.frame.live } : bundle)
      : null,
    playback,

    /** The check waiting on the player's die, if any. */
    pendingCheck,
    /** How many checks are on the table, so the UI can say another is coming. */
    pendingCheckCount: pendingCheck ? checkQueue.length : 0,
    /**
     * Roll the pending check — the engine decides the numbers. An opposed check
     * rolls BOTH sides here, in one call, so the two dice the card reveals are
     * the two the engine actually rolled.
     */
    rollCheck: (pending: PendingCheck, luckSpend = 0): CheckRoll => {
      if (!bundle) throw new Error("Still loading.");
      const actor = actorFor(bundle.character, {
        vitals: bundle.vitals,
        inventory: bundle.inventory,
      });
      // Clamp against the live pool, not against what the card offered: the
      // stepper cannot talk the engine into spending points that are not there.
      const luckSpent = clampLuckSpend(
        luckSpend,
        luckRemaining(bundle.vitals.luck_current, statsRecord(bundle.character)),
      );
      const spend = luckModifier(luckSpent);
      // Being hurt follows you out of the fight: the same −2/−4 the engine
      // already applies to attacks now rides on every other Check too.
      const wounds = woundActionPenalty(bundle.vitals.wound_state as WoundStateCode);
      const situational = [
        ...(spend ? [spend] : []),
        ...(wounds !== 0 ? [{ label: "Wounds", value: wounds }] : []),
        // What your Role brings to this particular check — a Solo's Threat
        // Detection on a Perception roll, a Fixer's Operator Rank on a deal.
        ...roleCheckModifiers({
          campaign: bundle.campaign,
          character: bundle.character,
          skillId: pending.skillId,
        }),
      ];
      const modifiers = situational.length > 0 ? { modifiers: situational } : {};
      const opposition = oppositionFor(pending);
      if (opposition) {
        return {
          kind: "opposed",
          luckSpent,
          result: opposedCheckForCharacter(actor, pending.skillId, opposition, undefined, {
            actorName: bundle.character.character.name,
            ...modifiers,
          }),
        };
      }
      if (pending.dv === null) throw new Error("That check has neither a DV nor an opponent.");
      return {
        kind: "dv",
        luckSpent,
        result: skillCheckForCharacter(actor, pending.skillId, pending.dv, undefined, modifiers),
      };
    },
    /** The character's Role Ability and Rank, for the panel that spends it. */
    roleAbility: bundle ? liveRoleAbility(bundle.character) : null,
    /** A Solo's live Combat Awareness division, or null for every other Role. */
    combatAwareness: bundle ? combatAwarenessFor(bundle.campaign, bundle.character) : null,
    /** The points as currently assigned, for the panel to edit. */
    combatAwarenessAllocation: bundle ? combatAwarenessAllocation(bundle.campaign) : {},
    /** Re-divide the pool. Rejected by the engine if it does not fit. */
    setCombatAwareness: (allocation: Record<string, number>) =>
      awarenessMutation.mutate(allocation),
    combatAwarenessBusy: awarenessMutation.isPending,
    /** Roll a Rockerboy's Charismatic Impact — the engine decides the number. */
    rollCharismaticImpact: (audienceId: string): CharismaticImpactResult => {
      if (!bundle) throw new Error("Still loading.");
      const ability = liveRoleAbility(bundle.character);
      if (!ability || ability.info.abilityId !== "charismatic_impact") {
        throw new Error("That is not your Role Ability.");
      }
      return charismaticImpactCheck(ability.rank, audienceId);
    },
    /** Record it and let the GM narrate the room. */
    commitCharismaticImpact: (result: CharismaticImpactResult) => charismaMutation.mutate(result),
    charismaBusy: charismaMutation.isPending,

    /** Lawman: roll to see whether anyone answers the call. */
    rollBackup: (): BackupCall => {
      if (!bundle) throw new Error("Still loading.");
      const ability = liveRoleAbility(bundle.character);
      if (!ability || ability.info.abilityId !== "backup") {
        throw new Error("That is not your Role Ability.");
      }
      return callBackup(ability.rank);
    },
    commitBackupCall: (call: BackupCall) => backupMutation.mutate(call),
    backupBusy: backupMutation.isPending,
    /** The group this Rank can call, for the panel to name before the roll. */
    backupTier: bundle ? backupTierFor(liveRoleAbility(bundle.character)?.rank ?? 0) : null,
    /** Help already on its way, if a call has landed. */
    pendingBackup: bundle ? pendingBackup(bundle.campaign) : null,

    /** Tech: the Maker Specialty division and its budget. */
    makerSpecialties: bundle ? makerSpecialties(bundle.campaign) : {},
    makerBudget: bundle ? makerSpecialtyBudget(bundle.campaign, bundle.character) : null,
    setMakerSpecialties: (specialties: Record<string, number>) =>
      specialtyMutation.mutate(specialties),
    makerBusy: specialtyMutation.isPending,

    /** Medtech: Specialty points and the doses they have on hand. */
    medicineSpecialties: bundle ? medicineSpecialties(bundle.campaign) : {},
    medicineDoses: bundle ? medicineDoses(bundle.campaign) : {},
    setMedicineSpecialties: (specialties: Record<string, number>) =>
      abilityStateMutation.mutate({
        abilityId: "medicine",
        state: { specialties, doses: bundle ? medicineDoses(bundle.campaign) : {} },
      }),
    setMedicineDoses: (doses: Record<string, number>) =>
      abilityStateMutation.mutate({
        abilityId: "medicine",
        state: { specialties: bundle ? medicineSpecialties(bundle.campaign) : {}, doses },
      }),

    /** Exec: the team and the slots their Rank supports. */
    execTeam: bundle ? execTeam(bundle.campaign, bundle.character) : null,
    setExecTeam: (members: unknown[]) =>
      abilityStateMutation.mutate({ abilityId: "teamwork", state: { members } }),
    abilityStateBusy: abilityStateMutation.isPending,
    /** The Luck Pool as the table sees it: what is left, and what it holds full. */
    luck: {
      remaining: bundle
        ? luckRemaining(bundle.vitals.luck_current, statsRecord(bundle.character))
        : 0,
      max: bundle ? luckPoolMax(statsRecord(bundle.character)) : 0,
    },
    /** Record the rolled check and let the GM narrate the outcome. */
    commitCheck: (pending: PendingCheck, roll: CheckRoll) => check.mutate({ pending, roll }),
    checkBusy: check.isPending,
    /** The attack waiting on the player's dice, if any. */
    pendingAttack,
    /** The live fight, for the board and the initiative/status rail. */
    encounter: playback.frame?.live ?? bundle?.encounter ?? null,
    /**
     * Walk to a spot on the board. The engine decides how far they get; a
     * Move does not end the Turn, so the Action is still theirs afterwards.
     */
    moveTo: (to: Point) => boardMove.mutate(to),
    /** Put rounds back in a gun, spending the Action the gate prices it at. */
    reload: (weaponItemId: string) => reload.mutate(weaponItemId),
    /** Call a shot on somebody, which posts the prompt the card resolves. */
    cancelShot: () => {
      if (pendingAttack) cancelShot.mutate(pendingAttack.eventId);
    },
    callShot: (targetId: string, weaponItemId: string) =>
      callShot.mutate({ targetId, weaponItemId }),
    /** Give up the rest of the Turn and let the hostiles take theirs. */
    endTurn: () => endTurn.mutate(),
    /**
     * True while a Turn is being spent or handed over. The board is inert
     * throughout: a click landing mid-narration would be computed against a
     * bundle the server has already moved past, and combatant positions are
     * written last-write-wins.
     */
    turnBusy: boardMove.isPending || endTurn.isPending || reload.isPending || callShot.isPending,
    /** Roll the attack — the engine resolves To-Hit, damage and armor. */
    rollAttack: (
      pending: PendingAttack,
      option: AttackOption,
      luckSpend = 0,
    ): PerformAttackResult => {
      if (!bundle?.encounter) throw new Error("There is no encounter to attack in.");
      const preview = previewAttack(snapshotFor(bundle), pending.target.id, option.weapon.itemId);
      if (preview.gap || preview.dv === null)
        throw new Error(preview.gap ?? "No ranged shot here.");
      if (owesASave(bundle)) throw new Error("Resolve the Death Save first.");
      // An attack roll is a Check, so Luck rides on it exactly as it does on a
      // Persuasion roll.
      const spend = luckModifier(
        clampLuckSpend(
          luckSpend,
          luckRemaining(bundle.vitals.luck_current, statsRecord(bundle.character)),
        ),
      );
      // A Solo's Precision Attack rides on the To-Hit roll.
      const awareness = combatAwarenessFor(bundle.campaign, bundle.character);
      const attackModifiers = [
        ...(spend ? [spend] : []),
        ...(awareness && awareness.attack > 0
          ? [{ label: "Precision Attack", value: awareness.attack }]
          : []),
      ];
      return performAttack(bundle.encounter.state, {
        attackerId: pending.attacker.id,
        targetId: pending.target.id,
        statLabel: option.statLabel,
        statValue: option.statValue,
        skillLabel: option.skillLabel,
        skillValue: option.skillValue,
        dv: preview.dv,
        damageDice: option.damageDice ?? 0,
        ...(attackModifiers.length > 0 ? { modifiers: attackModifiers } : {}),
      });
    },
    /** Record the rolled attack, run the hostile turns, and narrate the result. */
    commitAttack: (
      pending: PendingAttack,
      option: AttackOption,
      result: PerformAttackResult,
      luckSpent = 0,
    ) => combat.mutate({ pending, option, result, luckSpent }),
    combatBusy: combat.isPending,
    /** The Death Save the player owes before acting, if any. */
    pendingDeathSave,
    /** Roll the Death Save — the engine rolls it and applies the outcome. */
    rollDeathSave: (): BeginTurnResult => {
      if (!bundle?.encounter) throw new Error("There is no encounter to save against.");
      return beginTurn(bundle.encounter.state);
    },
    /** Record the rolled Death Save and let the GM narrate it. */
    commitDeathSave: (pending: PendingDeathSave, result: BeginTurnResult) =>
      death.mutate({ pending, result }),
    deathBusy: death.isPending,
    rolls: bundle ? rollHistory(bundle.events) : [],
    /** Tally the session's Improvement Points once the job is over. */
    tallyIp: (playstyles: { primary: IpPlaystyle; secondary: IpPlaystyle }) =>
      ip.mutate(playstyles),
    ipTally: (ip.data as IpTally | undefined) ?? null,
    ipBusy: ip.isPending,
    ipError: (ip.error as Error | null) ?? null,
    /** The I.P. this job already paid, if it has been tallied. */
    ipAwarded: bundle?.campaign.ip_awarded ?? null,
    /** The job is over: completed, or the character died. Null while playing. */
    finished: bundle ? jobOutcome(bundle.campaign.status, bundle.runtime?.status ?? null) : null,
    /** Take the next job in this campaign, keeping the run's money and wounds. */
    backToLife: () => nextJobMutation.mutate(),
    backToLifeBusy: nextJobMutation.isPending,
    backToLifeError: (nextJobMutation.error as Error | null) ?? null,
    opening: open.isPending || (bundle ? needsOpeningScene(bundle) && !open.error : false),
    busy:
      playback.locked ||
      query.isFetching ||
      turn.isPending ||
      options.isPending ||
      choose.isPending ||
      open.isPending ||
      check.isPending ||
      combat.isPending ||
      boardMove.isPending ||
      endTurn.isPending ||
      reload.isPending ||
      callShot.isPending ||
      cancelShot.isPending ||
      death.isPending,
    actionError,
    retry,
    // Only what `retry` can actually re-run. It re-fires the opening scene, the
    // turn and the beat choice; offering the button for a failed encounter
    // write put a dead control under the error, which reads as "we tried" and
    // is worse than no button at all.
    canRetry: Boolean(bundle) && Boolean(open.error ?? turn.error ?? choose.error),
  };
}
