/**
 * The furniture library.
 *
 * Authored content, so these tests are the proofreader: a material key that
 * does not exist, a section off the 2m lattice or two sections in the same
 * square would each produce an arena that looks fine and behaves wrongly, and
 * none of it would fail anywhere else.
 */
import { describe, expect, it } from "vitest";
import {
  BATTLEFIELD_PROPS,
  COVER_MATERIAL_KEYS,
  COVER_SECTION_METRES,
  battlefieldProp,
  coverMaxHp,
  isCover,
  placeProp,
  propFootprint,
  propsInCategory,
} from "..";

describe("the library itself", () => {
  it("has twenty props, each with a unique key", () => {
    expect(BATTLEFIELD_PROPS).toHaveLength(20);
    expect(new Set(BATTLEFIELD_PROPS.map((p) => p.key)).size).toBe(20);
  });

  it("is built only from materials the printed table has", () => {
    for (const prop of BATTLEFIELD_PROPS) {
      for (const section of prop.sections) {
        expect(COVER_MATERIAL_KEYS).toContain(section.material);
      }
    }
  });

  it("says which printed row each judgement reads against", () => {
    for (const prop of BATTLEFIELD_PROPS) {
      expect(prop.why.length).toBeGreaterThan(40);
      expect(prop.label.length).toBeGreaterThan(0);
      expect(prop.art.length).toBeGreaterThan(0);
    }
  });

  it("keeps every section on the 2m lattice and out of its neighbours' squares", () => {
    for (const prop of BATTLEFIELD_PROPS) {
      const seen = new Set<string>();
      for (const section of prop.sections) {
        expect(section.dx % COVER_SECTION_METRES).toBe(0);
        expect(section.dy % COVER_SECTION_METRES).toBe(0);
        expect(section.dx).toBeGreaterThanOrEqual(0);
        expect(section.dy).toBeGreaterThanOrEqual(0);
        const square = `${section.dx},${section.dy}`;
        expect(seen.has(square)).toBe(false);
        seen.add(square);
      }
      expect(new Set(prop.sections.map((s) => s.key)).size).toBe(prop.sections.length);
    }
  });

  it("covers the whole range of sizes, from one section to four", () => {
    const sizes = BATTLEFIELD_PROPS.map((p) => p.sections.length);
    expect(Math.min(...sizes)).toBe(1);
    expect(Math.max(...sizes)).toBe(4);
    expect(propFootprint(battlefieldProp("city_bus")!)).toEqual({ width: 8, height: 2 });
    expect(propFootprint(battlefieldProp("motorcycle")!)).toEqual({ width: 2, height: 2 });
  });

  it("has something in every category", () => {
    for (const category of ["vehicle", "street", "industrial", "interior"] as const) {
      expect(propsInCategory(category).length).toBeGreaterThan(0);
    }
  });
});

describe("what the pieces are actually worth", () => {
  it("makes the safe end of a car the engine end", () => {
    const [engine, cabin] = placeProp(battlefieldProp("sedan")!, { x: 0, y: 0 }, "sedan");
    expect(coverMaxHp(engine!)).toBe(50);
    expect(coverMaxHp(cabin!)).toBe(25);
  });

  it("uses the bulletproof glass row nothing else in the game used", () => {
    const screen = placeProp(battlefieldProp("teller_screen")!, { x: 0, y: 0 }, "teller");
    for (const piece of screen) expect(coverMaxHp(piece)).toBe(30);
  });

  it("gives the scenery no HP at all, and leaves it blocking the way", () => {
    for (const key of ["chainlink_fence", "cubicle_wall", "bus_shelter"]) {
      const pieces = placeProp(battlefieldProp(key)!, { x: 0, y: 0 }, key);
      for (const piece of pieces) {
        expect(coverMaxHp(piece)).toBe(0);
        // Not cover: the engine never lets it block a shot or be shot at.
        expect(isCover(piece)).toBe(false);
        // …but it is still something you walk around.
        expect(piece.blocksMovement).not.toBe(false);
      }
    }
  });

  it("lets the low things be crossed and still hidden behind", () => {
    for (const key of ["jersey_barrier", "planter"]) {
      const [piece] = placeProp(battlefieldProp(key)!, { x: 0, y: 0 }, key);
      expect(piece!.blocksMovement).toBe(false);
      expect(isCover(piece!)).toBe(true);
    }
  });
});

describe("putting one down", () => {
  const bus = battlefieldProp("city_bus")!;

  it("translates every section and keeps them 2m square", () => {
    const pieces = placeProp(bus, { x: 6, y: 10 }, "bus_north");
    expect(pieces.map((p) => p.rect)).toEqual([
      { x: 6, y: 10, width: 2, height: 2 },
      { x: 8, y: 10, width: 2, height: 2 },
      { x: 10, y: 10, width: 2, height: 2 },
      { x: 12, y: 10, width: 2, height: 2 },
    ]);
  });

  it("names each section after the copy, so two of the same prop never collide", () => {
    const north = placeProp(bus, { x: 0, y: 0 }, "bus_north");
    const south = placeProp(bus, { x: 0, y: 8 }, "bus_south");
    const ids = [...north, ...south].map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids[0]).toBe("bus_north_engine");
  });

  it("does not hand back a shared object the caller could mutate into the library", () => {
    const first = placeProp(bus, { x: 0, y: 0 }, "a");
    first[0]!.rect.x = 999;
    expect(placeProp(bus, { x: 0, y: 0 }, "b")[0]!.rect.x).toBe(0);
  });
});
