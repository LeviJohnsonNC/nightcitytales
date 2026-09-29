/**
 * Score a saved run again with today's checks.
 *
 *   bun run eval:rescore evals/results/before.json
 *
 * Writes `<name>.rescored.json` beside it. No model is called: every turn is
 * already in the file, and the scenarios' expectations and packets are read
 * from `scenarios.ts` as it is now.
 *
 * Use it before comparing a prompt change to the run that came before, when the
 * checks changed in between. Otherwise a cell that moved might have moved
 * because the check did, not the prompt.
 */
import { readFileSync, writeFileSync } from "node:fs";
import type { CheckContext } from "@/features/narration/narratorChecks";
import type { EvalRecord, ScenarioRecord } from "@/features/narration/evalReport";
import { PAIRS, SCENARIOS } from "./scenarios";
import { scorePair, scoreTurns } from "./score";

const [path] = process.argv.slice(2);
if (!path) throw new Error("Name a results file: bun run eval:rescore evals/results/<run>.json");

const record = JSON.parse(readFileSync(path, "utf8")) as EvalRecord;
const turnsOf = (s: ScenarioRecord) => s.runs.map((r) => r.turn);

/** The context a scenario id is scored under now, or null for one this file does not know. */
function contextFor(id: string): CheckContext | null {
  const single = SCENARIOS.find((s) => s.id === id);
  if (single) return { ...single.expect, packet: single.packet };
  for (const pair of PAIRS) {
    for (const variant of pair.variants) {
      if (id === `${pair.id} [${variant.label}]`) {
        return { ...pair.expect, packet: variant.packet };
      }
    }
  }
  return null;
}

let skipped: string[] = [];
const scenarios = record.scenarios.map((scenario): ScenarioRecord => {
  if (scenario.error) return scenario;
  const compared = PAIRS.find((p) => scenario.id === `${p.id} [compared]`);
  if (compared) {
    const [a, b] = compared.variants.map((v) =>
      record.scenarios.find((s) => s.id === `${compared.id} [${v.label}]`),
    );
    if (!a || !b || a.error || b.error) return scenario;
    return { ...scenario, checks: scorePair(turnsOf(a), turnsOf(b), compared.paired) };
  }
  const ctx = contextFor(scenario.id);
  if (!ctx) {
    skipped = [...skipped, scenario.id];
    return scenario;
  }
  return { ...scenario, checks: scoreTurns(turnsOf(scenario), ctx) };
});

const out = path.replace(/\.json$/, "") + ".rescored.json";
writeFileSync(out, JSON.stringify({ ...record, rescored: true, scenarios }, null, 2));
console.log(`rescored ${scenarios.length - skipped.length} scenario(s) -> ${out}`);
if (skipped.length)
  console.log(`  left as recorded (not in scenarios.ts any more): ${skipped.join(", ")}`);
