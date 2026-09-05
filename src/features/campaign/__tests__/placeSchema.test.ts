import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The generated Supabase types in this repository are hand-synchronised more
 * often than they are regenerated (see AGENTS.md), and that has already cost
 * one silent outage: a transaction filtered on a column the schema did not
 * have, the type checker never read inside the SQL string, and nothing failed
 * loudly. This is the same guard encounterSchema.test.ts applies, pointed at
 * the new table.
 */
const ROOT = process.cwd();
const MIGRATION = join(ROOT, "supabase/migrations/20260904030000_campaign_places.sql");
const TYPES = join(ROOT, "src/integrations/supabase/types.ts");

function columnsInMigration(): string[] {
  const sql = readFileSync(MIGRATION, "utf8");
  const body = /CREATE TABLE public\.campaign_places \(([\s\S]*?)\n\);/.exec(sql)?.[1] ?? "";
  return body
    .split("\n")
    .map((line) => line.trim())
    .filter(
      (line) =>
        line && !line.startsWith("--") && !/^(UNIQUE|PRIMARY|CONSTRAINT|CHECK)\b/.test(line),
    )
    .map((line) => line.split(/\s+/)[0]!)
    .filter((name) => /^[a-z_]+$/.test(name));
}

function columnsInTypes(): string[] {
  const source = readFileSync(TYPES, "utf8");
  const table = source.slice(source.indexOf("      campaign_places: {"));
  const row = /Row: \{([\s\S]*?)\n {8}\}/.exec(table)?.[1] ?? "";
  return row
    .split("\n")
    .map((line) => line.trim().split(":")[0]?.trim() ?? "")
    .filter((name) => /^[a-z_]+$/.test(name));
}

describe("campaign_places", () => {
  it("has the same columns in the migration and in the generated types", () => {
    const migration = columnsInMigration().sort();
    const types = columnsInTypes().sort();
    expect(migration.length).toBeGreaterThan(5);
    expect(types).toEqual(migration);
  });

  it("is scoped by the campaign ownership helper, with RLS on", () => {
    // The route guard is not authorization. Every table in here is reached by
    // owning the campaign, and this one is no exception.
    const sql = readFileSync(MIGRATION, "utf8");
    expect(sql).toContain("ENABLE ROW LEVEL SECURITY");
    expect(sql).toContain("public.owns_campaign(campaign_id)");
    expect(sql).toContain("ON DELETE CASCADE");
    expect(sql).toContain("UNIQUE (campaign_id, place_key)");
  });
});
