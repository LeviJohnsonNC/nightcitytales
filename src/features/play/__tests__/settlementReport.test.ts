import { describe, expect, it } from "vitest";
import type { CampaignEvent } from "@/lib/backend";
import { SETTLEMENT_EVENT, settlementFrom, wasShorted } from "../settlementReport";
import { OBSERVATION_MEANINGS } from "@/engine";

const ev = (type: string, data: unknown = {}): CampaignEvent =>
  ({ type, data }) as unknown as CampaignEvent;

const settled = (data: Record<string, unknown>) => ev(SETTLEMENT_EVENT, data);

const FULL = {
  findings: [
    { observation: "killed", count: 2, because: "2 died" },
    { observation: "loud", count: 1, because: "7 shots exchanged" },
  ],
  payment: { key: "short", agreed: 1000, paid: 600 },
  survivors: ["Vex"],
  mechanical: {
    hp: { before: 40, after: 31, lost: 9 },
    armor: [{ location: "body", before: 11, after: 9, ablated: 2 }],
    ammunition: [
      { inventoryId: "weapon-1", weapon: "Very Heavy Pistol", before: 8, after: 5, spent: 3 },
    ],
    criticalInjuries: 1,
  },
  pressure: [{ kind: "clock", key: "heat", label: "Heat", before: 1, after: 3 }],
  people: [{ key: "vex", name: "Vex", before: null, after: -3 }],
};

describe("settlementFrom", () => {
  it("says nothing for a campaign that has not finished a job", () => {
    expect(settlementFrom([])).toBeNull();
    expect(settlementFrom([ev("gm_narration")])).toBeNull();
  });

  it("reads the findings, the money and who walked away", () => {
    const view = settlementFrom([settled(FULL)])!;
    expect(view.lines.map((l) => l.observation)).toEqual(["killed", "loud"]);
    expect(view.lines[0]).toMatchObject({ count: 2, because: "2 died" });
    expect(view.payment).toEqual({ key: "short", agreed: 1000, paid: 600 });
    expect(view.survivors).toEqual(["Vex"]);
    expect(view.mechanical.hp).toEqual({ before: 40, after: 31, lost: 9 });
    expect(view.mechanical.armor[0]).toMatchObject({ location: "body", ablated: 2 });
    expect(view.mechanical.ammunition[0]).toMatchObject({ weapon: "Very Heavy Pistol", spent: 3 });
    expect(view.pressure[0]).toMatchObject({ label: "Heat", before: 1, after: 3 });
    expect(view.people[0]).toMatchObject({ name: "Vex", before: null, after: -3 });
  });

  it("explains the vocabulary rather than assuming the player knows it", () => {
    const view = settlementFrom([settled(FULL)])!;
    expect(view.lines[0]!.meaning).toBe(OBSERVATION_MEANINGS.killed);
  });

  it("shows the most recent job, not the first", () => {
    const older = settled({ ...FULL, survivors: ["Old Enemy"] });
    const newer = settled({ ...FULL, survivors: ["Vex"] });
    expect(settlementFrom([older, newer])!.survivors).toEqual(["Vex"]);
  });

  it("drops a finding whose word the clock vocabulary does not know", () => {
    const view = settlementFrom([
      settled({ findings: [{ observation: "vibes", count: 1, because: "bad ones" }] }),
    ])!;
    expect(view.lines).toEqual([]);
  });

  it("survives a row written with nothing useful in it", () => {
    for (const data of [null, "nonsense", { findings: "not an array" }, {}]) {
      const view = settlementFrom([settled(data as Record<string, unknown>)]);
      expect(view).not.toBeNull();
      expect(view!.lines).toEqual([]);
      expect(view!.survivors).toEqual([]);
    }
  });

  it("treats a missing count as one rather than zero", () => {
    const view = settlementFrom([settled({ findings: [{ observation: "loud" }] })])!;
    expect(view.lines[0]!.count).toBe(1);
  });

  it("reports no payment when the row carries none", () => {
    expect(settlementFrom([settled({ findings: [] })])!.payment).toBeNull();
  });
});

describe("wasShorted", () => {
  it("is true when the money did not all arrive", () => {
    expect(wasShorted(settlementFrom([settled(FULL)])!)).toBe(true);
  });

  it("is false when it did", () => {
    const paid = settled({ ...FULL, payment: { key: "paid", agreed: 1000, paid: 1000 } });
    expect(wasShorted(settlementFrom([paid])!)).toBe(false);
  });

  it("is false when there was no payment to be short of", () => {
    expect(wasShorted(settlementFrom([settled({})])!)).toBe(false);
  });
});
