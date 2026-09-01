import { describe, expect, it } from "vitest";
import {
  CELL_SIZE_PERCENT,
  GRID_HEIGHT,
  GRID_WIDTH,
  adjacentDistricts,
  districtAtPoint,
  districtNearPoint,
  isCity,
  walk,
} from "@/engine/cityGrid";
import { DISTRICTS, describePosition, districtOfPlace, getDistrict } from "@/engine/geography";

const NORTH = { x: 0, y: -1 };
const SOUTH = { x: 0, y: 1 };
const EAST = { x: 1, y: 0 };
const WEST = { x: -1, y: 0 };

describe("the traced city", () => {
  it("covers every district in the atlas", () => {
    for (const district of DISTRICTS) {
      expect(districtAtPoint(district.map), `${district.name} has no ground`).toBe(district.key);
    }
  });

  it("puts every district's own map point inside it", () => {
    // The point is what the pin renders on and what a bearing is measured from.
    // A district whose point lands in a neighbour is the bug this data replaced.
    for (const district of DISTRICTS) {
      expect(districtAtPoint(district.map)).toBe(district.key);
    }
  });

  it("puts every canonical venue in the district the atlas files it under", () => {
    // The atlas's venue coordinates and the atlas's printed boundaries are two
    // separate statements by the same publisher, so this is a real check that
    // they agree. Three do not, and each is the publisher's own inconsistency
    // rather than a fault in the trace — see the tests below.
    const DISPUTED = ["f5", "i6", "w5"];
    const misplaced: string[] = [];
    for (const district of DISTRICTS) {
      for (const place of district.locations) {
        if (!place.map) continue;
        if (DISPUTED.includes(place.key)) continue;
        if (districtNearPoint(place.map) !== district.key) {
          misplaced.push(`${place.code} ${place.name} (${district.name})`);
        }
      }
    }
    expect(misplaced).toEqual([]);
  });

  it("keeps two venues drawn on a boundary line filed where the atlas files them", () => {
    // Parkside Living and South Cargo Village are each drawn a single cell — a
    // fifth of a city block — on the far side of a line they sit on top of.
    // That is the width of the line, not a disagreement worth acting on, and
    // the district still comes from the atlas's own location list.
    for (const key of ["f5", "i6"]) {
      const place = DISTRICTS.flatMap((d) => d.locations).find((p) => p.key === key)!;
      const filed = DISTRICTS.find((d) => d.locations.some((p) => p.key === key))!;
      expect(districtNearPoint(place.map!)).not.toBe(filed.key);
      expect(districtOfPlace(key)!.key).toBe(filed.key);
    }
  });

  it("has one venue the atlas draws outside the district it lists it under", () => {
    // Playland by the Sea is marked on a spit of land reaching north into San
    // Morro Bay, and Pacifica Playground's printed boundary does not take that
    // spit in. The marker is exactly where the map draws it; the two statements
    // simply disagree, and the location list is the one that decides.
    const playland = DISTRICTS.flatMap((d) => d.locations).find((p) => p.key === "w5")!;
    expect(districtNearPoint(playland.map!)).toBeUndefined();
    expect(districtOfPlace("w5")!.key).toBe("pacifica_playground");
    expect(describePosition("w5")).toContain("Pacifica Playground");
  });

  it("is water off the coast and city on it", () => {
    // Morro Rock sits alone in the bay: land on the map, no district on it.
    expect(isCity({ x: 15.8, y: 39.1 })).toBe(false);
    // The open Pacific, west of everything.
    expect(isCity({ x: 4, y: 45 })).toBe(false);
    expect(isCity(getDistrict("little_europe")!.map)).toBe(true);
  });

  it("decodes to a grid of the size it declares", () => {
    expect(GRID_WIDTH).toBeGreaterThan(100);
    expect(GRID_HEIGHT).toBeGreaterThan(GRID_WIDTH);
    expect(CELL_SIZE_PERCENT).toBeCloseTo(100 / GRID_WIDTH);
  });
});

describe("walking the ground", () => {
  it("stops at the bay heading west out of Little Europe", () => {
    const journey = walk(getDistrict("little_europe")!.map, WEST);
    expect(journey.stoppedBy).toBe("water");
    expect(journey.legs.map((l) => l.key)).toEqual(["little_europe"]);
    expect(journey.distance).toBeGreaterThan(5);
  });

  it("crosses the island heading east, in the order the districts come", () => {
    const journey = walk(getDistrict("little_europe")!.map, EAST);
    const crossed = journey.legs.map((l) => l.key);
    expect(crossed[0]).toBe("little_europe");
    expect(crossed).toContain("the_hot_zone");
    // Each leg is further along the heading than the one before it.
    const reached = journey.legs.map((l) => l.reached);
    expect([...reached].sort((a, b) => a - b)).toEqual(reached);
  });

  it("leaves the city at the top of the map going north", () => {
    const journey = walk(getDistrict("norcal_military_base")!.map, NORTH);
    expect(journey.legs.map((l) => l.key)).toEqual(["norcal_military_base"]);
  });

  it("reaches the southern districts from the island going south", () => {
    const journey = walk(getDistrict("the_glen")!.map, SOUTH);
    expect(journey.legs.map((l) => l.key)).toContain("the_glen");
    expect(journey.distance).toBeGreaterThan(0);
  });
});

describe("who borders whom", () => {
  it("is symmetric", () => {
    for (const district of DISTRICTS) {
      for (const other of adjacentDistricts(district.key)) {
        expect(adjacentDistricts(other), `${other} should border ${district.key}`).toContain(
          district.key,
        );
      }
    }
  });

  it("gives every district at least one neighbour", () => {
    for (const district of DISTRICTS) {
      expect(adjacentDistricts(district.key).length, district.name).toBeGreaterThan(0);
    }
  });

  it("does not make a district its own neighbour", () => {
    for (const district of DISTRICTS) {
      expect(adjacentDistricts(district.key)).not.toContain(district.key);
    }
  });

  it("knows Exec Zone is wrapped by Charter Hill", () => {
    // Exec Zone is the one district the atlas lists no locations for. It was
    // found by tracing, not by a coordinate, and this is the shape that found it.
    expect(adjacentDistricts("exec_zone")).toEqual(["charter_hill"]);
  });
});
