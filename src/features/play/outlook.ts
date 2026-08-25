import { checkOutlook } from "@/engine/checkDV";

/**
 * Plain-language read of what the die has to do, with the Critical Failure rule
 * (natural 1 subtracts a second d10, no chaining) taken into account instead of
 * printing a nonsense target like "you need a -1 or better".
 */
export function describeOutlook(base: number, dv: number): string {
  const o = checkOutlook(base, dv);
  if (o.cannotFail) {
    return `Locked in. Even a Critical Failure bottoms out at ${o.worstCase} against DV ${dv} — you cannot miss this.`;
  }
  if (o.cannotSucceed) {
    return `Out of reach: even a Critical Success tops out at ${o.bestCase} against DV ${dv}.`;
  }
  if (o.critFailSafeUpTo !== null) {
    return `Any roll but a 1 clears DV ${dv}. On a natural 1 you subtract a second d10 — a ${o.critFailSafeUpTo} or lower on that die still gets you there.`;
  }
  if (o.critSuccessNeeded !== null) {
    return `Only a Critical Success reaches DV ${dv}: roll a natural 10, then ${o.critSuccessNeeded} or better on the second d10.`;
  }
  return `A ${o.needed} or better clears DV ${dv}. A natural 1 subtracts a second d10, so it can still come apart.`;
}

