/**
 * How long the climb takes, in awards — the pacing check ROADMAP.md owed.
 *
 *   bun run tools/pacing/climb.ts
 *
 * Pure arithmetic over the data files and the engine's own price functions, so
 * it cannot drift from what the game charges. It does NOT know how often a
 * player earns an award or how large (the GM picks printed tiers, `ipJudgement`),
 * so it prints the cost of each rung and how many awards of each printed size
 * it takes, and leaves "how many awards per hour of play" to a person at a
 * table. A number here is a price list read aloud, not a playtest.
 */
import { roleRankRaiseCost, skillRaiseCost } from "@/engine";

/** An ordinary Skill and one the sheet marks doubleCost. */
const ORDINARY = "concentration";
const DOUBLE = "autofire";
import ipAwards from "@/data/rules/ip-awards.json";
import jobTiers from "@/data/rules/job-tiers.json";

const SIZES = [20, 30, 40, 50];
const awards = (cost: number, size: number) => Math.ceil(cost / size);

function row(label: string, cost: number): string {
  return `${label.padEnd(34)}${String(cost).padStart(6)} IP   ${SIZES.map(
    (s) => `${String(awards(cost, s)).padStart(3)} @${s}`,
  ).join("  ")}`;
}

console.log("Awards needed (each award = a closed job, or seven in-world days of life)\n");
console.log(
  `${"".padEnd(34)}${"cost".padStart(6)}      ${SIZES.map((s) => `awards @${s}`).join("  ")}`,
);

console.log("\nSkills (20 IP x the new Level; doubleCost Skills twice that)");
for (const to of [1, 3, 5, 7, 10]) {
  console.log(row(`Skill ${to - 1} -> ${to}`, skillRaiseCost(ORDINARY, to)));
  console.log(row(`   ...a doubleCost Skill`, skillRaiseCost(DOUBLE, to)));
}

console.log("\nRole Ability (60 IP x the new Rank, from Rank 4)");
let running = 0;
for (let rank = 5; rank <= 10; rank += 1) {
  const cost = roleRankRaiseCost(rank);
  running += cost;
  console.log(row(`Rank ${rank - 1} -> ${rank}`, cost));
  console.log(row(`   ...cumulative from Rank 4`, running));
}

console.log("\nWhat the printed tiers award per session (ip-awards.json):");
console.log(`  ${ipAwards.tiers.map((t) => t.ip).join(", ")} IP`);

console.log("\nWork on offer (job-tiers.json) needs Reputation AND jobs finished:");
for (const t of jobTiers.tiers) {
  console.log(
    `  ${t.name.padEnd(14)} Reputation ${t.minReputation}+, ${t.minJobsFinished}+ jobs finished`,
  );
}
