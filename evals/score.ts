/**
 * Scoring turns, apart from asking for them.
 *
 * The eval asks a model and scores what came back. Those are separate jobs, and
 * keeping them separate is what lets a run be scored AGAIN: change a check and
 * every turn already on disk can be judged by the new one for nothing. Without
 * that, comparing a prompt change to the run before it confounds the prompt with
 * whatever the checks learned in between.
 */
import {
  ALL_CHECKS,
  isApplicable,
  type CheckContext,
  type CheckableTurn,
} from "@/features/narration/narratorChecks";
import { ALL_PAIRED_CHECKS, type PairedContext } from "@/features/narration/pairedChecks";
import type { CheckRecord } from "@/features/narration/evalReport";

/** What each applicable check made of these turns. */
export function scoreTurns(turns: CheckableTurn[], ctx: CheckContext): CheckRecord[] {
  return ALL_CHECKS.filter((check) => isApplicable(check, ctx)).map((check) => ({
    id: check.id,
    title: check.title,
    runs: turns.length,
    failures: turns
      .map((turn, run) => ({ run, findings: check.run(turn, ctx) }))
      .filter(({ findings }) => findings.length > 0),
  }));
}

/**
 * What each applicable paired check made of two sets of turns. One comparison
 * over all the runs, so it holds or it does not: counted as one run, not as a
 * failure in one of five.
 */
export function scorePair(
  a: CheckableTurn[],
  b: CheckableTurn[],
  paired: PairedContext,
): CheckRecord[] {
  return ALL_PAIRED_CHECKS.filter((check) => check.applies(paired)).map((check) => {
    const findings = check.run(a, b, paired);
    return {
      id: check.id,
      title: check.title,
      runs: 1,
      failures: findings.length ? [{ run: 0, findings }] : [],
    };
  });
}
