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

export function useReceipts(snapshot: TurnSnapshot | null): Receipt[] {
  const previous = useRef<TurnSnapshot | null>(null);
  const [receipts, setReceipts] = useState<Receipt[]>([]);

  // A fresh object every render, so the effect is keyed on the CONTENT. The
  // serialised form is small and settles: this is state the turn just wrote.
  const fingerprint = snapshot ? JSON.stringify(snapshot) : null;

  useEffect(() => {
    if (!fingerprint) return;
    const next = JSON.parse(fingerprint) as TurnSnapshot;
    const before = previous.current;
    previous.current = next;
    // The first bundle is a baseline, not a change: a player arriving at the
    // screen has not just spent anything.
    if (!before) return;
    const change = receiptsBetween(before, next);
    if (change.length === 0) return;
    setReceipts(change);
    const timer = setTimeout(() => setReceipts([]), RECEIPT_LIFETIME_MS);
    return () => clearTimeout(timer);
  }, [fingerprint]);

  return receipts;
}
