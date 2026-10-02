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
import { PAIRS as ALL_PAIRS, SCENARIOS as ALL_SCENARIOS, type Scenario } from "./scenarios";
import { SESSIONS as ALL_SESSIONS, type Session } from "./sessions";

/**
 * `ONLY=id,id` runs just those scenarios, pairs and sessions — for checking a
 * new scenario cheaply before spending a full run on it. A full run is still
 * the verdict on a prompt change; this is how you find out the new scenario
 * is even asking the right question.
 */
const ONLY = (process.env["ONLY"] ?? "")
  .split(",")
  .map((id) => id.trim())
  .filter(Boolean);
const picked = <T extends { id: string }>(all: T[]): T[] =>
  ONLY.length ? all.filter((item) => ONLY.includes(item.id)) : all;
const SCENARIOS = picked(ALL_SCENARIOS);
const PAIRS = picked(ALL_PAIRS);
const SESSIONS = picked(ALL_SESSIONS);
import { withRetry } from "./pacing";
import { evalProvider, modelFor, runTurn } from "./runTurn";
import { scorePair, scoreSession, scoreTurns, type SessionTurn } from "./score";
import { ALL_SESSION_CHECKS } from "@/features/narration/sessionChecks";

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
  const sessionCalls = SESSIONS.reduce((n, session) => n + session.inputs.length, 0);
  const calls = (SCENARIOS.length + PAIRS.length * 2 + sessionCalls) * REPEATS;
  // Said out loud before a penny is spent, so a REPEAT=40 typo is visible
  // rather than expensive.
  console.log(
    `\n  ${SCENARIOS.length} scenarios + ${PAIRS.length} pairs + ${SESSIONS.length} sessions × ${REPEATS} repeat(s) = ${calls} model calls\n` +
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
    // No links: a provider's error can point at the page for managing the key.
    error: message
      .split("\n")[0]!
      .replace(/https?:\/\/\S+/g, "")
      .trim()
      .slice(0, 200),
  };
}

/** What each applicable check made of these turns. */
function checkRecords(asked: Asked, ctx: CheckContext): CheckRecord[] {
  return scoreTurns(
    asked.map(({ result }) => result.turn),
    ctx,
  );
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
    runs: asked.map(({ result, seconds }) => ({ seconds, turn: result.turn, raw: result.raw })),
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
    /** What each paired check concluded. The record carries the rate; this is the verdict. */
    const verdicts: Record<string, Finding[]> = {};

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
      comparison = scorePair(turnsA, turnsB, pair.paired);
      for (const check of paired) verdicts[check.id] = check.run(turnsA, turnsB, pair.paired);
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
        const found = verdicts[check.id] ?? [];
        // The record carries a rate where a check has one; whether it held is
        // the check's own verdict, not "no run fell short".
        const rate = comparison.find((r) => r.id === check.id);
        const counted = rate?.rate ? `${rate.runs - rate.failures.length}/${rate.runs} runs\n` : "";
        expect(
          found,
          `${counted}rule: ${check.source}\n${found
            .map(describe_)
            .map((line) => `  ${line}`)
            .join("\n")}`,
        ).toEqual([]);
      });
    }
  });
}

/**
 * Play one session through, turn by turn: each reply goes into the next turn's
 * packet. The turns of a session are sequential by nature; the repeats of it are
 * what run at once.
 */
async function playSession(session: Session, model: string) {
  const said: { input: string; narration: string }[] = [];
  const turns: SessionTurn[] = [];
  const started = Date.now();
  let servedModel: string | null = null;
  for (const [t, input] of session.inputs.entries()) {
    const packet = session.packet(t, said);
    const scenario: Scenario = {
      id: `${session.id}#${t + 1}`,
      narrator: session.narrator,
      about: session.about,
      system: session.system,
      packet,
      expect: session.expect,
    };
    const result = await withRetry(() => runTurn(scenario, model));
    turns.push({ turn: result.turn, ctx: { ...session.expect, packet } });
    said.push({ input, narration: result.turn.narration });
    servedModel = result.servedModel ?? servedModel;
  }
  return { turns, servedModel, seconds: (Date.now() - started) / 1000 };
}

for (const session of SESSIONS) {
  describe(`${session.id} — ${session.about}`, () => {
    const model = modelFor(session.narrator);
    const firstCtx: CheckContext = { ...session.expect, packet: session.packet(0, []) };
    const checks = [
      ...ALL_CHECKS.filter((check) => isApplicable(check, firstCtx)),
      ...ALL_SESSION_CHECKS,
    ];
    let records: CheckRecord[] = [];

    beforeAll(async () => {
      let runs: Awaited<ReturnType<typeof playSession>>[];
      try {
        runs = await Promise.all(
          Array.from({ length: REPEATS }, () => playSession(session, model)),
        );
      } catch (error) {
        record.scenarios.push(failedScenario(session.id, "single", session, model, error));
        throw error;
      }
      records = scoreSession(
        runs.map((r) => r.turns),
        { interlocutor: session.interlocutor },
      );
      record.scenarios.push({
        id: session.id,
        kind: "single",
        narrator: session.narrator,
        about: session.about,
        model,
        servedModels: [...new Set(runs.map((r) => r.servedModel ?? "unknown"))],
        // The last turn stands for the run in tools that read one turn per run;
        // the whole session is in `raw`.
        runs: runs.map((r) => ({
          seconds: r.seconds,
          turn: r.turns[r.turns.length - 1]!.turn,
          raw: { session: r.turns.map((t) => t.turn) },
        })),
        checks: records,
      });
      console.log(`\n  ${session.id} · asked ${model} · ${session.inputs.length} turns`);
      if (TRANSCRIPT) {
        appendFileSync(
          TRANSCRIPT,
          `\n## ${session.id}\n\n_${session.about}_\n\n` +
            runs
              .map(
                (r, i) =>
                  `### session ${i + 1}\n\n` +
                  r.turns
                    .map((t, n) => `> ${session.inputs[n]}\n\n${t.turn.narration}\n`)
                    .join("\n"),
              )
              .join("\n"),
        );
      }
    }, 900_000);

    for (const check of checks) {
      it(check.title, () => {
        const found = records.find((r) => r.id === check.id)!;
        expect(found.failures, report(found, check.source)).toEqual([]);
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
