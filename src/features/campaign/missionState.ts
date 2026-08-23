/**
 * Mapping between the pure MissionRuntime (engine) and the mission_progress row
 * (backend). Flags are reconstructed from the branch history, so the row stays
 * lean. No arithmetic or branch logic lives here — the engine owns it.
 */
import {
  flagsFromChoices,
  startMission,
  type Mission,
  type MissionObjective,
  type MissionRuntime,
  type MissionStatus,
} from "@/engine";
import {
  getMissionProgress,
  upsertMissionProgress,
  type Json,
  type MissionProgress,
  type MissionProgressInsert,
} from "@/lib/backend";

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

function asChoices(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object") return {};
  const out: Record<string, string> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    if (typeof val === "string") out[key] = val;
  }
  return out;
}

function asObjectives(value: unknown): MissionObjective[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const rec = entry as Record<string, unknown>;
    if (
      typeof rec["id"] === "string" &&
      typeof rec["text"] === "string" &&
      typeof rec["status"] === "string"
    ) {
      return [
        { id: rec["id"], text: rec["text"], status: rec["status"] as MissionObjective["status"] },
      ];
    }
    return [];
  });
}

/** Build a MissionRuntime from a saved mission_progress row, deriving flags. */
export function progressToRuntime(mission: Mission, row: MissionProgress): MissionRuntime {
  const branchChoices = asChoices(row.branch_choices);
  return {
    missionId: row.mission_id,
    currentBeatId: row.current_beat_id ?? mission.startBeatId,
    completedBeats: asStringArray(row.completed_beats),
    branchChoices,
    objectives: asObjectives(row.objectives),
    flags: flagsFromChoices(mission, branchChoices),
    status: row.status as MissionStatus,
  };
}

/** Map a MissionRuntime onto an upsert payload for mission_progress. */
export function runtimeToUpsert(
  campaignId: string,
  runtime: MissionRuntime,
): MissionProgressInsert {
  return {
    campaign_id: campaignId,
    mission_id: runtime.missionId,
    current_beat_id: runtime.currentBeatId,
    completed_beats: runtime.completedBeats as unknown as Json,
    branch_choices: runtime.branchChoices as unknown as Json,
    objectives: runtime.objectives as unknown as Json,
    status: runtime.status,
  };
}

/** Load a mission's runtime for a campaign, or start it fresh if not begun. */
export async function loadMissionRuntime(
  campaignId: string,
  mission: Mission,
): Promise<MissionRuntime> {
  const row = await getMissionProgress(campaignId, mission.id);
  return row ? progressToRuntime(mission, row) : startMission(mission);
}

/** Persist a mission runtime to mission_progress. */
export async function saveMissionRuntime(
  campaignId: string,
  runtime: MissionRuntime,
): Promise<void> {
  await upsertMissionProgress(runtimeToUpsert(campaignId, runtime));
}
