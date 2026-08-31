/**
 * Does the transaction write columns that actually exist?
 *
 * `save_encounter_state` filtered its combatant UPDATE on
 * `encounter_combatants.campaign_id` for weeks. There is no such column: the
 * table is created twice in the migration history and the later definition —
 * the one that exists, and the one the generated types agree with — does not
 * have it. Every encounter save raised `column "campaign_id" does not exist`,
 * so no fight could persist movement, damage, hostile turns or its own ending.
 *
 * Nothing caught it. The engine tests pass because the engine is pure, the type
 * checker never sees inside a SQL string, and CI has no database. The only two
 * artefacts that could have disagreed out loud are the migration and the
 * generated types, and nothing compared them.
 *
 * So this compares them. It reads the NEWEST definition of the function out of
 * the migrations, pulls the column names it writes and filters on, and checks
 * each one against the row types generated from the deployed schema. It is
 * deliberately loud when it cannot find what it expects: a guard that silently
 * passes when the SQL is restructured is not a guard.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const MIGRATIONS = join(ROOT, "supabase/migrations");
const TYPES = join(ROOT, "src/integrations/supabase/types.ts");

/** The last migration that defines this function — the one that is deployed. */
function newestDefinitionOf(fn: string): string {
  const files = readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  let body: string | null = null;
  for (const file of files) {
    const sql = readFileSync(join(MIGRATIONS, file), "utf8");
    const start = sql.indexOf(`CREATE OR REPLACE FUNCTION public.${fn}`);
    if (start === -1) continue;
    const end = sql.indexOf("$$;", start);
    if (end === -1) continue;
    body = sql.slice(start, end);
  }
  if (!body) throw new Error(`No migration defines ${fn}.`);
  return body;
}

/**
 * Every column name the function assigns or filters on for a table.
 *
 * Reads ALL of the table's UPDATE statements, not the first: campaign_inventory
 * is written three times (head armour, body armour, ammunition) and each one
 * names different columns.
 *
 * An identifier counts when it sits immediately after SET, a comma, WHERE or
 * AND and is followed by `=`. That is precisely the set of assignments and
 * predicates, and it excludes the `v_entry->>'...'` JSON keys on the right-hand
 * side, which are payload fields rather than columns. Anchoring to the start of
 * a line instead — which is what this did first — silently missed every
 * predicate written mid-line, which is most of them.
 */
function columnsUpdated(body: string, table: string): string[] {
  const marker = `UPDATE public.${table} SET`;
  const found: string[] = [];
  let from = 0;
  let statements = 0;
  for (;;) {
    const start = body.indexOf(marker, from);
    if (start === -1) break;
    const end = body.indexOf(";", start);
    if (end === -1) throw new Error(`Unterminated UPDATE of ${table}.`);
    const statement = body.slice(start, end);
    statements += 1;
    from = end;
    for (const match of statement.matchAll(/(?:\bSET\b|\bWHERE\b|\bAND\b|,)\s*([a-z_]+)\s*=/gi)) {
      found.push(match[1]!.toLowerCase());
    }
  }
  if (statements === 0) throw new Error(`No "UPDATE public.${table} SET" in the function body.`);
  if (found.length === 0) throw new Error(`Parsed no columns out of the ${table} UPDATEs.`);
  return [...new Set(found)];
}

/** The column names of a table, as generated from the deployed database. */
function generatedColumns(table: string): string[] {
  const types = readFileSync(TYPES, "utf8");
  const start = types.indexOf(`      ${table}: {`);
  if (start === -1) throw new Error(`${table} is not in the generated types.`);
  const rowAt = types.indexOf("Row: {", start);
  const rowEnd = types.indexOf("}", rowAt);
  if (rowAt === -1 || rowEnd === -1) throw new Error(`No Row block for ${table}.`);
  const found = [...types.slice(rowAt, rowEnd).matchAll(/^\s*([a-z_]+)\??:/gm)].map((m) => m[1]!);
  if (found.length === 0) throw new Error(`Parsed no columns out of the ${table} Row type.`);
  return found;
}

describe("save_encounter_state writes columns that exist", () => {
  const body = newestDefinitionOf("save_encounter_state");

  // Every table the transaction UPDATEs. Each one is a chance to name a column
  // the deployed schema does not have, and the failure is invisible until a
  // player is standing on a battlefield that will not save.
  for (const table of ["encounter_combatants", "campaign_vitals", "campaign_inventory"]) {
    it(`only touches real columns on ${table}`, () => {
      const used = columnsUpdated(body, table);
      const real = generatedColumns(table);
      const missing = used.filter((c) => !real.includes(c));
      expect(missing).toEqual([]);
    });
  }

  it("does not scope combatants by a campaign_id they do not have", () => {
    // The specific regression, named so a reintroduction reads as itself rather
    // than as an anonymous column that went missing.
    expect(columnsUpdated(body, "encounter_combatants")).not.toContain("campaign_id");
  });

  it("still scopes the vitals and the kit by campaign, where the column is real", () => {
    // The fix removed one redundant predicate, not the scoping that matters.
    expect(columnsUpdated(body, "campaign_vitals")).toContain("campaign_id");
    expect(columnsUpdated(body, "campaign_inventory")).toContain("campaign_id");
  });

  it("reads the newest definition, not an older one that was superseded", () => {
    // The function is defined in several migrations; a guard reading the first
    // would check a version nobody runs.
    expect(body).toContain("version = v_version + 1");
  });
});
