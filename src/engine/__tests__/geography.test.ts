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
  LANDMARKS,
  limitInDirection,
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
  parseMode,
  resolvePosition,
  routeTo,
  walkFrom,
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
  it("costs nothing to stay put and more the further you go", () => {
    expect(travelMinutes("b1", "b1")).toBe(0);
    // Distance is what a trip costs now, so a longer route costs more than a
    // shorter one rather than both landing in the same band.
    const nextDoor = travelMinutes("little_europe", "downtown");
    const acrossTown = travelMinutes("little_europe", "north_heywood");
    const cornerToCorner = travelMinutes("kabuki", "rancho_coronado");
    expect(nextDoor).toBeGreaterThan(0);
    expect(acrossTown).toBeGreaterThan(nextDoor);
    expect(cornerToCorner).toBeGreaterThan(acrossTown);
  });

  it("prices the same trip differently depending on how you make it", () => {
    // Across town a cab wins comfortably.
    const far = "north_heywood";
    expect(travelMinutes("little_europe", far, "foot")).toBeGreaterThan(
      travelMinutes("little_europe", far, "cab") * 2,
    );
    // Round the corner it does not: you spend longer waiting for it than the
    // walk would have taken.
    expect(travelMinutes("little_europe", "a8", "foot")).toBeLessThan(
      travelMinutes("little_europe", "a8", "cab"),
    );
    // Unsaid means a cab, which is what the atlas's house rule assumes.
    expect(travelMinutes("little_europe", far)).toBe(travelMinutes("little_europe", far, "cab"));
  });

  it("reads how the character said they were travelling", () => {
    expect(parseMode("I'll walk")).toBe("foot");
    expect(parseMode("grab a cab")).toBe("cab");
    expect(parseMode("on foot")).toBe("foot");
    expect(parseMode("by taxi")).toBe("cab");
    expect(parseMode("teleport")).toBeUndefined();
    expect(parseMode(null)).toBeUndefined();
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
    expect(resolveDestination("The Afterlife")).toBe("b1");
    expect(resolveDestination("b1")).toBe("b1");
    expect(resolveDestination("O")).toBe("kabuki");
    expect(resolveDestination("Atlantis")).toBeUndefined();
    expect(resolveDestination("")).toBeUndefined();
  });

  it("resolves the geography the map names but the location list does not", () => {
    // These are printed on the atlas map. A player can read them off it, so the
    // engine has to know them or it refuses somewhere that plainly exists.
    expect(resolveDestination("San Morro Bridge")).toBe("san_morro_bridge");
    expect(resolveDestination("Estero Bay")).toBe("estero_bay");
    expect(resolveDestination("the Morro Canal")).toBe("morro_canal");
    expect(describePosition("san_morro_bridge")).toBe("San Morro Bridge, Heywood Docks (Mainland)");
  });

  it("offers the venues underfoot, the geography, and every district", () => {
    const names = reachableDestinations("b1").map((d) => d.name);
    expect(names).toContain("The Afterlife");
    expect(names).toContain("Kabuki");
    expect(names).toContain("San Morro Bridge");
    // Morro Rock is on the map and is not somewhere you can walk to, so it is
    // never offered as a destination.
    expect(names).not.toContain("Morro Rock");
    const reachableLandmarks = LANDMARKS.filter((l) => l.kind !== "island").length;
    expect(reachableDestinations(null).length).toBe(DISTRICTS.length + reachableLandmarks);
  });

  it("offers somewhere the character has already been, from anywhere", () => {
    // Standing in Kabuki, "back to Greta's" is a place they know, in a district
    // they are not in. Before, only the venues underfoot could be named.
    const gretas = getPlace("a8")!.name;
    const cold = reachableDestinations("kabuki").map((d) => d.name);
    expect(cold).not.toContain(gretas);
    const warm = reachableDestinations("kabuki", ["a8"]).map((d) => d.name);
    expect(warm).toContain(gretas);
  });

  it("refuses to walk out to an island", () => {
    const decision = resolveTravelIntent({ from: "little_europe", destination: "Morro Rock" });
    expect(decision.ok).toBe(false);
    if (!decision.ok) expect(decision.reason).toContain("Morro Rock");
  });
});

describe("the compass", () => {
  it("reads bearings off the atlas coordinates", () => {
    expect(directionBetween("little_europe", "upper_marina")).toBe("E");
    expect(directionBetween("little_europe", "downtown")).toBe("SW");
    expect(parseDirection("West")).toBe("W");
    expect(parseDirection("nw")).toBe("NW");
    expect(parseDirection("sideways")).toBeUndefined();
  });

  it("only offers districts that bear that way and can be reached", () => {
    // Nothing bears due west of Little Europe — Downtown is southwest, and the
    // engine calls it southwest, so "go west" may not quietly pick it. Past the
    // district's own western edge there is only the bay.
    expect(districtsInDirection("little_europe", "W")).toEqual([]);
    expect(limitInDirection("little_europe", "W")).toBe("water");

    // Every candidate is named that heading by the same function that names a
    // heading anywhere else. One definition of direction, used everywhere.
    for (const heading of ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const) {
      for (const found of districtsInDirection("little_europe", heading)) {
        expect(directionBetween("little_europe", found.key)).toBe(heading);
      }
    }
  });

  it("lets a heading cross water where a bridge does", () => {
    // Due east out of Little Europe the ground runs out at Del Coronado Bay, so
    // a walk stops there. A journey does not: the Coronado Bay Bridge carries it
    // on, and the districts beyond are reachable and so are offered.
    expect(walkFrom("little_europe", "E")!.stoppedBy).toBe("water");
    const east = districtsInDirection("little_europe", "E").map((d) => d.key);
    expect(east.length).toBeGreaterThan(0);
    const furthest = furthestInDirection("little_europe", "E")!;
    expect(east).toContain(furthest);
    // And getting there really does involve a span.
    expect(routeTo("little_europe", furthest)!.spans.length).toBeGreaterThan(0);
  });

  it("walks through a district rather than around it", () => {
    const journey = walkFrom("little_europe", "E");
    expect(journey).toBeDefined();
    expect(journey!.legs.map((l) => l.key)).toEqual([
      "little_europe",
      "the_hot_zone",
      "upper_marina",
    ]);
    expect(journey!.stoppedBy).toBe("water");
  });

  it("tags neighbours with a heading and a price", () => {
    const near = neighboursOf("little_europe");
    expect(near.length).toBeGreaterThan(0);
    for (const n of near) expect(n.minutes).toBeGreaterThanOrEqual(0);
    // Only districts Little Europe actually borders. Old Japantown is a short
    // hop across the island but shares no boundary with it.
    const keys = near.map((n) => n.key);
    expect(keys).toContain("downtown");
    expect(keys).not.toContain("old_japantown");
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
      direction: "south",
      extent: "far",
    });
    expect(decision.ok).toBe(true);
    if (decision.ok) {
      expect(decision.direction).toBe("S");
      expect(getDistrict(decision.to)!.map.y).toBeGreaterThan(getDistrict("little_europe")!.map.y);
    }
  });

  it("walking as far west as you can gets you to the waterfront, not nowhere", () => {
    // There is no district west of Little Europe, but there is a walk: across
    // the district to the bay. That is a move, it costs time, and the narrator
    // is told where it ended.
    const decision = resolveTravelIntent({
      from: "a8",
      direction: "west",
      extent: "far",
    });
    expect(decision).toMatchObject({
      ok: true,
      to: "little_europe",
      direction: "W",
      stoppedAt: "water",
    });
  });

  it("refuses a landmark it cannot place, even when a heading came with it", () => {
    // The San Morro Bridge is printed on the map but is not in the atlas data.
    // Dropping the name and setting off on the heading instead is how a request
    // to go to the bridge became a trip to a district nobody mentioned.
    const decision = resolveTravelIntent({
      from: "downtown",
      destination: "San Morro Bridge",
      direction: "northeast",
    });
    expect(decision.ok).toBe(false);
    if (!decision.ok) expect(decision.reason).toContain("San Morro Bridge");
  });

  it("still honours a plain named destination", () => {
    const decision = resolveTravelIntent({ from: "little_europe", destination: "The Afterlife" });
    expect(decision).toMatchObject({ ok: true, to: "b1" });
  });

  it("refuses a name that is not on the map", () => {
    expect(resolveTravelIntent({ from: "little_europe", destination: "Atlantis" }).ok).toBe(false);
  });
});
