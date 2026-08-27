import { describe, expect, it } from "vitest";
import type { CampaignEvent, CampaignNpc } from "@/lib/backend";
import { chronicleFor, chronicleInput, jobsByBroker } from "../chronicleModel";
import type { FactionStanding } from "@/engine";

const ev = (type: string, data: Record<string, unknown> = {}): CampaignEvent =>
  ({ type, data }) as unknown as CampaignEvent;

const npc = (over: Partial<CampaignNpc> = {}): CampaignNpc =>
  ({
    id: "r",
    npc_id: "kiro",
    name: "Kiro",
    disposition: 0,
    status: "alive",
    ...over,
  }) as unknown as CampaignNpc;

function sources(over: Record<string, unknown> = {}) {
  return {
    day: 20,
    events: [] as CampaignEvent[],
    standings: [] as FactionStanding[],
    pressure: [] as string[],
    npcs: [] as CampaignNpc[],
    situationKeys: [] as string[],
    tally: { jobsTaken: 0, jobsFinished: 0, jobsDeclined: 0, bodies: 0 },
    ...over,
  };
}

describe("who brings the work", () => {
  it("counts jobs per broker off the events that started them", () => {
    const events = [
      ev("mission_started", { brokerKey: "kiro" }),
      ev("mission_started", { brokerKey: "kiro" }),
      ev("mission_started", { brokerKey: "nix" }),
    ];
    expect(jobsByBroker(events).get("kiro")).toBe(2);
    expect(jobsByBroker(events).get("nix")).toBe(1);
  });

  it("ignores a job started before brokers were recorded", () => {
    expect(jobsByBroker([ev("mission_started")]).size).toBe(0);
  });
});

describe("gathering the campaign", () => {
  it("takes the counts from the running tally, not from the window", () => {
    // The whole point: a turn reads 200 rows, and counting jobs out of those
    // would mean counting the last two sessions rather than the campaign.
    const out = chronicleInput(
      sources({
        events: [ev("mission_started")],
        tally: { jobsTaken: 40, jobsFinished: 33, jobsDeclined: 12, bodies: 91 },
      }),
    );
    expect(out).toMatchObject({ jobsTaken: 40, jobsFinished: 33, jobsDeclined: 12, bodies: 91 });
  });

  it("leaves the dead out of the people it knows", () => {
    const npcs = [
      npc({ id: "1", npc_id: "a", name: "A" }),
      npc({ id: "2", npc_id: "b", name: "B", status: "dead" }),
    ];
    expect(chronicleInput(sources({ npcs })).people.map((p) => p.name)).toEqual(["A"]);
  });

  it("names anybody still owed a reckoning, from the situation on the books", () => {
    const npcs = [
      npc({ npc_id: "vex", name: "Vex" }),
      npc({ id: "2", npc_id: "kiro", name: "Kiro" }),
    ];
    const out = chronicleInput(sources({ npcs, situationKeys: ["grudge_vex", "rent_due"] }));
    expect(out.stillLooking).toEqual(["Vex"]);
  });

  it("names nobody when no grudge is outstanding", () => {
    const npcs = [npc({ npc_id: "vex", name: "Vex" })];
    expect(chronicleInput(sources({ npcs, situationKeys: ["rent_due"] })).stillLooking).toEqual([]);
  });

  it("attributes the work to the broker who brought it", () => {
    const npcs = [npc({ npc_id: "kiro", name: "Kiro" })];
    const events = [
      ev("mission_started", { brokerKey: "kiro" }),
      ev("mission_started", { brokerKey: "kiro" }),
    ];
    expect(chronicleInput(sources({ npcs, events })).people[0]!.jobsBrought).toBe(2);
  });
});

describe("chronicleFor", () => {
  it("says nothing about a campaign that has not started", () => {
    expect(chronicleFor(sources({ day: 1 }))).toEqual([]);
  });

  it("produces readable lines once there is something to say", () => {
    const lines = chronicleFor(
      sources({
        day: 30,
        events: [ev("mission_started", { brokerKey: "kiro" })],
        tally: { jobsTaken: 1, jobsFinished: 1, jobsDeclined: 0, bodies: 0 },
        npcs: [npc({ npc_id: "kiro", name: "Kiro Tanaka", disposition: 2 })],
        pressure: ["NCPD Heat: 3/8"],
      }),
    );
    expect(lines.join("\n")).toContain("1 job taken");
    expect(lines.join("\n")).toContain("Kiro Tanaka");
    expect(lines.join("\n")).toContain("NCPD Heat: 3/8");
  });
});
