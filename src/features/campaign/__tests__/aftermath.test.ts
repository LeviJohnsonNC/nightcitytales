import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CampaignEvent, CampaignNpc, Json } from "@/lib/backend";

const settleJob = vi.fn();
let liveEvents: CampaignEvent[] = [];
let npcs: CampaignNpc[] = [];
let flags: Array<{ flag: string; value: Json }> = [];

vi.mock("@/lib/backend", () => ({
  getCampaign: vi.fn(async () => ({
    campaign: { id: "c", day: 10 },
    vitals: { hp_current: 22 },
    inventory: [],
    npcs,
    factions: [],
    flags,
    missions: [],
  })),
  listCampaignEvents: vi.fn(async () => liveEvents),
  listClocks: vi.fn(async () => []),
  listCampaignFactions: vi.fn(async () => []),
  settleJob,
}));

const {
  GRUDGE_DUE_DAYS,
  JOB_LEDGER_LIMIT,
  SETTLEMENT_EVENT,
  SURVIVOR_DISPOSITION,
  alreadySettled,
  brokerKeyFor,
  scarsFor,
  settleAftermath,
  survivorKey,
} = await import("../aftermath");

const PLAYER = "Vela Ruiz";
let sequence = 0;
const ev = (type: string, data: Record<string, unknown> = {}): CampaignEvent =>
  ({ id: `event-${++sequence}`, seq: sequence, type, data }) as unknown as CampaignEvent;
const hit = (target: string) =>
  ev("attack", {
    attacker: PLAYER,
    target,
    hit: true,
    through_armor: 6,
    hp_before: 30,
    hp_after: 24,
    sp_before: 11,
    sp_after: 10,
    armor_location: "body",
  });

function input() {
  return {
    campaignId: "c",
    missionId: "mission-1",
    playerName: PLAYER,
    agreed: 1000,
    messy: false,
    factionId: null,
    completion: {
      summary: "Mission complete.",
      beatId: "beat-3",
      data: { missionId: "mission-1" },
    },
  };
}

beforeEach(() => {
  sequence = 0;
  liveEvents = [];
  npcs = [];
  flags = [];
  settleJob.mockReset();
  settleJob.mockResolvedValue({ eventId: "settled-1", receipt: {}, alreadySettled: false });
});

describe("settlement identities", () => {
  it("makes stable keys from names", () => {
    expect(survivorKey("Kiro Tanaka")).toBe("kiro_tanaka");
    expect(survivorKey("!!!")).toBe("survivor");
  });

  it("reads the broker from the most recent job", () => {
    expect(
      brokerKeyFor([
        ev("mission_started", { brokerKey: "old" }),
        ev("mission_started", { brokerKey: "current" }),
      ]),
    ).toBe("current");
  });

  it("only treats the current job as settled", () => {
    expect(alreadySettled([ev("mission_started"), ev(SETTLEMENT_EVENT)])).toBe(true);
    expect(
      alreadySettled([ev("mission_started"), ev(SETTLEMENT_EVENT), ev("mission_started")]),
    ).toBe(false);
  });
});

describe("durable residue", () => {
  it("persists grudges, not duplicate wound or armor situations", () => {
    expect(scarsFor(10, ["Vex"])).toEqual([
      expect.objectContaining({
        situation_key: "grudge_vex",
        npc_key: "vex",
        due_day: 10 + GRUDGE_DUE_DAYS,
      }),
    ]);
    expect(scarsFor(10, [])).toEqual([]);
  });
});

describe("atomic settlement preparation", () => {
  it("sends one complete closeout to the backend", async () => {
    const start = ev("mission_started", { brokerKey: "wakako" });
    liveEvents = [
      start,
      hit("Vex"),
      ev("attack", {
        attacker: "Vex",
        target: PLAYER,
        hit: true,
        hp_before: 30,
        hp_after: 24,
        sp_before: 11,
        sp_after: 10,
        armor_location: "body",
      }),
    ];

    const report = await settleAftermath(input());

    expect(report?.survivors).toEqual(["Vex"]);
    expect(report?.mechanical.hp).toEqual({ before: 30, after: 24, lost: 6 });
    expect(report?.mechanical.armor).toEqual([
      { location: "body", before: 11, after: 10, ablated: 1 },
    ]);
    expect(settleJob).toHaveBeenCalledOnce();
    expect(settleJob).toHaveBeenCalledWith(
      expect.objectContaining({
        campaign_id: "c",
        mission_id: "mission-1",
        job_event_id: start.id,
        payment: expect.objectContaining({ agreed: 1000 }),
        completion: {
          summary: "Mission complete.",
          beat_id: "beat-3",
          data: { missionId: "mission-1" },
        },
        npcs: [
          expect.objectContaining({
            npc_key: "vex",
            disposition: SURVIVOR_DISPOSITION,
          }),
        ],
        situations: [expect.objectContaining({ situation_key: "grudge_vex" })],
      }),
    );
  });

  it("uses fresh campaign people and day", async () => {
    npcs = [
      {
        id: "npc-vex",
        npc_id: "vex",
        name: "Vex",
        disposition: 1,
        status: "alive",
        data: {},
      } as unknown as CampaignNpc,
    ];
    liveEvents = [ev("mission_started"), hit("Vex")];

    const report = await settleAftermath(input());

    expect(report?.people).toContainEqual({ key: "vex", name: "Vex", before: 1, after: 0 });
    expect(report?.scars[0]?.dueDay).toBe(10 + GRUDGE_DUE_DAYS);
  });

  it("does no work when the current job is already settled", async () => {
    liveEvents = [ev("mission_started"), ev(SETTLEMENT_EVENT)];
    expect(await settleAftermath(input())).toBeNull();
    expect(settleJob).not.toHaveBeenCalled();
  });

  it("trusts the transaction's duplicate guard under a race", async () => {
    liveEvents = [ev("mission_started")];
    settleJob.mockResolvedValue({ eventId: "settled-1", receipt: {}, alreadySettled: true });
    expect(await settleAftermath(input())).toBeNull();
  });

  it("reads a job-sized bounded ledger window", async () => {
    const { listCampaignEvents } = await import("@/lib/backend");
    liveEvents = [ev("mission_started")];
    await settleAftermath(input());
    expect(JOB_LEDGER_LIMIT).toBeGreaterThan(200);
    expect(listCampaignEvents).toHaveBeenCalledWith("c", JOB_LEDGER_LIMIT);
  });
});
