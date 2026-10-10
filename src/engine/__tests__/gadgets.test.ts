import { describe, expect, it } from "vitest";
import {
  GADGET_BASES,
  GADGET_CAPABILITIES,
  GADGET_LIMITS,
  GADGETS_ARE_HOUSE_RULE,
  OBSERVATIONS,
  gadgetFinds,
  gadgetId,
  gadgetTurnEffects,
  getGear,
  isConsumable,
  itemName,
  kitBonuses,
  looksLikeGadget,
  readGadget,
  seededRng,
  shopStock,
  getVendor,
  placeVendorId,
  operateGadget,
} from "@/engine";

const LADDER = [10, 20, 50, 100, 500, 1000, 5000];

describe("the vocabulary", () => {
  it("is a house rule", () => {
    expect(GADGETS_ARE_HOUSE_RULE).toBe(true);
  });

  it("only ever suppresses or adds observations the engine prices", () => {
    for (const cap of Object.values(GADGET_CAPABILITIES)) {
      for (const o of cap.suppresses) expect(OBSERVATIONS).toContain(o);
    }
    for (const limit of Object.values(GADGET_LIMITS)) {
      for (const o of limit.adds ?? []) expect(OBSERVATIONS).toContain(o);
    }
  });

  it("gives every base only capabilities and limits that exist, and a printed price", () => {
    for (const base of GADGET_BASES) {
      expect(base.capabilities.length).toBeGreaterThan(0);
      for (const c of base.capabilities) expect(GADGET_CAPABILITIES[c]).toBeDefined();
      for (const l of base.limits) expect(GADGET_LIMITS[l]).toBeDefined();
      expect(LADDER).toContain(base.cost);
    }
  });

  it("never lets one find hide you and be conspicuous at once", () => {
    for (const base of GADGET_BASES) {
      if (base.capabilities.includes("remote") && base.limits.includes("conspicuous")) {
        // A remote find that is conspicuous is the crawler: you are seen with it, the act is not.
        expect(GADGET_CAPABILITIES["remote"]!.suppresses).toEqual(["seen"]);
      }
    }
  });
});

describe("a find is its id", () => {
  it("reads every combination the data allows, the same way every time, on the price ladder", () => {
    for (const base of GADGET_BASES) {
      for (const cap of base.capabilities) {
        for (const limit of base.limits) {
          const id = gadgetId(base.id, cap, limit, 3);
          const gadget = readGadget(id)!;
          expect(gadget).not.toBeNull();
          expect(readGadget(id)).toEqual(gadget);
          expect(LADDER).toContain(gadget.cost);
          expect(gadget.cost).toBeLessThanOrEqual(base.cost);
          expect(gadget.contract).toContain(GADGET_CAPABILITIES[cap]!.contract);
          expect(gadget.name).toContain(base.noun);
        }
      }
    }
  });

  it("refuses anything the data does not allow, rather than guessing powers for it", () => {
    for (const id of [
      "gadget.hush_wrap.remote.none.0", // a capability the base does not have
      "gadget.hush_wrap.quiet.conspicuous.0", // a limit the base does not have
      "gadget.nope.quiet.none.0",
      "gadget.hush_wrap.quiet.none.9999",
      "gadget.hush_wrap.quiet.none.-1",
      "gadget.hush_wrap.quiet.none",
      "rope_60m_yd",
    ]) {
      expect(readGadget(id)).toBeNull();
    }
    expect(() => gadgetId("hush_wrap", "remote", "none", 0)).toThrow();
  });

  it("is named, priced and described by the catalog like any gear line", () => {
    const id = gadgetId("sound_puck", "remote", "none", 0);
    expect(looksLikeGadget(id)).toBe(true);
    expect(itemName("gear", id)).toBe(readGadget(id)!.name);
    expect(getGear(id).cost).toBe(readGadget(id)!.cost);
    expect(getGear(id).description).toContain("not record you as seen");
  });

  it("is spent on use only when it is one-use", () => {
    expect(isConsumable(gadgetId("gel_tube", "quiet", "single_use", 0))).toBe(true);
    expect(isConsumable(gadgetId("hush_wrap", "quiet", "none", 0))).toBe(false);
    expect(isConsumable("gadget.nope.quiet.none.0")).toBe(false);
  });
});

describe("what turns up", () => {
  it("is the same all week and usually nothing", () => {
    let none = 0;
    for (let period = 0; period < 200; period += 1) {
      const input = { seed: "camp", vendorId: "street@o3", archetype: "street", period };
      const finds = gadgetFinds(input);
      expect(gadgetFinds(input)).toEqual(finds);
      if (finds.length === 0) none += 1;
      expect(new Set(finds.map((f) => f.base)).size).toBe(finds.length);
      for (const f of finds) expect(f.sellers).toContain("street");
    }
    expect(none).toBeGreaterThan(100);
  });

  it("turns up more at a shop that leans in", () => {
    const count = (lean: number) =>
      Array.from({ length: 200 }, (_, period) =>
        gadgetFinds({ seed: "camp", vendorId: "x", archetype: "street", period, lean }),
      ).reduce((n, f) => n + f.length, 0);
    expect(count(2)).toBeGreaterThan(count(0));
  });

  it("puts nothing on a seller no base is sold by", () => {
    expect(
      gadgetFinds({ seed: "c", vendorId: "fixer", archetype: "fixer", period: 0, lean: 9 }),
    ).toEqual([]);
  });

  it("sits on a shop's shelf one of a kind, and is gone once bought", () => {
    const swap = getVendor(placeVendorId("street", "k3"));
    let day = 1;
    let finds = shopStock({ vendor: swap, seed: "camp", day }).filter((i) => i.layer === "find");
    while (!finds.length) {
      day += 7;
      finds = shopStock({ vendor: swap, seed: "camp", day }).filter((i) => i.layer === "find");
    }
    const find = finds[0]!;
    expect(find.left).toBe(1);
    expect(find.price).toBe(readGadget(find.itemId)!.cost);
    const after = shopStock({
      vendor: swap,
      seed: "camp",
      day,
      bought: { [`gear:${find.itemId}`]: 1 },
    }).find((i) => i.itemId === find.itemId)!;
    expect(after.available).toBe(false);
  });
});

describe("using one", () => {
  const quiet = readGadget(gadgetId("hush_wrap", "quiet", "none", 0))!;
  const remote = readGadget(gadgetId("sound_puck", "remote", "none", 0))!;
  const quick = readGadget(gadgetId("tool_roll", "quick", "none", 0))!;
  const loudCutters = readGadget(gadgetId("foam_cutters", "quiet", "conspicuous", 0))!;

  it("keeps a quiet act from being heard, and says so only when it was going to be", () => {
    const heard = gadgetTurnEffects([operateGadget(quiet)], ["loud", "property"]);
    expect(heard.observations).toEqual(["property"]);
    expect(heard.lines).toHaveLength(1);
    const silent = gadgetTurnEffects([operateGadget(quiet)], ["property"]);
    expect(silent.observations).toEqual(["property"]);
    expect(silent.lines).toHaveLength(0);
  });

  it("keeps you from being seen doing what a remote find did", () => {
    expect(gadgetTurnEffects([operateGadget(remote)], ["seen", "loud"]).observations).toEqual([
      "loud",
    ]);
  });

  it("halves the time, but only where a turn's time is the activity's", () => {
    expect(gadgetTurnEffects([operateGadget(quick)], []).timeFactor).toBe(0.5);
    const job = gadgetTurnEffects([operateGadget(quick)], [], { timed: false });
    expect(job.timeFactor).toBe(1);
    expect(job.lines).toHaveLength(0);
  });

  it("costs a conspicuous thing a sighting", () => {
    const out = gadgetTurnEffects([operateGadget(loudCutters)], ["loud"]);
    expect(out.observations).toEqual(["seen"]);
  });

  it("lets a temperamental one fail on a 1 or 2, and changes nothing when it does", () => {
    const flaky = readGadget(gadgetId("sound_puck", "remote", "unreliable", 0))!;
    const outcomes = new Set<boolean>();
    for (let seed = 0; seed < 40; seed += 1) {
      const use = operateGadget(flaky, seededRng(seed));
      outcomes.add(use.worked);
      expect(use.roll).not.toBeNull();
      expect(use.worked).toBe(use.roll!.rolls[0]! > 2);
      if (!use.worked) {
        const out = gadgetTurnEffects([use], ["seen"]);
        expect(out.observations).toEqual(["seen"]);
        expect(out.lines[0]).toContain("did nothing");
      }
    }
    expect(outcomes.size).toBe(2);
  });
});

describe("the printed kit bonuses", () => {
  it("adds a Medscanner's +2 to First Aid and Paramedic, and nothing else", () => {
    expect(kitBonuses(["medscanner"], "first_aid")).toEqual([{ label: "Medscanner", value: 2 }]);
    expect(kitBonuses(["medscanner"], "paramedic")).toEqual([{ label: "Medscanner", value: 2 }]);
    expect(kitBonuses(["medscanner"], "perception")).toEqual([]);
    expect(kitBonuses([], "first_aid")).toEqual([]);
  });

  it("does not stack two of the same thing", () => {
    expect(kitBonuses(["agent", "agent"], "library_search")).toHaveLength(1);
  });

  it("names only Skills that exist", async () => {
    const { KIT_BONUSES, getSkill } = await import("@/engine");
    for (const bonus of KIT_BONUSES) {
      for (const skill of bonus.skills) expect(() => getSkill(skill)).not.toThrow();
      expect(() => getGear(bonus.item)).not.toThrow();
    }
  });
});
