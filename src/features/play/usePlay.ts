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
  currentBeat,
  getBeat,
  getMission,
  getSkill,
  skillCheckForCharacter,
  type Beat,
  type BeatExit,
  type Mission,
  type MissionRuntime,
  type SkillCheckResult,
} from "@/engine";
import {
  appendCampaignEvent,
  getCampaign,
  getCharacter,
  listCampaignEvents,
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
import { buildGmContext, renderGmUserPrompt } from "@/features/gm/gmContext";
import { gmTurnFn } from "@/features/gm/gmTurn.server";
import { actorFor, characterSummary, npcSummaries, recentEventLines } from "./playModel";
import {
  dvBandName,
  pendingCheckFrom,
  rollHistory,
  snapToPublishedDv,
  type PendingCheck,
} from "./checkPrompt";

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

  // A proposed check is NOT rolled here: it is posted to the ledger as a prompt
  // and waits for the player to roll it (see resolvePendingCheck).
  let promptPosted = false;
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
 * Roll a pending check. The ENGINE rolls (skillCheckForCharacter); this records
 * the trace and then asks the GM to narrate the outcome it was handed.
 */
export async function rollPendingCheck(
  bundle: PlayBundle,
  pending: PendingCheck,
): Promise<SkillCheckResult> {
  return skillCheckForCharacter(actorFor(bundle.character), pending.skillId, pending.dv);
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
    (turn.error as Error | null) ?? (choose.error as Error | null) ?? (open.error as Error | null);

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
    suggestions: bundle ? latestSuggestions(bundle) : [],
    opening: open.isPending || (bundle ? needsOpeningScene(bundle) && !open.error : false),
    busy: turn.isPending || choose.isPending || open.isPending,
    actionError,
    retry,
    canRetry: Boolean(actionError) && Boolean(bundle),
  };
}
