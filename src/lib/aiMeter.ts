/**
 * What a game turn may cost: how long its packet may be and how often one
 * caller may ask.
 *
 * The four game-turn functions (Job, Life, the cold open, the I.P. judgement)
 * authenticated their callers and stopped there. Every one took a
 * caller-built `userPrompt` with no ceiling, and none was metered, so any
 * signed-in account could loop the GM as a free general-purpose model or push
 * a megabyte through it on every call. The packet budget bounds what the
 * client renders; it is not a boundary, because the client is not.
 *
 * Not `.server.ts`: the validators that read the ceiling are bundled for the
 * client too. The limiter itself is imported only inside `meterTurn`, which
 * only a handler calls. See rate-limit.server.ts for what an in-memory limit
 * does and does not promise.
 */
import type { RateLimit } from "./rate-limit.server";

/**
 * The longest packet a turn may send. `packetBudget.test.ts` holds an extreme
 * rendered packet under 13,000 characters (GM) and 8,600 (Life), and a
 * player's own input rides on top; four times the larger is room for every
 * honest turn and no room for an essay.
 */
export const MAX_TURN_PROMPT_CHARS = 60_000;

/** How often one caller may ask, per kind of turn. */
export const TURN_LIMITS = {
  // A turn every five seconds for five minutes is faster than anybody reads.
  gm: { limit: 60, windowMs: 5 * 60_000 },
  life: { limit: 60, windowMs: 5 * 60_000 },
  // Written once a campaign; a retry or two is all an honest caller needs.
  opening: { limit: 10, windowMs: 5 * 60_000 },
  // Once per job or life award.
  ip: { limit: 20, windowMs: 5 * 60_000 },
} as const satisfies Record<string, RateLimit>;

export type TurnKind = keyof typeof TURN_LIMITS;

/** Refuse a caller who has asked too often. Throws a message a player can act on. */
export async function meterTurn(kind: TurnKind, userId: string): Promise<void> {
  const { takeToken } = await import("./rate-limit.server");
  const verdict = takeToken(`turn:${kind}:${userId}`, TURN_LIMITS[kind]);
  if (!verdict.allowed) {
    throw new Error(
      `That is a lot of turns in a short time. Try again in ${verdict.retryAfterSeconds} seconds.`,
    );
  }
}
