/**
 * The downtime view a campaign actually sees. What matters here is that the free
 * first month is honoured for campaigns that never recorded a payment, that
 * resting is priced in rent as well as days, and that only armor with a printed
 * rating and real damage shows up as repairable.
 */
import { describe, expect, it } from "vitest";
import { DOWNTIME_MONTH_DAYS } from "@/engine";
import type { Campaign, CampaignInventoryItem, CampaignVitals, FullCharacter } from "@/lib/backend";
import {
  billsAfterResting,
  downtimeView,
  lifestyleRates,
  paidThroughDay,
  repairableArmor,
} from "../downtimeModel";

const character = {
  character: { name: "Vincent Kang", role: "solo" },
  stats: { body: 7, cool: 6 },
  skills: [],
} as unknown as FullCharacter;

const campaign = (over: Partial<Campaign> = {}): Campaign =>
  ({ id: "c1", day: 0, bills_paid_through_day: 0, ...over }) as Campaign;

const vitals = (over: Partial<CampaignVitals> = {}): CampaignVitals =>
  ({ hp_current: 40, hp_max: 40, eurobucks: 2000, ...over }) as CampaignVitals;

const view = (over: {
  campaign?: Campaign;
  vitals?: CampaignVitals;
  inventory?: CampaignInventoryItem[];
  restDays?: number;
}) =>
  downtimeView({
    campaign: over.campaign ?? campaign(),
    vitals: over.vitals ?? vitals(),
    character,
    inventory: over.inventory ?? [],
    restDays: over.restDays ?? 0,
  });

describe("lifestyle rates", () => {
  it("reads the character's printed housing and Lifestyle", () => {
    const rates = lifestyleRates(character);
    expect(rates.rent).toBeGreaterThan(0);
    expect(rates.perMonth).toBe(rates.rent + rates.lifestyleCost);
    expect(rates.housingName).toBeTruthy();
  });
});

describe("the free first month", () => {
  it("counts a campaign that never paid as square through month one", () => {
    const rates = lifestyleRates(character);
    expect(paidThroughDay(campaign({ bills_paid_through_day: 0 }), rates)).toBe(
      DOWNTIME_MONTH_DAYS,
    );
  });

  it("owes nothing on day 20 of a brand-new run", () => {
    expect(view({ campaign: campaign({ day: 20 }) }).bills.total).toBe(0);
  });

  it("starts charging once the free month is behind you", () => {
    const owed = view({ campaign: campaign({ day: DOWNTIME_MONTH_DAYS * 2 }) });
    expect(owed.bills.months).toBe(1);
    expect(owed.bills.total).toBe(owed.rates.perMonth);
  });

  it("never gives back a month already paid for", () => {
    const paid = campaign({ day: DOWNTIME_MONTH_DAYS * 2, bills_paid_through_day: 60 });
    expect(paidThroughDay(paid, lifestyleRates(character))).toBe(60);
    expect(view({ campaign: paid }).bills.total).toBe(0);
  });
});

describe("resting", () => {
  it("prices the days as well as the healing", () => {
    const hurt = view({ vitals: vitals({ hp_current: 5 }), restDays: 5 });
    expect(hurt.rest.hpHealed).toBe(35); // BODY 7 × 5 days
    expect(hurt.restToFull.days).toBe(5);
  });

  it("shows the rent that lands while you lie low", () => {
    // Day 29 of the free month, resting five days pushes past the boundary.
    const hurt = view({
      campaign: campaign({ day: DOWNTIME_MONTH_DAYS * 2 - 3 }),
      vitals: vitals({ hp_current: 5 }),
      restDays: 5,
    });
    const after = billsAfterResting(hurt, 5);
    expect(after.total).toBeGreaterThan(hurt.bills.total);
  });

  it("says downtime is settled when whole, square and undamaged", () => {
    expect(view({ campaign: campaign({ day: 10 }) }).settled).toBe(true);
  });
});

describe("repairable armor", () => {
  const armorRow = (over: Partial<CampaignInventoryItem>): CampaignInventoryItem =>
    ({
      id: "i1",
      campaign_id: "c1",
      kind: "armor",
      item_id: "light_armorjack",
      quantity: 1,
      equipped: true,
      current_sp: null,
      slot: null,
      notes: null,
      ...over,
    }) as CampaignInventoryItem;

  it("lists a piece that has been chewed below its rating", () => {
    const [piece] = repairableArmor([armorRow({ current_sp: 6 })]);
    expect(piece).toMatchObject({ name: "Light Armorjack", currentSp: 6, maxSp: 11, missingSp: 5 });
    expect(piece!.cost).toBeGreaterThan(0);
  });

  it("ignores armor that has never been hit", () => {
    // current_sp null means untouched, which reads as its printed rating.
    expect(repairableArmor([armorRow({ current_sp: null })])).toEqual([]);
    expect(repairableArmor([armorRow({ current_sp: 11 })])).toEqual([]);
  });

  it("ignores things that are not armor, and armor the catalog forgot", () => {
    expect(repairableArmor([armorRow({ kind: "weapon", item_id: "medium_pistol" })])).toEqual([]);
    expect(repairableArmor([armorRow({ item_id: "chrome_trenchcoat", current_sp: 1 })])).toEqual(
      [],
    );
  });

  it("puts the worst-damaged piece first", () => {
    const rows = [
      armorRow({ id: "a", current_sp: 10 }),
      armorRow({ id: "b", current_sp: 2 }),
      armorRow({ id: "c", current_sp: 8 }),
    ];
    expect(repairableArmor(rows).map((p) => p.inventoryId)).toEqual(["b", "c", "a"]);
  });
});
