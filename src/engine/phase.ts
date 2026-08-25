/**
 * The campaign phase machine.
 *
 * The APPLICATION is authoritative about which phase a campaign is in — never
 * the AI. Life is the room between jobs; a job only begins when the player
 * knowingly commits to a hook. Pure TypeScript, like the rest of the engine.
 */

export const GAME_PHASES = ["life", "hook", "job", "aftermath"] as const;
export type GamePhase = (typeof GAME_PHASES)[number];

/**
 * What moved the campaign. Each trigger is owned by exactly one code path, so
 * no free-text turn can slip the player into a job:
 * - `offer_hook`   — a Life turn produced a job offer (life → hook)
 * - `decline_hook` — the player refused, delayed or ignored it (hook → life)
 * - `accept_hook`  — the ONLY door into a job, pressed by the player
 * - `end_job`      — the job resolved, one way or the other (job → aftermath)
 * - `close_out`    — wrap-up is done; back to living (aftermath → life)
 */
export const PHASE_TRIGGERS = [
  "offer_hook",
  "decline_hook",
  "accept_hook",
  "end_job",
  "close_out",
] as const;
export type PhaseTrigger = (typeof PHASE_TRIGGERS)[number];

const TRANSITIONS: Record<PhaseTrigger, { from: GamePhase[]; to: GamePhase }> = {
  offer_hook: { from: ["life"], to: "hook" },
  decline_hook: { from: ["hook"], to: "life" },
  accept_hook: { from: ["hook"], to: "job" },
  end_job: { from: ["job"], to: "aftermath" },
  close_out: { from: ["aftermath", "job"], to: "life" },
};

export function isGamePhase(value: unknown): value is GamePhase {
  return typeof value === "string" && (GAME_PHASES as readonly string[]).includes(value);
}

/** Read a persisted phase, falling back to Life for anything unrecognised. */
export function phaseOf(value: unknown): GamePhase {
  return isGamePhase(value) ? value : "life";
}

export function canTransition(from: GamePhase, trigger: PhaseTrigger): boolean {
  return TRANSITIONS[trigger].from.includes(from);
}

/** The phase a trigger leads to, or null when the move is illegal from here. */
export function nextPhase(from: GamePhase, trigger: PhaseTrigger): GamePhase | null {
  if (!canTransition(from, trigger)) return null;
  return TRANSITIONS[trigger].to;
}

/** True while the existing job machinery (beats, encounters) owns the screen. */
export function isJobPhase(phase: GamePhase): boolean {
  return phase === "job";
}
