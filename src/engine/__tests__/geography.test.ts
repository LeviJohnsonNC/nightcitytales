import { describe, expect, it } from "vitest";
import { districtAtPoint, districtNearPoint, nearestCity } from "@/engine/cityGrid";
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
  STREETS,
  streetsIn,
  streetPointIn,
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
  mapDistance,
  blocksToPercent,
  parseMode,
  placeKeyOf,
  positionKey,
  mapPointOf,
  resolvePosition,
  routeTo,
  walkFrom,
  travelMinutes,
  getLandmark,
  isReachable,
  isWater,
  standingPointFor,
  groundedPoint,
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

  it("resolves the major roads the map prints names along", () => {
    expect(resolveDestination("Republic Way")).toBe("republic_way");
    expect(resolveDestination("morro rock blvd")).toBe("morro_rock_blvd");
    expect(resolveDestination("Interstate 9")).toBe("interstate_9");
    expect(describePosition("republic_way")).toBe("Republic Way, Little Europe (The Island)");
    expect(resolvePlaceMention("Morro Rock Blvd")?.kind).toBe("street");
  });

  it("still refuses a minor street, because none are transcribed", () => {
    // Corporations St is printed on the map in outlined white lettering that
    // resisted every reading. Being honest about not knowing it beats guessing.
    expect(resolveDestination("Corporations St")).toBeUndefined();
    expect(resolveTravelIntent({ from: "little_europe", destination: "Corporations St" }).ok).toBe(
      false,
    );
  });

  it("charges for crossing to a road in the district you are already in", () => {
    // Pacific Blvd runs through The Glen. Standing in The Glen is not standing
    // on Pacific Blvd, and getting there takes a few minutes.
    const decision = resolveTravelIntent({
      from: "the_glen",
      destination: "Pacific Blvd",
      mode: "walk",
    });
    expect(decision).toMatchObject({ ok: true, to: "pacific_blvd" });
    if (decision.ok) expect(decision.minutes).toBeGreaterThan(0);
  });

  it("puts a road in every district the map labels it in", () => {
    for (const street of STREETS) {
      expect(street.districts.length).toBeGreaterThan(0);
      expect(street.marks.length).toBeGreaterThanOrEqual(street.districts.length);
      for (const key of street.districts) {
        expect(getDistrict(key), `${street.name} names ${key}`).toBeDefined();
        expect(streetsIn(key).map((s) => s.key)).toContain(street.key);
        // The point the map writes the name at is on that district's ground —
        // except for the interstate, whose name is printed out on the highway
        // east of the city, past where any district reaches.
        const point = streetPointIn(street, key)!;
        const on =
          street.key === "interstate_9" ? districtNearPoint(point, 30) : districtNearPoint(point);
        expect(on, `${street.name} in ${key}`).toBe(key);
      }
    }
  });

  it("keeps the one road whose name is printed outside the city", () => {
    // Interstate 9 leaves Night City eastward and the map labels it out there,
    // past the last district. It still belongs to the district it runs out of.
    const interstate = STREETS.find((s) => s.key === "interstate_9")!;
    expect(districtNearPoint(interstate.marks[0]!)).toBeUndefined();
    expect(interstate.districts).toEqual(["north_heywood"]);
  });

  it("refuses to walk out to an island", () => {
    const decision = resolveTravelIntent({ from: "little_europe", destination: "Morro Rock" });
    expect(decision.ok).toBe(false);
    if (!decision.ok) expect(decision.reason).toContain("Morro Rock");
  });
});

describe("where exactly you are standing", () => {
  it("reads back everything written before points existed", () => {
    // location_key has held plain place keys for the life of the game. Every one
    // of them still has to resolve, or every saved campaign loses its position.
    expect(resolvePosition("little_europe")).toMatchObject({ districtKey: "little_europe" });
    expect(resolvePosition("a8")).toMatchObject({ districtKey: "little_europe", placeKey: "a8" });
    expect(resolvePosition("san_morro_bridge")).toMatchObject({ landmarkKey: "san_morro_bridge" });
    expect(resolvePosition("republic_way")).toMatchObject({ streetKey: "republic_way" });
    expect(resolvePosition("little_europe")!.point).toBeUndefined();
  });

  it("carries an exact spot alongside the place", () => {
    const key = positionKey("little_europe", { x: 27.424, y: 42.255 });
    expect(key).toBe("little_europe@27.424,42.255");
    const position = resolvePosition(key)!;
    expect(position.districtKey).toBe("little_europe");
    expect(position.point).toEqual({ x: 27.424, y: 42.255 });
    expect(mapPointOf(key)).toEqual({ x: 27.424, y: 42.255 });
    expect(placeKeyOf(key)).toBe("little_europe");
  });

  it("takes the district from the spot, so the two can never disagree", () => {
    // A point in Downtown labelled little_europe is still in Downtown.
    const downtown = getDistrict("downtown")!.map;
    expect(resolvePosition(positionKey("little_europe", downtown))!.districtKey).toBe("downtown");
  });

  it("shrugs off a spot it cannot use", () => {
    expect(resolvePosition("little_europe@")).toMatchObject({ districtKey: "little_europe" });
    expect(resolvePosition("little_europe@nonsense")).toMatchObject({
      districtKey: "little_europe",
    });
    expect(resolvePosition("little_europe@999,999")).toMatchObject({
      districtKey: "little_europe",
    });
  });

  it("says which part of a district you are in, when that means something", () => {
    const west = positionKey("little_europe", { x: 27.424, y: 42.255 });
    expect(describePosition(west)).toBe("the west of Little Europe (The Island)");
    // Near the middle there is no quarter worth naming.
    expect(describePosition(positionKey("little_europe", getDistrict("little_europe")!.map))).toBe(
      "Little Europe (The Island)",
    );
  });

  it("charges for crossing a district, and nothing for standing still", () => {
    const middle = getDistrict("little_europe")!.map;
    const west = positionKey("little_europe", { x: 27.424, y: 42.255 });
    expect(travelMinutes(positionKey("little_europe", middle), west, "foot")).toBeGreaterThan(5);
    expect(travelMinutes(west, west, "foot")).toBe(0);
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
  it("goes where the player named, even when they got the compass wrong", () => {
    // Naming a place is a request for that place. A heading said alongside it is
    // how they pictured the way there, not a condition on it — refusing "south
    // to the Pacifica Bridge" because the bridge is south-EAST answers a
    // question nobody asked. The true heading comes back instead.
    const decision = resolveTravelIntent({
      from: "little_europe",
      destination: "Upper Marina",
      direction: "west",
      extent: "far",
    });
    expect(decision).toMatchObject({ ok: true, to: "upper_marina" });
    if (decision.ok)
      expect(decision.direction).toBe(directionBetween("little_europe", "upper_marina"));
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
      mode: "foot",
    });
    expect(decision).toMatchObject({ ok: true, direction: "W", stoppedAt: "water" });
    if (!decision.ok) return;
    // They end up at the waterfront, not back where they started, and it costs
    // them the walk. Leaving them at the district's own point was the bug.
    expect(placeKeyOf(decision.to)).toBe("little_europe");
    expect(resolvePosition(decision.to)!.point).toBeDefined();
    expect(decision.minutes).toBeGreaterThan(0);
    const started = mapPointOf("a8")!;
    const ended = mapPointOf(decision.to)!;
    expect(ended.x).toBeLessThan(started.x);
    expect(limitInDirection(decision.to, "W")).toBe("water");
  });

  it("refuses a place it cannot put on the map, even when a heading came with it", () => {
    // Dropping the name and setting off on the heading instead is how a request
    // to go somewhere became a trip to a district nobody mentioned. Corporations
    // St is a real Night City street the atlas never transcribed, so the honest
    // answer is that the engine cannot place it.
    const decision = resolveTravelIntent({
      from: "downtown",
      destination: "Corporations St",
      direction: "northeast",
    });
    expect(decision.ok).toBe(false);
    if (!decision.ok) expect(decision.reason).toContain("Corporations St");
  });

  it("goes the distance the player asked for, in blocks", () => {
    const decision = resolveTravelIntent({
      from: "little_europe",
      direction: "south",
      blocks: 7,
      mode: "cab",
    });
    expect(decision.ok).toBe(true);
    if (!decision.ok) return;
    // Seven blocks is seven blocks, not "the next district south".
    expect(decision.blocks).toBeGreaterThan(5);
    expect(decision.blocks).toBeLessThan(9);
    const moved = mapDistance("little_europe", decision.to)!;
    expect(moved).toBeGreaterThan(blocksToPercent(4));
    expect(moved).toBeLessThan(blocksToPercent(10));
    expect(decision.minutes).toBeGreaterThan(0);
  });

  it("does not turn a short hop into a district hop", () => {
    const near = resolveTravelIntent({ from: "little_europe", direction: "south", blocks: 2 });
    const far = resolveTravelIntent({ from: "little_europe", direction: "south", blocks: 12 });
    expect(near.ok && far.ok).toBe(true);
    if (!near.ok || !far.ok) return;
    // Asking for less gets you less. Before, both were "South Night City".
    expect(mapDistance("little_europe", near.to)!).toBeLessThan(
      mapDistance("little_europe", far.to)!,
    );
  });

  it("still honours a plain named destination", () => {
    const decision = resolveTravelIntent({ from: "little_europe", destination: "The Afterlife" });
    expect(decision).toMatchObject({ ok: true, to: "b1" });
  });

  it("refuses a name that is not on the map", () => {
    expect(resolveTravelIntent({ from: "little_europe", destination: "Atlantis" }).ok).toBe(false);
  });
});

describe("nobody stands in the water", () => {
  // The map names three bays, a canal and a reservoir, and each name is printed
  // across the middle of the water it names. Asking to go and see one is a
  // perfectly ordinary thing to do; ending up floating in it is not, and it is
  // what happened before this. Every rule below is one of the ways that could
  // still happen, closed off.

  it("reads a bay's printed name as water, not as ground", () => {
    // "SAN MORRO BAY" is lettering, and lettering is not blue, so the trace
    // used to leave it behind as a strip of dry land out in the bay.
    for (const landmark of LANDMARKS) {
      if (!isWater(landmark)) continue;
      expect(districtAtPoint(landmark.map), `${landmark.name} is drawn as land`).toBeUndefined();
    }
  });

  it("puts you on the shore when you go to see a stretch of water", () => {
    for (const landmark of LANDMARKS) {
      if (!isWater(landmark)) continue;
      const decision = resolveTravelIntent({ from: "little_europe", destination: landmark.name });
      expect(decision.ok, landmark.name).toBe(true);
      if (!decision.ok) continue;
      const point = mapPointOf(decision.to)!;
      expect(districtAtPoint(point), `${landmark.name} pin`).toBeDefined();
      expect(describePosition(decision.to)).toContain(`the shore of ${landmark.name}`);
    }
  });

  it("keeps the shore on the side of the water the atlas files it under", () => {
    // Half the point of going to see San Morro Bay is being where the atlas
    // says the bay belongs, rather than on whichever shore happens to be near.
    for (const landmark of LANDMARKS) {
      if (!isWater(landmark)) continue;
      const point = standingPointFor(landmark)!;
      expect(districtAtPoint(point), landmark.name).toBe(landmark.districtKey);
    }
  });

  it("gives every landmark you can reach somewhere to stand", () => {
    for (const landmark of LANDMARKS) {
      const point = standingPointFor(landmark);
      if (!isReachable(landmark)) {
        // Morro Rock is an island. There is nowhere on it to stand.
        expect(point, landmark.name).toBeUndefined();
        continue;
      }
      expect(point, landmark.name).toBeDefined();
      expect(districtAtPoint(point!), landmark.name).toBeDefined();
    }
  });

  it("never renders a pin on open water, whatever it is handed", () => {
    // Everything the engine can put in location_key, including the forms saved
    // before a position could carry a point.
    const stored: string[] = [
      ...DISTRICTS.map((d) => d.key),
      ...DISTRICTS.flatMap((d) => d.locations.map((p) => p.key)),
      ...LANDMARKS.filter(isReachable).map((l) => l.key),
      ...STREETS.map((s) => s.key),
    ];
    const adrift: string[] = [];
    for (const key of stored) {
      const point = mapPointOf(key);
      // A dock or a bridge approach sits on the waterline and belongs there;
      // what must never happen is a pin with no city anywhere near it.
      if (!point || !districtNearPoint(point)) adrift.push(key);
    }
    expect(adrift).toEqual([]);
  });

  it("falls back to the district rather than pinning a point out at sea", () => {
    // A saved game from before this, or any future slip in the data.
    const pin = mapPointOf("little_europe@4.0,45.0")!;
    expect(pin).toEqual(getDistrict("little_europe")!.map);
  });

  it("still stands you on a bridge, which is not the same as water", () => {
    const decision = resolveTravelIntent({
      from: "little_europe",
      destination: "San Morro Bridge",
    });
    expect(decision.ok).toBe(true);
    if (!decision.ok) return;
    expect(describePosition(decision.to)).toContain("San Morro Bridge");
    expect(describePosition(decision.to)).not.toContain("the shore of");
    expect(mapPointOf(decision.to)).toEqual(getLandmark("san_morro_bridge")!.map);
  });

  it("still refuses the island in the bay", () => {
    const decision = resolveTravelIntent({ from: "little_europe", destination: "Morro Rock" });
    expect(decision.ok).toBe(false);
  });

  it("keeps the name of the place when a point is written down with it", () => {
    const key = positionKey("san_morro_bay", { x: 33.485, y: 60.098 });
    const position = resolvePosition(key)!;
    expect(position.landmarkKey).toBe("san_morro_bay");
    expect(position.districtKey).toBe("south_night_city");
    expect(position.point).toEqual({ x: 33.485, y: 60.098 });
    expect(placeKeyOf(key)).toBe("san_morro_bay");
  });

  it("pulls a spot onto ground, and leaves one that is already on it alone", () => {
    const onGround = { x: 33.485, y: 60.098 };
    expect(groundedPoint(onGround)).toEqual(onGround);
    const inTheBay = getLandmark("san_morro_bay")!.map;
    expect(districtAtPoint(inTheBay)).toBeUndefined();
    // The middle of a bay is further from the shore than the grounding guard
    // reaches, and pretending otherwise would move somebody across the water.
    expect(groundedPoint(inTheBay)).toBeUndefined();
  });

  it("does not sell a seven-block cab ride that goes one cell", () => {
    // The shore of San Morro Bay has water due south of it, and southeast and
    // southwest too. Committing the cell and a half that was left would have
    // charged the seven minutes a cab takes to arrive for thirteen metres.
    const decision = resolveTravelIntent({
      from: "san_morro_bay@33.485,60.098",
      direction: "south",
      blocks: 7,
      mode: "cab",
    });
    expect(decision.ok).toBe(false);
    if (decision.ok) return;
    expect(decision.reason).toContain("the water");
  });

  it("still takes a short hop that covers real ground", () => {
    const decision = resolveTravelIntent({
      from: "little_europe",
      direction: "south",
      blocks: 2,
      mode: "foot",
    });
    expect(decision.ok).toBe(true);
    if (!decision.ok) return;
    expect(decision.blocks).toBeGreaterThanOrEqual(1);
  });

  it("finds the nearest ground, on the side asked for", () => {
    const bay = getLandmark("san_morro_bay")!.map;
    expect(nearestCity(bay, 32, "south_night_city")).toBeDefined();
    expect(districtAtPoint(nearestCity(bay, 32, "south_night_city")!)).toBe("south_night_city");
    // Nothing within a block of the middle of the bay.
    expect(nearestCity(bay, 4)).toBeUndefined();
    expect(nearestCity(bay, 32, "not_a_district")).toBeUndefined();
  });
});
