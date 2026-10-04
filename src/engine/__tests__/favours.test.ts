/**
 * What a place that is glad to see you will do. The rules the module states —
 * welcome first, a favour never leaves a place cold, one a day, and nothing
 * that touches a die — are held here, along with the data that feeds them.
 */
import { describe, expect, it } from "vitest";
import data from "@/data/atlas/favours.json";
import night from "@/data/atlas/night-city.json";
import {
  FAVOUR_DIAL,
  FAVOUR_FLAG,
  FAVOUR_TEMPLATES,
  FAVOURS_ARE_HOUSE_RULE,
  afterFavour,
  favoursAt,
  layLowReports,
  type FavourContext,
} from "../favours";
import { districtOfPlace } from "../geography";
import { favourCalledEventData, favourCalledOn, readFavourCalledEventData } from "../ledger";
import { heatMultiplier, tagsOf } from "../places";
import { dialsOf, startingState, type PlaceState } from "../placeState";

const CLINIC = "b11";
const HOME = "a1";

const hurt: FavourContext = {
  hpCurrent: 20,
  hpMax: 35,
  body: 6,
  heat: 4,
  calledToday: false,
};

function welcomed(placeKey: string, goodwill = 6): PlaceState {
  const start = startingState(placeKey);
  return {
    ...start,
    flags: [...start.flags.filter((f) => f !== "unwelcome"), FAVOUR_FLAG],
    dials: { ...start.dials, [FAVOUR_DIAL]: goodwill },
  };
}

const offer = (placeKey: string, state: PlaceState | undefined, ctx = hurt) =>
  favoursAt({ placeKey, state, context: ctx });

describe("who will do anything for you", () => {
  it("is nobody until a place is glad to see you", () => {
    expect(offer(CLINIC, undefined)).toEqual([]);
    const cold = { ...startingState(CLINIC), flags: [] };
    expect(offer(CLINIC, cold)).toEqual([]);
    expect(offer(CLINIC, { ...cold, flags: ["unwelcome"] })).toEqual([]);
  });

  it("lists what the ground supports, and only that", () => {
    const keys = (placeKey: string) => offer(placeKey, welcomed(placeKey)).map((o) => o.key);
    expect(keys(CLINIC)).toEqual(["patch_up"]);
    expect(keys(HOME)).toEqual(expect.arrayContaining(["patch_up", "lay_low"]));
  });

  it("says nothing about a place that is not on the map", () => {
    expect(offer("zz9", welcomed(CLINIC))).toEqual([]);
  });
});

describe("a day's kindness", () => {
  it("heals what a day of rest would, never more than is missing", () => {
    const [patch] = offer(CLINIC, welcomed(CLINIC));
    expect(patch).toMatchObject({ ready: true, hpHealed: 6, reason: null });
    const nearlyWell = offer(CLINIC, welcomed(CLINIC), { ...hurt, hpCurrent: 33 })[0]!;
    expect(nearlyWell.hpHealed).toBe(2);
  });

  it("is not offered to somebody who is not hurt, or who is past it", () => {
    const well = offer(CLINIC, welcomed(CLINIC), { ...hurt, hpCurrent: 35 })[0]!;
    expect(well).toMatchObject({ ready: false, reason: "You are not hurt." });
    const dying = offer(CLINIC, welcomed(CLINIC), { ...hurt, hpCurrent: 0 })[0]!;
    expect(dying.ready).toBe(false);
    expect(dying.hpHealed).toBe(0);
  });

  it("counts a Medtech's standing self-care", () => {
    const [patch] = offer(CLINIC, welcomed(CLINIC), { ...hurt, perDayBonus: 2 });
    expect(patch!.hpHealed).toBe(8);
  });
});

describe("losing the law", () => {
  const lay = (ctx: FavourContext, at = HOME) =>
    offer(at, welcomed(at), ctx).find((o) => o.key === "lay_low")!;

  it("takes off no more heat than there is, nor more than two segments scaled to the district", () => {
    const scale = heatMultiplier(districtOfPlace(HOME)!.key);
    const worth = Math.min(3, Math.round(2 * scale));
    expect(lay({ ...hurt, heat: 6 }).heatEased).toBe(worth);
    expect(lay({ ...hurt, heat: 1 }).heatEased).toBe(Math.min(1, worth));
  });

  it("is not offered when nobody is looking", () => {
    expect(lay({ ...hurt, heat: 0 })).toMatchObject({
      ready: false,
      reason: "Nobody is looking for you.",
    });
  });

  it("is two reports of working clean, the same thing the engine already says takes heat off", () => {
    expect(layLowReports()).toEqual([
      { observation: "clean", factionId: null },
      { observation: "clean", factionId: null },
    ]);
  });
});

describe("a favour is not an account", () => {
  it("is asked once a day of any one place", () => {
    const [patch] = offer(CLINIC, welcomed(CLINIC), { ...hurt, calledToday: true });
    expect(patch).toMatchObject({ ready: false, reason: "They have done enough for you today." });
  });

  it("is never asked when it would leave a place with nothing", () => {
    const cost = FAVOUR_TEMPLATES.find((f) => f.key === "patch_up")!.cost;
    const spent = offer(CLINIC, welcomed(CLINIC, cost))[0]!;
    expect(spent.ready).toBe(false);
    expect(offer(CLINIC, welcomed(CLINIC, cost + 1))[0]!.ready).toBe(true);
  });

  it("spends goodwill and nothing else, and leaves the place glad to see you", () => {
    const before = welcomed(CLINIC, 6);
    const [patch] = offer(CLINIC, before);
    const after = afterFavour(before, patch!);
    expect(after.dials[FAVOUR_DIAL]).toBe(6 - patch!.cost);
    expect(after.flags).toEqual(before.flags);
    expect(after.visits).toBe(before.visits);
    expect(afterFavour(welcomed(CLINIC, 1), { cost: 5 }).dials[FAVOUR_DIAL]).toBe(0);
  });
});

describe("the favours file", () => {
  it("is a house rule, and says so", () => {
    expect(FAVOURS_ARE_HOUSE_RULE).toBe(true);
    expect(data.houseRule).toBe(true);
  });

  it("only has effects the engine knows how to apply", () => {
    for (const f of FAVOUR_TEMPLATES) expect(["patch", "lay_low"]).toContain(f.effect);
  });

  it("names no number a player could mistake for a promise", () => {
    for (const f of FAVOUR_TEMPLATES) expect(`${f.label} ${f.description}`).not.toMatch(/\d/);
  });

  it("can always be afforded by a place that has reached the top", () => {
    for (const f of FAVOUR_TEMPLATES) {
      expect(f.cost, f.key).toBeGreaterThan(0);
      expect(f.minutes, f.key).toBeGreaterThan(0);
      // Welcome resets the dial to 6; the favour must leave at least one.
      expect(6 - f.cost, f.key).toBeGreaterThanOrEqual(1);
    }
  });

  it("is on ground where somebody can actually become welcome", () => {
    const keys: string[] = [];
    for (const d of (night as unknown as { districts: { locations: { key: string }[] }[] })
      .districts) {
      for (const l of d.locations) keys.push(l.key);
    }
    for (const f of FAVOUR_TEMPLATES) {
      const places = keys.filter(
        (k) =>
          (tagsOf(k) as string[]).some((t) => f.tags.includes(t)) &&
          dialsOf(k).includes(FAVOUR_DIAL),
      );
      expect(places.length, `${f.key} has nowhere to be asked`).toBeGreaterThan(0);
    }
  });
});

describe("the ledger's side of it", () => {
  const written = favourCalledEventData({
    placeKey: CLINIC,
    favour: "patch_up",
    effect: "patch",
    spent: 2,
    hpHealed: 6,
    heatEased: 0,
    minutes: 120,
    day: 12,
  });

  it("round-trips through the writer and the reader", () => {
    expect(readFavourCalledEventData(written)).toEqual(written);
    expect(readFavourCalledEventData({ favour: "x" })).toBeNull();
    expect(readFavourCalledEventData(null)).toBeNull();
  });

  it("remembers a favour for the day it was done, at the place that did it", () => {
    const events = [{ type: "favour_called", data: written }];
    expect(favourCalledOn(events, CLINIC, 12)).toBe(true);
    expect(favourCalledOn(events, CLINIC, 13)).toBe(false);
    expect(favourCalledOn(events, HOME, 12)).toBe(false);
    expect(favourCalledOn([{ type: "purchase", data: written }], CLINIC, 12)).toBe(false);
  });
});
