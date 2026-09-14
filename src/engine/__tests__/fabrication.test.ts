/**
 * A Tech at the bench.
 *
 * The Maker DV-and-time table and the price ladder were both already in the
 * repository with no consumer. These tests hold the join between them to the
 * printed rule, and hold the one thing that makes the bench worth using: parts
 * cost a category less than the finished thing.
 */
import { describe, expect, it } from "vitest";
import {
  AMMUNITION,
  ARMOR,
  FABRICABLE_KINDS,
  GEAR,
  PRICE_CATEGORY_LADDER,
  WEAPONS,
  canFabricate,
  categoryBelow,
  categoryCost,
  describeDuration,
  itemCost,
  makerTimeMinutes,
  planFabrication,
  priceCategoryContext,
  repairSkillFor,
  rollFabrication,
  type ItemKind,
} from "@/engine";

/** Scripted d10, so a plan's DV can be walked either side of. */
const die = (face: number) => () => (face - 1) / 10;

describe("what a bench can turn out", () => {
  it("builds weapons, armor, ammunition and gear, and nothing else", () => {
    expect(FABRICABLE_KINDS).toEqual(["weapon", "armor", "ammunition", "gear"]);
    // Chrome is a surgical install, not a thing you put in a bag.
    expect(canFabricate("cyberware" as ItemKind)).toBe(false);
    expect(planFabrication("cyberware" as ItemKind, "cyberaudio_suite")).toBeNull();
  });

  it("plans every fabricable catalog line rather than half of them", () => {
    for (const weapon of WEAPONS) {
      expect(planFabrication("weapon", weapon.id), weapon.name).not.toBeNull();
    }
    for (const armor of ARMOR) {
      expect(planFabrication("armor", armor.id), armor.name).not.toBeNull();
    }
    for (const gear of GEAR) {
      expect(planFabrication("gear", gear.id), gear.name).not.toBeNull();
    }
    for (const ammo of AMMUNITION) {
      expect(planFabrication("ammunition", ammo.id), ammo.name).not.toBeNull();
    }
  });

  it("returns null for an item the catalog does not know", () => {
    expect(planFabrication("weapon", "orbital_laser")).toBeNull();
  });
});

describe("materials cost a price category less", () => {
  it("is the whole reason to build rather than buy", () => {
    // A 500eb Expensive weapon out of 100eb of Premium parts.
    const plan = planFabrication("weapon", "very_heavy_melee");
    expect(plan).not.toBeNull();
    expect(plan!.itemPrice).toBe(500);
    expect(plan!.category).toBe("Expensive");
    expect(plan!.materialsCategory).toBe("Premium");
    expect(plan!.materialsCost).toBe(100);
  });

  it("never asks more for the parts than the finished thing costs", () => {
    for (const kind of FABRICABLE_KINDS) {
      for (const plan of buildablePlans(kind)) {
        expect(plan.materialsCost, plan.itemName).toBeLessThanOrEqual(plan.itemPrice);
        expect(plan.materialsCost, plan.itemName).toBeGreaterThan(0);
      }
    }
  });

  it("charges the cheapest things their own category, having no rung below", () => {
    expect(categoryBelow(PRICE_CATEGORY_LADDER[0]!)).toBeNull();
    const cheap = buildablePlans("gear").find((p) => p.category === "Cheap");
    if (cheap) expect(cheap.materialsCost).toBe(categoryCost("Cheap"));
  });

  it("reads each rung's cost off the printed ladder", () => {
    expect(categoryCost("Cheap")).toBe(10);
    expect(categoryCost("Premium")).toBe(100);
    expect(categoryCost("Very Expensive")).toBe(1000);
    expect(categoryBelow("Expensive")).toBe("Premium");
  });
});

describe("the DV and the time come off the Maker table", () => {
  it("matches the table the Tech's own rules text prints", () => {
    const cases: [string, number, string][] = [
      ["Everyday", 9, "1 hour"],
      ["Costly", 13, "6 hours"],
      ["Premium", 17, "1 day"],
      ["Expensive", 21, "1 week"],
    ];
    for (const [category, dv, time] of cases) {
      const context = priceCategoryContext(category);
      expect(context?.techDV, category).toBe(dv);
      expect(context?.techTime, category).toBe(time);
    }
  });

  it("turns the printed durations into minutes", () => {
    expect(makerTimeMinutes("1 hour", 20)).toBe(60);
    expect(makerTimeMinutes("6 hours", 50)).toBe(360);
    expect(makerTimeMinutes("1 day", 100)).toBe(1440);
    expect(makerTimeMinutes("1 week", 500)).toBe(7 * 1440);
    expect(makerTimeMinutes("2 weeks", 1000)).toBe(14 * 1440);
    expect(makerTimeMinutes("1 month", 5000)).toBe(30 * 1440);
  });

  it("repeats the Super Luxury row per 10,000eb, rounding a part-step up", () => {
    const month = 30 * 1440;
    const row = "1 month per 10,000eb of Cost";
    expect(makerTimeMinutes(row, 10_000)).toBe(month);
    expect(makerTimeMinutes(row, 10_001)).toBe(2 * month);
    expect(makerTimeMinutes(row, 25_000)).toBe(3 * month);
    // Never free, however cheap the caller claims it is.
    expect(makerTimeMinutes(row, 0)).toBe(month);
  });

  it("reads a duration back the way a person would say it", () => {
    expect(describeDuration(60)).toBe("1 hour");
    expect(describeDuration(360)).toBe("6 hours");
    expect(describeDuration(1440)).toBe("1 day");
    expect(describeDuration(7 * 1440)).toBe("1 week");
    expect(describeDuration(30 * 1440)).toBe("1 month");
  });

  it("always costs some time — a build is never instant", () => {
    for (const kind of FABRICABLE_KINDS) {
      for (const plan of buildablePlans(kind)) {
        expect(plan.minutes, plan.itemName).toBeGreaterThan(0);
      }
    }
  });
});

describe("the repair Skill", () => {
  it("builds guns and rounds with Weaponstech and everything else with Basic Tech", () => {
    expect(repairSkillFor("weapon", WEAPONS[0]!.id)).toBe("weaponstech");
    expect(repairSkillFor("ammunition", "basic_ammo")).toBe("weaponstech");
    expect(repairSkillFor("armor", ARMOR[0]!.id)).toBe("basic_tech");
    expect(repairSkillFor("gear", GEAR[0]!.id)).toBe("basic_tech");
  });
});

describe("rolling the build", () => {
  const plan = planFabrication("armor", "kevlar")!; // Costly: DV 13

  it("is TECH + the repair Skill + the Fabrication Rank + 1d10", () => {
    // TECH 6 + Skill 4 + Rank 2 = 12, and a 2 makes 14 against DV 13.
    const result = rollFabrication({ plan, tech: 6, skillLevel: 4, specialtyRank: 2 }, die(2));
    expect(result.built).toBe(true);
    expect(result.total).toBe(14);
    expect(result.modifiers.map((m) => m.label)).toContain("Fabrication Expertise");
  });

  it("fails without the Rank on the same dice", () => {
    const result = rollFabrication({ plan, tech: 6, skillLevel: 4, specialtyRank: 0 }, die(2));
    expect(result.built).toBe(false);
    expect(result.modifiers.map((m) => m.label)).not.toContain("Fabrication Expertise");
  });

  it("takes the caller's own modifiers too, so wounds follow you to the bench", () => {
    const result = rollFabrication(
      {
        plan,
        tech: 6,
        skillLevel: 4,
        specialtyRank: 2,
        modifiers: [{ label: "Wounds", value: -4 }],
      },
      die(2),
    );
    expect(result.total).toBe(10);
    expect(result.built).toBe(false);
  });

  it("carries the plan through, so a caller never re-derives the price", () => {
    const result = rollFabrication({ plan, tech: 6, skillLevel: 4, specialtyRank: 2 }, die(9));
    expect(result.plan.materialsCost).toBe(plan.materialsCost);
    expect(result.plan.itemPrice).toBe(itemCost("armor", "kevlar"));
  });
});

/** Every plan for one kind, for the properties that must hold across the catalog. */
function buildablePlans(kind: ItemKind) {
  const ids =
    kind === "weapon"
      ? WEAPONS.map((w) => w.id)
      : kind === "armor"
        ? ARMOR.map((a) => a.id)
        : kind === "gear"
          ? GEAR.map((g) => g.id)
          : kind === "ammunition"
            ? AMMUNITION.map((a) => a.id)
            : [];
  return ids.flatMap((id) => {
    const plan = planFabrication(kind, id);
    return plan ? [plan] : [];
  });
}

describe("the top of the ladder", () => {
  /**
   * A 10,000eb Super Luxury weapon is the one row that does not take the
   * category below: the rules say materials worth half its Price, and the time
   * repeats per 10,000eb. Worth its own test because it is the only branch in
   * the module and the easiest one to get silently wrong.
   */
  it("takes half the Price in materials rather than the rung below", () => {
    const plan = planFabrication("weapon", "malorian_3516");
    expect(plan).not.toBeNull();
    expect(plan!.itemPrice).toBe(10_000);
    expect(plan!.category).toBe("Super Luxury");
    expect(plan!.materialsCost).toBe(5_000);
    expect(plan!.minutes).toBe(30 * 1440);
  });

  it("still takes the rung below one step down the ladder", () => {
    const plan = planFabrication("weapon", "kendachi_mono_three");
    expect(plan!.itemPrice).toBe(5_000);
    expect(plan!.category).toBe("Luxury");
    expect(plan!.materialsCategory).toBe("Very Expensive");
    expect(plan!.materialsCost).toBe(1_000);
  });
});
