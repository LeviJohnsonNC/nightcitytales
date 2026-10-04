/**
 * Calling a favour in. What is held here is the order and the honesty of the
 * writes: the benefit, then the goodwill, then the time, then the receipt; a
 * favour that is not on offer is refused without a single write; and the second
 * ask of the day, from a page that still shows the first, is refused too.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FAVOUR_FLAG, LEDGER_EVENTS, startingState, type PlaceState } from "@/engine";
import type { Campaign, CampaignEvent, CampaignVitals, FullCharacter } from "@/lib/backend";

const calls: string[] = [];
let campaign: Campaign;
let vitals: CampaignVitals;
let places: Record<string, PlaceState> = {};
let events: CampaignEvent[] = [];
let heat = 0;
const writes: Array<{ name: string; args: unknown[] }> = [];
const record =
  (name: string, result: unknown = undefined) =>
  async (...args: unknown[]) => {
    calls.push(name);
    writes.push({ name, args });
    return result;
  };

vi.mock("@/lib/backend", () => ({
  getCampaign: vi.fn(async () => ({ campaign, vitals, inventory: [], npcs: [] })),
  listCampaignEvents: vi.fn(async () => events),
  listClocks: vi.fn(async () =>
    heat > 0 ? [{ clock_key: "heat", filled: heat, segments: 6, data: {} }] : [],
  ),
  listCampaignPlaces: vi.fn(async () =>
    Object.values(places).map((p) => ({
      place_key: p.placeKey,
      dials: p.dials,
      flags: p.flags,
      visits: p.visits,
      first_visit_day: p.firstVisitDay,
      last_visit_day: p.lastVisitDay,
    })),
  ),
  upsertCampaignPlace: vi.fn(record("upsertCampaignPlace")),
  updateCampaignVitals: vi.fn(record("updateCampaignVitals")),
  setCampaignClock: vi.fn(record("setCampaignClock")),
  appendCampaignEvent: vi.fn(record("appendCampaignEvent")),
}));

vi.mock("../pressure", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../pressure")>()),
  applyPressure: vi.fn(record("applyPressure", { pressure: [], moved: [] })),
}));

const { callInFavour, favourOffers, standingAt } = await import("../favours");

const character = {
  character: { name: "Vincent Kang", role: "solo" },
  stats: { body: 6 },
  skills: [],
} as unknown as FullCharacter;

const CLINIC = "b11";

function welcomed(placeKey: string, goodwill = 6): PlaceState {
  const start = startingState(placeKey);
  return {
    ...start,
    flags: [...start.flags, FAVOUR_FLAG],
    dials: { ...start.dials, goodwill },
  };
}

beforeEach(() => {
  calls.length = 0;
  writes.length = 0;
  campaign = { id: "c", day: 12, minute: 600, location_key: CLINIC } as unknown as Campaign;
  vitals = { hp_current: 20, hp_max: 35, eurobucks: 100 } as unknown as CampaignVitals;
  places = { [CLINIC]: welcomed(CLINIC) };
  events = [];
  heat = 0;
});

const ask = (favourKey: string) => callInFavour({ campaignId: "c", favourKey, character });

describe("where the character is standing", () => {
  it("is the venue they stand in", () => {
    expect(standingAt({ location_key: CLINIC })).toBe(CLINIC);
  });

  it("offers nothing until the place is glad to see them", () => {
    const offers = (state: Record<string, PlaceState>) =>
      favourOffers({
        campaign,
        vitals,
        character,
        inventory: [],
        places: state,
        heat: 0,
        events: [],
      });
    expect(offers({})).toEqual([]);
    expect(offers({ [CLINIC]: welcomed(CLINIC) }).map((o) => o.key)).toEqual(["patch_up"]);
  });
});

describe("calling in a patch-up", () => {
  it("heals, then spends the goodwill, then takes the time, then writes the receipt", async () => {
    const outcome = await ask("patch_up");
    expect(outcome.ok).toBe(true);
    expect(calls).toEqual([
      "updateCampaignVitals",
      "upsertCampaignPlace",
      "setCampaignClock",
      "appendCampaignEvent",
    ]);
    expect(writes[0]!.args[1]).toEqual({ hp_current: 26 });
    const spent = writes[1]!.args[1] as { dials: Record<string, number>; flags: string[] };
    expect(spent.dials["goodwill"]).toBe(4);
    expect(spent.flags).toContain(FAVOUR_FLAG);
    const receipt = writes[3]!.args[0] as { type: string; summary: string; data: unknown };
    expect(receipt.type).toBe(LEDGER_EVENTS.favourCalled);
    expect(receipt.summary).toContain("healed 6 HP");
    expect(receipt.summary).not.toMatch(/goodwill|segment/i);
  });

  it("is refused, with no writes, when they are not hurt", async () => {
    vitals = { ...vitals, hp_current: 35 };
    expect(await ask("patch_up")).toEqual({ ok: false, reason: "You are not hurt." });
    expect(calls).toEqual([]);
  });
});

describe("calling in a place's only-once-a-day kindness", () => {
  it("is refused the second time, from a page that still shows the first", async () => {
    events = [
      {
        id: "e1",
        seq: 1,
        type: LEDGER_EVENTS.favourCalled,
        data: { placeKey: CLINIC, favour: "patch_up", effect: "patch", day: 12 },
      } as unknown as CampaignEvent,
    ];
    const outcome = await ask("patch_up");
    expect(outcome).toEqual({ ok: false, reason: "They have done enough for you today." });
    expect(calls).toEqual([]);
  });

  it("is asked again tomorrow", async () => {
    events = [
      {
        id: "e1",
        seq: 1,
        type: LEDGER_EVENTS.favourCalled,
        data: { placeKey: CLINIC, favour: "patch_up", effect: "patch", day: 11 },
      } as unknown as CampaignEvent,
    ];
    expect((await ask("patch_up")).ok).toBe(true);
  });
});

describe("what a place will not do", () => {
  it("refuses a favour it was never going to offer, and a place that has not taken to them", async () => {
    expect(await ask("lay_low")).toEqual({
      ok: false,
      reason: "Nobody here would do that for you.",
    });
    places = {};
    expect(await ask("patch_up")).toEqual({
      ok: false,
      reason: "Nobody here would do that for you.",
    });
    expect(calls).toEqual([]);
  });

  it("will not go out on a limb for the last of what it has", async () => {
    places = { [CLINIC]: welcomed(CLINIC, 2) };
    const outcome = await ask("patch_up");
    expect(outcome.ok).toBe(false);
    expect(calls).toEqual([]);
  });
});

describe("lying low", () => {
  it("eases the heat through the pressure the game already has, and costs a night", async () => {
    campaign = { ...campaign, location_key: "a1" } as Campaign;
    places = { a1: welcomed("a1") };
    heat = 4;
    const outcome = await ask("lay_low");
    expect(outcome.ok).toBe(true);
    expect(calls).toEqual([
      "applyPressure",
      "upsertCampaignPlace",
      "setCampaignClock",
      "appendCampaignEvent",
    ]);
    expect(writes[0]!.args[1]).toEqual([
      { observation: "clean", factionId: null },
      { observation: "clean", factionId: null },
    ]);
  });

  it("is not offered to somebody nobody is looking for", async () => {
    campaign = { ...campaign, location_key: "a1" } as Campaign;
    places = { a1: welcomed("a1") };
    heat = 0;
    expect(await ask("lay_low")).toEqual({ ok: false, reason: "Nobody is looking for you." });
  });
});
