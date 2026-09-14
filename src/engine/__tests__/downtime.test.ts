/**
 * Downtime arithmetic. The rules under test: healing is BODY per full day of
 * rest, monthly costs come due a whole month at a time, and resting never costs
 * more days than the wound actually needs — which is what keeps a week in bed
 * from quietly eating a month's rent for nothing.
 */
import { describe, expect, it } from "vitest";
import {
  DOWNTIME_MONTH_DAYS,
  armorRepairCost,
  billsDue,
  canAfford,
  healingPerDay,
  planRest,
  purchaseCost,
  selfCareBonus,
} from "../downtime";

describe("healing", () => {
  it("recovers HP equal to BODY for each full day of rest", () => {
    expect(healingPerDay(7)).toBe(7);
    const plan = planRest({ days: 3, hpCurrent: 10, hpMax: 40, body: 7 });
    expect(plan.hpHealed).toBe(21);
    expect(plan.hpAfter).toBe(31);
    expect(plan.days).toBe(3);
  });

  it("never heals past full, and never charges days it did not need", () => {
    // Two days would cover 14, but only 5 HP are missing: one day does it.
    const plan = planRest({ days: 2, hpCurrent: 35, hpMax: 40, body: 7 });
    expect(plan.hpAfter).toBe(40);
    expect(plan.hpHealed).toBe(5);
    expect(plan.days).toBe(1);
  });

  it("rests nobody who is already whole", () => {
    const plan = planRest({ days: 5, hpCurrent: 40, hpMax: 40, body: 7 });
    expect(plan).toMatchObject({ days: 0, hpHealed: 0, hpAfter: 40, daysToFull: 0 });
  });

  it("says how long the wound will actually take", () => {
    // 30 missing at BODY 7 is five days, the last one only partly used.
    expect(planRest({ days: 0, hpCurrent: 10, hpMax: 40, body: 7 }).daysToFull).toBe(5);
  });

  it("does not heal a character with no BODY to heal with", () => {
    const plan = planRest({ days: 5, hpCurrent: 1, hpMax: 40, body: 0 });
    expect(plan).toMatchObject({ days: 0, hpHealed: 0, daysToFull: 0 });
  });

  it("refuses negative days rather than draining HP", () => {
    expect(planRest({ days: -3, hpCurrent: 10, hpMax: 40, body: 7 }).hpHealed).toBe(0);
  });
});

describe("bills", () => {
  const rates = { rent: 1000, lifestyleCost: 100 };

  it("owes nothing until a full month has passed", () => {
    const due = billsDue({ day: 20, paidThroughDay: 0, ...rates });
    expect(due).toMatchObject({ months: 0, total: 0, paidThroughDay: 0 });
  });

  it("charges rent and Lifestyle together once the month turns", () => {
    const due = billsDue({ day: DOWNTIME_MONTH_DAYS, paidThroughDay: 0, ...rates });
    expect(due).toMatchObject({ months: 1, rent: 1000, lifestyle: 100, total: 1100 });
    expect(due.paidThroughDay).toBe(DOWNTIME_MONTH_DAYS);
  });

  it("charges every month a long lie-low ran through", () => {
    const due = billsDue({ day: DOWNTIME_MONTH_DAYS * 3 + 5, paidThroughDay: 0, ...rates });
    expect(due.months).toBe(3);
    expect(due.total).toBe(3300);
    // The leftover days carry: paying settles three months, not the stray five.
    expect(due.paidThroughDay).toBe(DOWNTIME_MONTH_DAYS * 3);
  });

  it("owes nothing on a rent-free roof", () => {
    const due = billsDue({ day: 90, paidThroughDay: 0, rent: 0, lifestyleCost: 0 });
    expect(due.total).toBe(0);
    expect(due.months).toBe(3); // the months still passed
  });

  it("knows when the take does not cover it", () => {
    expect(canAfford(1500, 1100)).toBe(true);
    expect(canAfford(900, 1100)).toBe(false);
    expect(canAfford(1100, 1100)).toBe(true);
  });
});

describe("buying and repairing", () => {
  it("prices a purchase at catalog price times quantity", () => {
    const one = purchaseCost("ammunition", "basic_ammo", 1);
    expect(purchaseCost("ammunition", "basic_ammo", 4)).toBe(one * 4);
  });

  it("charges nothing for a quantity of none", () => {
    expect(purchaseCost("ammunition", "basic_ammo", 0)).toBe(0);
  });

  it("charges for the SP a piece is actually missing", () => {
    const full = armorRepairCost({
      kind: "armor",
      itemId: "light_armorjack",
      currentSp: 11,
      maxSp: 11,
    });
    expect(full).toEqual({ missingSp: 0, cost: 0 });

    const chewed = armorRepairCost({
      kind: "armor",
      itemId: "light_armorjack",
      currentSp: 7,
      maxSp: 11,
    });
    expect(chewed.missingSp).toBe(4);
    expect(chewed.cost).toBeGreaterThan(0);
  });

  it("scales the bill with the damage", () => {
    const light = armorRepairCost({
      kind: "armor",
      itemId: "light_armorjack",
      currentSp: 10,
      maxSp: 11,
    });
    const heavy = armorRepairCost({
      kind: "armor",
      itemId: "light_armorjack",
      currentSp: 3,
      maxSp: 11,
    });
    expect(heavy.cost).toBeGreaterThan(light.cost);
  });
});

describe("a Medtech's own recovery", () => {
  it("adds the self-care bonus to the printed BODY rate", () => {
    // The house rule: the better of Surgery and Medical Tech over 4, capped at 2.
    expect(selfCareBonus(0)).toBe(0);
    expect(selfCareBonus(3)).toBe(0);
    expect(selfCareBonus(4)).toBe(1);
    expect(selfCareBonus(8)).toBe(2);
    expect(selfCareBonus(10)).toBe(2);

    const plan = planRest({ days: 3, hpCurrent: 10, hpMax: 40, body: 7, perDayBonus: 2 });
    expect(plan.perDay).toBe(9);
    expect(plan.hpHealed).toBe(27);
  });

  it("leaves every other Role's rest exactly as it was", () => {
    const plain = planRest({ days: 3, hpCurrent: 10, hpMax: 40, body: 7 });
    expect(plain.perDay).toBe(7);
    expect(plain.hpHealed).toBe(21);
    expect(plain.courseDays).toBe(0);
  });
});

describe("a course of Antibiotic", () => {
  // The printed drug: +2 HP a day for a week. The point of modelling it as a
  // course rather than a rate is that it RUNS OUT.
  const course = { hpPerDay: 2, days: 7 };

  it("heals faster for the days it covers", () => {
    const plan = planRest({ days: 3, hpCurrent: 0, hpMax: 60, body: 5, course });
    expect(plan.perDay).toBe(5);
    expect(plan.perDayOnCourse).toBe(7);
    expect(plan.courseDays).toBe(3);
    expect(plan.hpHealed).toBe(21);
  });

  it("runs out partway through a longer rest and stops helping", () => {
    // Ten days: seven at 7 a day (49) and three at 5 (15) = 64, capped at 60.
    const plan = planRest({ days: 10, hpCurrent: 0, hpMax: 60, body: 5, course });
    expect(plan.courseDays).toBe(7);
    expect(plan.hpHealed).toBe(60);
    // And it got there sooner than the nine days a plain BODY 5 rest needs.
    expect(plan.daysToFull).toBeLessThan(
      planRest({ days: 99, hpCurrent: 0, hpMax: 60, body: 5 }).daysToFull,
    );
  });

  it("still never rests more days than the wound needs", () => {
    const plan = planRest({ days: 9, hpCurrent: 54, hpMax: 60, body: 5, course });
    expect(plan.days).toBe(1);
    expect(plan.hpAfter).toBe(60);
  });

  it("terminates when nothing can heal at all", () => {
    const plan = planRest({ days: 5, hpCurrent: 1, hpMax: 40, body: 0 });
    expect(plan.daysToFull).toBe(0);
    expect(plan.hpHealed).toBe(0);
  });
});
