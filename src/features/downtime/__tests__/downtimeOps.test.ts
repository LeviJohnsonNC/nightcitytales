/**
 * The Night Market and the repair bench price against the money the character
 * holds NOW, not the money the panel last rendered.
 *
 * Two quick presses used to both read the same snapshot and each write an
 * absolute balance, so the first purchase was free.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { purchaseCost } from "@/engine";
import type { CampaignInventoryItem } from "@/lib/backend";
import type { DowntimeBundle } from "../downtimeOps";

let eurobucks = 0;
const events: { type: string }[] = [];
const spWrites: { id: string; sp: number }[] = [];

vi.mock("@/lib/backend", () => ({
  getCampaign: vi.fn(async () => ({ vitals: { eurobucks } })),
  updateCampaignVitals: vi.fn(async (_id: string, patch: { eurobucks?: number }) => {
    if (patch.eurobucks !== undefined) eurobucks = patch.eurobucks;
  }),
  addInventoryItem: vi.fn(async () => ({}) as CampaignInventoryItem),
  setInventorySp: vi.fn(async (id: string, sp: number) => {
    spWrites.push({ id, sp });
  }),
  appendCampaignEvent: vi.fn(async (event: { type: string }) => {
    events.push(event);
  }),
}));

const { buy, repair } = await import("../downtimeOps");

/** A bundle rendered when the character had 1,000eb, and never refreshed. */
const stale = {
  campaign: { id: "c1" },
  vitals: { eurobucks: 1000 },
} as unknown as DowntimeBundle;

const knife = { kind: "weapon" as const, itemId: "light_melee", quantity: 1 };

beforeEach(() => {
  eurobucks = 1000;
  events.length = 0;
  spWrites.length = 0;
});

describe("downtime spending", () => {
  it("charges both of two quick purchases from one stale bundle", async () => {
    const cost = purchaseCost(knife.kind, knife.itemId, 1);
    expect(cost).toBeGreaterThan(0);
    await buy(stale, knife);
    await buy(stale, knife);
    expect(eurobucks).toBe(1000 - 2 * cost);
    expect(events.map((e) => e.type)).toEqual(["downtime_purchase", "downtime_purchase"]);
  });

  it("refuses what the live balance cannot cover, even when the snapshot could", async () => {
    eurobucks = 0;
    await expect(buy(stale, knife)).rejects.toThrow(/you have 0eb/);
    expect(events).toHaveLength(0);
  });

  it("buys nothing for a quantity of zero", async () => {
    await buy(stale, { ...knife, quantity: 0 });
    expect(eurobucks).toBe(1000);
    expect(events).toHaveLength(0);
  });

  it("repairs against the live balance too", async () => {
    const piece = {
      inventoryId: "arm-1",
      itemId: "kevlar",
      name: "Kevlar",
      maxSp: 7,
      missingSp: 3,
      cost: 100,
    } as Parameters<typeof repair>[1];
    eurobucks = 150;
    await repair(stale, piece);
    expect(eurobucks).toBe(50);
    await expect(repair(stale, piece)).rejects.toThrow(/you have 50eb/);
    expect(spWrites).toEqual([{ id: "arm-1", sp: 7 }]);
  });
});
