/**
 * The judged quality layer. A second model reads two narrations of the same
 * scene and says which is better; a person checks the judge.
 *
 *   bun run eval:judge compare before.json after.json [--limit-per-scenario 3] [--scenarios a,b] [--dry]
 *   bun run eval:judge label   before.json after.json [--n 30]
 *   bun run eval:judge calibrate evals/results/judged/labels.md
 *
 * `compare` pairs run N of a scenario in `before` with run N in `after` (the
 * runs are independent samples, so the pairing is arbitrary and only there to
 * give the judge two texts), judges each pair in both orders, and reports
 * what survives the swap. It is NEVER a gate: it costs money, and a judge is a
 * model with biases. The report says whether the judge has been checked
 * against a person, and how often the longer text won.
 *
 * The scene the judge sees is the scenario's packet as `scenarios.ts` renders
 * it now. A record does not keep its packet, so a scenario whose packet
 * changed since the run is judged against the new scene. Judge runs made close
 * together.
 *
 * Reports go to `evals/results/judged/`, a subdirectory, so `eval:compare`
 * (which reads every .json at the top level) never mistakes one for a run.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import type { EvalRecord } from "@/features/narration/evalReport";
import {
  JUDGE_CRITERIA,
  agreement,
  combineOrders,
  lengthBias,
  parseLabels,
  renderLabels,
  shuffled,
  tally,
  type CriterionId,
  type LabelKey,
  type Outcome,
  type Side,
} from "@/features/narration/judge";
import { judgePair, JUDGE_MODEL } from "./judgeCall";
import { PAIRS, SCENARIOS } from "./scenarios";

const OUT = "evals/results/judged";
const CALIBRATION = `${OUT}/calibration.json`;

const argv = process.argv.slice(2);
const [command, ...rest] = argv;
const files = rest.filter((a, i) => !a.startsWith("--") && !rest[i - 1]?.startsWith("--"));
const flag = (name: string) => {
  const i = rest.indexOf(name);
  return i >= 0 ? rest[i + 1] : undefined;
};

type Pair = {
  id: string;
  scenario: string;
  about: string;
  scene: string;
  before: string;
  after: string;
};

function sceneFor(id: string): { scene: string; about: string } | null {
  const single = SCENARIOS.find((s) => s.id === id);
  if (single) return { scene: single.packet, about: single.about };
  for (const pair of PAIRS) {
    for (const variant of pair.variants) {
      if (id === `${pair.id} [${variant.label}]`) {
        return { scene: variant.packet, about: pair.about };
      }
    }
  }
  return null;
}

const load = (path: string) => JSON.parse(readFileSync(path, "utf8")) as EvalRecord;

function buildPairs(beforePath: string, afterPath: string): Pair[] {
  const before = load(beforePath);
  const after = load(afterPath);
  const limit = Number(flag("--limit-per-scenario") ?? Infinity);
  const only = flag("--scenarios")?.split(",");
  const out: Pair[] = [];
  for (const b of before.scenarios) {
    const a = after.scenarios.find((s) => s.id === b.id);
    if (!a || a.error || b.error || (only && !only.includes(b.id))) continue;
    const known = sceneFor(b.id);
    if (!known) continue;
    const n = Math.min(a.runs.length, b.runs.length, limit);
    for (let i = 0; i < n; i += 1) {
      const x = b.runs[i]!.turn.narration;
      const y = a.runs[i]!.turn.narration;
      if (!x || !y) continue;
      out.push({
        id: `${b.id}#${i + 1}`,
        scenario: b.id,
        about: known.about,
        scene: known.scene,
        before: x,
        after: y,
      });
    }
  }
  return out;
}

type Calibration = {
  judgeModel: string;
  at: string;
  n: number;
  raw: number | null;
  kappa: number | null;
};

function calibrationStatus(): string {
  try {
    const c = JSON.parse(readFileSync(CALIBRATION, "utf8")) as Calibration;
    const stats = `${c.n} pairs, agreement ${pct(c.raw)}, kappa ${c.kappa?.toFixed(2) ?? "n/a"}`;
    return c.judgeModel === JUDGE_MODEL
      ? `calibrated against a person: ${stats}`
      : `UNCALIBRATED for ${JUDGE_MODEL} (last calibration was for ${c.judgeModel}: ${stats})`;
  } catch {
    return `UNCALIBRATED: no person has checked ${JUDGE_MODEL} yet. Run \`label\` and \`calibrate\`.`;
  }
}

const pct = (v: number | null) => (v === null ? "n/a" : `${Math.round(v * 100)}%`);

async function runCompare() {
  const [beforePath, afterPath] = files;
  if (!beforePath || !afterPath) throw new Error("Name two results files: before.json after.json");
  const pairs = buildPairs(beforePath, afterPath);
  const calls = pairs.length * 2;
  console.log(`\n  ${pairs.length} pairs × 2 orders = ${calls} judge calls to ${JUDGE_MODEL}\n`);
  if (rest.includes("--dry") || pairs.length === 0) return;

  const perCriterion = new Map<CriterionId, Outcome[]>(JUDGE_CRITERIA.map((c) => [c.id, []]));
  const rows: { pair: Pair; outcome: Outcome | "unparseable" }[] = [];
  for (const pair of pairs) {
    const [one, two] = await Promise.all([
      judgePair({ scene: pair.scene, a: pair.before, b: pair.after }),
      judgePair({ scene: pair.scene, a: pair.after, b: pair.before }),
    ]);
    if (!one || !two) {
      rows.push({ pair, outcome: "unparseable" });
      continue;
    }
    rows.push({ pair, outcome: combineOrders(one.overall, two.overall) });
    for (const { id } of JUDGE_CRITERIA) {
      const x = one.criteria[id];
      const y = two.criteria[id];
      if (x && y) perCriterion.get(id)!.push(combineOrders(x, y));
    }
  }

  const judged = rows.filter((r) => r.outcome !== "unparseable") as {
    pair: Pair;
    outcome: Outcome;
  }[];
  const overall = tally(judged.map((r) => r.outcome));
  const bias = lengthBias(
    judged.map((r) => ({
      outcome: r.outcome,
      beforeLength: r.pair.before.length,
      afterLength: r.pair.after.length,
    })),
  );
  const line = (t: ReturnType<typeof tally>) =>
    `before ${t.before} · after ${t.after} · tie ${t.tie} · inconsistent ${t.inconsistent}` +
    `  (p=${t.p.toFixed(3)}${t.favours ? `, favours ${t.favours}` : ", not distinguishable from chance"})`;

  const report = [
    `Judged ${judged.length} of ${pairs.length} pairs (${rows.length - judged.length} unparseable) with ${JUDGE_MODEL}`,
    `Judge: ${calibrationStatus()}`,
    "",
    `Overall: ${line(overall)}`,
    ...JUDGE_CRITERIA.map(({ id }) => `  ${id.padEnd(12)} ${line(tally(perCriterion.get(id)!))}`),
    "",
    bias.share === null
      ? "Length: no decided pairs"
      : `Length: the longer text won ${bias.longerWon} of ${bias.decided} decided pairs (${pct(bias.share)}; 50% is no bias)`,
    "",
    "By scenario (after wins − before wins):",
    ...[...new Set(judged.map((r) => r.pair.scenario))].map((id) => {
      const t = tally(judged.filter((r) => r.pair.scenario === id).map((r) => r.outcome));
      return `  ${String(t.after - t.before).padStart(3)}  ${id}  (${t.after}–${t.before}, ${t.tie} tie, ${t.inconsistent} inconsistent)`;
    }),
  ].join("\n");
  console.log(`\n${report}\n`);

  mkdirSync(OUT, { recursive: true });
  const path = `${OUT}/${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  writeFileSync(
    path,
    JSON.stringify({ judgeModel: JUDGE_MODEL, beforePath, afterPath, report, rows }, null, 2),
  );
  console.log(`  saved: ${path}\n`);
}

function runLabel() {
  const [beforePath, afterPath] = files;
  if (!beforePath || !afterPath) throw new Error("Name two results files: before.json after.json");
  const n = Number(flag("--n") ?? 30);
  const pairs = shuffled(buildPairs(beforePath, afterPath), 20260929).slice(0, n);
  const key: LabelKey = [];
  const items = pairs.map((p, i) => {
    const flipped = shuffled([false, true], 1000 + i)[0]!;
    key.push({ id: p.id, flipped });
    return {
      id: p.id,
      scenario: p.about,
      scene: p.scene.split("== PLAYER INPUT ==")[1]?.trim() ?? p.scene.slice(-600),
      a: flipped ? p.after : p.before,
      b: flipped ? p.before : p.after,
    };
  });
  mkdirSync(OUT, { recursive: true });
  writeFileSync(`${OUT}/labels.md`, renderLabels(items));
  // The key carries the full pairs, so `calibrate` can ask the judge exactly
  // what the person was asked, in the same slots.
  writeFileSync(
    `${OUT}/labels.key.json`,
    JSON.stringify({ key, pairs: Object.fromEntries(pairs.map((p) => [p.id, p])) }, null, 2),
  );
  console.log(`\n  ${items.length} pairs written to ${OUT}/labels.md (key: labels.key.json)\n`);
}

async function runCalibrate() {
  const [labelsPath] = files;
  if (!labelsPath) throw new Error("Name the filled-in labels file");
  const labels = parseLabels(readFileSync(labelsPath, "utf8"));
  const stored = JSON.parse(readFileSync(`${OUT}/labels.key.json`, "utf8")) as {
    key: LabelKey;
    pairs: Record<string, Pair>;
  };
  const person: Side[] = [];
  const judge: Side[] = [];
  for (const { id, flipped } of stored.key) {
    const human = labels.get(id);
    const pair = stored.pairs[id];
    if (!human || !pair) continue;
    const verdict = await judgePair({
      scene: pair.scene,
      a: flipped ? pair.after : pair.before,
      b: flipped ? pair.before : pair.after,
    });
    if (!verdict) continue;
    person.push(human);
    judge.push(verdict.overall);
  }
  const stats = agreement(person, judge);
  const calibration: Calibration = {
    judgeModel: JUDGE_MODEL,
    at: new Date().toISOString(),
    n: stats.n,
    raw: stats.raw,
    kappa: stats.kappa,
  };
  mkdirSync(OUT, { recursive: true });
  writeFileSync(CALIBRATION, JSON.stringify(calibration, null, 2));
  console.log(
    `\n  ${stats.n} labelled pairs · agreement ${pct(stats.raw)} · kappa ${stats.kappa?.toFixed(2) ?? "n/a"}\n` +
      "  Kappa near 0 is chance; above about 0.4 the judge is worth reading, above 0.6 it agrees with you well.\n",
  );
}

const commands: Record<string, () => void | Promise<void>> = {
  compare: runCompare,
  label: runLabel,
  calibrate: runCalibrate,
};
const run = command ? commands[command] : undefined;
if (!run) throw new Error("Usage: bun run eval:judge <compare|label|calibrate> …");
try {
  await run();
} catch (error) {
  // One line, no links: a provider's error can carry headers and cookies.
  const message = error instanceof Error ? error.message : String(error);
  console.error(
    `\n  ${message
      .split("\n")[0]!
      .replace(/https?:\/\/\S+/g, "")
      .slice(0, 300)}\n`,
  );
  process.exit(1);
}
