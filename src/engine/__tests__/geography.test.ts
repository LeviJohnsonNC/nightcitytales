import { describe, expect, it } from "vitest";
import {
  AREAS,
  DISTRICTS,
  areaOf,
  canTravel,
  describePosition,
  directionBetween,
  districtsInDirection,
  furthestInDirection,
  neighboursOf,
  parseDirection,
  resolveTravelIntent,
  districtOfPlace,
  getDistrict,
  getPlace,
  isCombatZone,
  placesIn,
  reachableDestinations,
  resolveDestination,
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

describe("destinations", () => {
  it("resolves whatever the narration called the place", () => {
    expect(resolveDestination("Estero Bay")).toBe(getDistrict("Estero Bay")?.key);
    expect(resolveDestination("The Afterlife")).toBe("b1");
    expect(resolveDestination("b1")).toBe("b1");
    expect(resolveDestination("O")).toBe("kabuki");
    expect(resolveDestination("Atlantis")).toBeUndefined();
    expect(resolveDestination("")).toBeUndefined();
  });

  it("offers every district plus the venues underfoot", () => {
    const names = reachableDestinations("b1").map((d) => d.name);
    expect(names).toContain("The Afterlife");
    expect(names).toContain("Kabuki");
    expect(reachableDestinations(null).length).toBe(DISTRICTS.length);
  });
});

describe("the compass", () => {
  it("reads bearings off the atlas coordinates", () => {
    expect(directionBetween("little_europe", "upper_marina")).toBe("E");
    expect(parseDirection("West")).toBe("W");
    expect(parseDirection("nw")).toBe("NW");
    expect(parseDirection("sideways")).toBeUndefined();
  });

  it("only offers districts that genuinely lie that way", () => {
    const west = districtsInDirection("little_europe", "W").map((d) => d.key);
    expect(west.length).toBeGreaterThan(0);
    expect(west).not.toContain("upper_marina");
    const furthest = furthestInDirection("little_europe", "W");
    expect(furthest).toBeDefined();
    expect(getDistrict(furthest!)!.map.x).toBeLessThan(getDistrict("little_europe")!.map.x);
  });

  it("tags neighbours with a heading and a price", () => {
    const near = neighboursOf("little_europe");
    expect(near.length).toBeGreaterThan(0);
    for (const n of near) expect(n.minutes).toBeGreaterThanOrEqual(0);
  });
});

describe("travel intent", () => {
  it("refuses a named destination that points the wrong way", () => {
    const decision = resolveTravelIntent({
      from: "little_europe",
      destination: "Upper Marina",
      direction: "west",
      extent: "far",
    });
    expect(decision.ok).toBe(false);
  });

  it("picks the destination itself when the player named a heading", () => {
    const decision = resolveTravelIntent({
      from: "little_europe",
      direction: "west",
      extent: "far",
    });
    expect(decision.ok).toBe(true);
    if (decision.ok) {
      expect(decision.direction).toBe("W");
      expect(getDistrict(decision.to)!.map.x).toBeLessThan(getDistrict("little_europe")!.map.x);
    }
  });

  it("still honours a plain named destination", () => {
    const decision = resolveTravelIntent({ from: "little_europe", destination: "The Afterlife" });
    expect(decision).toMatchObject({ ok: true, to: "b1" });
  });

  it("refuses a name that is not on the map", () => {
    expect(resolveTravelIntent({ from: "little_europe", destination: "Atlantis" }).ok).toBe(false);
  });
});
