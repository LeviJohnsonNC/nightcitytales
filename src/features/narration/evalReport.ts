/**
 * What an eval run leaves behind, and how two of them are compared.
 *
 * WHY THIS EXISTS. The eval printed to a console and was gone. "Did 2.14 make
 * the narrator worse than 2.13" needs two runs side by side, and until the
 * results were a file there was nothing to put side by side: the only record
 * of a run was the terminal it scrolled past on.
 *
 * Pure, so `evalReport.test.ts` runs it in CI for nothing. The eval writes a
 * record (`narrator.eval.ts`); `evals/compare.ts` reads two and prints this.
 *
 * WHAT IT WILL NOT CLAIM. A model is nondeterministic and the sample is small.
 * The first two runs this was ever used on had IDENTICAL prompts and still
 * disagreed: one check went from 3/3 clean to 0/3, which under a "half the runs
 * moved" rule was a regression that never happened. So a change is called only
 * when Fisher's exact test says the two counts are unlikely to be the same
 * rate (p < 0.05). At three runs a side the best possible swing, 3/3 against
 * 0/3, gives p = 0.1 and so can never be called; five runs is where a 5/5
 * against 0/5 (p = 0.008) or 5/5 against 1/5 (p = 0.048) can be. Anything that
 * moved and cannot be called is listed as unclear, with the runs to read.
 */
import type { CheckableTurn, Finding } from "./narratorChecks";

export const EVAL_RECORD_VERSION = 1;

/** One check against one scenario: how many runs it held for, and what broke it. */
export type CheckRecord = {
  id: string;
  title: string;
  runs: number;
  failures: { run: number; findings: Finding[] }[];
};

export type ScenarioRecord = {
  id: string;
  /** "pair" is either one side of a paired scenario or the comparison between the two. */
  kind: "single" | "pair";
  narrator: "gm" | "life";
  about: string;
  model: string;
  servedModels: string[];
  runs: { seconds: number; turn: CheckableTurn; raw?: unknown }[];
  checks: CheckRecord[];
  /**
   * Set when the model could not be asked (a rate limit, an outage). Such a
   * scenario measured nothing, and a comparison must not read its missing
   * cells as checks that were dropped.
   */
  error?: string;
};

export type EvalRecord = {
  version: typeof EVAL_RECORD_VERSION;
  startedAt: string;
  provider: string;
  prompts: { gm: string; life: string };
  repeats: number;
  scenarios: ScenarioRecord[];
  /** Scored again after the run, by `eval:rescore`, with the checks as they are now. */
  rescored?: true;
};

/** A change is called when the chance of seeing it from one unchanged rate is under this. */
export const ALPHA = 0.05;

/** The fewest runs a side needs for the best possible swing to clear `ALPHA`. */
export const MIN_RUNS = 5;

const logFactorial: number[] = [0];
function logFact(n: number): number {
  for (let i = logFactorial.length; i <= n; i += 1)
    logFactorial[i] = logFactorial[i - 1]! + Math.log(i);
  return logFactorial[n]!;
}

/**
 * Two-sided Fisher's exact test on clean/dirty counts for two runs of the same
 * check: how likely a split this lopsided is if both were the same rate.
 */
export function fisherExact(cleanA: number, runsA: number, cleanB: number, runsB: number): number {
  const clean = cleanA + cleanB;
  const total = runsA + runsB;
  const logP = (a: number) =>
    logFact(clean) +
    logFact(total - clean) +
    logFact(runsA) +
    logFact(runsB) -
    logFact(total) -
    logFact(a) -
    logFact(clean - a) -
    logFact(runsA - a) -
    logFact(runsB - clean + a);
  const observed = logP(cleanA);
  let p = 0;
  for (let a = Math.max(0, clean - runsB); a <= Math.min(runsA, clean); a += 1) {
    const here = logP(a);
    if (here <= observed + 1e-9) p += Math.exp(here);
  }
  return Math.min(1, p);
}

export function cleanRuns(check: CheckRecord): number {
  return check.runs - check.failures.length;
}

export function passRate(check: CheckRecord): number {
  return check.runs === 0 ? 1 : cleanRuns(check) / check.runs;
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

// ---------------------------------------------------------------------------
// One run, summarised
// ---------------------------------------------------------------------------

export type Summary = {
  /** Applicable scenario × check cells, and the runs they were held to. */
  cells: number;
  cleanRuns: number;
  totalRuns: number;
  /** Cells that broke at least once, worst first. */
  failing: { scenario: string; check: string; title: string; clean: number; runs: number }[];
  medianSeconds: number | null;
  /** Scenarios that could not be asked at all. */
  errored: { scenario: string; error: string }[];
};

export function summarize(record: EvalRecord): Summary {
  const failing: Summary["failing"] = [];
  let cells = 0;
  let clean = 0;
  let total = 0;
  const errored: Summary["errored"] = [];
  for (const scenario of record.scenarios) {
    if (scenario.error) errored.push({ scenario: scenario.id, error: scenario.error });
    for (const check of scenario.checks) {
      cells += 1;
      clean += cleanRuns(check);
      total += check.runs;
      if (check.failures.length > 0) {
        failing.push({
          scenario: scenario.id,
          check: check.id,
          title: check.title,
          clean: cleanRuns(check),
          runs: check.runs,
        });
      }
    }
  }
  failing.sort((a, b) => a.clean / a.runs - b.clean / b.runs);
  return {
    cells,
    cleanRuns: clean,
    totalRuns: total,
    failing,
    medianSeconds: median(record.scenarios.flatMap((s) => s.runs.map((r) => r.seconds))),
    errored,
  };
}

export function formatSummary(record: EvalRecord): string {
  const s = summarize(record);
  const lines = [
    `${s.cells} checks held to their scenarios · ${s.cleanRuns}/${s.totalRuns} runs clean` +
      (s.medianSeconds === null ? "" : ` · median ${s.medianSeconds.toFixed(1)}s a turn`),
  ];
  if (s.failing.length === 0) lines.push("  nothing broke");
  for (const e of s.errored) lines.push(`  could not be asked: ${e.scenario} (${e.error})`);
  for (const f of s.failing) {
    lines.push(`  ${f.clean}/${f.runs}  ${f.scenario} > ${f.title}`);
  }
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Two runs, side by side
// ---------------------------------------------------------------------------

export type Verdict = "regressed" | "improved" | "unclear" | "same" | "new" | "gone";

export type Change = {
  scenario: string;
  check: string;
  title: string;
  verdict: Verdict;
  before: CheckRecord | null;
  after: CheckRecord | null;
};

export type Comparison = {
  before: EvalRecord;
  after: EvalRecord;
  changes: Change[];
  /** Fewer than `MIN_RUNS` a side: too few for even the biggest swing to be called. */
  thin: boolean;
  /** Scenarios that could not be asked in one run or the other, and so are not compared. */
  unmeasured: string[];
};

function cellsOf(
  record: EvalRecord,
  skip: (id: string) => boolean,
): Map<string, { scenario: string; check: CheckRecord }> {
  const cells = new Map<string, { scenario: string; check: CheckRecord }>();
  for (const scenario of record.scenarios) {
    if (skip(scenario.id)) continue;
    for (const check of scenario.checks) {
      cells.set(`${scenario.id}::${check.id}`, { scenario: scenario.id, check });
    }
  }
  return cells;
}

export function compareRecords(before: EvalRecord, after: EvalRecord): Comparison {
  // A scenario the model could not be asked in EITHER run is left out of both,
  // or its cells in the other run would read as checks that had been dropped.
  const unmeasured = [
    ...new Set([...before.scenarios, ...after.scenarios].filter((s) => s.error).map((s) => s.id)),
  ];
  // A paired scenario is recorded as `id [side]` and `id [compared]`, so a
  // failure recorded under the pair's own id leaves out all of them.
  const skipped = (id: string) => unmeasured.some((u) => id === u || id.startsWith(`${u} [`));
  const a = cellsOf(before, skipped);
  const b = cellsOf(after, skipped);
  const changes: Change[] = [];
  for (const key of new Set([...a.keys(), ...b.keys()])) {
    const was = a.get(key);
    const now = b.get(key);
    const ref = (now ?? was)!;
    let verdict: Verdict;
    if (!was) verdict = "new";
    else if (!now) verdict = "gone";
    else {
      const delta = passRate(now.check) - passRate(was.check);
      if (Math.abs(delta) < 1e-9) verdict = "same";
      else {
        const p = fisherExact(
          cleanRuns(was.check),
          was.check.runs,
          cleanRuns(now.check),
          now.check.runs,
        );
        verdict = p >= ALPHA ? "unclear" : delta < 0 ? "regressed" : "improved";
      }
    }
    changes.push({
      scenario: ref.scenario,
      check: ref.check.id,
      title: ref.check.title,
      verdict,
      before: was?.check ?? null,
      after: now?.check ?? null,
    });
  }
  return {
    before,
    after,
    changes,
    thin: Math.min(before.repeats, after.repeats) < MIN_RUNS,
    unmeasured,
  };
}

const fraction = (c: CheckRecord | null) => (c ? `${cleanRuns(c)}/${c.runs}` : "—");

function quoteOf(change: Change): string | null {
  const first = change.after?.failures[0];
  const finding = first?.findings[0];
  return finding ? `run ${first!.run + 1}: "${finding.quote}"` : null;
}

function header(label: string, r: EvalRecord): string {
  const scored = r.rescored ? " · re-scored with the current checks" : "";
  return `${label}: GM ${r.prompts.gm} · Life ${r.prompts.life} · ${r.repeats} run(s) each · ${r.startedAt}${scored}`;
}

/** Cells only one run had, a line a scenario rather than a line a check. */
function grouped(title: string, verdict: Verdict, changes: Change[], lines: string[]): void {
  const rows = changes.filter((c) => c.verdict === verdict);
  if (rows.length === 0) return;
  const byScenario = new Map<string, Change[]>();
  for (const row of rows)
    byScenario.set(row.scenario, [...(byScenario.get(row.scenario) ?? []), row]);
  lines.push(`${title} (${byScenario.size} scenario(s), ${rows.length} check(s))`);
  for (const [scenario, cells] of byScenario) {
    const records = cells.map((c) => c.after ?? c.before!);
    const clean = records.reduce((n, r) => n + cleanRuns(r), 0);
    const runs = records.reduce((n, r) => n + r.runs, 0);
    lines.push(`  ${scenario}: ${cells.length} check(s), ${clean}/${runs} runs clean`);
  }
  lines.push("");
}

export function formatComparison(cmp: Comparison): string {
  const lines = [header("before", cmp.before), header("after ", cmp.after), ""];
  if (cmp.thin) {
    lines.push(
      `Fewer than ${MIN_RUNS} runs a side. Below that even 3/3 against 0/3 could be chance, so nothing`,
      "here can be called a change: read the lists as leads to follow, and run more before believing one.",
      "",
    );
  }
  const section = (title: string, verdict: Verdict, showQuote: boolean) => {
    const rows = cmp.changes.filter((c) => c.verdict === verdict);
    if (rows.length === 0) return;
    lines.push(`${title} (${rows.length})`);
    for (const row of rows) {
      lines.push(
        `  ${fraction(row.before)} -> ${fraction(row.after)}  ${row.scenario} > ${row.title}`,
      );
      const quote = showQuote ? quoteOf(row) : null;
      if (quote) lines.push(`      ${quote}`);
    }
    lines.push("");
  };
  if (cmp.unmeasured.length > 0) {
    lines.push(
      `Not compared, because the model could not be asked in one of the runs (${cmp.unmeasured.length}):`,
      ...cmp.unmeasured.map((id) => `  ${id}`),
      "",
    );
  }
  section("Got worse", "regressed", true);
  section("Got better", "improved", false);
  section(
    "Moved, but not by more than chance could do (read the runs before believing either way)",
    "unclear",
    true,
  );
  grouped("Only in the new run", "new", cmp.changes, lines);
  grouped("Only in the old run", "gone", cmp.changes, lines);

  const same = cmp.changes.filter((c) => c.verdict === "same").length;
  lines.push(`${same} check(s) unchanged.`);
  const a = summarize(cmp.before);
  const b = summarize(cmp.after);
  lines.push(
    `Runs clean: ${a.cleanRuns}/${a.totalRuns} -> ${b.cleanRuns}/${b.totalRuns}` +
      (a.medianSeconds !== null && b.medianSeconds !== null
        ? ` · median turn ${a.medianSeconds.toFixed(1)}s -> ${b.medianSeconds.toFixed(1)}s`
        : ""),
  );
  return lines.join("\n");
}
