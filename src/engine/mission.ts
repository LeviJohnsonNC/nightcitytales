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
import type { ForceSize, ThreatMember } from "./threats";
import type { BeatTruth } from "./truth";

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
  /**
   * Objectives this exit closes as achieved, by objective id.
   *
   * This is how an objective ever stops being "active". The beat graph owns it
   * for the same reason it owns every other transition: taking the exit that
   * frees the hostage IS achieving the objective, and the narrator should not
   * be the one deciding whether it counts.
   */
  completes?: string[];
  /** Objectives this exit closes as failed, by objective id. */
  fails?: string[];
};

/** An objective declared with a stable id of its own rather than a positional one. */
export type BeatObjective = { key: string; text: string };

export type Beat = {
  id: string;
  type: BeatType;
  title: string;
  /** Core-book / Tales page, for traceability. */
  page?: number;
  /** Verbatim read-aloud text, where the source provides it. */
  readAloud?: string;
  /**
   * GM-facing brief the AI narrates this beat from. NEVER shown to the player.
   *
   * Stage directions and what is OPENLY true — the tone to set, the geography
   * to frame, what the scene is. The beat's concealed facts do not belong here:
   * this string reaches the model every turn of the beat, so a twist written
   * into it is a twist the narrator has been told and asked to sit on. Those
   * go in `truths`.
   */
  gmBrief: string;
  /**
   * What the player legitimately knows while standing on this beat — safe to
   * render in the UI. Anything secret belongs in gmBrief only.
   */
  playerBrief?: string;
  /**
   * What this beat puts on the board. A bare string is identified by its
   * position (`beatId.0`); the keyed form names itself, which is what an exit's
   * `completes` should reference — a positional id silently re-points at a
   * different objective the moment one is inserted above it.
   */
  objectives?: (string | BeatObjective)[];
  /**
   * What this beat is holding back: the facts the player has no way of knowing
   * yet, each with the Skill that would find it. Withheld from the prompt until
   * discovered — see `truth.ts`.
   */
  truths?: BeatTruth[];
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
  /** Where the work is, as printed. */
  district: string;
  /** The Night City Atlas district key the work sits in, when the job names one. */
  districtKey?: string;
  /** The location code the work is actually at, when the job names a building. */
  placeKey?: string;
  /** That building's printed name, for the pitch. */
  placeName?: string;
  /** What is waiting when they get there. Not volunteered. */
  opposition: string;
  /** The pitch in the broker's words, as the player hears it. */
  pitch: string;
  /** The single thing they are being asked to achieve. */
  ask: string;
};

/**
 * Who is waiting, decided when the job was, not when it is described.
 *
 * Drawn from the mission's own seed at generation time — before the offer is
 * pitched, argued over, or narrated. The GM used to author every hostile's REF,
 * BODY, HP, SP, skill and damage dice inside prompt guidance, which meant the
 * same job told twice could produce two different fights, and pushing the fee
 * could quietly change what was in the building.
 */
export type MissionForce = {
  /** Force template key from data/rules/threats.json. */
  forceKey: string;
  size: ForceSize;
  /** The expanded roster, stat blocks and all. */
  members: ThreatMember[];
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
  /** The opposition waiting at the climax, seeded with everything else. */
  force?: MissionForce;
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

/** The id an objective entry answers to: its own key, or its position. */
function objectiveId(beatId: string, entry: string | BeatObjective, index: number): string {
  return typeof entry === "string" ? `${beatId}.${index}` : entry.key;
}

function objectivesFor(beat: Beat): MissionObjective[] {
  return (beat.objectives ?? []).map((entry, index) => ({
    id: objectiveId(beat.id, entry, index),
    text: typeof entry === "string" ? entry : entry.text,
    status: "active" as const,
  }));
}

/**
 * The objectives the beats named here put on the board, in order, de-duplicated.
 *
 * What a runtime's objective list SHOULD hold, given where it has been — which
 * is how a saved one is rebuilt after the mission content changes underneath it.
 * Unknown beat ids are skipped rather than throwing: a renamed beat should cost
 * its own objectives, not the whole load.
 */
export function objectivesForBeats(mission: Mission, beatIds: string[]): MissionObjective[] {
  let out: MissionObjective[] = [];
  for (const id of beatIds) {
    const beat = mission.beats.find((b) => b.id === id);
    if (beat) out = mergeObjectives(out, objectivesFor(beat));
  }
  return out;
}

/**
 * Every objective the mission declares anywhere, by id.
 *
 * An exit may close an objective belonging to a beat the player never stood on
 * — a job whose climax fails the "keep them alive" objective declared back at
 * the hook. Closing one that is not on the board yet has to ADD it closed
 * rather than quietly do nothing, or the result is the silent no-op this whole
 * change exists to remove.
 */
export function declaredObjectives(mission: Mission): Map<string, MissionObjective> {
  const byId = new Map<string, MissionObjective>();
  for (const beat of mission.beats) {
    for (const objective of objectivesFor(beat)) {
      if (!byId.has(objective.id)) byId.set(objective.id, objective);
    }
  }
  return byId;
}

/**
 * Close an objective, adding it in that state if the board has not seen it yet.
 * Throws on an id the mission does not declare — `validateMission` rejects those
 * at authoring time, so reaching here means a typo got past the tests.
 */
function closeObjective(
  mission: Mission,
  objectives: MissionObjective[],
  id: string,
  status: ObjectiveStatus,
): MissionObjective[] {
  if (objectives.some((o) => o.id === id)) {
    return objectives.map((o) => (o.id === id ? { ...o, status } : o));
  }
  const declared = declaredObjectives(mission).get(id);
  if (!declared) {
    throw new Error(`Mission "${mission.id}" has no objective "${id}" to close.`);
  }
  return [...objectives, { ...declared, status }];
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

/**
 * A runtime parked on a named beat, without playing the beats before it.
 *
 * `startMission` puts a job at its opening. Reaching a beat in the middle of
 * one normally means playing there, which is correct for a player and useless
 * for a harness that wants to stand on the climax and look at it.
 *
 * Deliberately NOT a shortcut a player can take: nothing in the play loop calls
 * this, and mission movement still goes through `advance`. It exists so a
 * developer tool can construct a position the engine agrees is well-formed
 * rather than hand-writing a runtime object and hoping.
 *
 * Throws on a beat this mission does not have, because a typo'd beat id should
 * fail where it is written rather than resolve to somewhere plausible.
 */
export function runtimeAtBeat(mission: Mission, beatId: string): MissionRuntime {
  const beat = getBeat(mission, beatId);
  return {
    missionId: mission.id,
    currentBeatId: beat.id,
    // Nothing was played to get here, so nothing is completed. The objectives
    // are this beat's own — a harness has no history to merge.
    completedBeats: [],
    branchChoices: {},
    objectives: objectivesFor(beat),
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

  let objectives = mergeObjectives(runtime.objectives, objectivesFor(target));
  for (const id of exit.completes ?? [])
    objectives = closeObjective(mission, objectives, id, "done");
  for (const id of exit.fails ?? []) objectives = closeObjective(mission, objectives, id, "failed");

  return {
    ...runtime,
    currentBeatId: target.id,
    completedBeats,
    branchChoices: { ...runtime.branchChoices, [runtime.currentBeatId]: exit.to },
    objectives,
    flags: [...flags],
    status: target.type === "resolution" ? "completed" : runtime.status,
  };
}

/**
 * Mark the mission failed (e.g. the player character died).
 *
 * Anything still open failed with it. A dead Edgerunner does not leave a job
 * with three objectives eternally "active" — that reads as a job still in
 * progress everywhere the objectives are counted.
 */
export function failMission(runtime: MissionRuntime): MissionRuntime {
  return {
    ...runtime,
    status: "failed",
    objectives: runtime.objectives.map((o) =>
      o.status === "active" ? { ...o, status: "failed" } : o,
    ),
  };
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

  // Objective ids must be unique across the mission, because an exit closes one
  // by id: two beats declaring the same key would make "completes" ambiguous.
  const objectiveIds = new Set<string>();
  for (const beat of mission.beats) {
    (beat.objectives ?? []).forEach((entry, index) => {
      const id = objectiveId(beat.id, entry, index);
      if (objectiveIds.has(id)) {
        problems.push(`Objective id "${id}" is declared more than once.`);
      }
      objectiveIds.add(id);
    });
  }

  for (const beat of mission.beats) {
    // `advance` identifies an exit by its TARGET, so two exits from one beat to
    // the same beat are indistinguishable and the first always wins. That is
    // survivable when they differ only in wording and actively wrong now that an
    // exit carries consequences: "got out clean" and "got out messy" landing on
    // the same Resolution would silently close the same objectives either way.
    const targets = new Set<string>();
    for (const exit of beat.exits) {
      if (targets.has(exit.to)) {
        problems.push(
          `Beat "${beat.id}" has more than one exit to "${exit.to}", which advance() cannot tell apart.`,
        );
      }
      targets.add(exit.to);
    }

    for (const exit of beat.exits) {
      if (!ids.has(exit.to)) {
        problems.push(`Beat "${beat.id}" exits to "${exit.to}", which does not exist.`);
      }
      for (const id of [...(exit.completes ?? []), ...(exit.fails ?? [])]) {
        if (!objectiveIds.has(id)) {
          problems.push(
            `Beat "${beat.id}" exits to "${exit.to}" closing objective "${id}", which no beat declares.`,
          );
        }
      }
      const both = (exit.completes ?? []).filter((id) => (exit.fails ?? []).includes(id));
      for (const id of both) {
        problems.push(
          `Beat "${beat.id}" exits to "${exit.to}" both completing and failing objective "${id}".`,
        );
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

  // An objective no exit ever closes can only ever be "active". That was true of
  // every objective in the game until this check existed, and settlement spent
  // that whole time reporting "0/N objectives closed" on finished jobs. Stated
  // here so the next mission that forgets fails a test instead of a player.
  const closedSomewhere = new Set(
    mission.beats.flatMap((beat) =>
      beat.exits.flatMap((exit) => [...(exit.completes ?? []), ...(exit.fails ?? [])]),
    ),
  );
  for (const id of objectiveIds) {
    if (!closedSomewhere.has(id)) {
      problems.push(`Objective "${id}" is never completed or failed by any exit.`);
    }
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
    ask: startObjectiveText(mission) ?? mission.title,
  };
}

/** The first objective on the start beat, as text. What the job is asking for. */
function startObjectiveText(mission: Mission): string | null {
  const entry = mission.beats.find((b) => b.id === mission.startBeatId)?.objectives?.[0];
  if (entry === undefined) return null;
  return typeof entry === "string" ? entry : entry.text;
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
