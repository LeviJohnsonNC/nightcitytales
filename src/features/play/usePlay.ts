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
  beginTurn,
  currentBeat,
  getBeat,
  getMission,
  getSkill,
  performAttack,
  skillCheckForCharacter,
  type Beat,
  type BeatExit,
  type BeginTurnResult,
  type Mission,
  type MissionRuntime,
  type PerformAttackResult,
  type SkillCheckResult,
} from "@/engine";

import {
  appendCampaignEvent,
  getCampaign,
  getCharacter,
  listCampaignEvents,
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
import { logSkillCheck } from "@/features/campaign/skillCheckLog";
import { logAttack, logDeathSave } from "@/features/campaign/combatLog";
import {
  loadLiveEncounter,
  saveLiveEncounter,
  type LiveEncounter,
} from "@/features/campaign/encounterState";
import { buildGmContext, renderGmUserPrompt } from "@/features/gm/gmContext";
import { gmTurnFn } from "@/features/gm/gmTurn.server";
import { actorFor, characterSummary, npcSummaries, recentEventLines } from "./playModel";
import { beginEncounter, describeAttack, runNpcTurns } from "./combatFlow";
import {
  findTarget,
  pendingAttackFrom,
  type AttackOption,
  type PendingAttack,
} from "./attackPrompt";
import {
  dvBandName,
  pendingCheckFrom,
  rollHistory,
  snapToPublishedDv,
  type PendingCheck,
} from "./checkPrompt";
import {
  deathSaveOwed,
  pendingDeathSaveFrom,
  type PendingDeathSave,
} from "./deathSavePrompt";


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
  let promptPosted = false;
  let live = bundle.encounter;

  for (const action of gm.proposedActions) {
    if (action.kind === "skill_check") {
      if (promptPosted) continue; // one check at a time at the table
      let skillName: string | null = null;
      try {
        skillName = getSkill(action.skillId).name;
      } catch {
        continue; // an unknown skill id is not a check we can offer
      }
      const dv = snapToPublishedDv(action.dv);
      const band = dvBandName(dv);
      promptPosted = true;
      await appendCampaignEvent({
        campaign_id: campaignId,
        type: "check_prompt",
        summary: `${skillName} check — DV ${dv}${band ? ` (${band})` : ""}`,
        data: {
          skillId: action.skillId,
          skillName,
          dv,
          intent: action.intent,
        } as unknown as Json,
        ...beatFields,
      });
    } else if (action.kind === "advance_beat") {
      try {
        const next = advance(bundle.mission, bundle.runtime, action.to);
        await saveMissionRuntime(campaignId, next);
        await logBeatAdvanced(campaignId, {
          mission: bundle.mission,
          fromBeatId: bundle.beat.id,
          toBeat: getBeat(bundle.mission, action.to),
        });
      } catch {
        // Ignore an invalid advancement the model proposed; the beat stays put.
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
      if (promptPosted || !live || live.state.status !== "active") continue;
      const target = findTarget(live, action.targetId);
      if (!target || target.defeated || target.isPlayer) continue;
      promptPosted = true;
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

/** Persist a rolled check and have the GM narrate the result, win or lose. */
async function commitCheck(
  bundle: PlayBundle,
  pending: PendingCheck,
  result: SkillCheckResult,
): Promise<void> {
  const campaignId = bundle.campaign.id;
  await logSkillCheck(campaignId, result, {
    skillId: pending.skillId,
    skillName: pending.skillName,
    intent: pending.intent,
    ...(pending.beatId ? { beatId: pending.beatId } : {}),
  });

  const verdict = result.success ? "SUCCESS" : "FAILURE";
  const crit =
    result.critical === "success"
      ? " (Critical Success: an extra d10 was added)"
      : result.critical === "failure"
        ? " (Critical Failure: an extra d10 was subtracted)"
        : "";
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
    mutationFn: ({ pending, result }: { pending: PendingCheck; result: SkillCheckResult }) => {
      if (!query.data) throw new Error("Still loading.");
      return commitCheck(query.data, pending, result);
    },
    onSuccess: invalidate,
  });

  const combat = useMutation({
    mutationFn: ({
      pending,
      option,
      result,
    }: {
      pending: PendingAttack;
      option: AttackOption;
      result: PerformAttackResult;
    }) => {
      if (!query.data) throw new Error("Still loading.");
      return commitAttack(query.data, pending, option, result);
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
    (combat.error as Error | null);

  const pendingCheck = bundle ? pendingCheckFrom(bundle.events, bundle.character) : null;
  const pendingAttack = bundle
    ? pendingAttackFrom(bundle.events, bundle.character, bundle.encounter)
    : null;

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
    suggestions: pendingCheck || pendingAttack ? [] : bundle ? latestSuggestions(bundle) : [],
    /** The check waiting on the player's die, if any. */
    pendingCheck,
    /** Roll the pending check — the engine decides the number. */
    rollCheck: (pending: PendingCheck) => {
      if (!bundle) throw new Error("Still loading.");
      return skillCheckForCharacter(actorFor(bundle.character), pending.skillId, pending.dv);
    },
    /** Record the rolled check and let the GM narrate the outcome. */
    commitCheck: (pending: PendingCheck, result: SkillCheckResult) =>
      check.mutate({ pending, result }),
    checkBusy: check.isPending,
    /** The attack waiting on the player's dice, if any. */
    pendingAttack,
    /** The live fight, for the initiative/status rail. */
    encounter: bundle?.encounter ?? null,
    /** Roll the attack — the engine resolves To-Hit, damage and armor. */
    rollAttack: (pending: PendingAttack, option: AttackOption): PerformAttackResult => {
      if (!bundle?.encounter) throw new Error("There is no encounter to attack in.");
      if (option.dv === null) throw new Error("This weapon has no printed Range DV here.");
      return performAttack(bundle.encounter.state, {
        attackerId: pending.attacker.id,
        targetId: pending.target.id,
        statLabel: option.statLabel,
        statValue: option.statValue,
        skillLabel: option.skillLabel,
        skillValue: option.skillValue,
        dv: option.dv,
        damageDice: option.damageDice ?? 0,
      });
    },
    /** Record the rolled attack, run the hostile turns, and narrate the result. */
    commitAttack: (pending: PendingAttack, option: AttackOption, result: PerformAttackResult) =>
      combat.mutate({ pending, option, result }),
    combatBusy: combat.isPending,
    rolls: bundle ? rollHistory(bundle.events) : [],
    opening: open.isPending || (bundle ? needsOpeningScene(bundle) && !open.error : false),
    busy:
      turn.isPending || choose.isPending || open.isPending || check.isPending || combat.isPending,
    actionError,
    retry,
    canRetry: Boolean(actionError) && Boolean(bundle),
  };
}
