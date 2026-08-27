import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CampaignEvent, CampaignFlag, CampaignNpc, Json } from "@/lib/backend";

const flags = new Map<string, Json>();
const situations: Record<string, unknown>[] = [];
const ledger: { type: string; summary: string; data: Record<string, unknown> }[] = [];
let liveEvents: CampaignEvent[] = [];
const statusWrites: { key: string; status: string }[] = [];

vi.mock("@/lib/backend", () => ({
  listCampaignFlags: vi.fn(async () =>
    [...flags.entries()].map(([flag, value]) => ({ flag, value }) as unknown as CampaignFlag),
  ),
  setCampaignFlag: vi.fn(async (_c: string, flag: string, value: Json) => {
    flags.set(flag, value);
    return { flag, value } as unknown as CampaignFlag;
  }),
  listCampaignEvents: vi.fn(async () => liveEvents),
  setSituationStatus: vi.fn(async (_c: string, key: string, status: string) => {
    statusWrites.push({ key, status });
  }),
  upsertSituations: vi.fn(async (_c: string, rows: Record<string, unknown>[]) => {
    situations.push(...rows);
    return rows;
  }),
  appendCampaignEvent: vi.fn(async (row: Record<string, unknown>) => {
    ledger.push({
      type: row["type"] as string,
      summary: row["summary"] as string,
      data: (row["data"] ?? {}) as Record<string, unknown>,
    });
    return row;
  }),
}));

const {
  GIG_TAKEN_AFTER_DAYS,
  MOVED_EVENT,
  MOVE_DUE_DAYS,
  WORLD_TICK_FLAG,
  gigsGoneCold,
  grudgeIsDue,
  peopleFor,
  runWorldTick,
  settleMoves,
  situationFor,
} = await import("../worldTick");
const { MOVE_MEANINGS, MOVE_SEVERITY } = await import("@/engine");

const MORNING = 9 * 60;

function npc(over: Partial<CampaignNpc> & { lastSeenDay?: number } = {}): CampaignNpc {
  const { lastSeenDay, ...rest } = over;
  return {
    id: "row",
    npc_id: "kiro",
    name: "Kiro Tanaka",
    disposition: 0,
    status: "alive",
    data: lastSeenDay === undefined ? {} : { lastSeenDay },
    ...rest,
  } as unknown as CampaignNpc;
}

const ev = (type: string, data: Record<string, unknown> = {}): CampaignEvent =>
  ({ type, data }) as unknown as CampaignEvent;

beforeEach(() => {
  flags.clear();
  situations.length = 0;
  ledger.length = 0;
  liveEvents = [];
  statusWrites.length = 0;
});

describe("reading the cast", () => {
  it("counts days since somebody was last dealt with", () => {
    const [person] = peopleFor([npc({ lastSeenDay: 4 })], 10, []);
    expect(person!.quietDays).toBe(6);
  });

  it("treats somebody never dealt with as waiting since day one", () => {
    const [person] = peopleFor([npc()], 12, []);
    expect(person!.quietDays).toBe(12);
  });

  it("never reports negative silence for a clock that went backwards", () => {
    const [person] = peopleFor([npc({ lastSeenDay: 20 })], 10, []);
    expect(person!.quietDays).toBe(0);
  });

  it("leaves the dead out of it", () => {
    expect(peopleFor([npc({ status: "dead" })], 10, [])).toEqual([]);
  });

  it("marks somebody whose grudge has come due", () => {
    const grudges = [{ situationKey: "grudge_kiro", dueDay: 8, status: "live" }];
    expect(peopleFor([npc()], 10, grudges)[0]!.grudgeDue).toBe(true);
  });
});

describe("grudgeIsDue", () => {
  const grudge = (over: Record<string, unknown> = {}) => [
    { situationKey: "grudge_vex", dueDay: 8, status: "live", ...over },
  ];

  it("is true once the day has arrived", () => {
    expect(grudgeIsDue("vex", grudge(), 8)).toBe(true);
    expect(grudgeIsDue("vex", grudge(), 20)).toBe(true);
  });

  it("is false before it comes due", () => {
    expect(grudgeIsDue("vex", grudge(), 7)).toBe(false);
  });

  it("is false for a grudge that has been dealt with", () => {
    expect(grudgeIsDue("vex", grudge({ status: "resolved" }), 20)).toBe(false);
  });

  it("does not confuse one person's grudge for another's", () => {
    expect(grudgeIsDue("kiro", grudge(), 20)).toBe(false);
  });

  it("ignores a situation with no due day", () => {
    expect(grudgeIsDue("vex", grudge({ dueDay: null }), 20)).toBe(false);
  });
});

describe("the situation a move produces", () => {
  const person = { key: "kiro", name: "Kiro Tanaka", disposition: 0, quietDays: 9 };

  it("says what happened and never why", () => {
    const s = situationFor(person, "asks_a_favour", 10);
    expect(s.summary).toContain(MOVE_MEANINGS.asks_a_favour);
    expect(s.summary?.toLowerCase()).not.toContain("because");
    expect(s.severity).toBe(MOVE_SEVERITY.asks_a_favour);
    expect(s.npcKey).toBe("kiro");
  });

  it("gives a debt a deadline and a favour none", () => {
    expect(situationFor(person, "calls_in_debt", 10).dueDay).toBe(10 + MOVE_DUE_DAYS);
    // A live people situation past its due day escalates on every load, so a
    // favour with a deadline would become a severity-5 emergency.
    expect(situationFor(person, "asks_a_favour", 10).dueDay).toBeNull();
  });

  it("keys on the person, so a second move replaces the first", () => {
    expect(situationFor(person, "asks_a_favour", 10).situationKey).toBe(
      situationFor(person, "moves_against", 14).situationKey,
    );
  });
});

describe("gigs somebody else took", () => {
  const declined = (title: string, day: number) =>
    ev("hook_declined", { title, day, reason: "no" });

  it("reports a job passed on long enough ago", () => {
    const events = [declined("Watson retrieval", 5)];
    expect(gigsGoneCold(events, 5 + GIG_TAKEN_AFTER_DAYS)).toEqual([
      { title: "Watson retrieval", day: 5 },
    ]);
  });

  it("says nothing while the job is still warm", () => {
    expect(gigsGoneCold([declined("Watson retrieval", 5)], 6)).toEqual([]);
  });

  it("does not report the same job twice", () => {
    const events = [
      declined("Watson retrieval", 5),
      ev(MOVED_EVENT, { gigTaken: "Watson retrieval" }),
    ];
    expect(gigsGoneCold(events, 20)).toEqual([]);
  });

  it("ignores a decline written before titles were recorded", () => {
    expect(gigsGoneCold([ev("hook_declined", { reason: "no" })], 20)).toEqual([]);
  });
});

describe("running the day", () => {
  const input = (over: Record<string, unknown> = {}) => ({
    campaignId: "c",
    day: 10,
    minute: MORNING,
    npcs: [npc({ lastSeenDay: 1 })],
    situations: [],
    ...over,
  });

  it("claims the day so it cannot be run twice", async () => {
    const first = await runWorldTick(input());
    expect(first.ran).toBe(true);
    expect(flags.get(WORLD_TICK_FLAG)).toBe(10);

    const second = await runWorldTick(input());
    expect(second.ran).toBe(false);
  });

  it("runs again once the clock reaches a new day", async () => {
    await runWorldTick(input());
    expect((await runWorldTick(input({ day: 11 }))).ran).toBe(true);
  });

  it("does not re-run a day the clock went backwards into", async () => {
    await runWorldTick(input({ day: 10 }));
    expect((await runWorldTick(input({ day: 9 }))).ran).toBe(false);
  });

  it("logs the roll even on a night nobody moves", async () => {
    // Over several days at least one must come up quiet.
    let quiet = 0;
    for (let day = 1; day <= 40; day += 1) {
      situations.length = 0;
      const out = await runWorldTick(input({ day }));
      if (out.ran && !out.personName && !out.gigTaken) quiet += 1;
    }
    expect(quiet).toBeGreaterThan(0);
    expect(ledger.filter((e) => e.type === "oracle_roll").length).toBe(40);
  });

  it("writes a situation only when somebody actually moved", async () => {
    let moved = 0;
    for (let day = 1; day <= 40; day += 1) {
      const before = situations.length;
      const out = await runWorldTick(input({ day }));
      if (out.personName) {
        moved += 1;
        expect(situations.length).toBeGreaterThan(before);
      }
    }
    expect(moved).toBeGreaterThan(0);
  });

  it("gives one person the night, never the whole cast", async () => {
    const cast = [
      npc({ id: "1", npc_id: "a", name: "A", lastSeenDay: 1 }),
      npc({ id: "2", npc_id: "b", name: "B", lastSeenDay: 1 }),
      npc({ id: "3", npc_id: "c", name: "C", lastSeenDay: 1 }),
    ];
    for (let day = 1; day <= 30; day += 1) {
      situations.length = 0;
      await runWorldTick(input({ day, npcs: cast }));
      const moves = situations.filter((s) => String(s["situationKey"]).startsWith("moved_"));
      expect(moves.length).toBeLessThanOrEqual(1);
    }
  });

  it("tells the player somebody else took the job they passed on", async () => {
    liveEvents = [ev("hook_declined", { title: "Watson retrieval", day: 1, reason: "no" })];
    const out = await runWorldTick(input({ day: 10 }));
    expect(out.gigTaken).toBe("Watson retrieval");
    expect(situations.some((s) => String(s["situationKey"]).startsWith("gig_taken_"))).toBe(true);
    expect(ledger.some((e) => e.type === MOVED_EVENT)).toBe(true);
  });

  it("mentions one cold gig, not a news bulletin of three", async () => {
    liveEvents = [
      ev("hook_declined", { title: "One", day: 1, reason: "no" }),
      ev("hook_declined", { title: "Two", day: 1, reason: "no" }),
      ev("hook_declined", { title: "Three", day: 1, reason: "no" }),
    ];
    await runWorldTick(input({ day: 10 }));
    expect(
      situations.filter((s) => String(s["situationKey"]).startsWith("gig_taken_")),
    ).toHaveLength(1);
  });

  it("writes no ledger line at all on a night with nothing in it", async () => {
    // Nobody has a reason to move and no gigs are cold.
    const seen = [npc({ lastSeenDay: 10 })];
    for (let day = 10; day <= 12; day += 1) {
      await runWorldTick(input({ day, npcs: seen }));
    }
    expect(ledger.filter((e) => e.type === MOVED_EVENT)).toHaveLength(0);
  });
});

describe("taking a move off the board", () => {
  it("resolves the move and the grudge when the player deals with somebody", async () => {
    await settleMoves("c", "vex");
    expect(statusWrites).toEqual([
      { key: "moved_vex", status: "resolved" },
      { key: "grudge_vex", status: "resolved" },
    ]);
  });

  it("resolves a grudge the moment it actually arrives", async () => {
    const grudges = [{ situationKey: "grudge_kiro", dueDay: 1, status: "live" }];
    // A due grudge outscores everything, so the only variable is the die.
    let arrived = false;
    for (let day = 2; day <= 40 && !arrived; day += 1) {
      statusWrites.length = 0;
      const out = await runWorldTick({
        campaignId: "c",
        day,
        minute: 3 * 60,
        npcs: [npc({ lastSeenDay: 1 })],
        situations: grudges,
      });
      if (out.personName) {
        arrived = true;
        expect(out.move).toBe("comes_looking");
        // Left live it would escalate forever AND win every future night.
        expect(statusWrites).toContainEqual({ key: "grudge_kiro", status: "resolved" });
      }
    }
    expect(arrived).toBe(true);
  });

  it("does not touch a grudge on a night that person did not move", async () => {
    await runWorldTick({
      campaignId: "c",
      day: 10,
      minute: 9 * 60,
      npcs: [npc({ lastSeenDay: 10 })],
      situations: [],
    });
    expect(statusWrites).toEqual([]);
  });
});
