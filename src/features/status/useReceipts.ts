/**
 * What the last turn cost, as the screen sees it.
 *
 * The diff itself is pure (receipts.ts). This is only the part that has to know
 * about time passing: hold the previous snapshot, fire when the content of the
 * next one differs, and clear after a while so the strip means something when
 * it is lit.
 *
 * Takes a nullable snapshot so it can be called unconditionally, above a
 * screen's loading and error returns, as the rules of hooks require.
 */
import { useEffect, useRef, useState } from "react";
import { receiptsBetween, type Receipt, type TurnSnapshot } from "./receipts";

/** Long enough to read twice, short enough that it still reads as news. */
export const RECEIPT_LIFETIME_MS = 7000;

export function useReceipts(snapshot: TurnSnapshot | null): Receipt[];
export function useReceipts<T>(
  snapshot: T | null,
  diff: (before: T, after: T) => Receipt[],
): Receipt[];
/**
 * `diff` defaults to a turn's receipts. Anything else that changes in front of
 * the player — a Skill bought on the spend card — passes its own pure diff and
 * gets the same timing, so a receipt means the same thing wherever it appears.
 */
export function useReceipts<T>(
  snapshot: T | null,
  diff: (before: T, after: T) => Receipt[] = receiptsBetween as unknown as (
    before: T,
    after: T,
  ) => Receipt[],
): Receipt[] {
  const previous = useRef<T | null>(null);
  const [receipts, setReceipts] = useState<Receipt[]>([]);

  // A fresh object every render, so the effect is keyed on the CONTENT. The
  // serialised form is small and settles: this is state the turn just wrote.
  const fingerprint = snapshot ? JSON.stringify(snapshot) : null;

  useEffect(() => {
    if (!fingerprint) return;
    const next = JSON.parse(fingerprint) as T;
    const before = previous.current;
    previous.current = next;
    // The first bundle is a baseline, not a change: a player arriving at the
    // screen has not just spent anything.
    if (!before) return;
    const change = diff(before, next);
    if (change.length === 0) return;
    setReceipts(change);
    const timer = setTimeout(() => setReceipts([]), RECEIPT_LIFETIME_MS);
    return () => clearTimeout(timer);
    // `diff` is a module-level pure function at every call site; keying on it
    // would only re-fire on an identity change that never happens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fingerprint]);

  return receipts;
}
