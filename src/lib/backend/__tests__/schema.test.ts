import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Migrations that exist against migrations somebody has accounted for.
 *
 * A file in supabase/migrations is a file somebody wrote. It is not a change to
 * the database until somebody applies it, and nothing in the repository knew the
 * difference — the convention was a commit message no test could read.
 *
 * That shipped a real bug. 20260906090000_character_home_place.sql was committed
 * and never applied, so character_finance had no home_place_key column: saving a
 * character silently dropped their address, reading it back failed, the failure
 * was swallowed, and every new character woke up at the atlas default whatever
 * district they had chosen. The whole suite stayed green, because every test ran
 * against code and none against the database.
 *
 * This cannot check the database — there is none here. What it can do is make an
 * unaccounted-for migration fail, which turns "somebody has to remember" into
 * "somebody has to decide".
 */

const MIGRATIONS = join(process.cwd(), "supabase", "migrations");
const LEDGER = join(MIGRATIONS, "APPLIED.md");

function migrationFiles(): string[] {
  return readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith(".sql"))
    .sort();
}

function ledgerEntries(): string[] {
  const text = readFileSync(LEDGER, "utf8");
  return [...text.matchAll(/^- `([^`]+\.sql)`/gm)].map((m) => m[1]!);
}

describe("every migration is accounted for", () => {
  it("lists each migration on disk in APPLIED.md", () => {
    const missing = migrationFiles().filter((f) => !ledgerEntries().includes(f));
    expect(
      missing,
      "these migrations exist but nobody has said whether they were applied — " +
        "run them, then add them to supabase/migrations/APPLIED.md",
    ).toEqual([]);
  });

  it("names no migration that is not on disk", () => {
    // The other direction: a line left behind after a file was renamed or
    // removed is a record of something that is no longer true.
    const files = new Set(migrationFiles());
    const ghosts = ledgerEntries().filter((f) => !files.has(f));
    expect(ghosts, "APPLIED.md names migrations that do not exist").toEqual([]);
  });

  it("has an entry for every migration exactly once", () => {
    const entries = ledgerEntries();
    const seen = new Set<string>();
    const duplicates = entries.filter((f) => !seen.add(f) || false);
    expect(duplicates).toEqual([]);
    expect(entries.length).toBe(migrationFiles().length);
  });
});

/**
 * The columns the app reads by name, against the migrations that create them.
 *
 * Narrower than it looks and deliberately so: this only checks that some
 * migration mentions the column, which is not the same as the database having
 * it. It would not have caught the bug above on its own. What it catches is the
 * other half — code that reads a column no migration ever creates, which is the
 * same class of mistake pointed the other way.
 */
describe("columns the app reads exist in a migration", () => {
  const sql = migrationFiles()
    .map((f) => readFileSync(join(MIGRATIONS, f), "utf8"))
    .join("\n");

  it("creates the home columns the campaign start depends on", () => {
    for (const column of ["home_place_key", "home_district_key"]) {
      expect(sql, `no migration creates ${column}`).toContain(column);
    }
  });

  it("creates the campaign columns the atlas depends on", () => {
    for (const column of ["location_key", "known_places"]) {
      expect(sql, `no migration creates ${column}`).toContain(column);
    }
  });
});
