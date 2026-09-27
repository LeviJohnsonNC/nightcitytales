/**
 * What the Life narrator is told once the engine has settled a skill check.
 *
 * Built here rather than inline in `lifeOps.ts` so the eval can ask the model
 * exactly what play asks it.
 */
export function checkResolvedLine(r: {
  skillName: string;
  formula: string;
  success: boolean;
  margin: number;
  intent: string;
  /** Pre-worded additions: what the search found, what the read told them. */
  extra?: string;
}): string {
  const verdict = r.success ? "SUCCESS" : "FAILURE";
  return (
    `The ${r.skillName} check is RESOLVED. ${r.formula}. Outcome: ${verdict} by ` +
    `${Math.abs(r.margin)}, for the intent "${r.intent}".${r.extra ?? ""}`
  );
}
