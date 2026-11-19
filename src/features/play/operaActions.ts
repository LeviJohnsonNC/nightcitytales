import { advance, advanceClock, getBeat } from "@/engine";
import { type OperaAction } from "@/engine/missions/nightAtTheOpera";
import { runtimeToUpsert } from "@/features/campaign/missionState";
import { commitOperaAction, lastCampaignEventOfType } from "@/lib/backend";
import type { PlayBundle } from "./playBundleOps";

export async function resolveOperaAction(
  bundle: PlayBundle,
  action: OperaAction,
  input: string,
  requestId: string,
): Promise<void> {
  const { campaign, mission, runtime, events } = bundle;
  if (!mission || !runtime) throw new Error("There is no active mission.");
  const alreadyAdvanced = runtime.branchChoices[action.from] === action.to;
  if (!alreadyAdvanced && (runtime.currentBeatId !== action.from || bundle.encounter)) {
    throw new Error("The scene changed. Choose an action from the current scene.");
  }
  // A retry can arrive with either the old or the refreshed view. The original
  // request ID lets the transaction recognize its receipt in both cases.
  const progress = runtimeToUpsert(
    campaign.id,
    alreadyAdvanced ? runtime : advance(mission, runtime, action.to),
  );
  const clock = advanceClock({ day: campaign.day, minute: campaign.minute }, action.minutes);
  const started =
    events.filter((event) => event.type === "mission_started").at(-1) ??
    (await lastCampaignEventOfType(campaign.id, "mission_started"));
  await commitOperaAction({
    campaign_id: campaign.id,
    request_id: requestId,
    mission_started_id: started?.id ?? null,
    from_beat: action.from,
    to_beat: action.to,
    expected_day: campaign.day,
    expected_minute: campaign.minute,
    expected_location: campaign.location_key,
    day: clock.day,
    minute: clock.minute,
    completed_beats: progress.completed_beats ?? [],
    branch_choices: progress.branch_choices ?? {},
    objectives: progress.objectives ?? [],
    input,
    choice: action.label,
    summary: `${mission.title}: ${getBeat(mission, action.to).title}`,
  });
}
