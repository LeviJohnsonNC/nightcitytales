/**
 * Pacing and retry for every eval script that calls a model: the narrator run
 * and the judge both spend from the same provider, so they share one rule for
 * how fast and what counts as fatal.
 *
 * How many calls may START each minute. A provider's limit is on requests, not
 * on how many are in flight, and the first live run of this harness lost three
 * scenarios to a new OpenRouter account's twenty a minute because the repeats
 * went out together. Fifteen leaves room for the SDK's own retries. `EVAL_RPM`
 * raises it for an account that can take more.
 */
const RPM = Math.max(1, Number(process.env["EVAL_RPM"] ?? 15));
let nextStart = 0;

/** Wait for this call's turn to start. Calls are spaced, so a burst becomes a queue. */
export async function paced(): Promise<void> {
  const now = Date.now();
  const at = Math.max(now, nextStart);
  nextStart = at + 60_000 / RPM;
  if (at > now) await new Promise((resolve) => setTimeout(resolve, at - now));
}

/**
 * Errors no retry can fix: the key, its limit, the balance. A rate limit is NOT
 * one of these ("Rate limit exceeded" passes) because waiting does fix it.
 */
export const FATAL =
  /key limit|total limit|more credits|insufficient|invalid api key|unauthori[sz]ed|forbidden|\b(?:401|402|403)\b/i;
let fatalError: unknown = null;

/**
 * A call that failed once for a network reason gets one more go before the
 * scenario is lost. One that failed for a reason waiting cannot fix stops the
 * run: the first run with a spent key spent three and a half minutes asking
 * twenty-five scenarios a question every one of them was going to be refused.
 */
export async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  if (fatalError) throw fatalError;
  await paced();
  try {
    return await fn();
  } catch (error) {
    if (FATAL.test(String((error as Error)?.message ?? error))) {
      fatalError = error;
      throw error;
    }
    await paced();
    return fn();
  }
}
