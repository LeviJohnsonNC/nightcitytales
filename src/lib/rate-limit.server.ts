/**
 * A per-user allowance for endpoints that spend money on every call.
 *
 * WHAT THIS IS NOT. It is in-memory, so it is per server instance: a deploy
 * running several isolates gives a determined caller one allowance per isolate,
 * and a cold start forgets everything. It is a throttle on the obvious loop, not
 * a quota. The real boundary is authentication — a caller has to be a signed-in
 * user before they reach this at all — and a hard quota belongs in the database
 * beside the user, whenever somebody needs one.
 *
 * It is here because an authenticated caller can still run image generation in a
 * loop, and the bill for that arrives either way.
 *
 * `.server.ts` so it never reaches the client bundle.
 */

export type RateLimit = {
  /** How many calls are allowed inside the window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
};

export type RateLimitVerdict =
  | { allowed: true; remaining: number }
  /** Whole seconds until the oldest call in the window falls out of it. */
  | { allowed: false; retryAfterSeconds: number };

/** Recent call times per key, oldest first. Pruned on read, so it cannot grow forever. */
const hits = new Map<string, number[]>();

/**
 * Record a call against `key` and say whether it is allowed.
 *
 * Sliding window rather than a fixed bucket: a fixed window lets somebody spend
 * a full allowance at 11:59 and another at 12:00.
 */
export function takeToken(
  key: string,
  limit: RateLimit,
  now: number = Date.now(),
): RateLimitVerdict {
  const since = now - limit.windowMs;
  const recent = (hits.get(key) ?? []).filter((at) => at > since);

  if (recent.length >= limit.limit) {
    // Keep the pruned list so the map does not hold times nobody will read.
    hits.set(key, recent);
    const oldest = recent[0] ?? now;
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((oldest + limit.windowMs - now) / 1000)),
    };
  }

  recent.push(now);
  hits.set(key, recent);
  return { allowed: true, remaining: limit.limit - recent.length };
}

/** Drop everything. Tests only — module state otherwise leaks between cases. */
export function resetRateLimits(): void {
  hits.clear();
}
