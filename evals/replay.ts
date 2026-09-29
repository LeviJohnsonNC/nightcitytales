/**
 * Score the narrator's real turns, grouped by the prompt version that wrote them.
 *
 *   bun run eval:replay --file rows.json
 *   bun run eval:replay                       # reads the project's own ledger
 *   bun run eval:replay --since 2026-09-20 --narrator gm --json out.json
 *
 * No model is called and nothing is written to the database: it reads
 * `campaign_events` and runs the detectors that need only the prose. What it can
 * and cannot say is in `src/features/narration/ledgerReplay.ts`, which is worth
 * reading before believing a number.
 *
 * The turns are your players' private narration. The report quotes short
 * fragments of the ones that broke a rule; do not paste it anywhere it should
 * not go.
 */
import { writeFileSync } from "node:fs";
import { formatReplay, replay } from "../src/features/narration/ledgerReplay";
import { fetchLedger, readLedgerFile } from "./ledgerSource";

function flag(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const file = flag("--file");
const narrator = flag("--narrator");
if (narrator && narrator !== "gm" && narrator !== "life") {
  throw new Error('--narrator is "gm" or "life".');
}

const source = file
  ? { rows: readLedgerFile(file), scope: `the file ${file}` }
  : await fetchLedger({ ...(flag("--since") ? { since: flag("--since")! } : {}) });

console.log(`Read ${source.rows.length} narration row(s) from ${source.scope}.\n`);
const groups = replay(source.rows).filter((g) => !narrator || g.narrator === narrator);
console.log(formatReplay(groups));

const out = flag("--json");
if (out) {
  writeFileSync(out, JSON.stringify(groups, null, 2));
  console.log(`\nGroups written to ${out}.`);
}
