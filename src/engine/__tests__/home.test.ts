import { describe, expect, it } from "vitest";
import {
  buildingsFor,
  homeRates,
  housingChoices,
  MOVE_DEPOSIT_MONTHS,
  MOVE_MINUTES,
  planMove,
  startingHomeOf,
  type Home,
  type MoveInput,
} from "../home";
import { everyStartingHome, execHomes } from "../startingHome";
import { DOWNTIME_MONTH_DAYS } from "../downtime";

const container: Home = { housingId: "cargo_container", lifestyleId: "kibble", placeKey: "x3" };
const studio = (placeKey: string): Home => ({
  housingId: "studio_apartment",
  lifestyleId: "kibble",
  placeKey,
});
const anyStudio = buildingsFor("studio_apartment")[0]!.key;

const input = (over: Partial<MoveInput> = {}): MoveInput => ({
  roleId: "solo",
  current: container,
  target: studio(anyStudio),
  eurobucks: 5000,
  clock: { day: 10, minute: 600 },
  paidThroughDay: DOWNTIME_MONTH_DAYS,
  ...over,
});

describe("the homes on offer", () => {
  it("starts every Role where creation put them", () => {
    expect(startingHomeOf("solo", "x3")).toEqual(container);
    expect(startingHomeOf("exec", "a3").housingId).toBe("corporate_conapt");
  });

  it("prices a home off the printed tables", () => {
    expect(homeRates(container)).toEqual({ rent: 1000, lifestyleCost: 100 });
    expect(
      homeRates({ housingId: "corporate_conapt", lifestyleId: "fresh_food", placeKey: null }),
    ).toEqual({ rent: 0, lifestyleCost: 1500 });
  });

  it("offers the corporate conapt only to the Role it is granted to", () => {
    expect(housingChoices("solo").map((h) => h.id)).not.toContain("corporate_conapt");
    expect(housingChoices("exec").map((h) => h.id)).toContain("corporate_conapt");
  });

  it("has somewhere to rent every kind of home it offers", () => {
    for (const h of housingChoices("exec")) expect(buildingsFor(h.id).length).toBeGreaterThan(0);
  });

  it("can always move back to the kind of building creation offered", () => {
    const containers = buildingsFor("cargo_container").map((b) => b.key);
    for (const home of everyStartingHome()) expect(containers).toContain(home.key);
    const conapts = buildingsFor("corporate_conapt").map((b) => b.key);
    for (const home of execHomes()) expect(conapts).toContain(home.key);
  });
});

describe("a move", () => {
  it("costs a deposit of the new rent and most of a day", () => {
    const v = planMove(input());
    if (!v.ok) throw new Error(v.reason);
    expect(v.plan).toMatchObject({
      moving: true,
      deposit: 1500 * MOVE_DEPOSIT_MONTHS,
      perMonthBefore: 1100,
      perMonthAfter: 1600,
      minutes: MOVE_MINUTES,
    });
    expect(v.plan.clockAfter.day * 1440 + v.plan.clockAfter.minute).toBe(
      10 * 1440 + 600 + MOVE_MINUTES,
    );
  });

  it("charges nothing and takes no time to change what you eat", () => {
    const v = planMove(input({ target: { ...container, lifestyleId: "good_prepak" } }));
    if (!v.ok) throw new Error(v.reason);
    expect(v.plan).toMatchObject({ moving: false, deposit: 0, minutes: 0, perMonthAfter: 1600 });
  });

  it("is refused while rent is owed where you are", () => {
    const v = planMove(input({ clock: { day: DOWNTIME_MONTH_DAYS * 2 + 1, minute: 0 } }));
    expect(v).toMatchObject({ ok: false, reason: expect.stringContaining("owe") });
  });

  it("is refused when the deposit is more than you have", () => {
    expect(planMove(input({ eurobucks: 100 })).ok).toBe(false);
  });

  it("is refused at a building that does not rent that kind of home", () => {
    const corp = buildingsFor("corporate_conapt")[0]!.key;
    expect(planMove(input({ target: studio(corp) })).ok).toBe(false);
  });

  it("is refused for a kind of home this Role is not offered, and for no change at all", () => {
    const corp = buildingsFor("corporate_conapt")[0]!.key;
    expect(
      planMove(
        input({ target: { housingId: "corporate_conapt", lifestyleId: "kibble", placeKey: corp } }),
      ).ok,
    ).toBe(false);
    expect(planMove(input({ target: container })).ok).toBe(false);
  });
});
