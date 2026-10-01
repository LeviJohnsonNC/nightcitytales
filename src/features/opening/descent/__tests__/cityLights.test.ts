import { describe, expect, it } from "vitest";
import { DISTRICTS, getPlace } from "@/engine";
import { placeOnMap } from "@/features/atlas/mapWarp";
import { SEARCH_STEPS, cityLights, homeOnMap, searchCounts, survives } from "../cityLights";

const district = DISTRICTS.find((d) => d.key === "little_europe")!;
const place = district.locations[0]!;
const input = { count: 1200, seed: 99, districtKey: district.key, placeKey: place.key };

describe("the city of lights", () => {
  const city = cityLights(input);

  it("is the same city for the same seed, so a remount draws what was drawn", () => {
    expect(cityLights(input).lights).toEqual(city.lights);
  });

  it("does not change when the player's facts arrive, except for their own light", () => {
    const before = cityLights({ ...input, districtKey: null, placeKey: null });
    const base = (c: typeof city) => c.lights.filter((l) => !l.deep && !l.you);
    expect(base(before)).toEqual(base(city));
  });

  it("puts every light on the map picture, in a real district", () => {
    for (const light of city.lights.filter((l) => !l.deep)) {
      expect(light.u).toBeGreaterThan(0);
      expect(light.u).toBeLessThan(1);
      expect(light.v).toBeGreaterThan(0);
      expect(light.v).toBeLessThan(1);
      expect(light.district).not.toBe("");
    }
    expect(city.lights.filter((l) => !l.deep && !l.you)).toHaveLength(input.count);
  });

  it("puts the player's light where the place they sleep is on the map", () => {
    const at = placeOnMap(place.map!.x, place.map!.y);
    expect(city.you.u).toBeCloseTo(at.left / 100, 6);
    expect(city.you.v).toBeCloseTo(at.top / 100, 6);
    expect(city.you.you).toBe(true);
    expect(city.you.district).toBe(district.key);
    expect(city.lights[city.lights.length - 1]).toBe(city.you);
    expect(getPlace(place.key)).toBeDefined();
  });

  it("falls back to the district when the place has no spot of its own", () => {
    const at = homeOnMap(null, district.key)!;
    const centre = placeOnMap(district.map.x, district.map.y);
    expect(at.u).toBeCloseTo(centre.left / 100, 6);
  });
});

describe("the search", () => {
  const city = cityLights(input);

  it("keeps the player's light through every step, and narrows by place first", () => {
    for (let step = 0; step <= SEARCH_STEPS.length; step++) {
      expect(survives(city.you, step, city.you)).toBe(true);
    }
    const everyone = city.lights.filter((l) => !l.deep && !l.you);
    const inArea = everyone.filter((l) => survives(l, 1, city.you));
    const inDistrict = everyone.filter((l) => survives(l, 2, city.you));
    expect(inArea.length).toBeLessThan(everyone.length);
    expect(inDistrict.length).toBeLessThan(inArea.length);
    expect(inDistrict.every((l) => l.district === district.key)).toBe(true);
  });

  it("counts down from seven million to one, strictly falling", () => {
    const counts = searchCounts(city, 7_000_000);
    expect(counts).toHaveLength(SEARCH_STEPS.length + 1);
    expect(counts[counts.length - 1]).toBe(1);
    let last = 7_000_000;
    for (const n of counts) {
      expect(n).toBeLessThan(last);
      last = n;
    }
  });

  it("makes the first count the real share of the city that lives in the area", () => {
    const everyone = city.lights.filter((l) => !l.deep && !l.you);
    const share = everyone.filter((l) => survives(l, 1, city.you)).length / everyone.length;
    expect(searchCounts(city, 7_000_000)[0]).toBe(Math.round(share * 7_000_000));
  });
});
