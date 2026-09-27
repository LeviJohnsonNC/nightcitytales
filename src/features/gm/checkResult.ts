/**
 * What the Job narrator is told once the engine has settled a skill check.
 *
 * Built here rather than inline in `playOps.ts` so the eval can ask the model
 * exactly what play asks it: a result turn worded differently in the eval would
 * be measuring a prompt no player ever reaches.
 */
export function critNote(critical: "success" | "failure" | null): string {
  if (critical === "success") return " (Critical Success: an extra d10 was added)";
  if (critical === "failure") return " (Critical Failure: an extra d10 was subtracted)";
  return "";
}

export function checkResolvedInput(r: {
  skillName: string;
  formula: string;
  critical: "success" | "failure" | null;
  success: boolean;
  margin: number;
  intent: string;
  /** Pre-worded additions: what the search found, what the read told them, the rest of what they said. */
  extra?: string;
}): string {
  const verdict = r.success ? "SUCCESS" : "FAILURE";
  return (
    `(ENGINE: the ${r.skillName} check is RESOLVED. ${r.formula}${critNote(r.critical)}. ` +
    `Outcome: ${verdict} by ${Math.abs(r.margin)}. Narrate this exact outcome for the intent ` +
    `"${r.intent}". Do not re-decide it, do not soften a failure, do not propose the same check ` +
    `again.${r.extra ?? ""} End on a decision.)`
  );
}
