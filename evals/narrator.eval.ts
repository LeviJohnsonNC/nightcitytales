/**
 * The eval. Calls a real model, costs real money, never runs in CI.
 *
 * It cannot be picked up by `bun run test`: the default vitest config includes
 * `src/**` only, and this file is neither under `src/` nor named `*.test.ts`.
 * That separation is structural on purpose. A `skipIf(!process.env.KEY)` guard
 * would work right up until someone ran the suite with a populated `.env` and
 * quietly paid for it, or until one guard was forgotten.
 *
 * What it reports, per scenario and per check, is a count over repeats rather
 * than a boolean. One run of a nondeterministic model is not a verdict, and a
 * check that trips one time in three is exactly the finding worth seeing.
 *
 *   bun run eval                            # three runs of everything
 *   REPEAT=5 bun run eval
 *   bun run eval -t job-risky-intent
 *   TRANSCRIPT=/tmp/turns.md bun run eval   # also write every turn out in full
 *   bun run eval:compare                    # the two newest runs, side by side
 *
 * Every run leaves `evals/results/<time>.json` (or `RESULTS=<file>`), because a
 * run that only scrolled past on a terminal cannot be set beside the next one.
 *
 * Only the checks a scenario gives something to measure are run and reported.
 * Held to every scenario, most of the report was checks passing because they
 * had nothing to look at.
 *
 * The checks measure whether a turn broke a rule, not whether it was any good.
 * TRANSCRIPT is for the other half: reading what the narrator actually wrote,
 * which is the only measure of prose quality this project has.
 */
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  ALL_CHECKS,
  isApplicable,
  type CheckContext,
  type Finding,
} from "@/features/narration/narratorChecks";
import { ALL_PAIRED_CHECKS } from "@/features/narration/pairedChecks";
import {
  EVAL_RECORD_VERSION,
  formatSummary,
  type CheckRecord,
  type EvalRecord,
  type ScenarioRecord,
} from "@/features/narration/evalReport";
import { GM_PROMPT_VERSION } from "@/features/gm/gmSystemPrompt";
import { LIFE_PROMPT_VERSION } from "@/features/life/lifeSystemPrompt";
import { PAIRS, SCENARIOS, type Scenario } from "./scenarios";
import { evalProvider, modelFor, runTurn } from "./runTurn";

/** How many times each scenario is asked. `REPEAT=N`, or `--repeat N` where the runner allows it. */
const REPEATS = Math.max(1, Number(process.env["REPEAT"] ?? readFlag("--repeat") ?? 5));

function readFlag(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

/** Where to write every turn in full, when set. */
const TRANSCRIPT = process.env["TRANSCRIPT"];

const startedAt = new Date().toISOString();
const RESULTS = process.env["RESULTS"] ?? `evals/results/${startedAt.replace(/[:.]/g, "-")}.json`;

const record: EvalRecord = {
  version: EVAL_RECORD_VERSION,
  startedAt,
  provider: "unknown",
  prompts: { gm: GM_PROMPT_VERSION, life: LIFE_PROMPT_VERSION },
  repeats: REPEATS,
  scenarios: [],
};

beforeAll(() => {
  try {
    record.provider = evalProvider().name;
  } catch {
    /* the first call says so, with the instructions */
  }
  if (TRANSCRIPT) {
    writeFileSync(
      TRANSCRIPT,
      `# Narrator transcript\n\nGM prompt ${GM_PROMPT_VERSION} · Life prompt ${LIFE_PROMPT_VERSION}\n`,
    );
  }
  const calls = (SCENARIOS.length + PAIRS.length * 2) * REPEATS;
  // Said out loud before a penny is spent, so a REPEAT=40 typo is visible
  // rather than expensive.
  console.log(
    `\n  ${SCENARIOS.length} scenarios + ${PAIRS.length} pairs × ${REPEATS} repeat(s) = ${calls} model calls\n` +
      `  GM prompt ${GM_PROMPT_VERSION} · Life prompt ${LIFE_PROMPT_VERSION}\n`,
  );
});

afterAll(() => {
  if (record.scenarios.length === 0) return;
  mkdirSync(dirname(RESULTS), { recursive: true });
  writeFileSync(RESULTS, JSON.stringify(record, null, 2));
  console.log(`\n${formatSummary(record)}\n\n  results: ${RESULTS}\n`);
});

/**
 * How many model calls may START each minute. A provider's limit is on
 * requests, not on how many are in flight, and the first live run of this
 * harness lost three scenarios to a new OpenRouter account's twenty a minute
 * because the repeats went out together. Fifteen leaves room for the SDK's own
 * retries. `EVAL_RPM` raises it for an account that can take more.
 */
const RPM = Math.max(1, Number(process.env["EVAL_RPM"] ?? 15));
let nextStart = 0;

/** Wait for this call's turn to start. Calls are spaced, so a burst becomes a queue. */
async function paced(): Promise<void> {
  const now = Date.now();
  const at = Math.max(now, nextStart);
  nextStart = at + 60_000 / RPM;
  if (at > now) await new Promise((resolve) => setTimeout(resolve, at - now));
}

/** A call that failed once for a network reason gets one more go before the scenario is lost. */
async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  await paced();
  try {
    return await fn();
  } catch {
    await paced();
    return fn();
  }
}

/**
 * Ask one scenario `REPEATS` times at once. A model turn is a few seconds of
 * waiting, and asking them one after another made `REPEAT=3` three times
 * slower and put every repeat inside one scenario's timeout.
 */
async function askRepeatedly(scenario: Scenario, model: string) {
  return Promise.all(
    Array.from({ length: REPEATS }, async () => {
      const started = Date.now();
      const result = await withRetry(() => runTurn(scenario, model));
      return { result, seconds: (Date.now() - started) / 1000 };
    }),
  );
}

type Asked = Awaited<ReturnType<typeof askRepeatedly>>;

function failedScenario(
  id: string,
  kind: ScenarioRecord["kind"],
  scenario: Pick<Scenario, "narrator" | "about">,
  model: string,
  error: unknown,
): ScenarioRecord {
  const message = error instanceof Error ? error.message : String(error);
  return {
    id,
    kind,
    narrator: scenario.narrator,
    about: scenario.about,
    model,
    servedModels: [],
    runs: [],
    checks: [],
    error: message.split("\n")[0]!.slice(0, 200),
  };
}

/** What each applicable check made of these turns. */
function checkRecords(asked: Asked, ctx: CheckContext): CheckRecord[] {
  return ALL_CHECKS.filter((check) => isApplicable(check, ctx)).map((check) => ({
    id: check.id,
    title: check.title,
    runs: asked.length,
    failures: asked
      .map(({ result }, run) => ({ run, findings: check.run(result.turn, ctx) }))
      .filter(({ findings }) => findings.length > 0),
  }));
}

function scenarioRecord(
  id: string,
  kind: ScenarioRecord["kind"],
  scenario: Pick<Scenario, "narrator" | "about">,
  model: string,
  asked: Asked,
  checks: CheckRecord[],
): ScenarioRecord {
  return {
    id,
    kind,
    narrator: scenario.narrator,
    about: scenario.about,
    model,
    servedModels: [...new Set(asked.map((a) => a.result.servedModel ?? "unknown"))],
    runs: asked.map(({ result, seconds }) => ({ seconds, turn: result.turn })),
    checks,
  };
}

/** The whole report in the failure message: which runs, and what they actually said. */
function report(record_: CheckRecord, source: string): string {
  return [
    `${record_.runs - record_.failures.length}/${record_.runs} runs passed`,
    `rule: ${source}`,
    ...record_.failures.map(
      ({ run, findings }) => `  run ${run + 1}: ${findings.map(describe_).join(" / ")}`,
    ),
  ].join("\n");
}

for (const scenario of SCENARIOS) {
  describe(`${scenario.id} — ${scenario.about}`, () => {
    const model = modelFor(scenario.narrator);
    const ctx: CheckContext = { ...scenario.expect, packet: scenario.packet };
    const checks = ALL_CHECKS.filter((check) => isApplicable(check, ctx));
    let records: CheckRecord[] = [];

    beforeAll(async () => {
      let asked: Asked;
      try {
        asked = await askRepeatedly(scenario, model);
      } catch (error) {
        record.scenarios.push(failedScenario(scenario.id, "single", scenario, model, error));
        throw error;
      }
      records = checkRecords(asked, ctx);
      const rec = scenarioRecord(scenario.id, "single", scenario, model, asked, records);
      record.scenarios.push(rec);
      console.log(`\n  ${scenario.id} · asked ${model} · answered ${rec.servedModels.join(", ")}`);
      if (TRANSCRIPT) appendFileSync(TRANSCRIPT, transcriptOf(scenario, asked));
    }, 120_000);

    for (const check of checks) {
      it(check.title, () => {
        const found = records.find((r) => r.id === check.id)!;
        expect(found.failures, report(found, check.source)).toEqual([]);
      });
    }
  });
}

for (const pair of PAIRS) {
  describe(`${pair.id} — ${pair.about}`, () => {
    const model = modelFor(pair.narrator);
    const sides = pair.variants.map((variant) => ({
      variant,
      scenario: {
        id: `${pair.id} [${variant.label}]`,
        narrator: pair.narrator,
        about: pair.about,
        system: pair.system,
        packet: variant.packet,
        expect: pair.expect,
      } satisfies Scenario,
      ctx: { ...pair.expect, packet: variant.packet } satisfies CheckContext,
    }));
    const paired = ALL_PAIRED_CHECKS.filter((check) => check.applies(pair.paired));
    const records: Record<string, CheckRecord[]> = {};
    let comparison: CheckRecord[] = [];

    beforeAll(async () => {
      let both: Asked[];
      try {
        both = await Promise.all(sides.map((side) => askRepeatedly(side.scenario, model)));
      } catch (error) {
        for (const id of [...sides.map((side) => side.scenario.id), `${pair.id} [compared]`]) {
          record.scenarios.push(failedScenario(id, "pair", pair, model, error));
        }
        throw error;
      }
      const [a, b] = both;
      for (const [i, asked] of [a!, b!].entries()) {
        const side = sides[i]!;
        records[side.variant.label] = checkRecords(asked, side.ctx);
        record.scenarios.push(
          scenarioRecord(
            side.scenario.id,
            "pair",
            pair,
            model,
            asked,
            records[side.variant.label]!,
          ),
        );
        if (TRANSCRIPT) appendFileSync(TRANSCRIPT, transcriptOf(side.scenario, asked));
      }
      const turnsA = a!.map((x) => x.result.turn);
      const turnsB = b!.map((x) => x.result.turn);
      comparison = paired.map((check) => {
        const findings = check.run(turnsA, turnsB, pair.paired);
        return {
          id: check.id,
          title: check.title,
          // One comparison over all the runs, so it holds or it does not: counted
          // as one run, not as a failure in one of three.
          runs: 1,
          failures: findings.length ? [{ run: 0, findings }] : [],
        };
      });
      record.scenarios.push({
        id: `${pair.id} [compared]`,
        kind: "pair",
        narrator: pair.narrator,
        about: pair.about,
        model,
        servedModels: [],
        runs: [],
        checks: comparison,
      });
      console.log(`\n  ${pair.id} · asked ${model}`);
    }, 180_000);

    for (const side of sides) {
      for (const check of ALL_CHECKS.filter((c) => isApplicable(c, side.ctx))) {
        it(`${side.variant.label}: ${check.title}`, () => {
          const found = records[side.variant.label]!.find((r) => r.id === check.id)!;
          expect(found.failures, report(found, check.source)).toEqual([]);
        });
      }
    }

    for (const check of paired) {
      it(check.title, () => {
        const found = comparison.find((r) => r.id === check.id)!;
        // A paired check is one comparison over all the runs, not one per run.
        expect(
          found.failures,
          `rule: ${check.source}\n${found.failures
            .flatMap((f) => f.findings.map(describe_))
            .map((line) => `  ${line}`)
            .join("\n")}`,
        ).toEqual([]);
      });
    }
  });
}

function describe_(finding: Finding): string {
  return finding.note ? `"${finding.quote}" (${finding.note})` : `"${finding.quote}"`;
}

function transcriptOf(scenario: Pick<Scenario, "id" | "about" | "packet">, asked: Asked): string {
  const said = scenario.packet.split("== PLAYER INPUT ==")[1]?.trim() ?? "";
  const runs = asked.map(({ result, seconds }, i) => {
    const { narration, ...rest } = result.turn;
    const mechanics = Object.entries(rest)
      .filter(([, v]) => (Array.isArray(v) ? v.length > 0 : v !== undefined && v !== 0))
      .map(([k, v]) => `${k}: ${JSON.stringify(v)}`);
    const took = ` (${seconds.toFixed(1)}s)`;
    return [`### run ${i + 1}${took}`, "", narration, "", ...mechanics.map((m) => `- ${m}`)].join(
      "\n",
    );
  });
  return `\n## ${scenario.id}\n\n_${scenario.about}_\n\n> ${said}\n\n${runs.join("\n\n")}\n`;
}
