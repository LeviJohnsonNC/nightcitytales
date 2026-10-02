/**
 * Improvement Points over "everything since the last award".
 *
 * Two halves. The pure helpers in `ipAward.ts` — where the window opens, what
 * the judge reads, how many rolls it saw — and the contract with
 * `award_improvement_points`, whose payload is read inside a SQL string that the
 * type checker never sees. The second reads the newest definition of the
 * function and holds the keys it reads to `AwardImprovementPointsPayload`, the
 * same way `skillRaised.test.ts` holds `spend_ip_on_skill`.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { ipAwardedEventData } from "@/engine";
import type { AwardImprovementPointsPayload, CampaignEvent } from "@/lib/backend";

// The judgement is a paid server call; nothing here makes one.
vi.mock("@/features/gm/ipJudgement.server", () => ({ ipJudgementFn: vi.fn() }));

const { judgementLog, lastAwardFrom, rollsIn } = await import("../ipAward");

let seq = 0;
function event(type: string, summary: string | null, data: unknown = {}): CampaignEvent {
  seq += 1;
  return {
    id: `e${seq}`,
    campaign_id: "c",
    seq,
    type,
    summary,
    data,
    beat_id: null,
    roll: null,
    created_at: "2026-10-02T00:00:00Z",
  } as CampaignEvent;
}

describe("lastAwardFrom", () => {
  it("opens the first window at the campaign's start", () => {
    expect(lastAwardFrom(null)).toEqual({ seq: null, day: null, playstyles: null });
  });

  it("carries the award's seq, day and the playstyles declared", () => {
    const e = event(
      "ip_awarded",
      "30 I.P.",
      ipAwardedEventData({
        award: { ip: 30, source: "explorer", descriptor: "", fromStandout: false },
        judgement: {},
        playstyles: { primary: "explorer", secondary: "roleplayer" },
        kind: "life",
        day: 22,
      }),
    );
    expect(lastAwardFrom(e)).toEqual({
      seq: e.seq,
      day: 22,
      playstyles: { primary: "explorer", secondary: "roleplayer" },
    });
  });

  it("drops a declared playstyle the table does not print", () => {
    const e = event("ip_awarded", "x", {
      award: { ip: 10, source: "group" },
      playstyles: { primary: "hacker", secondary: "warrior" },
    });
    expect(lastAwardFrom(e).playstyles).toBeNull();
  });
});

describe("what the judge reads", () => {
  const window = [
    event("life_narration", "Rent day. Kiro does not pick up."),
    event("skill_check", "Persuasion vs DV 15: success"),
    event("encounter_state", null),
    event("attack", "Handgun → ganger: hit"),
    event("life_narration", "   "),
  ];

  it("is one line per event that says something, oldest first", () => {
    expect(judgementLog(window, false)).toEqual([
      "[life_narration] Rent day. Kiro does not pick up.",
      "[skill_check] Persuasion vs DV 15: success",
      "[attack] Handgun → ganger: hit",
    ]);
  });

  it("says so when the old end of a long stretch was cut", () => {
    expect(judgementLog(window, true)[0]).toMatch(/not shown/);
  });

  it("counts checks and attacks, all of them", () => {
    expect(rollsIn(window)).toBe(2);
    const many = Array.from({ length: 30 }, () => event("skill_check", "x"));
    expect(rollsIn(many)).toBe(30);
  });
});

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

describe("award_improvement_points reads the payload the client sends", () => {
  // Every key of the type, so renaming one there is a type error here.
  const sent: Record<keyof AwardImprovementPointsPayload, true> = {
    campaign_id: true,
    kind: true,
    ip: true,
    summary: true,
    data: true,
    expected_last_award_seq: true,
  };

  it("reads exactly those keys", () => {
    const body = newestDefinitionOf("award_improvement_points");
    const read = new Set([...body.matchAll(/payload\s*->>?\s*'([a-z_]+)'/g)].map((m) => m[1]));
    expect([...read].sort()).toEqual(Object.keys(sent).sort());
  });

  it("writes the award as the ledger type the engine reads back", () => {
    expect(newestDefinitionOf("award_improvement_points")).toContain("'ip_awarded'");
  });
});
