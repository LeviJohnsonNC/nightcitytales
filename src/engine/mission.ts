/**
 * Mission beat-graph runtime — the anti-hallucination core. Every Tales from the
 * RED mission is a Beat Chart (Background, Hook, Developments, Cliffhangers,
 * Climax, Resolution); we transcribe it into a graph the engine walks, and the
 * AI narrates whichever beat the player is standing on. The engine owns the
 * position and the transitions; the LLM never decides "what happens next".
 *
 * Pure TypeScript: no React, no backend. MissionRuntime maps onto the
 * mission_progress table (current_beat_id, completed_beats, branch_choices,
 * objectives); flags gate branches and mirror to campaign_flags in the app.
 */
import type { MissionStatus } from "./campaign";

export type BeatType = "background" | "hook" | "dev" | "opdev" | "cliff" | "climax" | "resolution";

/** A skill check the beat calls for, with its DV set in advance (fairness rule). */
export type BeatCheck = {
  skill: string;
  dv: number;
  note?: string;
};

export type BeatExit = {
  /** Target beat id. */
  to: string;
  /** Player-facing description of taking this path. */
  label: string;
  /** Flags that must ALL be set for this exit to be offered. */
  requires?: string[];
  /** Flags set when this exit is taken. */
  sets?: string[];
};

export type Beat = {
  id: string;
  type: BeatType;
  title: string;
  /** Core-book / Tales page, for traceability. */
  page?: number;
  /** Verbatim read-aloud text, where the source provides it. */
  readAloud?: string;
  /** GM-facing brief the AI narrates this beat from. */
  gmBrief: string;
  objectives?: string[];
  checks?: BeatCheck[];
  opposition?: string[];
  /** True when this beat is a fight the combat engine resolves. */
  encounter?: boolean;
  exits: BeatExit[];
};

export type MissionReward = {
  eurobucksPerHead: number;
  upfront?: number;
  notes?: string;
};

export type Mission = {
  id: string;
  title: string;
  subtitle?: string;
  source: string;
  patron?: string;
  reward?: MissionReward;
  startBeatId: string;
  beats: Beat[];
};

export type ObjectiveStatus = "active" | "done" | "failed";
export type MissionObjective = { id: string; text: string; status: ObjectiveStatus };

export type MissionRuntime = {
  missionId: string;
  currentBeatId: string;
  completedBeats: string[];
  branchChoices: Record<string, string>;
  objectives: MissionObjective[];
  flags: string[];
  status: MissionStatus;
};

// ---------------------------------------------------------------------------

export function getBeat(mission: Mission, beatId: string): Beat {
  const beat = mission.beats.find((b) => b.id === beatId);
  if (!beat) throw new Error(`Mission "${mission.id}" has no beat "${beatId}".`);
  return beat;
}

function objectivesFor(beat: Beat): MissionObjective[] {
  return (beat.objectives ?? []).map((text, index) => ({
    id: `${beat.id}.${index}`,
    text,
    status: "active" as const,
  }));
}

function mergeObjectives(
  existing: MissionObjective[],
  incoming: MissionObjective[],
): MissionObjective[] {
  const byId = new Map(existing.map((o) => [o.id, o]));
  for (const objective of incoming) {
    if (!byId.has(objective.id)) byId.set(objective.id, objective);
  }
  return [...byId.values()];
}

export function startMission(mission: Mission): MissionRuntime {
  const start = getBeat(mission, mission.startBeatId);
  return {
    missionId: mission.id,
    currentBeatId: start.id,
    completedBeats: [],
    branchChoices: {},
    objectives: objectivesFor(start),
    flags: [],
    status: "active",
  };
}

export function currentBeat(mission: Mission, runtime: MissionRuntime): Beat {
  return getBeat(mission, runtime.currentBeatId);
}

/** Exits from the current beat whose `requires` flags are all satisfied. */
export function availableExits(mission: Mission, runtime: MissionRuntime): BeatExit[] {
  const beat = currentBeat(mission, runtime);
  const flags = new Set(runtime.flags);
  return beat.exits.filter((exit) => (exit.requires ?? []).every((flag) => flags.has(flag)));
}

/**
 * Take an exit from the current beat: mark it completed, set the exit's flags,
 * record the branch choice, merge the target beat's objectives, and move. A
 * move into a Resolution beat completes the mission. Throws if the exit is not
 * currently available.
 */
export function advance(mission: Mission, runtime: MissionRuntime, exitTo: string): MissionRuntime {
  const exit = availableExits(mission, runtime).find((e) => e.to === exitTo);
  if (!exit) {
    throw new Error(`"${exitTo}" is not an available exit from beat "${runtime.currentBeatId}".`);
  }
  const target = getBeat(mission, exit.to);

  const flags = new Set(runtime.flags);
  for (const flag of exit.sets ?? []) flags.add(flag);

  const completedBeats = runtime.completedBeats.includes(runtime.currentBeatId)
    ? runtime.completedBeats
    : [...runtime.completedBeats, runtime.currentBeatId];

  return {
    ...runtime,
    currentBeatId: target.id,
    completedBeats,
    branchChoices: { ...runtime.branchChoices, [runtime.currentBeatId]: exit.to },
    objectives: mergeObjectives(runtime.objectives, objectivesFor(target)),
    flags: [...flags],
    status: target.type === "resolution" ? "completed" : runtime.status,
  };
}

/** Mark the mission failed (e.g. the player character died). */
export function failMission(runtime: MissionRuntime): MissionRuntime {
  return { ...runtime, status: "failed" };
}

/** A beat with no exits, or a Resolution, ends its line. */
export function isTerminal(beat: Beat): boolean {
  return beat.type === "resolution" || beat.exits.length === 0;
}

/**
 * Reconstruct the set flags from a recorded branch history. Flags are a pure
 * function of the mission graph plus which exits were taken, so mission_progress
 * needn't store them separately — loading a saved mission derives them here.
 */
export function flagsFromChoices(
  mission: Mission,
  branchChoices: Record<string, string>,
): string[] {
  const flags = new Set<string>();
  for (const [beatId, exitTo] of Object.entries(branchChoices)) {
    const beat = mission.beats.find((b) => b.id === beatId);
    const exit = beat?.exits.find((e) => e.to === exitTo);
    for (const flag of exit?.sets ?? []) flags.add(flag);
  }
  return [...flags];
}

/**
 * What the job pays, from the mission's printed reward. Nothing is invented
 * here: if the mission records no reward, there is no payout.
 */
export type MissionPayout = {
  upfront: number;
  onCompletion: number;
  total: number;
  notes?: string;
};

export function missionPayout(mission: Mission, crewSize = 1): MissionPayout | null {
  const reward = mission.reward;
  if (!reward) return null;
  const upfront = reward.upfront ?? 0;
  const onCompletion = reward.eurobucksPerHead * Math.max(1, crewSize);
  return {
    upfront,
    onCompletion,
    total: upfront + onCompletion,
    ...(reward.notes ? { notes: reward.notes } : {}),
  };
}
