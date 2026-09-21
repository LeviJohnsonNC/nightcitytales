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
 *   bun run eval
 *   bun run eval -- --repeat 3
 *   bun run eval -- -t job-risky-intent
 */
import { beforeAll, describe, expect, it } from "vitest";
import { ALL_CHECKS, type CheckContext, type Finding } from "@/features/narration/narratorChecks";
import { GM_PROMPT_VERSION } from "@/features/gm/gmSystemPrompt";
import { LIFE_PROMPT_VERSION } from "@/features/life/lifeSystemPrompt";
import { SCENARIOS } from "./scenarios";
import { modelFor, runTurn, type TurnResult } from "./runTurn";

/** How many times each scenario is asked. `--repeat N`, or REPEAT=N. */
const REPEATS = Math.max(1, Number(process.env["REPEAT"] ?? readFlag("--repeat") ?? 1));

function readFlag(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

beforeAll(() => {
  const calls = SCENARIOS.length * REPEATS;
  // Said out loud before a penny is spent, so a --repeat 40 typo is visible
  // rather than expensive.
  console.log(
    `\n  ${SCENARIOS.length} scenarios × ${REPEATS} repeat(s) = ${calls} model calls\n` +
      `  GM prompt ${GM_PROMPT_VERSION} · Life prompt ${LIFE_PROMPT_VERSION}\n`,
  );
});

for (const scenario of SCENARIOS) {
  describe(`${scenario.id} — ${scenario.about}`, () => {
    const results: TurnResult[] = [];
    const model = modelFor(scenario.narrator);
    const ctx: CheckContext = { ...scenario.expect, packet: scenario.packet };

    beforeAll(async () => {
      for (let i = 0; i < REPEATS; i++) results.push(await runTurn(scenario, model));
      const served = [...new Set(results.map((r) => r.servedModel ?? "unknown"))];
      console.log(`\n  ${scenario.id} · asked ${model} · answered ${served.join(", ")}`);
    }, 120_000);

    for (const check of ALL_CHECKS) {
      it(check.title, () => {
        const failures = results
          .map((result, run) => ({ run, findings: check.run(result.turn, ctx) }))
          .filter(({ findings }) => findings.length > 0);

        // The whole report in the failure message: which runs, and what they
        // actually said. A count with no quote sends you back to the model to
        // reproduce it, which is the opposite of what an eval is for.
        expect(
          failures,
          [
            `${results.length - failures.length}/${results.length} runs passed`,
            `rule: ${check.source}`,
            ...failures.map(
              ({ run, findings }) => `  run ${run + 1}: ${findings.map(describe_).join(" / ")}`,
            ),
          ].join("\n"),
        ).toEqual([]);
      });
    }
  });
}

function describe_(finding: Finding): string {
  return finding.note ? `"${finding.quote}" (${finding.note})` : `"${finding.quote}"`;
}
