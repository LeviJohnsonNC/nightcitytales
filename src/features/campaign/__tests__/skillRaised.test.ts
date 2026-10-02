/**
 * Does the database write the `skill_raised` payload the engine reads?
 *
 * The writer is SQL — `spend_ip_on_skill` appends the event inside the same
 * transaction that moves the Level — so the usual ledger guarantee (a builder
 * in `engine/ledger.ts`, a rename that is a type error) cannot reach it. The
 * type checker never reads inside a SQL string. This reads the newest
 * definition of the function out of the migrations instead, and holds the keys
 * it spells to `SKILL_RAISED_KEYS`, the same way `encounterSchema.test.ts`
 * holds `save_encounter_state` to the generated row types.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { LEDGER_EVENTS, readSkillRaisedEventData, SKILL_RAISED_KEYS } from "@/engine";

const MIGRATIONS = join(process.cwd(), "supabase/migrations");

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

/** The INSERT into the ledger, from its first line to the end of the statement. */
function ledgerInsert(body: string): string {
  const start = body.indexOf("INSERT INTO public.campaign_events");
  if (start === -1) throw new Error("spend_ip_on_skill no longer writes to campaign_events.");
  const end = body.indexOf(");\n", start);
  return body.slice(start, end);
}

describe("spend_ip_on_skill's ledger event", () => {
  const insert = ledgerInsert(newestDefinitionOf("spend_ip_on_skill"));

  it("is the event type the engine names", () => {
    expect(insert).toContain(`'${LEDGER_EVENTS.skillRaised}'`);
  });

  it("spells exactly the keys the reader parses, in order", () => {
    const build = insert.slice(insert.indexOf("jsonb_build_object("));
    const keys = [...build.matchAll(/^\s*'([a-z_]+)',/gm)].map((m) => m[1]);
    expect(keys).toEqual([...SKILL_RAISED_KEYS]);
  });
});

describe("readSkillRaisedEventData", () => {
  // The shape jsonb_build_object produces, null specialization and all.
  const written = {
    skill_id: "handgun",
    specialization: null,
    from_level: 6,
    to_level: 7,
    cost: 140,
  };

  it("reads what the database writes", () => {
    expect(readSkillRaisedEventData(written)).toEqual({
      skillId: "handgun",
      specialization: null,
      fromLevel: 6,
      toLevel: 7,
      cost: 140,
    });
  });

  it("keeps a repeatable Skill's specialization", () => {
    expect(
      readSkillRaisedEventData({ ...written, skill_id: "local_expert", specialization: "watson" })
        ?.specialization,
    ).toBe("watson");
  });

  it("refuses a payload the function could not have written", () => {
    expect(readSkillRaisedEventData({ ...written, to_level: 9 })).toBeNull();
    expect(readSkillRaisedEventData({ ...written, cost: "140" })).toBeNull();
    expect(readSkillRaisedEventData({ skillId: "handgun" })).toBeNull();
    expect(readSkillRaisedEventData(null)).toBeNull();
    expect(readSkillRaisedEventData([written])).toBeNull();
  });
});
