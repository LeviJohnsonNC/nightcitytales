/**
 * Built street edges: what the facade painter may put on a wall, judged from
 * saved geometry alone. Services never sit in a window or a door, never off
 * the wall, never on top of one another, and the same saved building always
 * gets the same answer.
 */
import { describe, expect, it } from "vitest";
import { composeScene, type SceneEnvironment, type SceneStructure } from "@/engine";
import { facadeOpenings } from "../courtyard/architectureArt";
import { blockOpenings, cityRoofUnits, wallFittings } from "../courtyard/cityBlock";

const EDGES = ["north", "east"] as const;
const scenes: SceneEnvironment[] = [0, 1, 4, 7, 8, 12, 23, 41].map(
  (seed) => composeScene("intersection", seed).layout.arena.environment!,
);
const built = scenes.flatMap((env) =>
  env.structures
    .filter((s) => s.style !== "mesh-fence" && s.style !== "interior-wall")
    .map((s) => ({ s, env })),
);
const lengthOf = (s: SceneStructure, edge: "north" | "east") =>
  edge === "north" ? s.rect.width : s.rect.height;
const overlaps = (
  a: { s0: number; s1: number; z0: number; z1: number },
  b: { s0: number; s1: number; z0: number; z1: number },
) => a.s0 < b.s1 && a.s1 > b.s0 && a.z0 < b.z1 && a.z1 > b.z0;

describe("wallFittings", () => {
  it("has buildings to test against", () => {
    expect(built.length).toBeGreaterThan(10);
    expect(new Set(built.map(({ s }) => s.style)).size).toBeGreaterThan(1);
  });

  it("keeps every fitting on its wall, below the parapet", () => {
    for (const { s, env } of built)
      for (const edge of EDGES)
        for (const f of wallFittings(s, edge, env.entrances)) {
          expect(f.s0, s.id).toBeGreaterThan(0.15);
          expect(f.s1, s.id).toBeLessThan(lengthOf(s, edge) - 0.15);
          expect(f.z0).toBeLessThan(f.z1);
          expect(f.z1, s.id).toBeLessThan(s.height - 0.22);
        }
  });

  it("never puts a fitting in, or against, a window or a door", () => {
    for (const { s, env } of built)
      for (const edge of EDGES) {
        const openings = blockOpenings(s, edge, env.entrances);
        for (const f of wallFittings(s, edge, env.entrances))
          for (const o of openings)
            expect(
              overlaps(f, { s0: o.s0 - 0.13, s1: o.s1 + 0.13, z0: o.z0 - 0.15, z1: o.z1 + 0.15 }),
              `${s.id} ${edge} ${f.kind}`,
            ).toBe(false);
      }
  });

  it("never stacks fittings on each other", () => {
    for (const { s, env } of built)
      for (const edge of EDGES) {
        const list = wallFittings(s, edge, env.entrances);
        for (let i = 0; i < list.length; i++)
          for (let j = i + 1; j < list.length; j++)
            expect(overlaps(list[i]!, list[j]!), `${s.id} ${edge}`).toBe(false);
      }
  });

  it("puts at most three ground-floor services on a face, and air-con only on tall buildings", () => {
    for (const { s, env } of built)
      for (const edge of EDGES) {
        const list = wallFittings(s, edge, env.entrances);
        expect(list.filter((f) => f.kind !== "aircon").length).toBeLessThanOrEqual(3);
        if (s.height <= 6) expect(list.some((f) => f.kind === "aircon")).toBe(false);
      }
  });

  it("gives homes post and notices, and other buildings meters and notices", () => {
    for (const { s, env } of built)
      for (const edge of EDGES)
        for (const f of wallFittings(s, edge, env.entrances).filter((x) => x.kind !== "aircon"))
          expect(s.style === "residential" ? ["mail", "notices"] : ["meter", "notices"]).toContain(
            f.kind,
          );
  });

  it("keeps a shopfront's ground floor clear", () => {
    for (const { s, env } of built)
      for (const edge of EDGES)
        expect(wallFittings(s, edge, env.entrances, true).every((f) => f.kind === "aircon")).toBe(
          true,
        );
  });

  it("fits nothing to a fence or an interior wall", () => {
    const base = built[0]!;
    for (const style of ["mesh-fence", "interior-wall"] as const)
      expect(wallFittings({ ...base.s, style }, "north", base.env.entrances)).toEqual([]);
  });

  it("is deterministic for the same saved building", () => {
    for (const { s, env } of built)
      for (const edge of EDGES)
        expect(wallFittings(structuredClone(s), edge, structuredClone(env.entrances))).toEqual(
          wallFittings(s, edge, env.entrances),
        );
  });
});

describe("blockOpenings", () => {
  /** A saved door is drawn as a 2.1 m x 2.65 m bay centred on the entrance. */
  const isDoor = (o: { kind: string; z0: number; z1: number }) =>
    o.kind === "bay" && o.z0 === 0 && o.z1 === 2.65;

  it("keeps every window and bay on its own wall and under its roof", () => {
    for (const { s, env } of built)
      for (const edge of EDGES)
        for (const o of blockOpenings(s, edge, env.entrances).filter((x) => !isDoor(x))) {
          expect(o.s0, `${s.id} ${edge} ${o.kind}`).toBeGreaterThanOrEqual(-1e-9);
          expect(o.s1, `${s.id} ${edge} ${o.kind}`).toBeLessThanOrEqual(lengthOf(s, edge) + 1e-9);
          expect(o.z0).toBeGreaterThanOrEqual(0);
          expect(o.z1, `${s.id} ${o.kind}`).toBeLessThanOrEqual(s.height + 1e-9);
          expect(o.s0).toBeLessThan(o.s1);
          expect(o.z0).toBeLessThan(o.z1);
        }
  });

  it("draws a door only where an entrance is saved, centred on it", () => {
    for (const { s, env } of built)
      for (const edge of EDGES) {
        const doors = blockOpenings(s, edge, env.entrances).filter(isDoor);
        const saved = facadeOpenings(s, env.entrances, edge).doors;
        expect(doors.map((d) => (d.s0 + d.s1) / 2)).toEqual(saved.map((x) => expect.closeTo(x, 9)));
        // A door square-centred 1 m from a corner overhangs it by its 5 cm
        // half-width surplus; the painter clips to the face. Never more.
        for (const d of doors) {
          expect(d.s0).toBeGreaterThanOrEqual(-0.05 - 1e-9);
          expect(d.s1).toBeLessThanOrEqual(lengthOf(s, edge) + 0.05 + 1e-9);
        }
      }
  });

  it("is deterministic for the same saved building", () => {
    for (const { s, env } of built)
      for (const edge of EDGES)
        expect(blockOpenings(structuredClone(s), edge, structuredClone(env.entrances))).toEqual(
          blockOpenings(s, edge, env.entrances),
        );
  });

  it("draws a shop's window bays at the shopfront size", () => {
    for (const { s, env } of built.filter(({ s }) => s.style === "shop"))
      for (const edge of EDGES) {
        const ground = blockOpenings(s, edge, env.entrances).filter(
          (o) => o.z0 === 0.65 && o.z1 === 2.35,
        );
        for (const b of ground) expect(b.s1 - b.s0).toBeCloseTo(2.2);
      }
  });
});

describe("cityRoofUnits", () => {
  it("keeps every unit on its own roof, at the 2 m frame", () => {
    for (const { s } of built)
      for (const u of cityRoofUnits(s)) {
        expect(u.width).toBe(2);
        expect(u.height).toBe(2);
        expect(u.x, s.id).toBeGreaterThanOrEqual(s.rect.x);
        expect(u.y, s.id).toBeGreaterThanOrEqual(s.rect.y);
        expect(u.x + u.width, s.id).toBeLessThanOrEqual(s.rect.x + s.rect.width + 1e-9);
        expect(u.y + u.height, s.id).toBeLessThanOrEqual(s.rect.y + s.rect.height + 1e-9);
      }
  });

  it("never overlaps two units", () => {
    for (const { s } of built) {
      const [a, b] = cityRoofUnits(s);
      if (!a || !b) continue;
      const apart =
        a.x + a.width <= b.x ||
        b.x + b.width <= a.x ||
        a.y + a.height <= b.y ||
        b.y + b.height <= a.y;
      expect(apart, s.id).toBe(true);
    }
  });

  it("puts nothing on a roof too small to stand a unit on, or on a fence", () => {
    const base = built[0]!.s;
    expect(cityRoofUnits({ ...base, rect: { ...base.rect, width: 2.9 } })).toEqual([]);
    expect(cityRoofUnits({ ...base, rect: { ...base.rect, height: 2.9 } })).toEqual([]);
    expect(cityRoofUnits({ ...base, style: "mesh-fence" })).toEqual([]);
    expect(cityRoofUnits({ ...base, style: "interior-wall" })).toEqual([]);
  });

  it("puts one unit on a modest roof and two on a large one", () => {
    const base = built[0]!.s;
    const at = (width: number, height: number) =>
      cityRoofUnits({ ...base, rect: { x: 10, y: 10, width, height } }).length;
    expect(at(6, 5)).toBe(1);
    expect(at(8.9, 8)).toBe(1);
    expect(at(12, 8)).toBe(2);
  });

  it("is deterministic for the same saved roof", () => {
    for (const { s } of built) expect(cityRoofUnits(structuredClone(s))).toEqual(cityRoofUnits(s));
  });
});
