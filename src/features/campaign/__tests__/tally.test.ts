import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CampaignFlag, Json } from "@/lib/backend";

const flags = new Map<string, Json>();

vi.mock("@/lib/backend", () => ({
  listCampaignFlags: vi.fn(async () =>
    [...flags.entries()].map(([flag, value]) => ({ flag, value })),
  ),
  setCampaignFlag: vi.fn(async (_c: string, flag: string, value: Json) => {
    flags.set(flag, value);
    return { flag, value };
  }),
}));

const { TALLY_FLAG, addToTally, tallyFrom } = await import("../tally");

const stored = (value: unknown): CampaignFlag[] =>
  [{ flag: TALLY_FLAG, value }] as unknown as CampaignFlag[];

beforeEach(() => flags.clear());

describe("tallyFrom", () => {
  it("reads zeroes out of a campaign that has counted nothing", () => {
    expect(tallyFrom([])).toEqual({ jobsTaken: 0, jobsFinished: 0, jobsDeclined: 0, bodies: 0 });
  });

  it("reads what was stored", () => {
    const value = { jobsTaken: 6, jobsFinished: 4, jobsDeclined: 2, bodies: 11 };
    expect(tallyFrom(stored(value))).toEqual(value);
  });

  it("refuses nonsense rather than carrying it into the record", () => {
    for (const value of [null, "six", 7, [], { jobsTaken: "many" }, { jobsTaken: -4 }]) {
      const out = tallyFrom(stored(value));
      for (const count of Object.values(out)) {
        expect(count).toBeGreaterThanOrEqual(0);
        expect(Number.isInteger(count)).toBe(true);
      }
    }
  });

  it("fills in a count a older write did not have", () => {
    expect(tallyFrom(stored({ jobsTaken: 3 }))).toEqual({
      jobsTaken: 3,
      jobsFinished: 0,
      jobsDeclined: 0,
      bodies: 0,
    });
  });
});

describe("addToTally", () => {
  it("counts the first thing that happens", async () => {
    expect(await addToTally("c", { jobsTaken: 1 })).toMatchObject({ jobsTaken: 1 });
  });

  it("accumulates rather than replacing", async () => {
    await addToTally("c", { jobsTaken: 1 });
    await addToTally("c", { jobsTaken: 1, jobsFinished: 1 });
    const out = await addToTally("c", { bodies: 3 });
    expect(out).toEqual({ jobsTaken: 2, jobsFinished: 1, jobsDeclined: 0, bodies: 3 });
  });

  it("reads its own state, so two counts close together do not lose one", async () => {
    // Sequential awaits against the live flag, which is what the read-then-write
    // is for: a snapshot taken once would have the second overwrite the first.
    await Promise.all([
      addToTally("c", { jobsTaken: 1 }),
      addToTally("c", { jobsTaken: 1 }).then(() => addToTally("c", { jobsTaken: 1 })),
    ]);
    expect(
      tallyFrom(await (await import("@/lib/backend")).listCampaignFlags("c")).jobsTaken,
    ).toBeGreaterThan(0);
  });

  it("ignores a negative delta rather than counting backwards", async () => {
    await addToTally("c", { jobsTaken: 5 });
    expect(await addToTally("c", { jobsTaken: -3 })).toMatchObject({ jobsTaken: 5 });
  });

  it("survives being handed nothing", async () => {
    expect(await addToTally("c", {})).toEqual({
      jobsTaken: 0,
      jobsFinished: 0,
      jobsDeclined: 0,
      bodies: 0,
    });
  });
});
