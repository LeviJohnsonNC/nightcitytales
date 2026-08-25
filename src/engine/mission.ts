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
  /** GM-facing brief the AI narrates this beat from. NEVER shown to the player. */
  gmBrief: string;
  /**
   * What the player legitimately knows while standing on this beat — safe to
   * render in the UI. Anything secret belongs in gmBrief only.
   */
  playerBrief?: string;
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

/**
 * The job as it is PITCHED, before anyone has agreed to anything.
 *
 * A mission and its offer are the same object seen from two sides. The offer is
 * what reaches the player over the phone: who is calling, what they claim they
 * want, and what they say it pays. The rest of the beat graph is what is
 * actually waiting.
 *
 * Splitting the two apart is what stops the Life loop offering one job and then
 * running a different one: the offer is READ from the mission, never invented
 * alongside it.
 *
 * `patronName`, `patronOrg` and `opposition` are deliberately part of the offer
 * and deliberately NOT told to the player up front. They are what negotiating
 * buys (see engine/negotiation.ts): the fixer knows who is paying, and the
 * street knows what is waiting, and both cost something to find out.
 */
export type MissionOffer = {
  /** The voice on the phone: whoever actually brings the player the work. */
  brokerName: string;
  /** Stable key for that person, so the same broker is the same NPC every time. */
  brokerKey: string;
  /** One line on who the broker is, in their own right. */
  brokerLine: string;
  /** Who is really paying, behind the broker. Not volunteered. */
  patronName: string;
  patronOrg: string;
  /** Where the work is. */
  district: string;
  /** What is waiting when they get there. Not volunteered. */
  opposition: string;
  /** The pitch in the broker's words, as the player hears it. */
  pitch: string;
  /** The single thing they are being asked to achieve. */
  ask: string;
};

export type Mission = {
  id: string;
  title: string;
  subtitle?: string;
  source: string;
  patron?: string;
  reward?: MissionReward;
  /**
   * How this job reaches a player who has not taken it yet. Optional because an
   * authored mission may be started directly rather than offered.
   */
  offer?: MissionOffer;
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

// ---------------------------------------------------------------------------

/**
 * Structural problems with a beat graph, as human-readable lines. Empty means
 * the graph is walkable: every exit lands somewhere real, every beat is
 * reachable from the start, and at least one Resolution can actually be
 * arrived at.
 *
 * Authored missions are proofread by whoever transcribed them. Generated ones
 * are not proofread by anyone, so this is what stands in for that — a generator
 * that emits a dead end or an orphan beat should fail a test, not strand a
 * player mid-job.
 */
export function validateMission(mission: Mission): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();

  for (const beat of mission.beats) {
    if (ids.has(beat.id)) problems.push(`Duplicate beat id "${beat.id}".`);
    ids.add(beat.id);
  }

  if (mission.beats.length === 0) {
    problems.push("Mission has no beats.");
    return problems;
  }
  if (!ids.has(mission.startBeatId)) {
    problems.push(`startBeatId "${mission.startBeatId}" is not a beat in this mission.`);
  }

  for (const beat of mission.beats) {
    for (const exit of beat.exits) {
      if (!ids.has(exit.to)) {
        problems.push(`Beat "${beat.id}" exits to "${exit.to}", which does not exist.`);
      }
    }
    if (!isTerminal(beat) && beat.exits.length === 0) {
      problems.push(`Beat "${beat.id}" is a dead end but is not a Resolution.`);
    }
  }

  // Walk forward from the start, ignoring flag gates: a beat unreachable even
  // with every flag set is unreachable, full stop.
  const reached = new Set<string>();
  const queue = [mission.startBeatId];
  while (queue.length > 0) {
    const id = queue.shift() as string;
    if (reached.has(id) || !ids.has(id)) continue;
    reached.add(id);
    const beat = mission.beats.find((b) => b.id === id);
    for (const exit of beat?.exits ?? []) queue.push(exit.to);
  }

  for (const beat of mission.beats) {
    if (!reached.has(beat.id)) problems.push(`Beat "${beat.id}" is unreachable from the start.`);
  }
  if (![...reached].some((id) => mission.beats.find((b) => b.id === id)?.type === "resolution")) {
    problems.push("No Resolution beat is reachable, so the mission can never complete.");
  }

  return problems;
}

/** Throw if a beat graph is not walkable. */
export function assertValidMission(mission: Mission): void {
  const problems = validateMission(mission);
  if (problems.length > 0) {
    throw new Error(`Mission "${mission.id}" is malformed:\n- ${problems.join("\n- ")}`);
  }
}

// ---------------------------------------------------------------------------
// The offer.
// ---------------------------------------------------------------------------

/**
 * How this job reaches someone who has not taken it.
 *
 * A mission that records its own offer is read as written. One that does not
 * (an authored mission handed straight to a campaign) gets a plain offer built
 * from what it does record, so the Life loop never has to invent a patron or a
 * fee to have something to put on the phone.
 */
export function missionOffer(mission: Mission): MissionOffer {
  if (mission.offer) return mission.offer;
  const broker = mission.patron?.trim() || "a fixer with your number";
  return {
    brokerName: broker,
    brokerKey: stableKey(broker),
    brokerLine: mission.source,
    patronName: broker,
    patronOrg: mission.subtitle ?? "",
    district: mission.subtitle ?? "Night City",
    opposition: "Unknown.",
    pitch: mission.beats.find((b) => b.id === mission.startBeatId)?.readAloud ?? mission.title,
    ask: mission.beats.find((b) => b.id === mission.startBeatId)?.objectives?.[0] ?? mission.title,
  };
}

/** A lowercase, underscored key for a name. Stable for the same input. */
export function stableKey(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "") || "unknown"
  );
}
