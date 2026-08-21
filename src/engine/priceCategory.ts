/**
 * Price Category context, parsed out of src/data/rules/roles.json.
 *
 * Nothing here is typed by hand: the ladder, the Tech Maker DV/time table, and
 * the Fixer Operator Reach ranks are all read from the rules file. If a value
 * is missing from the file, the helper returns null rather than guessing.
 */
import rolesData from "@/data/rules/roles.json";

type RoleAbility = { mechanicalText?: string };
type Role = { roleAbility?: RoleAbility };

const ROLES = (rolesData as unknown as { roles: Record<string, Role> }).roles;

const TECH_TEXT = ROLES["tech"]?.roleAbility?.mechanicalText ?? "";
const FIXER_TEXT = ROLES["fixer"]?.roleAbility?.mechanicalText ?? "";

export type PriceCategoryContext = {
  /** Canonical category name as printed in the rules text. */
  label: string;
  /** Tech Maker DV to upgrade / fabricate / invent at this category. */
  techDV: number;
  /** Time the Maker table gives for that work. */
  techTime: string;
  /** Lowest Fixer Operator Rank that can always source this category, if stated. */
  fixerRank: number | null;
};

/** "Cheap/Everyday DV9, 1 hour; Costly DV13, 6 hours; ..." */
const makerTable: { labels: string[]; dv: number; time: string }[] = (() => {
  const start = TECH_TEXT.indexOf("DV & Time by cost:");
  if (start === -1) return [];
  const tail = TECH_TEXT.slice(start + "DV & Time by cost:".length);
  const end = tail.indexOf(".\n") === -1 ? tail.length : tail.indexOf(".\n");
  return tail
    .slice(0, end)
    .split(";")
    .map((segment) => {
      const match = /^\s*(.+?)\s+DV(\d+),\s*(.+?)\.?\s*$/.exec(segment);
      if (!match) return null;
      return {
        labels: (match[1] ?? "").split("/").map((s) => s.trim()),
        dv: Number(match[2]),
        time: (match[3] ?? "").trim(),
      };
    })
    .filter((row): row is { labels: string[]; dv: number; time: string } => row !== null);
})();

/** Category ladder, cheapest first, in the order the Maker table prints them. */
const LADDER: string[] = makerTable.flatMap((row) => row.labels);

function normalize(category: string): string {
  const trimmed = category.trim().toLowerCase().replace(/\./g, "");
  return trimmed === "v expensive" ? "very expensive" : trimmed;
}

function ladderIndex(category: string): number {
  return LADDER.findIndex((l) => normalize(l) === normalize(category));
}

/**
 * Fixer Operator Reach, per rank tier. Night Market lines are excluded: the
 * rules describe those as a temporary market, not the Fixer's standing Reach.
 */
const fixerReach: { rank: number; maxIndex: number }[] = (() => {
  const out: { rank: number; maxIndex: number }[] = [];
  // Rank tiers are written inline as "Ranks 1-2: ... Reach: ... Haggle: ...".
  const segments = FIXER_TEXT.split(/(?=Ranks?\s+\d+(?:[–—-]\d+)?:)/);
  for (const segment of segments) {
    const rankMatch = /^Ranks?\s+(\d+)/.exec(segment.trim());
    if (!rankMatch) continue;
    const reachMatch = /Reach:\s*([^\n]*?)(?:\s*Haggle:|$)/.exec(segment);
    if (!reachMatch) continue;
    const reach = (reachMatch[1] ?? "").split(";")[0] ?? "";
    if (/Night Market/i.test(reach)) continue;
    let maxIndex = -1;
    LADDER.forEach((label, index) => {
      if (new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(reach)) {
        maxIndex = Math.max(maxIndex, index);
      }
    });
    if (maxIndex >= 0) out.push({ rank: Number(rankMatch[1]), maxIndex });
  }
  return out.sort((a, b) => a.rank - b.rank);
})();

function lowestFixerRank(index: number): number | null {
  const tier = fixerReach.find((t) => t.maxIndex >= index);
  return tier ? tier.rank : null;
}

export function priceCategoryContext(category: string | null | undefined): PriceCategoryContext | null {
  if (!category) return null;
  const index = ladderIndex(category);
  if (index === -1) return null;
  const label = LADDER[index] ?? "";
  const row = makerTable.find((r) => r.labels.some((l) => normalize(l) === normalize(label)));
  if (!row) return null;
  return { label, techDV: row.dv, techTime: row.time, fixerRank: lowestFixerRank(index) };
}

/** Ordered ladder, exported for display and tests. */
export const PRICE_CATEGORY_LADDER = LADDER;
