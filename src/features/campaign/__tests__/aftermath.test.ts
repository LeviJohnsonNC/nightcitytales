import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CampaignEvent, CampaignInventoryItem, CampaignNpc, Json } from "@/lib/backend";

const npcs: CampaignNpc[] = [];
const situations: Record<string, unknown>[] = [];
const ledger: { type: string; summary: string; data: Record<string, unknown> }[] = [];
/** What listCampaignEvents hands back, so the settle-once guard can be tested. */
let liveEvents: CampaignEvent[] = [];
const flags = new Map<string, Json>();

vi.mock("@/lib/backend", () => ({
  EVENT_WINDOW: 200,
  listCampaignFlags: vi.fn(async () =>
    [...flags.entries()].map(([flag, value]) => ({ flag, value })),
  ),
  setCampaignFlag: vi.fn(async (_c: string, flag: string, value: Json) => {
    flags.set(flag, value);
    return { flag, value };
  }),
  findCampaignNpc: vi.fn(
    async (_c: string, key: string) => npcs.find((n) => n.npc_id === key) ?? null,
  ),
  saveCampaignNpc: vi.fn(async (_c: string, key: string, patch: { name?: string; data?: Json }) => {
    const existing = npcs.find((n) => n.npc_id === key);
    if (existing) return existing;
    const row = {
      id: `npc-${npcs.length}`,
      npc_id: key,
      name: patch.name ?? key,
      disposition: 0,
      status: "alive",
      data: patch.data ?? {},
    } as unknown as CampaignNpc;
    npcs.push(row);
    return row;
  }),
  setNpcDisposition: vi.fn(async (id: string, disposition: number) => {
    const row = npcs.find((n) => n.id === id);
    if (row) (row as { disposition: number }).disposition = disposition;
    return row;
  }),
  upsertSituations: vi.fn(async (_c: string, rows: Record<string, unknown>[]) => {
    situations.push(...rows);
    return rows;
  }),
  listCampaignEvents: vi.fn(async () => liveEvents),
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
  GRUDGE_DUE_DAYS,
  SETTLEMENT_EVENT,
  SURVIVOR_DISPOSITION,
  alreadySettled,
  brokerKeyFor,
  scarsFor,
  settleAftermath,
  survivorKey,
} = await import("../aftermath");

const PLAYER = "Vela Ruiz";
const ev = (type: string, data: Record<string, unknown> = {}): CampaignEvent =>
  ({ type, data }) as unknown as CampaignEvent;
const hit = (target: string) =>
  ev("attack", { attacker: PLAYER, target, hit: true, through_armor: 6 });
const died = (name: string) => ev("death_save", { combatant: name, died: true });

/** Settlement reads the live ledger, so the fixture drives that. */
function withLedger(events: CampaignEvent[]) {
  liveEvents = events;
}

function input(over: Partial<Parameters<typeof settleAftermath>[0]> = {}) {
  return {
    campaignId: "c",
    playerName: PLAYER,
    agreed: 1000,
    messy: false,
    day: 10,
    inventory: [] as CampaignInventoryItem[],
    ...over,
  };
}

beforeEach(() => {
  npcs.length = 0;
  situations.length = 0;
  ledger.length = 0;
  liveEvents = [];
  flags.clear();
});

describe("survivorKey", () => {
  it("makes a stable key out of a name", () => {
    expect(survivorKey("Vex")).toBe("vex");
    expect(survivorKey("Kiro Tanaka")).toBe("kiro_tanaka");
    expect(survivorKey("  Royce!  ")).toBe("royce");
  });

  it("never produces an empty key", () => {
    expect(survivorKey("!!!")).toBe("survivor");
  });
});

describe("promoting survivors", () => {
  it("turns somebody who walked away into an NPC who remembers", async () => {
    const events = [ev("mission_started"), hit("Vex")];
    withLedger(events);
    const report = (await settleAftermath(input(), { current: 30, max: 30 }))!;
    expect(report.survivors).toEqual(["Vex"]);
    expect(npcs).toHaveLength(1);
    expect(npcs[0]).toMatchObject({
      npc_id: "vex",
      name: "Vex",
      disposition: SURVIVOR_DISPOSITION,
    });
  });

  it("does not promote the dead", async () => {
    const events = [ev("mission_started"), hit("Vex"), died("Vex")];
    withLedger(events);
    const report = (await settleAftermath(input(), { current: 30, max: 30 }))!;
    expect(report.survivors).toEqual([]);
    expect(npcs).toHaveLength(0);
  });

  it("does not promote a job description", async () => {
    const events = [ev("mission_started"), hit("Guard"), hit("Ganger 2")];
    withLedger(events);
    const report = (await settleAftermath(input(), { current: 30, max: 30 }))!;
    expect(report.survivors).toEqual([]);
  });

  it("makes somebody the campaign already knows angrier rather than resetting them", async () => {
    npcs.push({
      id: "npc-existing",
      npc_id: "vex",
      name: "Vex",
      disposition: 1,
      status: "alive",
      data: {},
    } as unknown as CampaignNpc);
    const events = [ev("mission_started"), hit("Vex")];
    withLedger(events);
    await settleAftermath(input(), { current: 30, max: 30 });
    expect(npcs).toHaveLength(1);
    expect(npcs[0]!.disposition).toBe(0);
  });
});

describe("scars written into Life", () => {
  it("gives a grudge a day it comes due on", () => {
    const scars = scarsFor(input(), ["Vex"], { current: 30, max: 30 });
    const grudge = scars.find((s) => s.situationKey === "grudge_vex")!;
    expect(grudge).toMatchObject({
      category: "pressure",
      npcKey: "vex",
      dueDay: 10 + GRUDGE_DUE_DAYS,
    });
  });

  it("notices the character came back hurt", () => {
    const scars = scarsFor(input(), [], { current: 10, max: 40 });
    const wounds = scars.find((s) => s.situationKey === "aftermath_wounds")!;
    expect(wounds.category).toBe("need");
    expect(wounds.summary).toContain("10/40");
  });

  it("says nothing about a scratch", () => {
    expect(scarsFor(input(), [], { current: 38, max: 40 })).toEqual([]);
  });

  it("takes a bad wound more seriously than a bad day", () => {
    const bad = scarsFor(input(), [], { current: 5, max: 40 })[0]!;
    const worse = scarsFor(input(), [], { current: 19, max: 40 })[0]!;
    expect(bad.severity!).toBeGreaterThan(worse.severity!);
  });

  it("notices armor ablated to nothing", () => {
    const chewed = [
      { current_sp: 0, equipped: true },
      { current_sp: 7, equipped: true },
    ] as unknown as CampaignInventoryItem[];
    const scars = scarsFor(input({ inventory: chewed }), [], { current: 40, max: 40 });
    expect(scars.find((s) => s.situationKey === "aftermath_armor")).toBeTruthy();
  });

  it("ignores armor that is only dented, and armor in the bag", () => {
    const fine = [
      { current_sp: 4, equipped: true },
      { current_sp: 0, equipped: false },
    ] as unknown as CampaignInventoryItem[];
    expect(scarsFor(input({ inventory: fine }), [], { current: 40, max: 40 })).toEqual([]);
  });

  it("survives a campaign with no hp_max without dividing by nothing", () => {
    expect(() => scarsFor(input(), [], { current: 0, max: 0 })).not.toThrow();
    expect(scarsFor(input(), [], { current: 0, max: 0 })).toEqual([]);
  });
});

describe("settling", () => {
  it("writes the scars it decided on", async () => {
    const events = [ev("mission_started"), hit("Vex")];
    withLedger(events);
    await settleAftermath(input(), { current: 5, max: 40 });
    const keys = situations.map((s) => s["situationKey"]);
    expect(keys).toContain("grudge_vex");
    expect(keys).toContain("aftermath_wounds");
  });

  it("writes one settlement line showing the money and what it cost", async () => {
    const events = [ev("mission_started"), died("Vex")];
    withLedger(events);
    const report = (await settleAftermath(input(), { current: 30, max: 30 }))!;
    const row = ledger.find((e) => e.type === SETTLEMENT_EVENT)!;
    expect(row).toBeTruthy();
    expect(row.data["findings"]).toBeTruthy();
    expect(row.summary).toContain("eb");
    expect(report.findings.some((f) => f.observation === "killed")).toBe(true);
  });

  it("never pays out more than was agreed", async () => {
    for (let i = 0; i < 60; i += 1) {
      ledger.length = 0;
      const report = (await settleAftermath(input(), { current: 30, max: 30 }))!;
      expect(report.payment.paid).toBeLessThanOrEqual(1000);
      expect(report.payment.paid).toBeGreaterThanOrEqual(0);
    }
  });

  it("settles once — a second pass pays nothing and promotes nobody", async () => {
    withLedger([ev("mission_started"), hit("Vex")]);
    const first = await settleAftermath(input(), { current: 30, max: 30 });
    expect(first).not.toBeNull();

    // The ledger now carries the settlement, which is what the guard reads.
    withLedger([ev("mission_started"), ev(SETTLEMENT_EVENT)]);
    npcs.length = 0;
    const second = await settleAftermath(input(), { current: 30, max: 30 });
    expect(second).toBeNull();
    expect(npcs).toHaveLength(0);
  });

  it("still settles the NEXT job after this one was settled", async () => {
    // A settlement before the current mission_started must not block it.
    withLedger([ev(SETTLEMENT_EVENT), ev("mission_started")]);
    const report = await settleAftermath(input(), { current: 30, max: 30 });
    expect(report).not.toBeNull();
  });

  it("reports a clean job as clean", async () => {
    const report = (await settleAftermath(input(), { current: 30, max: 30 }))!;
    expect(report.findings.map((f) => f.observation)).toEqual(["clean"]);
  });
});

describe("brokerKeyFor", () => {
  it("reads the broker off the event that started the job", () => {
    const events = [ev("mission_started", { brokerKey: "wakako_okada" })];
    expect(brokerKeyFor(events)).toBe("wakako_okada");
  });

  it("uses the most recent job, not the first", () => {
    const events = [
      ev("mission_started", { brokerKey: "old_broker" }),
      ev("mission_started", { brokerKey: "current_broker" }),
    ];
    expect(brokerKeyFor(events)).toBe("current_broker");
  });

  it("says nothing when the event predates brokers being recorded", () => {
    expect(brokerKeyFor([ev("mission_started")])).toBeNull();
    expect(brokerKeyFor([ev("mission_started", { brokerKey: "" })])).toBeNull();
    expect(brokerKeyFor([])).toBeNull();
  });
});

describe("alreadySettled", () => {
  it("is false for a job still in progress", () => {
    expect(alreadySettled([ev("mission_started"), ev("gm_narration")])).toBe(false);
  });

  it("is true once this job has been settled", () => {
    expect(alreadySettled([ev("mission_started"), ev(SETTLEMENT_EVENT)])).toBe(true);
  });

  it("looks only at the current job", () => {
    const events = [ev("mission_started"), ev(SETTLEMENT_EVENT), ev("mission_started")];
    expect(alreadySettled(events)).toBe(false);
  });

  it("is false for a campaign that has never started a job", () => {
    expect(alreadySettled([])).toBe(false);
  });
});

describe("how far settlement reads", () => {
  it("reads a whole job, not a turn's window", async () => {
    // A long job can start further back than the rows a turn reads. Counting
    // from inside that window would silently charge for only part of the job.
    const { JOB_LEDGER_LIMIT } = await import("../aftermath");
    expect(JOB_LEDGER_LIMIT).toBeGreaterThan(200);
  });

  it("asks the ledger for that many rows, not for everything", async () => {
    const { listCampaignEvents } = await import("@/lib/backend");
    const { JOB_LEDGER_LIMIT } = await import("../aftermath");
    withLedger([ev("mission_started")]);
    await settleAftermath(input(), { current: 30, max: 30 });
    expect(listCampaignEvents).toHaveBeenCalledWith("c", JOB_LEDGER_LIMIT);
  });
});
