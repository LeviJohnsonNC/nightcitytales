/**
 * Campaign (play-engine) game-state types and the rules that govern them.
 *
 * Pure TypeScript, like the rest of the engine: no React, no backend, no
 * feature imports. This module is the authority on how live campaign state is
 * shaped and initialised — the database RPC and the UI both implement the
 * contract described here; they never invent their own numbers.
 */

// ---------------------------------------------------------------------------
// Status vocabularies. Declared as const tuples so the same list is available
// at runtime (for validation) and as a literal union type.
// ---------------------------------------------------------------------------

export const CAMPAIGN_STATUSES = ["active", "won", "lost", "abandoned"] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

export const MISSION_STATUSES = ["active", "completed", "failed", "abandoned"] as const;
export type MissionStatus = (typeof MISSION_STATUSES)[number];

/**
 * Cyberpunk RED wound states. Not full HP is "light" (Lightly Wounded), at or
 * below half HP is "serious" (Seriously Wounded), 0 or below is "mortal"
 * (Mortally Wounded → Death Saves). The full ladder of effects and
 * stabilization DVs lives in the rules data as WOUND_STATES (see rulesData.ts);
 * this is just the persisted code the campaign_vitals.wound_state column stores.
 */
export const WOUND_STATE_CODES = ["none", "light", "serious", "mortal"] as const;
export type WoundStateCode = (typeof WOUND_STATE_CODES)[number];

export const NPC_STATUSES = ["alive", "dead", "fled", "unknown"] as const;
export type NpcStatus = (typeof NPC_STATUSES)[number];

// ---------------------------------------------------------------------------
// Wound state — the mechanical read of current HP. Precedence matters: check
// mortal, then serious, then light, then unwounded.
// ---------------------------------------------------------------------------

/**
 * The wound state implied by current HP. `seriouslyWoundedThreshold` is the
 * engine-derived half-max value (see deriveStats); pass the character's stored
 * threshold so this never disagrees with the sheet.
 */
export function woundStateFor(
  hpCurrent: number,
  hpMax: number,
  seriouslyWoundedThreshold: number,
): WoundStateCode {
  if (hpCurrent <= 0) return "mortal";
  if (hpCurrent <= seriouslyWoundedThreshold) return "serious";
  if (hpCurrent < hpMax) return "light";
  return "none";
}

// ---------------------------------------------------------------------------
// Starting vitals — the contract start_campaign() implements in SQL. Kept here
// so it is unit-testable and so any client-side preview matches the server.
// ---------------------------------------------------------------------------

export type StartingVitalsInput = {
  hpMax: number;
  seriouslyWoundedThreshold: number;
  /** The character's current Humanity at creation (already reduced by cyberware). */
  humanityCurrent: number;
  humanityMax: number;
  eurobucks: number;
};

export type StartingVitals = {
  hpCurrent: number;
  hpMax: number;
  seriouslyWoundedThreshold: number;
  humanityCurrent: number;
  humanityMax: number;
  woundState: WoundStateCode;
  mortalSaveFailures: number;
  eurobucks: number;
};

/**
 * A fresh character enters the world at full HP, carrying their creation-time
 * Humanity and eurobucks, unwounded, with no failed Death Saves.
 */
export function startingVitals(input: StartingVitalsInput): StartingVitals {
  return {
    hpCurrent: input.hpMax,
    hpMax: input.hpMax,
    seriouslyWoundedThreshold: input.seriouslyWoundedThreshold,
    humanityCurrent: input.humanityCurrent,
    humanityMax: input.humanityMax,
    woundState: woundStateFor(input.hpMax, input.hpMax, input.seriouslyWoundedThreshold),
    mortalSaveFailures: 0,
    eurobucks: input.eurobucks,
  };
}

// ---------------------------------------------------------------------------
// In-world clock. Missions in Tales from the RED tend to kick off around 18:00.
// ---------------------------------------------------------------------------

export type GameClock = { day: number; minute: number };

/** Day 1, 18:00 — the default opening of a campaign. */
export const CAMPAIGN_START_CLOCK: GameClock = { day: 1, minute: 18 * 60 };

/** Human-readable clock, e.g. "Day 1, 18:00". */
export function formatClock(clock: GameClock): string {
  const hours = Math.floor(clock.minute / 60);
  const minutes = clock.minute % 60;
  return `Day ${clock.day}, ${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// NPC disposition — a small signed scale mirrored by the DB CHECK constraint.
// ---------------------------------------------------------------------------

export const NPC_DISPOSITION_MIN = -3; // hostile
export const NPC_DISPOSITION_MAX = 3; // devoted

/** Clamp a disposition shift into the valid range, rounding to a whole step. */
export function clampDisposition(value: number): number {
  return Math.max(NPC_DISPOSITION_MIN, Math.min(NPC_DISPOSITION_MAX, Math.round(value)));
}
