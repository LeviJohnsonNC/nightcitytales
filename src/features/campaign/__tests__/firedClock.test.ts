/**
 * Pressure that came due is SPENT only when the narrator has been told.
 *
 * The Job turn spent the clock before the model call, so a failed call (a 429,
 * a dropped connection) took the threat with it, and the retry found the
 * clock empty and nothing coming.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HEAT_CLOCK_KEY, heatClock } from "@/engine";
import type { CampaignClock } from "@/lib/backend";

let clocks: CampaignClock[] = [];
const ledger: { type: string }[] = [];

vi.mock("@/lib/backend", () => ({
  listClocks: vi.fn(async () => clocks),
  upsertClock: vi.fn(async (_c: string, next: { clockKey: string; filled: number }) => {
    clocks = clocks.map((row) =>
      row.clock_key === next.clockKey ? { ...row, filled: next.filled } : row,
    );
  }),
  appendCampaignEvent: vi.fn(async (event: { type: string }) => {
    ledger.push(event);
  }),
}));

const { firedClockDue, spendFiredClock } = await import("../pressure");

beforeEach(() => {
  const full = heatClock();
  clocks = [
    { clock_key: HEAT_CLOCK_KEY, filled: full.segments, data: {} } as unknown as CampaignClock,
  ];
  ledger.length = 0;
});

describe("a fired clock", () => {
  it("is read without being spent", async () => {
    const due = await firedClockDue("c");
    expect(due?.arrived.definition.key).toBe(HEAT_CLOCK_KEY);
    expect(clocks[0]!.filled).toBe(heatClock().segments);
    expect(ledger).toHaveLength(0);
  });

  it("is spent once by its commit, however many passes commit it", async () => {
    const first = await firedClockDue("c");
    const second = await firedClockDue("c");
    await first!.commit();
    await second!.commit();
    expect(clocks[0]!.filled).toBe(0);
    expect(ledger.map((e) => e.type)).toEqual(["pressure_arrived"]);
  });

  it("still spends in one step for a caller that wants it now", async () => {
    expect((await spendFiredClock("c"))?.definition.key).toBe(HEAT_CLOCK_KEY);
    expect(clocks[0]!.filled).toBe(0);
    expect(await spendFiredClock("c")).toBeNull();
  });
});
