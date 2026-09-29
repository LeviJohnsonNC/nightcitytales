/**
 * Two eval runs, side by side.
 *
 *   bun run eval:compare                       # the two newest in evals/results/
 *   bun run eval:compare before.json after.json
 *
 * The logic is `src/features/narration/evalReport.ts`, which CI tests. This is
 * only the file handling.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  compareRecords,
  formatComparison,
  type EvalRecord,
} from "../src/features/narration/evalReport";

const DIR = "evals/results";

function load(path: string): EvalRecord {
  const record = JSON.parse(readFileSync(path, "utf8")) as EvalRecord;
  if (record.version !== 1) throw new Error(`${path}: unknown record version ${record.version}`);
  return record;
}

function newest(count: number): string[] {
  const files = readdirSync(DIR)
    .filter((f) => f.endsWith(".json"))
    .sort();
  if (files.length < count) {
    throw new Error(
      `Need ${count} runs in ${DIR}/ to compare and found ${files.length}. Run \`bun run eval\` again, or name the files.`,
    );
  }
  return files.slice(-count).map((f) => join(DIR, f));
}

const [first, second] = process.argv.slice(2);
const [before, after] = first && second ? [first, second] : newest(2);
console.log(formatComparison(compareRecords(load(before!), load(after!))));
