/**
 * Moving through a job's scenes: taking an exit, opening a beat, and reading
 * which suggestions and prompts are live. Split out of playOps.ts, which
 * re-exports them. No React and no TanStack Query in here.
 */

import { advance, availableExits, getBeat, type BeatExit } from "@/engine";
import { GmSuggestedActionSchema, type GmSuggestedAction } from "@/features/gm/gmResponse";
import { z } from "zod";
import { logBeatAdvanced } from "@/features/campaign/missionLog";
import { saveMissionRuntime } from "@/features/campaign/missionState";
import type { CampaignEvent } from "@/lib/backend";
import type { PlayBundle } from "./playBundleOps";
import { narrate } from "./playTurnOps";
import { revealBeatTruths } from "./playTruthOps";
import { settleMission } from "./playSettleOps";

export async function takeExit(bundle: PlayBundle, exit: BeatExit): Promise<void> {
  if (!bundle.mission || !bundle.runtime || !bundle.beat) return;
  const campaignId = bundle.campaign.id;
  const next = advance(bundle.mission, bundle.runtime, exit.to);
  await saveMissionRuntime(campaignId, next);
  await revealBeatTruths(bundle, bundle.mission, exit.to);
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

/** Ask the GM to open the current beat, without logging a fake player action. */
export async function openScene(bundle: PlayBundle): Promise<void> {
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
