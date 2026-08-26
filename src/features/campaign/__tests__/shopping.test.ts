import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CampaignEvent, CampaignInventoryItem, Json } from "@/lib/backend";

/** A campaign's inventory, vitals and ledger, small enough to hold in one hand. */
const inventory: CampaignInventoryItem[] = [];
const ledger: { type: string; summary: string; data: Record<string, unknown> }[] = [];
let eurobucks = 0;
let clock = { day: 1, minute: 18 * 60 };
/** What listCampaignEvents hands back, so "is a regular" can be exercised. */
let ledgerEvents: CampaignEvent[] = [];
const ammoWrites: { id: string; loaded: number }[] = [];
const quantityWrites: { id: string; quantity: number }[] = [];

vi.mock("@/lib/backend", () => ({
  addInventoryItem: vi.fn(
    async (
      _campaignId: string,
      item: { kind: string; itemId: string; quantity: number; stack: boolean },
    ) => {
      const existing = item.stack
        ? inventory.find((r) => r.kind === item.kind && r.item_id === item.itemId)
        : undefined;
      if (existing) {
        existing.quantity += item.quantity;
        return existing;
      }
      const row = {
        id: `row-${inventory.length}`,
        kind: item.kind,
        item_id: item.itemId,
        quantity: item.quantity,
        // The real addInventoryItem derives this; the fake records that it was asked to.
        slot: item.kind === "armor" ? "body" : item.kind,
        ammo_loaded: null,
      } as unknown as CampaignInventoryItem;
      inventory.push(row);
      return row;
    },
  ),
  updateCampaignVitals: vi.fn(async (_id: string, patch: { eurobucks?: number }) => {
    if (patch.eurobucks !== undefined) eurobucks = patch.eurobucks;
    return {};
  }),
  setCampaignClock: vi.fn(async (_id: string, next: { day: number; minute: number }) => {
    clock = next;
    return {};
  }),
  setInventoryAmmo: vi.fn(async (id: string, loaded: number) => {
    ammoWrites.push({ id, loaded });
    const row = inventory.find((r) => r.id === id);
    if (row) row.ammo_loaded = loaded;
    return {};
  }),
  setInventoryQuantity: vi.fn(async (id: string, quantity: number) => {
    quantityWrites.push({ id, quantity });
    const row = inventory.find((r) => r.id === id);
    if (row) row.quantity = quantity;
    return {};
  }),
  appendCampaignEvent: vi.fn(async (row: Record<string, unknown>) => {
    ledger.push({
      type: row["type"] as string,
      summary: row["summary"] as string,
      data: (row["data"] ?? {}) as Record<string, unknown>,
    });
    return row;
  }),
  listCampaignEvents: vi.fn(async () => ledgerEvents),
  getCampaign: vi.fn(async () => ({
    campaign: { id: "c", day: clock.day, minute: clock.minute },
    vitals: { eurobucks },
    inventory,
  })),
  listCampaignFlags: vi.fn(async () => []),
  setCampaignFlag: vi.fn(async (_id: string, flag: string, value: Json) => ({ flag, value })),
}));

const {
  PURCHASE_EVENT,
  RELOAD_EVENT,
  isRegularAt,
  purchase,
  reloadWeapon,
  reloadableWeapons,
  spareRounds,
  spendVisit,
  stockedShelf,
} = await import("../shopping");
const { getVendor, shelfFor, weaponProfile, WEAPONS, AMMUNITION, vendorPrice } =
  await import("@/engine");

const GUNS = getVendor("gun_shop");
const STREET = getVendor("street");

const ORDINARY = shelfFor(GUNS).find((i) => i.tier === "ordinary" && i.kind === "weapon")!;
const UNUSUAL = shelfFor(GUNS).find((i) => i.tier === "unusual" && i.kind === "weapon")!;

function event(type: string, data: Record<string, unknown> = {}): CampaignEvent {
  return { type, data } as unknown as CampaignEvent;
}

beforeEach(() => {
  inventory.length = 0;
  ledger.length = 0;
  ammoWrites.length = 0;
  quantityWrites.length = 0;
  eurobucks = 10000;
  clock = { day: 1, minute: 18 * 60 };
  ledgerEvents = [];
});

describe("the shelf as the character sees it", () => {
  it("lists everything, affordable or not", () => {
    const shelf = stockedShelf(GUNS, 60);
    expect(shelf.length).toBe(shelfFor(GUNS).length);
    expect(shelf.some((i) => !i.affordable)).toBe(true);
    for (const item of shelf) expect(item.affordable).toBe(item.price <= 60);
  });

  it("marks nothing affordable when the character is broke", () => {
    const shelf = stockedShelf(GUNS, 0);
    expect(shelf.length).toBeGreaterThan(0);
    expect(shelf.every((i) => !i.affordable)).toBe(true);
  });
});

describe("buying something", () => {
  it("writes the item into the kit and takes the money", async () => {
    const out = await purchase({
      campaignId: "c",
      vendorId: "gun_shop",
      kind: ORDINARY.kind,
      itemId: ORDINARY.itemId,
      quantity: 1,
    });
    expect(out.ok).toBe(true);
    expect(inventory).toHaveLength(1);
    expect(inventory[0]).toMatchObject({ kind: ORDINARY.kind, item_id: ORDINARY.itemId });
    expect(eurobucks).toBe(10000 - ORDINARY.price);
  });

  it("gives the row a slot, so the game can actually see what was bought", async () => {
    await purchase({
      campaignId: "c",
      vendorId: "gun_shop",
      kind: "weapon",
      itemId: ORDINARY.itemId,
      quantity: 1,
    });
    // The whole original defect: a bought gun with no slot is invisible to
    // weaponCapabilities, which skips every row whose slot is not "weapon".
    expect(inventory[0]!.slot).toBe("weapon");
    expect(ledger[0]!.data["slot"]).toBe("weapon");
  });

  it("records the purchase in the ledger with what it cost and who sold it", async () => {
    await purchase({
      campaignId: "c",
      vendorId: "gun_shop",
      kind: ORDINARY.kind,
      itemId: ORDINARY.itemId,
      quantity: 1,
    });
    const row = ledger.find((e) => e.type === PURCHASE_EVENT)!;
    expect(row.summary).toContain(ORDINARY.name);
    expect(row.data).toMatchObject({ vendorId: "gun_shop", cost: ORDINARY.price });
  });

  it("refuses what this vendor does not deal in, in their own words", async () => {
    const armor = shelfFor(getVendor("armorer")).find((i) => i.kind === "armor")!;
    const out = await purchase({
      campaignId: "c",
      vendorId: "gun_shop",
      kind: "armor",
      itemId: armor.itemId,
      quantity: 1,
    });
    expect(out.ok).toBe(false);
    expect(inventory).toHaveLength(0);
    if (!out.ok) expect(out.reason).toBe(GUNS.refusal);
  });

  it("refuses what the character cannot pay for, and takes nothing", async () => {
    eurobucks = 1;
    const out = await purchase({
      campaignId: "c",
      vendorId: "gun_shop",
      kind: ORDINARY.kind,
      itemId: ORDINARY.itemId,
      quantity: 1,
    });
    expect(out.ok).toBe(false);
    expect(inventory).toHaveLength(0);
    expect(eurobucks).toBe(1);
    if (!out.ok) expect(out.reason).toMatch(/you have 1eb/);
  });

  it("stacks ammunition onto one row rather than filing a second", async () => {
    const ammo = AMMUNITION.find((a) => a.cost <= 100)!;
    for (let i = 0; i < 3; i += 1) {
      await purchase({
        campaignId: "c",
        vendorId: "street",
        kind: "ammunition",
        itemId: ammo.id,
        quantity: 2,
      });
    }
    expect(inventory).toHaveLength(1);
    expect(inventory[0]!.quantity).toBe(6);
  });

  it("prices a second purchase against what is left, not a stale balance", async () => {
    // The bug this guards: a React bundle is a snapshot from the last render,
    // so two presses of Buy before the refetch would both price themselves
    // against the same balance and spend it twice. Money is read live instead.
    eurobucks = ORDINARY.price + 1;
    const first = await purchase({
      campaignId: "c",
      vendorId: "gun_shop",
      kind: ORDINARY.kind,
      itemId: ORDINARY.itemId,
      quantity: 1,
    });
    const second = await purchase({
      campaignId: "c",
      vendorId: "gun_shop",
      kind: ORDINARY.kind,
      itemId: ORDINARY.itemId,
      quantity: 1,
    });
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(false);
    expect(eurobucks).toBe(1);
    expect(inventory).toHaveLength(1);
  });

  it("charges the fixer's markup rather than the printed price", async () => {
    const item = shelfFor(getVendor("fixer")).find((i) => i.tier === "ordinary")!;
    await purchase({
      campaignId: "c",
      vendorId: "fixer",
      kind: item.kind,
      itemId: item.itemId,
      quantity: 1,
    });
    expect(10000 - eurobucks).toBe(vendorPrice(getVendor("fixer"), item.kind, item.itemId));
  });
});

describe("whether it is in stock", () => {
  it("never rolls for the ordinary, and writes no stock line", async () => {
    await purchase({
      campaignId: "c",
      vendorId: "gun_shop",
      kind: ORDINARY.kind,
      itemId: ORDINARY.itemId,
      quantity: 1,
    });
    expect(ledger.filter((e) => e.type === "oracle_roll")).toHaveLength(0);
  });

  it("rolls for the unusual and shows the player the roll", async () => {
    await purchase({
      campaignId: "c",
      vendorId: "gun_shop",
      kind: UNUSUAL.kind,
      itemId: UNUSUAL.itemId,
      quantity: 1,
    });
    const rolls = ledger.filter((e) => e.type === "oracle_roll");
    expect(rolls).toHaveLength(1);
    expect(rolls[0]!.summary).toContain("On the shelf");
  });

  it("takes no money when the shelf comes up empty", async () => {
    // Force the empty face by exhausting every outcome: over many attempts at
    // least one must be a refusal, and no refusal may cost anything.
    let refusals = 0;
    for (let i = 0; i < 60; i += 1) {
      inventory.length = 0;
      eurobucks = 100000;
      const out = await purchase({
        campaignId: "c",
        vendorId: "gun_shop",
        kind: UNUSUAL.kind,
        itemId: UNUSUAL.itemId,
        quantity: 1,
      });
      if (!out.ok) {
        refusals += 1;
        expect(eurobucks).toBe(100000);
        expect(inventory).toHaveLength(0);
      }
    }
    expect(refusals).toBeGreaterThan(0);
  });

  it("knows a regular from the ledger rather than from a stored flag", () => {
    expect(isRegularAt([], "gun_shop")).toBe(false);
    expect(isRegularAt([event(PURCHASE_EVENT, { vendorId: "street" })], "gun_shop")).toBe(false);
    expect(isRegularAt([event(PURCHASE_EVENT, { vendorId: "gun_shop" })], "gun_shop")).toBe(true);
    expect(isRegularAt([event("life_narration", { vendorId: "gun_shop" })], "gun_shop")).toBe(
      false,
    );
  });
});

describe("the visit costs an evening", () => {
  it("spends the vendor's own minutes, off the clock it reads for itself", async () => {
    clock = { day: 1, minute: 60 };
    const after = await spendVisit("c", "gun_shop");
    expect(after?.minute).toBe(60 + GUNS.minutes);
    expect(clock).toEqual(after);
  });

  it("costs more to go through a fixer than to walk to the street", () => {
    expect(getVendor("fixer").minutes).toBeGreaterThan(STREET.minutes);
  });
});

describe("reloading", () => {
  const GUN = WEAPONS.find((w) => w.magazine !== null && w.magazine >= 6)!;
  const MAG = weaponProfile(GUN.id).magazine!;

  function kit(loaded: number | null, rounds: number): CampaignInventoryItem[] {
    return [
      {
        id: "gun",
        kind: "weapon",
        item_id: GUN.id,
        slot: "weapon",
        quantity: 1,
        ammo_loaded: loaded,
      },
      {
        id: "ammo",
        kind: "ammunition",
        item_id: "basic_ammo",
        slot: "ammunition",
        quantity: rounds,
        ammo_loaded: null,
      },
    ] as unknown as CampaignInventoryItem[];
  }

  it("counts spare rounds across every ammunition row", () => {
    expect(spareRounds(kit(0, 40))).toBe(40);
    expect(spareRounds([])).toBe(0);
  });

  it("fills the magazine and spends the rounds it used", async () => {
    inventory.push(...kit(0, 40));
    const out = await reloadWeapon("c", "gun");
    expect(out.ok).toBe(true);
    expect(ammoWrites).toEqual([{ id: "gun", loaded: MAG }]);
    expect(quantityWrites).toEqual([{ id: "ammo", quantity: 40 - MAG }]);
  });

  it("writes what happened to the ledger", async () => {
    inventory.push(...kit(0, 40));
    await reloadWeapon("c", "gun");
    const row = ledger.find((e) => e.type === RELOAD_EVENT)!;
    expect(row.summary).toContain(`${MAG}/${MAG}`);
    expect(row.data).toMatchObject({ itemId: GUN.id, rounds: MAG });
  });

  it("refuses a full gun without touching anything", async () => {
    inventory.push(...kit(MAG, 40));
    const out = await reloadWeapon("c", "gun");
    expect(out.ok).toBe(false);
    expect(ammoWrites).toHaveLength(0);
    expect(quantityWrites).toHaveLength(0);
  });

  it("refuses when there are no rounds to load", async () => {
    inventory.push(...kit(0, 0));
    const out = await reloadWeapon("c", "gun");
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toMatch(/No spare rounds/);
  });

  it("refuses a weapon that is not in the kit", async () => {
    inventory.push(...kit(0, 40));
    const out = await reloadWeapon("c", "not-a-row");
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toMatch(/not in your kit/);
  });

  it("does not load the same rounds into the gun twice", async () => {
    // Same class as the double-spend: a snapshot of the inventory would let two
    // reloads each take a full magazine from one box of ammunition.
    inventory.push(...kit(0, MAG + 1));
    const first = await reloadWeapon("c", "gun");
    const second = await reloadWeapon("c", "gun");
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(false);
    expect(inventory.find((r) => r.id === "ammo")!.quantity).toBe(1);
  });

  it("offers only the guns that could actually take rounds now", () => {
    expect(reloadableWeapons(kit(0, 40)).map((w) => w.row.id)).toEqual(["gun"]);
    // Full: nothing to do.
    expect(reloadableWeapons(kit(MAG, 40))).toHaveLength(0);
    // Empty pockets: nothing to do either.
    expect(reloadableWeapons(kit(0, 0))).toHaveLength(0);
  });

  it("reports what is in each gun, for a UI that has to say so", () => {
    const [only] = reloadableWeapons(kit(2, 40));
    expect(only).toMatchObject({ loaded: 2, magazine: MAG, name: weaponProfile(GUN.id).name });
  });
});
