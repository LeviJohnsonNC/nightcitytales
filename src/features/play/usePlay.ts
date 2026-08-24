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
  getMission,
  failMission,
  getSkill,
  missionPayout,
  type IpAward,
  type IpPlaystyle,
  clampLuckSpend,
  jobIdForSeed,
  luckAfterSpend,
  luckModifier,
  luckPoolMax,
  luckRemaining,
  opposedCheckForCharacter,
  performAttack,
  resolveSkillId,
  rollJobSeed,
  startMission,
  skillCheckForCharacter,
  type Beat,
  type BeatExit,
  type BeginTurnResult,
  type Mission,
  type MissionRuntime,
  type OpposedCheckResult,
  type Opposition,
  type PerformAttackResult,
} from "@/engine";

import {
  addImprovementPoints,
  appendCampaignEvent,
  getCampaign,
  getCharacter,
  listCampaignEvents,
  updateCampaign,
  updateCampaignVitals,
  type Campaign,
  type CampaignEvent,
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
import {
  loadLiveEncounter,
  saveLiveEncounter,
  type LiveEncounter,
} from "@/features/campaign/encounterState";
import { buildGmContext, renderGmUserPrompt } from "@/features/gm/gmContext";
import { gmTurnFn } from "@/features/gm/gmTurn.server";
import { renderIpJudgementPrompt, type IpJudgement } from "@/features/gm/ipJudgement";
import { ipJudgementFn } from "@/features/gm/ipJudgement.server";
import {
  actorFor,
  characterSummary,
  findNpcByKey,
  statsRecord,
  npcSummaries,
  jobOutcome,
  recentEventLines,
  turnsSinceLastRoll,
} from "./playModel";
import { beginEncounter, describeAttack, runNpcTurns } from "./combatFlow";
import {
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
  /** The fight in progress, if the GM has started one. */
  encounter: LiveEncounter | null;
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
    encounter,
  };
}

async function narrate(
  bundle: PlayBundle,
  input: string,
  options: { logInput?: boolean } = {},
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

  const context = buildGmContext({
    mission: bundle.mission,
    beat: bundle.beat,
    availableExits: bundle.availableExits,
    character: characterSummary(bundle.character, bundle.vitals),
    objectives: bundle.runtime.objectives,
    npcsPresent: npcSummaries(bundle.npcs),
    recentEvents: recentEventLines(bundle.events),
    turnsSinceLastRoll: turnsSinceLastRoll(bundle.events),
  });

  const gm = await gmTurnFn({ data: { userPrompt: renderGmUserPrompt(context, input) } });

  await appendCampaignEvent({
    campaign_id: campaignId,
    type: "gm_narration",
    summary: gm.narration,
    data: {
      endsWithDecision: gm.endsWithDecision,
      suggestedActions: gm.suggestedActions,
    } as unknown as Json,
    ...beatFields,
  });

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
  const outstanding = pendingChecksFrom(bundle.events, bundle.character).length;
  const checkBudget = Math.max(0, MAX_CHECKS_PER_TURN - outstanding);

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
        if (next.status === "completed") {
          await settleMission({ ...bundle, runtime: next }, next, bundle.mission);
        }
      }
    } else if (action.kind === "start_encounter") {
      if (live) continue; // one fight at a time
      live = await beginEncounter({
        campaignId,
        characterId: bundle.campaign.character_id,
        beatId,
        name: action.name,
        character: bundle.character,
        vitals: bundle.vitals,
        enemies: action.enemies,
      });
    } else if (action.kind === "attack") {
      if (attackPosted || postedSkillIds.size > 0) continue;
      if (!live || live.state.status !== "active") continue;
      const target = findTarget(live, action.targetId);
      if (!target || target.defeated || target.isPlayer) continue;
      attackPosted = true;
      await appendCampaignEvent({
        campaign_id: campaignId,
        type: "attack_prompt",
        summary: `Attack ${target.name} at ${action.distance}m`,
        data: {
          targetId: target.id,
          targetName: target.name,
          distance: action.distance,
          intent: action.intent,
        } as unknown as Json,
        ...beatFields,
      });
    }
  }

  for (const delta of gm.stateDeltas) {
    if (delta.kind === "note") {
      await appendCampaignEvent({
        campaign_id: campaignId,
        type: "gm_note",
        summary: delta.text,
        data: {} as Json,
        ...beatFields,
      });
    }
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
    { logInput: false },
  );
}

/** Persist a rolled check and have the GM narrate the result, win or lose. */
async function commitCheck(
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
    { logInput: false },
  );
}

/**
 * Persist the player's rolled attack, run the hostile turns the engine owns,
 * sync the player's HP, then let the GM narrate exactly what happened.
 */
export async function commitAttack(
  bundle: PlayBundle,
  pending: PendingAttack,
  option: AttackOption,
  result: PerformAttackResult,
  luckSpent = 0,
): Promise<void> {
  if (!bundle.encounter) throw new Error("There is no encounter to attack in.");
  const campaignId = bundle.campaign.id;
  const beatId = pending.beatId;

  let live: LiveEncounter = { ...bundle.encounter, state: result.state };
  await saveLiveEncounter(live);
  await logAttack(
    campaignId,
    { attack: result.attack, damage: result.damage, applied: result.applied },
    {
      attackerName: pending.attacker.name,
      targetName: pending.target.name,
      weapon: option.weapon.name,
      ...(result.targetWoundState ? { targetWoundState: result.targetWoundState } : {}),
      beatId,
    },
  );
  await payLuck(bundle, luckSpent);

  const lines = [
    describeAttack(pending.attacker.name, pending.target.name, option.weapon.name, result),
  ];
  const npc = await runNpcTurns(campaignId, beatId, live);
  live = npc.live;
  lines.push(...npc.lines);

  // The player's HP in the fight is the campaign's HP.
  const player = Object.values(live.state.combatants).find((c) => c.isPlayer);
  if (player && player.hp !== bundle.vitals.hp_current) {
    await updateCampaignVitals(campaignId, { hp_current: player.hp });
  }

  const status = await closeOutFight(campaignId, beatId, live);

  // A Mortally Wounded player owes a Death Save before they can act again.
  const owed = deathSaveOwed(live);
  if (owed) await promptDeathSave(campaignId, beatId, owed.name);

  const fresh: PlayBundle = {
    ...bundle,
    events: await listCampaignEvents(campaignId),
    encounter: live,
  };
  await narrate(
    fresh,
    `(ENGINE: combat is RESOLVED for this exchange. ${lines.join(" ")}${status} Narrate exactly these results in short kinetic beats. Do not change a hit, a miss, a damage number, or who is standing. ${
      status
        ? "Return to the scene."
        : owed
          ? "The player is Mortally Wounded and owes a Death Save before acting: end on that breath, and propose nothing."
          : "Then propose the player's next attack or action."
    })`,
    { logInput: false },
  );
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
  const payout = missionPayout(mission);
  if (payout) {
    await updateCampaignVitals(campaignId, {
      eurobucks: bundle.vitals.eurobucks + payout.total,
    });
  }
  const done = runtime.objectives.filter((o) => o.status === "done").length;
  await appendCampaignEvent({
    campaign_id: campaignId,
    type: "mission_completed",
    summary: payout
      ? `${mission.title} complete — ${payout.total}eb paid (${payout.upfront}eb up front, ${payout.onCompletion}eb on delivery); ${done}/${runtime.objectives.length} objectives closed.`
      : `${mission.title} complete — ${done}/${runtime.objectives.length} objectives closed. This job records no printed payout.`,
    data: { missionId: mission.id, payout } as unknown as Json,
    ...(runtime.currentBeatId ? { beat_id: runtime.currentBeatId } : {}),
  });
  // The campaign stays active: it is the character's run, not this one job.
  // mission_progress already records the job as completed, and the player is
  // offered the next one at wrap-up.
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
 * Take the next job in the same campaign.
 *
 * The run continues: eurobucks, HP, wounds and inventory all carry over, which
 * is the whole point of the campaign outliving the job. Only the mission
 * pointer moves, and ip_awarded is cleared so the next session can be judged on
 * its own merits — I.P. are awarded per session, not once per character.
 */
async function startNextJob(bundle: PlayBundle): Promise<string> {
  const campaignId = bundle.campaign.id;
  const missionId = jobIdForSeed(rollJobSeed());
  const mission = getMission(missionId);

  await saveMissionRuntime(campaignId, startMission(mission));
  await updateCampaign(campaignId, {
    current_mission_id: missionId,
    ip_awarded: null,
    status: "active",
  });
  // A new job is a new session: the Luck Pool refills. This app has always
  // treated one job as one session — it is the unit Improvement Points are
  // awarded on — so Luck refreshes on the same boundary.
  await updateCampaignVitals(campaignId, {
    luck_current: luckPoolMax(statsRecord(bundle.character)),
  });
  await appendCampaignEvent({
    campaign_id: campaignId,
    type: "mission_started",
    summary: `New job: ${mission.title}${mission.patron ? ` — ${mission.patron}` : ""}`,
    data: { missionId } as unknown as Json,
  });
  return missionId;
}

/** Announce a finished fight in the ledger, and describe it for the GM. */
async function closeOutFight(
  campaignId: string,
  beatId: string | null,
  live: LiveEncounter,
): Promise<string> {
  if (live.state.status === "active") return "";
  const won = live.state.status === "friendlies_won";
  const summary = won
    ? "The hostiles are all down; the fight is over."
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

  const live: LiveEncounter = { ...bundle.encounter, state: result.state };
  await saveLiveEncounter(live);
  await logDeathSave(campaignId, save, {
    combatantName: pending.combatant.name,
    died: result.died,
    beatId,
  });

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

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ["play", campaignId] });

  const turn = useMutation({
    mutationFn: (input: string) => {
      if (!query.data) throw new Error("Still loading.");
      return narrate(query.data, input);
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

  const combat = useMutation({
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

  const death = useMutation({
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
    (choose.error as Error | null) ??
    (open.error as Error | null) ??
    (check.error as Error | null) ??
    (combat.error as Error | null) ??
    (death.error as Error | null);

  // Exactly one card is ever live: a Death Save outranks everything (you cannot
  // act until you have made it), then whichever prompt the GM posted last.
  const pendingDeathSave = bundle ? pendingDeathSaveFrom(bundle.events, bundle.encounter) : null;
  const checkQueue =
    bundle && !pendingDeathSave ? pendingChecksFrom(bundle.events, bundle.character) : [];
  const checkCandidate = checkQueue[0] ?? null;
  const attackCandidate =
    bundle && !pendingDeathSave
      ? pendingAttackFrom(bundle.events, bundle.character, bundle.encounter)
      : null;
  const newest = bundle ? newestPrompt(bundle.events, checkCandidate, attackCandidate) : null;
  const pendingCheck = newest === "check" ? checkCandidate : null;
  const pendingAttack = newest === "attack" ? attackCandidate : null;

  const nextJobMutation = useMutation({
    mutationFn: () => {
      if (!query.data) throw new Error("Still loading.");
      return startNextJob(query.data);
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
    suggestions:
      pendingCheck || pendingAttack || pendingDeathSave
        ? []
        : bundle
          ? latestSuggestions(bundle)
          : [],

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
      const actor = actorFor(bundle.character);
      // Clamp against the live pool, not against what the card offered: the
      // stepper cannot talk the engine into spending points that are not there.
      const luckSpent = clampLuckSpend(
        luckSpend,
        luckRemaining(bundle.vitals.luck_current, statsRecord(bundle.character)),
      );
      const spend = luckModifier(luckSpent);
      const modifiers = spend ? { modifiers: [spend] } : {};
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
    /** The live fight, for the initiative/status rail. */
    encounter: bundle?.encounter ?? null,
    /** Roll the attack — the engine resolves To-Hit, damage and armor. */
    rollAttack: (
      pending: PendingAttack,
      option: AttackOption,
      luckSpend = 0,
    ): PerformAttackResult => {
      if (!bundle?.encounter) throw new Error("There is no encounter to attack in.");
      if (option.dv === null) throw new Error("This weapon has no printed Range DV here.");
      // An attack roll is a Check, so Luck rides on it exactly as it does on a
      // Persuasion roll.
      const spend = luckModifier(
        clampLuckSpend(
          luckSpend,
          luckRemaining(bundle.vitals.luck_current, statsRecord(bundle.character)),
        ),
      );
      return performAttack(bundle.encounter.state, {
        attackerId: pending.attacker.id,
        targetId: pending.target.id,
        statLabel: option.statLabel,
        statValue: option.statValue,
        skillLabel: option.skillLabel,
        skillValue: option.skillValue,
        dv: option.dv,
        damageDice: option.damageDice ?? 0,
        ...(spend ? { modifiers: [spend] } : {}),
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
    nextJob: () => nextJobMutation.mutate(),
    nextJobBusy: nextJobMutation.isPending,
    nextJobError: (nextJobMutation.error as Error | null) ?? null,
    opening: open.isPending || (bundle ? needsOpeningScene(bundle) && !open.error : false),
    busy:
      turn.isPending ||
      choose.isPending ||
      open.isPending ||
      check.isPending ||
      combat.isPending ||
      death.isPending,
    actionError,
    retry,
    canRetry: Boolean(actionError) && Boolean(bundle),
  };
}
