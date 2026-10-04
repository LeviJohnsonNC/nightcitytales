/**
 * The career soak, as a report.
 *
 *   bun run tools/pacing/soak.ts            # the default sweep
 *   bun run tools/pacing/soak.ts --careers 2000 --horizon 365
 *
 * Plays careers through the engine (`src/features/dev/careerSim.ts`) under
 * stated playstyles and job cadences, and prints how long the climb takes, whether
 * the money holds, and any invariant a career broke. Read the header of the sim
 * before trusting a number: the playstyles and cadences are assumptions, and it
 * plays no combat, so it says nothing about death.
 */
import { JOB_TIERS, startingLifestylePlan, ROLE_OPENING_IDS } from "@/engine";
import { PLAYSTYLES, sweep, type SweepRow } from "@/features/dev/careerSim";

const arg = (name: string, fallback: number): number => {
  const i = process.argv.indexOf(`--${name}`);
  const v = i >= 0 ? Number(process.argv[i + 1]) : NaN;
  return Number.isFinite(v) ? v : fallback;
};
const CAREERS = arg("careers", 100);
const HORIZON = arg("horizon", 180);
const START_EB = arg("start", 500);

const day = (r: { median: number | null; reached: number }): string =>
  r.reached === 0
    ? "never"
    : `d${Math.round(r.median ?? 0)}${r.reached < 1 ? ` (${Math.round(r.reached * 100)}%)` : ""}`;
const eb = (n: number | null): string => (n === null ? "-" : `${Math.round(n)}`);
const pct = (n: number): string => `${Math.round(n * 100)}%`;

function print(rows: SweepRow[]): void {
  console.log(
    [
      "style".padEnd(8),
      "jobs/".padEnd(6),
      "steady".padEnd(12),
      "serious".padEnd(12),
      "rank5".padEnd(12),
      "1st raise".padEnd(10),
      "behind".padEnd(7),
      "eb@1/3".padStart(8),
      "eb@end".padStart(8),
      "rep".padStart(4),
      "jobs".padStart(5),
      "skills".padStart(7),
      "rank".padStart(5),
    ].join(" "),
  );
  for (const r of rows) {
    console.log(
      [
        r.playstyle.padEnd(8),
        `${r.daysBetweenJobs}d`.padEnd(6),
        day(r.steady).padEnd(12),
        day(r.serious).padEnd(12),
        day(r.rank5).padEnd(12),
        day(r.skillRaise).padEnd(10),
        pct(r.everBehind).padEnd(7),
        eb(r.midEb).padStart(8),
        eb(r.endEb).padStart(8),
        String(r.endReputation ?? "-").padStart(4),
        String(r.endJobs ?? "-").padStart(5),
        String(r.endSkillLevels ?? "-").padStart(7),
        String(r.endRank ?? "-").padStart(5),
      ].join(" "),
    );
  }
}

console.log(
  `Career soak — ${CAREERS} careers a row, ${HORIZON} days, ${START_EB}eb to start, every Role evenly.\n` +
    "Jobs turn up every N days; I.P. is saved for the Role Rank (second table: Skills). No combat, no\n" +
    "ammunition, no doctor:\n" +
    "money out is rent and Lifestyle only, so surpluses are upper bounds.\n",
);

console.log("What the bills are (monthly, from the printed rents and Lifestyles):");
const seen = new Map<string, string>();
for (const id of ROLE_OPENING_IDS) {
  const p = startingLifestylePlan(id);
  const key = `${p.rent + p.lifestyleCost}eb (rent ${p.rent} + lifestyle ${p.lifestyleCost})`;
  seen.set(key, `${seen.get(key) ?? ""}${seen.get(key) ? ", " : ""}${id}`);
}
for (const [k, roles] of seen) console.log(`  ${k}: ${roles}`);
console.log("");

const rows: SweepRow[] = [];
const violations: string[] = [];
const fees = JOB_TIERS.map(() => [] as number[]);
for (const style of PLAYSTYLES) {
  for (const every of [4, 7, 14]) {
    const { row, careers } = sweep({
      playstyle: style,
      daysBetweenJobs: every,
      startingEb: START_EB,
      spend: "rank",
      careers: CAREERS,
      horizon: HORIZON,
    });
    rows.push(row);
    for (const c of careers) {
      for (const v of c.violations) violations.push(`${style.id}/${every}d ${v}`);
      c.fees.forEach((list, i) => fees[i]!.push(...list));
    }
  }
}
print(rows);

console.log("\nWhat a job pays at each tier (printed total: upfront + per head, one head):");
JOB_TIERS.forEach((tier, i) => {
  const list = fees[i]!;
  if (!list.length) return console.log(`  ${tier.name}: never offered`);
  const mean = list.reduce((a, b) => a + b, 0) / list.length;
  console.log(`  ${tier.name.padEnd(14)} ${Math.round(mean)}eb mean over ${list.length} offers`);
});

const bills = 1100;
console.log(
  `\nWhat a month's bills (${bills}eb) ask of the work, from those fees:\n` +
    JOB_TIERS.map((tier, i) => {
      const list = fees[i]!;
      if (!list.length) return null;
      const mean = (list.reduce((a, b) => a + b, 0) / list.length) * 0.89; // after short/marked pay
      const surplus = (every: number) => Math.round(mean - bills / (30 / every));
      return (
        `  ${tier.name.padEnd(14)} jobs a month to break even: ${(bills / mean).toFixed(1)}; ` +
        `left per job for kit and chrome at a job every 4/7/14 days: ` +
        `${surplus(4)} / ${surplus(7)} / ${surplus(14)}eb`
      );
    })
      .filter(Boolean)
      .join("\n"),
);

console.log("\nI.P. policy, at a job every 7 days (ghost / pro / brawler):");
const policyRows: SweepRow[] = [];
for (const style of PLAYSTYLES) {
  policyRows.push(
    sweep({
      playstyle: style,
      daysBetweenJobs: 7,
      startingEb: START_EB,
      spend: "skills",
      careers: CAREERS,
      horizon: HORIZON,
    }).row,
  );
}
print(policyRows);

console.log(
  `\nInvariants: ${violations.length === 0 ? "none broken" : `${violations.length} BROKEN`}`,
);
for (const v of violations.slice(0, 10)) console.log(`  ${v}`);
process.exit(violations.length === 0 ? 0 : 1);
