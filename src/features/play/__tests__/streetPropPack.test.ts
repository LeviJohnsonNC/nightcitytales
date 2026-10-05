import { describe, expect, it } from "vitest";
import { composeScene } from "@/engine";
import {
  FRAME,
  SEDAN,
  STREET_PROP_BENCHMARK,
  STREET_PROP_PACK,
  cabinFrameOffset,
  framePoint,
  sectionFrameOnGuide,
  sedanCut,
  sedanPoint,
  toGuide,
} from "../courtyard/streetPropPack";
import { interiorPropPoint } from "../courtyard/interiorPropArt";
import { PROP_PIXELS_PER_METRE } from "../courtyard/sceneArtMetrics";

describe("street prop pack: the renderer's own geometry", () => {
  it("is bound to props that exist in seed 7, with the art and rotation the scene saved", () => {
    const arena = composeScene("intersection", 7).layout.arena;
    const props = arena.environment!.props;
    const check = (cover: readonly string[], art: readonly string[] | string, rotation: number) =>
      cover.forEach((id, i) => {
        const p = props.find((q) => q.coverId === id)!;
        expect(p, id).toBeDefined();
        expect(p.art).toBe(Array.isArray(art) ? art[i] : art);
        expect(p.rotation ?? 0).toBe(rotation);
      });
    const B = STREET_PROP_BENCHMARK;
    check(B.sedan.cover, B.sedan.art, B.sedan.rotation);
    check(B.planter.cover, B.planter.art, B.planter.rotation);
    check(B.cabinet.cover, B.cabinet.art, B.cabinet.rotation);
    // the two sedan sections are adjacent along the car's axis
    const [engine, cabin] = B.sedan.cover.map((id) => arena.cover!.find((c) => c.id === id)!.rect);
    expect(cabin!.y - engine!.y).toBe(2);
  });

  it("projects a section exactly as the board's prop frames do", () => {
    for (const rotation of [0, 90] as const) {
      const p = framePoint(1.2, 0.4, 0.8, rotation);
      const q = interiorPropPoint(1.2, 0.4, 0.8 * PROP_PIXELS_PER_METRE, rotation);
      expect(p).toEqual(q);
      // the ground diamond fills the frame's width, its front corner on the bottom edge
      const xs = [
        [0, 0],
        [2, 0],
        [2, 2],
        [0, 2],
      ].map(([x, y]) => framePoint(x!, y!, 0, rotation));
      expect(Math.min(...xs.map((v) => v.x))).toBeCloseTo(0);
      expect(Math.max(...xs.map((v) => v.x))).toBeCloseTo(FRAME.width);
      expect(Math.max(...xs.map((v) => v.y))).toBeCloseTo(FRAME.height);
    }
  });

  it("joins the two sedan sections without a seam: the join is the same point in both frames", () => {
    for (const rotation of [0, 90] as const) {
      const o = cabinFrameOffset(rotation);
      for (const [y, z] of [
        [0.2, SEDAN.hood],
        [1.8, SEDAN.sill],
        [1, SEDAN.roof],
      ] as const) {
        const engine = framePoint(SEDAN.join, y, z, rotation);
        const cabin = framePoint(0, y, z, rotation);
        expect(engine.x).toBeCloseTo(cabin.x + o.x);
        expect(engine.y).toBeCloseTo(cabin.y + o.y);
        // and the car-metre helper agrees on both sides of the join
        const a = sedanPoint(SEDAN.join, y, z, rotation);
        const b = sedanPoint(SEDAN.join + 1e-9, y, z, rotation);
        expect(a.x).toBeCloseTo(b.x, 4);
        expect(a.y).toBeCloseTo(b.y, 4);
      }
    }
  });

  it("gives the overlap to the section the board draws in front", () => {
    // rotation 90 (this sedan): the engine is nearer the camera; rotation 0: the cabin
    expect(sedanCut(STREET_PROP_PACK.find((g) => g.id === "sedan-r90")!).nearer).toBe(
      "sedan-engine",
    );
    expect(sedanCut(STREET_PROP_PACK.find((g) => g.id === "sedan-r0")!).nearer).toBe("sedan-cabin");
  });

  it("fits every guide's volume on its square canvas, at the image tool's sizes", () => {
    for (const g of STREET_PROP_PACK) {
      expect([1024, 1536]).toContain(g.canvas);
      for (let i = 0; i < g.sections.length; i++) {
        const o = g.sections[i]!.offset;
        for (const [x, y] of [
          [0, 0],
          [2, 0],
          [2, 2],
          [0, 2],
        ] as const)
          for (const z of [0, 1.4]) {
            const p = framePoint(x, y, z, g.rotation);
            const q = toGuide(g, { x: p.x + o.x, y: p.y + o.y });
            expect(q.x).toBeGreaterThanOrEqual(0);
            expect(q.x).toBeLessThanOrEqual(g.canvas);
            expect(q.y).toBeGreaterThanOrEqual(0);
            expect(q.y).toBeLessThanOrEqual(g.canvas);
          }
        // a section frame cut from the guide has the board frame's proportions
        const f = sectionFrameOnGuide(g, i);
        expect(f.width / f.height).toBeCloseTo(FRAME.width / FRAME.height);
      }
    }
  });
});
