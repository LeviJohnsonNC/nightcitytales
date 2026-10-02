/**
 * Does the database write the `role_rank_raised` payload the engine reads, and
 * hold the same ceiling the engine prices to?
 *
 * The twin of `skillRaised.test.ts`: `spend_ip_on_role_rank` is the writer, and
 * the type checker never reads inside its SQL string.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  LEDGER_EVENTS,
  readRoleRankRaisedEventData,
  ROLE_RANK_MAX,
  ROLE_RANK_RAISED_KEYS,
} from "@/engine";

/** The last migration that defines this function — the one that is deployed. */
function newestDefinitionOf(fn: string): string {
  const dir = join(process.cwd(), "supabase/migrations");
  let body: string | null = null;
  for (const file of readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort()) {
    const sql = readFileSync(join(dir, file), "utf8");
    const start = sql.indexOf(`CREATE OR REPLACE FUNCTION public.${fn}`);
    if (start === -1) continue;
    const end = sql.indexOf("$$;", start);
    if (end !== -1) body = sql.slice(start, end);
  }
  if (!body) throw new Error(`No migration defines ${fn}.`);
  return body;
}

describe("spend_ip_on_role_rank", () => {
  const body = newestDefinitionOf("spend_ip_on_role_rank");
  const insert = body.slice(body.indexOf("INSERT INTO public.campaign_events"));

  it("writes the event type the engine names", () => {
    expect(insert).toContain(`'${LEDGER_EVENTS.roleRankRaised}'`);
  });

  it("spells exactly the keys the reader parses, in order", () => {
    const build = insert.slice(insert.indexOf("jsonb_build_object("));
    const keys = [...build.matchAll(/^\s*'([a-z_]+)',/gm)].map((m) => m[1]);
    expect(keys).toEqual([...ROLE_RANK_RAISED_KEYS]);
  });

  it("refuses above the same ceiling the engine prices to", () => {
    expect(body).toContain(`p_new_rank > ${ROLE_RANK_MAX}`);
  });
});

describe("readRoleRankRaisedEventData", () => {
  const written = { ability_id: "combat_awareness", from_rank: 4, to_rank: 5, cost: 300 };

  it("reads what the database writes", () => {
    expect(readRoleRankRaisedEventData(written)).toEqual({
      abilityId: "combat_awareness",
      fromRank: 4,
      toRank: 5,
      cost: 300,
    });
  });

  it("refuses a payload the function could not have written", () => {
    expect(readRoleRankRaisedEventData({ ...written, to_rank: 7 })).toBeNull();
    expect(readRoleRankRaisedEventData({ ...written, cost: "300" })).toBeNull();
    expect(readRoleRankRaisedEventData(null)).toBeNull();
  });
});
