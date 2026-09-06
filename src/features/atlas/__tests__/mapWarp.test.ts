import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DISTRICTS, LANDMARKS, MAP_IMAGE } from "@/engine";
import { districtAtPoint } from "@/engine/cityGrid";
import warp from "@/data/atlas/map-warp.json";
import {
  MAP_PICTURE,
  MAP_WARP_GRID,
  MAP_WARP_IS_HOUSE_RULE,
  placeOnMap,
  placeOnMapStyle,
} from "../mapWarp";

/**
 * The warp is presentation only, and these are mostly about proving that.
 *
 * Swapping the map picture is the sort of change that quietly moves everybody's
 * marker one district over, so the tests that matter are the ones asserting
 * nothing about the city itself moved: the atlas is untouched, the coordinate
 * system is untouched, and the engine cannot see any of this.
 */

describe("the warp is a house rule about drawing, and nothing else", () => {
  it("is what it claims to be", () => {
    expect(MAP_WARP_IS_HOUSE_RULE).toBe(true);
    expect(warp.points).toHaveLength(MAP_WARP_GRID.cols * MAP_WARP_GRID.rows);
  });

  it("leaves the printed atlas describing the printed atlas", () => {
    // night-city.json still points at the R. Talsorian map, because that is
    // what every coordinate in the app is a percentage of and what both the
    // warp fitter and the district tracer measure against. Repointing it at the
    // picture would quietly redefine the coordinate system.
    expect(MAP_IMAGE.image).toContain("night-city.jpg");
    expect(MAP_IMAGE.width).toBe(3600);
    expect(MAP_IMAGE.height).toBe(5573);
  });

  it("draws on a picture that is actually there", () => {
    expect(MAP_PICTURE.src).not.toBe(MAP_IMAGE.image);
    expect(existsSync(join(process.cwd(), "public", MAP_PICTURE.src))).toBe(true);
  });

  it("cannot be seen by the engine", () => {
    // districtAtPoint works in atlas percentages and never touches a picture.
    // If this ever changed, swapping the art would start moving districts.
    for (const district of DISTRICTS) {
      expect(districtAtPoint(district.map), district.name).toBeTypeOf("string");
    }
  });
});

describe("placing a coordinate on the picture", () => {
  it("keeps every district pin on the picture", () => {
    for (const district of DISTRICTS) {
      const at = placeOnMap(district.map.x, district.map.y);
      expect(at.left, `${district.name} x`).toBeGreaterThan(0);
      expect(at.left, `${district.name} x`).toBeLessThan(100);
      expect(at.top, `${district.name} y`).toBeGreaterThan(0);
      expect(at.top, `${district.name} y`).toBeLessThan(100);
    }
  });

  it("keeps every location and landmark on the picture", () => {
    const points = [
      ...DISTRICTS.flatMap((d) => d.locations.filter((l) => l.map).map((l) => l.map!)),
      ...LANDMARKS.map((l) => l.map),
    ];
    expect(points.length).toBeGreaterThan(150);
    for (const p of points) {
      const at = placeOnMap(p.x, p.y);
      expect(at.left).toBeGreaterThan(-5);
      expect(at.left).toBeLessThan(105);
      expect(at.top).toBeGreaterThan(-5);
      expect(at.top).toBeLessThan(105);
    }
  });

  it("never folds: going right or down on the atlas goes right or down on the picture", () => {
    // A fold would send two different places to the same pixel, and two
    // characters standing apart would draw on top of each other.
    for (let y = 0; y <= 100; y += 5) {
      let last = -Infinity;
      for (let x = 0; x <= 100; x += 5) {
        const at = placeOnMap(x, y).left;
        expect(at, `x ${x} at y ${y}`).toBeGreaterThan(last);
        last = at;
      }
    }
    for (let x = 0; x <= 100; x += 5) {
      let last = -Infinity;
      for (let y = 0; y <= 100; y += 5) {
        const at = placeOnMap(x, y).top;
        expect(at, `y ${y} at x ${x}`).toBeGreaterThan(last);
        last = at;
      }
    }
  });

  it("moves a point only as far as a redrawing should", () => {
    // The warp corrects for the same city drawn again, not for a different
    // city. Anything shifted more than a fifth of the map is a fitting error.
    for (const district of DISTRICTS) {
      const at = placeOnMap(district.map.x, district.map.y);
      expect(Math.abs(at.left - district.map.x), `${district.name} x`).toBeLessThan(20);
      expect(Math.abs(at.top - district.map.y), `${district.name} y`).toBeLessThan(20);
    }
  });

  it("is continuous, so a character crossing a mesh line does not jump", () => {
    const step = 0.25;
    for (let y = 5; y < 95; y += 7) {
      let previous = placeOnMap(5, y);
      for (let x = 5 + step; x < 95; x += step) {
        const at = placeOnMap(x, y);
        expect(Math.abs(at.left - previous.left), `jump at ${x},${y}`).toBeLessThan(1);
        previous = at;
      }
    }
  });

  it("hands CSS back as percentages", () => {
    const style = placeOnMapStyle(50, 50);
    expect(style.left).toMatch(/^[\d.]+%$/);
    expect(style.top).toMatch(/^[\d.]+%$/);
  });
});
