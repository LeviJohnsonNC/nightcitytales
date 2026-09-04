/**
 * Pressure the engine owns.
 *
 * A clock the model can invent, label and forget is not a clock. This module is
 * the registry: which clocks exist, how many segments each has, what arrives
 * when one fills, and above all what MOVES them. The model never decides any of
 * it. It reports observations from a closed vocabulary — you were seen, someone
 * lived to describe you, you used their name out loud — and the table below
 * decides what each one costs.
 *
 * That split is the whole design. Only the model can notice that a guard got a
 * clear look at the character's face; only the engine should be allowed to say
 * that this is worth two segments of an Arasaka file and a point of standing.
 *
 * There is deliberately no "trust" clock. What a fixer thinks of you is already
 * modelled, precisely, as their NPC disposition (see engine/cast.ts); a second
 * dial for the same feeling would drift out of step with the first.
 *
 * Pure TypeScript: observations in, deltas out. Nothing here reads state, writes
 * a row, or knows which campaign it is talking about.
 */
import { getFaction, type FactionId } from "./factions";

export const CLOCK_KINDS = ["heat", "investigation", "retaliation"] as const;
export type ClockKind = (typeof CLOCK_KINDS)[number];

export function isClockKind(value: unknown): value is ClockKind {
  return typeof value === "string" && (CLOCK_KINDS as readonly string[]).includes(value);
}

/**
 * A clock's identity, separate from how full it is. Definitions are derived, not
 * stored: a campaign persists the fill, and this rebuilds the label and the
 * payoff from the key, so wording can be corrected without a migration.
 */
export type ClockDefinition = {
  key: string;
  label: string;
  segments: number;
  kind: ClockKind;
  factionId: FactionId | null;
  /** What has arrived, in the engine's words, when the last segment fills. */
  payoff: string;
  /** Clocks are hidden only when the character has no way to feel them coming. */
  hidden: boolean;
};

/** Six segments is the house standard: slow enough to dread, short enough to land. */
export const DEFAULT_SEGMENTS = 6;

export const HEAT_CLOCK_KEY = "heat";

/**
 * NCPD attention. Every loud thing in Night City feeds this one, whoever it was
 * done to, which is why it is the only clock that exists from day one.
 */
export function heatClock(): ClockDefinition {
  return {
    key: HEAT_CLOCK_KEY,
    label: "NCPD Heat",
    segments: DEFAULT_SEGMENTS,
    kind: "heat",
    factionId: "ncpd",
    payoff: "NCPD have put a name to the pattern, and they are working from an address.",
    hidden: false,
  };
}

/**
 * What this faction does about you. Corps and cops open a file; gangs come to
 * your door. Both fill the same way and land very differently.
 *
 * NCPD are the exception: their attention already has a dial, and giving them a
 * second one would split the same organisation's interest in you across two
 * numbers that immediately drift apart.
 */
export function factionClock(factionId: FactionId): ClockDefinition {
  if (factionId === "ncpd") return heatClock();
  const faction = getFaction(factionId);
  const investigating = faction.investigates;
  return {
    key: `${investigating ? "investigation" : "retaliation"}_${factionId}`,
    label: `${faction.name} ${investigating ? "Investigation" : "Retaliation"}`,
    segments: DEFAULT_SEGMENTS,
    kind: investigating ? "investigation" : "retaliation",
    factionId,
    payoff: investigating
      ? `${faction.name} have your file open on somebody's desk, with a photograph in it.`
      : `${faction.name} have decided you are worth the trip, and they know where to start.`,
    hidden: false,
  };
}

/** Rebuild a definition from a stored key. Null when the key names no clock. */
export function clockDefinitionFor(
  key: string,
  factionId: FactionId | null,
): ClockDefinition | null {
  if (key === HEAT_CLOCK_KEY) return heatClock();
  if (factionId) {
    const derived = factionClock(factionId);
    if (derived.key === key) return derived;
  }
  return null;
}

// ---------------------------------------------------------------------------
// The vocabulary. This is the only thing the model may report.
// ---------------------------------------------------------------------------

export const OBSERVATIONS = [
  "seen",
  "named",
  "witness",
  "wounded",
  "killed",
  "property",
  "loud",
  "clean",
  "favour",
  "burned",
] as const;
export type Observation = (typeof OBSERVATIONS)[number];

export function isObservation(value: unknown): value is Observation {
  return typeof value === "string" && (OBSERVATIONS as readonly string[]).includes(value);
}

/** What each observation means, for the prompt. Written for the model to match against. */
export const OBSERVATION_MEANINGS: Record<Observation, string> = {
  seen: "somebody got a clear look at the character's face",
  named: "their name, handle or employer was said where it could be heard",
  witness: "somebody who saw what happened walked away from it",
  wounded: "the character put someone in a hospital",
  killed: "somebody died",
  property: "something expensive belonging to them was destroyed",
  loud: "it happened in public, or loudly enough that the street noticed",
  clean: "nobody can place the character there at all",
  favour: "the character did them an actual service",
  burned: "the character crossed someone who was counting on them",
};

/**
 * What an observation costs.
 *
 * `faction` moves the clock belonging to whoever it was done to. `heat` moves
 * NCPD attention regardless of who it was done to, because the city notices
 * noise on its own account. `standing` moves the organisation's opinion.
 *
 * These are APP PACING NUMBERS, not Cyberpunk RED rules values. No printed rule
 * says what being seen costs; what the published rules own is the dice, and
 * nothing here touches those.
 */
export type ObservationCost = {
  faction: number;
  heat: number;
  standing: number;
};

export const OBSERVATION_COSTS: Record<Observation, ObservationCost> = {
  seen: { faction: 1, heat: 0, standing: 0 },
  named: { faction: 2, heat: 1, standing: -1 },
  witness: { faction: 1, heat: 1, standing: 0 },
  wounded: { faction: 1, heat: 1, standing: -1 },
  killed: { faction: 2, heat: 2, standing: -2 },
  property: { faction: 1, heat: 1, standing: -1 },
  loud: { faction: 1, heat: 2, standing: 0 },
  // Working clean is the only thing that takes pressure back off.
  clean: { faction: -1, heat: -1, standing: 0 },
  favour: { faction: -1, heat: 0, standing: 2 },
  burned: { faction: 2, heat: 0, standing: -3 },
};

// ---------------------------------------------------------------------------
// Turning observations into deltas.
// ---------------------------------------------------------------------------

/** One thing the fiction noticed, and who it was done to. */
export type ObservationReport = {
  observation: Observation;
  /** Null when nobody in particular was on the receiving end. */
  factionId: FactionId | null;
};

export type ClockTick = { definition: ClockDefinition; delta: number };
export type StandingShift = { factionId: FactionId; delta: number };

export type PressureChange = {
  ticks: ClockTick[];
  standings: StandingShift[];
  /** Human-readable lines for the ledger, in the order they were applied. */
  notes: string[];
};

/**
 * The most one turn may move a single clock or standing.
 *
 * A turn that reports five observations should hurt, but a single evening
 * cannot fill a six-segment dial from empty and detonate it: pressure that
 * arrives all at once reads as a scripted punishment rather than as something
 * the player did to themselves over time.
 */
export const MAX_TURN_TICK = 3;
export const MAX_TURN_STANDING = 4;

function clampTurn(value: number, limit: number): number {
  return Math.max(-limit, Math.min(limit, value));
}

/**
 * Fold a turn's observations into clock and standing deltas.
 *
 * Aggregated per clock, so three bodies are one tick of six clamped to the turn
 * limit rather than three separate rows racing each other into the database.
 */
export type ObservationOptions = {
  /**
   * What noise costs where it happened, from the district's response profile
   * (see places.ts). One is the ordinary city. Zero is a district nobody
   * polices, where being loud genuinely does not reach the NCPD — which is the
   * whole mechanical difference between the Exec Zone and Rancho Coronado.
   *
   * It scales HEAT only. Being seen by Arasaka costs Arasaka's file exactly the
   * same wherever it happened: a corporation does not stop keeping records
   * because the neighbourhood is poor.
   */
  heatMultiplier?: number;
};

export function applyObservations(
  reports: ObservationReport[],
  options: ObservationOptions = {},
): PressureChange {
  const heatScale = options.heatMultiplier ?? 1;
  const byClock = new Map<string, ClockTick>();
  const byFaction = new Map<FactionId, number>();
  const notes: string[] = [];

  const tick = (definition: ClockDefinition, delta: number) => {
    if (delta === 0) return;
    const existing = byClock.get(definition.key);
    if (existing) existing.delta += delta;
    else byClock.set(definition.key, { definition, delta });
  };

  for (const report of reports) {
    const cost = OBSERVATION_COSTS[report.observation];
    if (!cost) continue;

    if (report.factionId) {
      tick(factionClock(report.factionId), cost.faction);
      if (cost.standing !== 0) {
        byFaction.set(report.factionId, (byFaction.get(report.factionId) ?? 0) + cost.standing);
      }
      notes.push(
        `${getFaction(report.factionId).name}: ${OBSERVATION_MEANINGS[report.observation]}.`,
      );
    } else {
      notes.push(capitalize(`${OBSERVATION_MEANINGS[report.observation]}.`));
    }

    // Heat is the city's own attention and moves whether or not anyone in
    // particular was on the receiving end. When the receiving end WAS the NCPD,
    // their clock is this clock, and the faction cost above already moved it.
    if (report.factionId !== "ncpd") tick(heatClock(), cost.heat * heatScale);
  }

  return {
    ticks: [...byClock.values()]
      // Rounded once, at the end. A scaled heat cost can land on a half
      // segment, and a clock is whole segments: rounding each report as it
      // arrives would let three half-ticks come to nothing.
      .map((t) => ({ ...t, delta: clampTurn(Math.round(t.delta), MAX_TURN_TICK) }))
      .filter((t) => t.delta !== 0),
    standings: [...byFaction.entries()]
      .map(([factionId, delta]) => ({ factionId, delta: clampTurn(delta, MAX_TURN_STANDING) }))
      .filter((s) => s.delta !== 0),
    notes,
  };
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

// ---------------------------------------------------------------------------
// Firing.
// ---------------------------------------------------------------------------

/**
 * A filled clock is spent, not left ringing.
 *
 * When pressure arrives it resets to empty and the world moves on, so a faction
 * the player keeps provoking comes back around instead of sitting permanently
 * at the top of the dial doing nothing.
 */
export const FIRED_CLOCK_FILL = 0;

export type ClockState = { key: string; filled: number; segments: number };

/** True when this clock has reached the end of its dial. */
export function hasFilled(clock: ClockState): boolean {
  return clock.segments > 0 && clock.filled >= clock.segments;
}

/** Every clock that has come due, worst first, for the caller to spend. */
export function fired(clocks: ClockState[]): ClockState[] {
  return clocks.filter(hasFilled).sort((a, b) => b.filled - a.filled || a.key.localeCompare(b.key));
}
