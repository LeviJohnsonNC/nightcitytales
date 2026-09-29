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
import { ALL_SESSION_CHECKS, type SessionScene } from "@/features/narration/sessionChecks";

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
    // A check that can be measured as a rate is recorded as one: a count of runs
    // is something a later run can be compared with, and one yes or no is not.
    const rate = check.rate?.(a, b, paired);
    if (rate) {
      return {
        id: check.id,
        title: check.title,
        runs: rate.runs,
        failures: rate.failing.map((finding, run) => ({ run, findings: [finding] })),
        rate: true as const,
        held: rate.held,
      };
    }
    const findings = check.run(a, b, paired);
    return {
      id: check.id,
      title: check.title,
      runs: 1,
      failures: findings.length ? [{ run: 0, findings }] : [],
    };
  });
}

/** One turn of a session, with the context it was asked under. */
export type SessionTurn = { turn: CheckableTurn; ctx: CheckContext };

/**
 * A session scored as a whole. A run here is one full session, and a check
 * fails it if ANY turn broke it, with the turn named in the finding: what a
 * session is for is seeing whether a rule that holds on turn one still holds on
 * turn five, and that only shows if the turn number survives into the report.
 * Checks the scenario gives nothing to measure are left out, as everywhere else.
 */
export function scoreSession(runs: SessionTurn[][], scene?: SessionScene): CheckRecord[] {
  const applicable = ALL_CHECKS.filter((check) =>
    runs.some((run) => run.some(({ ctx }) => isApplicable(check, ctx))),
  );
  const perTurn = applicable.map((check) => ({
    id: check.id,
    title: check.title,
    runs: runs.length,
    failures: runs
      .map((run, index) => ({
        run: index,
        findings: run.flatMap(({ turn, ctx }, t) =>
          isApplicable(check, ctx)
            ? check.run(turn, ctx).map((f) => ({
                ...f,
                note: `turn ${t + 1}${f.note ? `: ${f.note}` : ""}`,
              }))
            : [],
        ),
      }))
      .filter(({ findings }) => findings.length > 0),
  }));
  const acrossTurns = ALL_SESSION_CHECKS.map((check) => ({
    id: check.id,
    title: check.title,
    runs: runs.length,
    failures: runs
      .map((run, index) => ({
        run: index,
        findings: check
          .run(
            run.map(({ turn }) => turn),
            scene,
          )
          .map(({ turn, note, ...f }) => ({
            ...f,
            note: `turn ${turn}${note ? `: ${note}` : ""}`,
          })),
      }))
      .filter(({ findings }) => findings.length > 0),
  }));
  return [...perTurn, ...acrossTurns];
}
