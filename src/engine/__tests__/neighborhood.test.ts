import { describe, expect, it } from "vitest";
import {
  clinicDescription,
  clinicDestination,
  neighborhoodMoment,
  planNeighborhood,
  readNeighborhood,
  NEIGHBORHOOD_FLAG,
  type Neighborhood,
  type NeighborhoodContext,
} from "../neighborhood";

const ctx = (place: string, over: Partial<NeighborhoodContext> = {}): NeighborhoodContext => ({
  place,
  role: "solo",
  cash: 150,
  hp: 16,
  maxHp: 40,
  serious: 20,
  clock: { day: 7, minute: 600 },
  ...over,
});
const open: Neighborhood = {
  keys: "keys",
  staff: "staff",
  equipment: "unload",
  lease: "residents",
};
const ids = (s: Neighborhood, c: NeighborhoodContext) =>
  neighborhoodMoment(s, c)?.choices.map((choice) => choice.id);
function take(s: Neighborhood, c: NeighborhoodContext, id: string) {
  const planned = planNeighborhood(s, c, id);
  return readNeighborhood([
    { flag: NEIGHBORHOOD_FLAG, value: JSON.parse(JSON.stringify({ ...s, ...planned.patch })) },
  ]);
}

describe("Old Japantown Life scenes", () => {
  it("starts an existing campaign with no neighborhood flag and preserves an unknown record", () => {
    expect(readNeighborhood([{ flag: "other", value: 7 }])).toEqual({});
    expect(() =>
      readNeighborhood([{ flag: NEIGHBORHOOD_FLAG, value: { counterLead: "new-version" } }]),
    ).toThrow();
  });
  it.each(["fixer", "medtech", "nomad"])(
    "lets a %s arrange a second delivery and resume after the trip",
    (role) => {
      const c = ctx("h8", { role });
      expect(ids({}, c)).toEqual(["ticket", role]);
      const s = take({}, c, role);
      expect(ids(s, c)).toContain("split");
      expect(() => planNeighborhood(s, ctx("h7"), "split")).toThrow();
      const done = take(s, c, "split");
      expect(neighborhoodMoment(done, c)?.text).toMatch(/blue bowl/);
      expect(ids(done, c)).toEqual([]);
      expect(ids({ ...done, keys: "keys", staff: "staff" }, ctx("h4"))).toContain("collect");
    },
  );
  it("gives every other role two possible endings and remembers the missed opportunity", () => {
    const c = ctx("h8");
    const s = take({}, c, "ticket");
    expect(ids(s, c)).toEqual(["bowls", "kit"]);
    const supper = take(s, c, "bowls");
    expect(neighborhoodMoment(supper, c)?.text).toMatch(/welder/);
    expect(ids({ ...supper, keys: "keys", staff: "staff" }, ctx("h4"))).not.toContain("collect");
  });
  it("lets a Rockerboy take the room unplugged and gives Yori a recurring place at the clinic", () => {
    expect(ids({}, ctx("h7", { role: "fixer" }))).toEqual(["listen"]);
    const c = ctx("h7", { role: "rockerboy" });
    const s = take(take({}, c, "rockerboy"), c, "door");
    expect(clinicDescription({ ...open, ...s })).toContain("Yori keeps the door");
    expect(ids(s, c)).toEqual([]);
  });
  it.each(["tech", "media", "netrunner", "lawman", "exec", "solo"])(
    "gives the %s their own way into the benefit",
    (role) => {
      const c = ctx("h7", { role });
      const picked = planNeighborhood({}, c, role);
      const s = take({}, c, role);
      expect(neighborhoodMoment(s, c)?.text).toBe(picked.choice.receipt);
      expect(ids(s, c)).toEqual(["benefit", "door"]);
      expect(() => planNeighborhood({}, ctx("h7", { role: "fixer" }), role)).toThrow();
    },
  );
  it("prices the residents’ lease against the benefit and quotes an affordable alternative", () => {
    const s: Neighborhood = {
      ...take(take({}, ctx("h7"), "listen"), ctx("h7"), "benefit"),
      keys: "keys",
      staff: "staff",
      equipment: "buy",
    };
    expect(planNeighborhood(s, ctx("h5", { cash: 75 }), "residents").choice.cost).toBe(75);
    expect(() => planNeighborhood(s, ctx("h5", { cash: 74 }), "residents")).toThrow("eurobucks");
    expect(planNeighborhood(s, ctx("h5", { cash: 0 }), "kimen").choice.cost).toBeUndefined();
  });
});

describe("Stackside Clinic", () => {
  it("can open without money or either side story, one saved stop at a time", () => {
    let s: Neighborhood = {};
    for (const [place, id] of [
      ["h5", "keys"],
      ["h1", "staff"],
      ["h4", "unload"],
      ["h5", "kimen"],
    ] as const) {
      expect(clinicDestination(s).place).toBe(place);
      s = take(s, ctx(place, { cash: 0 }), id);
      expect(() => planNeighborhood(s, ctx(place), id)).toThrow();
    }
    expect(neighborhoodMoment(s, ctx("h5"))?.text).toMatch(/Kimen-Gumi/);
    expect(planNeighborhood(s, ctx("h5"), "care").choice.minutes).toBe(75);
  });
  it("charges the quoted kit price once and refuses a skipped stage or wrong address", () => {
    expect(planNeighborhood({ keys: "keys", staff: "staff" }, ctx("h4"), "buy").choice.cost).toBe(
      100,
    );
    expect(() => planNeighborhood({}, ctx("h4"), "buy")).toThrow();
    expect(() => planNeighborhood(open, ctx("h1"), "care")).toThrow();
  });
  it("records the treatment on its finishing day and updates the wound category", () => {
    const late = ctx("h5", { clock: { day: 7, minute: 1430 } });
    const result = planNeighborhood(open, late, "care");
    expect(result).toMatchObject({
      choice: { minutes: 30, heal: 4 },
      patch: { careDay: 8 },
      clock: { day: 8, minute: 20 },
      wound: "light",
    });
    const s = take(open, late, "care");
    expect(() => planNeighborhood(s, { ...late, clock: result.clock }, "care")).toThrow("today");
    expect(
      planNeighborhood(s, ctx("h5", { clock: { day: 9, minute: 60 }, hp: 39 }), "care"),
    ).toMatchObject({ choice: { heal: 1 }, wound: "none" });
  });
  it.each([0, 40])("refuses routine treatment at %i HP", (hp) => {
    expect(() => planNeighborhood(open, ctx("h5", { hp }), "care")).toThrow();
  });
});
