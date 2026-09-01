import { describe, expect, it } from "vitest";
import {
  AREAS,
  DISTRICTS,
  areaOf,
  canTravel,
  describePosition,
  districtOfPlace,
  getDistrict,
  getPlace,
  isCombatZone,
  placesIn,
  resolvePlaceMention,
  resolvePosition,
  travelMinutes,
} from "../geography";

describe("night city atlas data", () => {
  it("carries all 24 lettered districts across four areas", () => {
    expect(DISTRICTS).toHaveLength(24);
    expect(AREAS.map((a) => a.key)).toEqual(["island", "northside", "mainland", "southside"]);
    for (const d of DISTRICTS) {
      expect(d.blurb.length).toBeGreaterThan(20);
      expect(AREAS.some((a) => a.key === d.area)).toBe(true);
      expect(d.map.x).toBeGreaterThan(0);
      expect(d.map.y).toBeGreaterThan(0);
    }
  });

  it("keeps location keys unique", () => {
    const keys = DISTRICTS.flatMap((d) => d.locations.map((l) => l.key));
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.length).toBeGreaterThan(150);
  });
});

describe("lookups", () => {
  it("finds districts by key and by printed code", () => {
    expect(getDistrict("kabuki")?.code).toBe("O");
    expect(getDistrict("O")?.name).toBe("Kabuki");
    expect(getDistrict("Upper Marina")?.key).toBe("upper_marina");
    expect(getDistrict("nowhere")).toBeUndefined();
  });

  it("finds canonical locations", () => {
    expect(getPlace("b1")?.name).toBe("The Afterlife");
    expect(districtOfPlace("b1")?.name).toBe("Upper Marina");
    expect(placesIn("upper_marina").length).toBeGreaterThan(5);
    expect(areaOf("kabuki")?.key).toBe("northside");
  });
});

describe("positions", () => {
  it("resolves a venue and a bare district", () => {
    expect(resolvePosition("b1")).toEqual({ districtKey: "upper_marina", placeKey: "b1" });
    expect(resolvePosition("kabuki")).toEqual({ districtKey: "kabuki" });
    expect(resolvePosition("atlantis")).toBeUndefined();
  });

  it("describes where you are", () => {
    expect(describePosition("b1")).toBe("The Afterlife, Upper Marina (The Island)");
    expect(describePosition(null)).toBe("Somewhere in Night City");
  });
});

describe("travel", () => {
  it("costs nothing to stay put and more to cross the city", () => {
    expect(travelMinutes("b1", "b1")).toBe(0);
    expect(travelMinutes("b1", "b3")).toBe(10);
    expect(travelMinutes("upper_marina", "downtown")).toBe(25);
    expect(travelMinutes("upper_marina", "kabuki")).toBe(45);
    expect(travelMinutes("kabuki", "rancho_coronado")).toBe(60);
  });

  it("refuses destinations that are not on the map", () => {
    expect(canTravel("b1")).toBe(true);
    expect(canTravel("night_city_hilton")).toBe(false);
  });
});

describe("combat zones", () => {
  it("reads the atlas rather than a second list", () => {
    expect(isCombatZone("south_night_city")).toBe(true);
    expect(isCombatZone("upper_marina")).toBe(false);
  });
});

describe("narration mentions", () => {
  it("matches district and location names", () => {
    expect(resolvePlaceMention("The Afterlife")?.kind).toBe("place");
    expect(resolvePlaceMention("kabuki")?.kind).toBe("district");
    expect(resolvePlaceMention("The Moon")).toBeUndefined();
  });
});
