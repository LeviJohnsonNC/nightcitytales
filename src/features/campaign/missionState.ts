/**
 * Mapping between the pure MissionRuntime (engine) and the mission_progress row
 * (backend). Flags are reconstructed from the branch history, so the row stays
 * lean. No arithmetic or branch logic lives here — the engine owns it.
 */
import {
  declaredObjectives,
  flagsFromChoices,
  objectivesForBeats,
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

/**
 * The objective board, rebuilt from where the mission has been.
 *
 * Objective ids come from mission content, so editing that content can orphan a
 * saved id — renaming one, or giving a positionally-identified objective a
 * stable key. An orphan can never be closed by any exit, so it would sit
 * "active" forever beside its own replacement: two of the same objective on
 * screen and a count that never completes.
 *
 * So the board is DERIVED, the way flags already are: the beats this runtime
 * has stood on say which objectives exist and what they read, and the saved row
 * supplies only what has happened to them. An objective closed from a beat the
 * player never visited is kept as well — `advance` can do that deliberately,
 * and it is still one the mission declares.
 */
function liveObjectives(
  mission: Mission,
  saved: MissionObjective[],
  visitedBeatIds: string[],
): MissionObjective[] {
  const savedById = new Map(saved.map((objective) => [objective.id, objective]));
  const board = objectivesForBeats(mission, visitedBeatIds).map((objective) => {
    const was = savedById.get(objective.id);
    // Text from the content so prose corrections land; status from the save.
    return was ? { ...objective, status: was.status } : objective;
  });

  const onBoard = new Set(board.map((objective) => objective.id));
  const declared = declaredObjectives(mission);
  const offBoard = saved.filter((o) => !onBoard.has(o.id) && declared.has(o.id));
  return [...board, ...offBoard];
}

/** Build a MissionRuntime from a saved mission_progress row, deriving flags. */
export function progressToRuntime(mission: Mission, row: MissionProgress): MissionRuntime {
  const branchChoices = asChoices(row.branch_choices);
  const currentBeatId = row.current_beat_id ?? mission.startBeatId;
  const completedBeats = asStringArray(row.completed_beats);
  return {
    missionId: row.mission_id,
    currentBeatId,
    completedBeats,
    branchChoices,
    objectives: liveObjectives(mission, asObjectives(row.objectives), [
      ...completedBeats,
      currentBeatId,
    ]),
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
