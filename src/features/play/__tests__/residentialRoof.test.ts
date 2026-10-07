import { describe, expect, it } from "vitest";
import { composeScene, type Point } from "@/engine";
import { isAnnex, rooftopUnits } from "../courtyard/architectureArt";
import { paintResidentialRoof, residentialRoofDrains } from "../courtyard/residentialRoof";

const homes = (seed: number) => {
  const e = composeScene("intersection", seed).layout.arena.environment!;
  return e.structures.filter((s) => s.style === "residential" || isAnnex(s, e.entrances));
};
const ppm = 15;
const project = (p: Point) => ({
  x: (p.x + p.y) * ppm * Math.cos(Math.PI / 6),
  y: (p.x - p.y) * ppm * 0.5,
});

describe("residential roofs inside the saved envelope", () => {
  it("keeps internal drains inside the parapet and clear of equipment across placements", () => {
    for (let seed = 0; seed < 41; seed++)
      for (const s of homes(seed)) {
        const drains = residentialRoofDrains(s);
        expect(drains.length).toBeGreaterThan(0);
        expect(drains.length).toBeLessThanOrEqual(2);
        for (const p of drains) {
          expect(p.x).toBeGreaterThan(s.rect.x + 0.5);
          expect(p.y).toBeGreaterThan(s.rect.y + 0.5);
          expect(p.x).toBeLessThan(s.rect.x + s.rect.width - 0.5);
          expect(p.y).toBeLessThan(s.rect.y + s.rect.height - 0.5);
          for (const u of rooftopUnits(s))
            expect(
              p.x < u.x - 0.5 ||
                p.x > u.x + u.width + 0.5 ||
                p.y < u.y - 0.5 ||
                p.y > u.y + u.height + 0.5,
            ).toBe(true);
        }
      }
  });

  it("clips every roof mark to the original projected roof, including when tiles are absent", () => {
    for (const seed of [0, 7, 8])
      for (const s of homes(seed)) {
        const before = JSON.stringify(s);
        let path: Point[] = [],
          clipped = false,
          fills = 0;
        const stack: boolean[] = [],
          clips: Point[][] = [];
        const ctx = {
          save: () => stack.push(clipped),
          restore: () => {
            clipped = stack.pop()!;
          },
          beginPath: () => {
            path = [];
          },
          moveTo: (x: number, y: number) => path.push({ x, y }),
          lineTo: (x: number, y: number) => path.push({ x, y }),
          closePath: () => undefined,
          clip: () => {
            clips.push([...path]);
            clipped = true;
          },
          fill: () => {
            expect(clipped).toBe(true);
            fills++;
          },
          stroke: () => {
            expect(clipped).toBe(true);
            expect(path.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))).toBe(true);
          },
        } as unknown as CanvasRenderingContext2D;
        paintResidentialRoof(ctx, project, ppm, s, {});
        const r = s.rect;
        const expected = [
          { x: r.x, y: r.y },
          { x: r.x + r.width, y: r.y },
          { x: r.x + r.width, y: r.y + r.height },
          { x: r.x, y: r.y + r.height },
        ].map((p) => {
          const q = project(p);
          return { x: q.x, y: q.y - s.height * ppm };
        });
        expect(clips[0]).toEqual(expected);
        expect(fills).toBeGreaterThan(10);
        expect(stack).toEqual([]);
        expect(clipped).toBe(false);
        expect(JSON.stringify(s)).toBe(before);
      }
  });
});
