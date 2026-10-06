/**
 * A display window on the shop's composed side spans two cutaway pieces, and the
 * reveal can leave one of them below the window's sill. The light and glow drawn for
 * each piece must stay inside that piece: the glow is added after the renderer's
 * albedo mask, so anything drawn past the piece shows as light where no wall is.
 *
 * The canvas is a recorder: it keeps the clip stack and every polygon filled under
 * it, and maps the clip back onto the wall's own (along, height) plane.
 */
import { describe, expect, it } from "vitest";
import { composeScene, type Point } from "@/engine";
import { battlefieldProjection } from "../battlefieldProjection";
import { cutawayWalls } from "../courtyard/cutawayGeometry";
import { edgeFrame } from "../courtyard/frontage";
import { INTERSECTION_NIGHT } from "../courtyard/nightLighting";
import { BAY } from "../courtyard/architecturePack";
import { paintReturnLight, shopReturns } from "../courtyard/streetfront";

type Paint = { clips: Point[][] };

function recorder() {
  const paints: Paint[] = [];
  let path: Point[] = [];
  let clips: Point[][] = [];
  const stack: Point[][][] = [];
  const gradient = { addColorStop: () => undefined };
  const ctx = {
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    globalAlpha: 1,
    shadowBlur: 0,
    shadowColor: "",
    save: () => stack.push([...clips]),
    restore: () => {
      clips = stack.pop() ?? [];
    },
    beginPath: () => {
      path = [];
    },
    moveTo: (x: number, y: number) => path.push({ x, y }),
    lineTo: (x: number, y: number) => path.push({ x, y }),
    closePath: () => undefined,
    clip: () => {
      clips = [...clips, path];
    },
    fill: () => paints.push({ clips }),
    fillRect: () => paints.push({ clips }),
    stroke: () => paints.push({ clips }),
    drawImage: () => paints.push({ clips }),
    transform: () => undefined,
    createLinearGradient: () => gradient,
    createRadialGradient: () => gradient,
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, paints };
}

describe("the shop's display, cut away", () => {
  const arena = composeScene("intersection", 0).layout.arena;
  const env = arena.environment!;
  const { project, pixelsPerMetre: ppm } = battlefieldProjection(
    arena.extent.width,
    arena.extent.height,
  );
  const face = shopReturns(env)[0]!;
  const f = edgeFrame(face.structure.rect, face.edge);
  // (along, height) on the wall plane, from a screen point
  const o = project(f.world(0, 0)),
    u = project(f.world(1, 0));
  const onWall = (q: Point) => {
    const s = (q.x - o.x) / (u.x - o.x);
    return { s, z: (o.y + s * (u.y - o.y) - q.y) / ppm };
  };
  // the east face's pieces, as the renderer cuts them (s along the face)
  const r = face.structure.rect;
  const pieces = cutawayWalls(face.structure, env.entrances)
    .filter((p) => p.rect.x + p.rect.width === r.x + r.width && p.rect.y !== r.y)
    .map((p) => ({ s0: p.rect.y - r.y, s1: p.rect.y - r.y + p.rect.height }));
  const bay = face.display[0]!;
  const spanned = pieces.filter((p) => p.s1 > bay && p.s0 < bay + BAY.width);

  it("the first display bay spans two pieces", () => {
    expect(spanned).toHaveLength(2);
  });

  const draw = (pass: "light" | "glow", clip?: { s0: number; s1: number; zMax: number }) => {
    const { ctx, paints } = recorder();
    paintReturnLight(ctx, face, project, ppm, {}, INTERSECTION_NIGHT, pass, clip);
    return paints;
  };

  for (const pass of ["light", "glow"] as const) {
    it(`${pass}: a retained piece is lit, and only inside itself`, () => {
      const piece = { ...spanned[0]!, zMax: 2.4 };
      const paints = draw(pass, piece);
      expect(paints.length).toBeGreaterThan(0);
      for (const p of paints) {
        expect(p.clips.length).toBeGreaterThan(0);
        // the innermost clip of each paint lies on the piece
        const clip = p.clips.flat().map(onWall);
        const inside = p.clips.some((c) =>
          c
            .map(onWall)
            .every(
              (q) =>
                q.s >= piece.s0 - 1e-6 &&
                q.s <= piece.s1 + 1e-6 &&
                q.z >= -1e-6 &&
                q.z <= piece.zMax + 1e-6,
            ),
        );
        expect(inside, JSON.stringify(clip.slice(0, 4))).toBe(true);
      }
    });

    it(`${pass}: a piece below the sill gives no window light`, () => {
      const piece = { ...spanned[1]!, zMax: 0.65 };
      expect(draw(pass, piece)).toEqual([]);
    });

    it(`${pass}: the whole wall is drawn as before, unclipped`, () => {
      const paints = draw(pass);
      expect(paints.length).toBeGreaterThan(0);
      expect(paints.every((p) => p.clips.length === 0)).toBe(true);
    });
  }

  it("the two pieces' clips do not overlap, so nothing is drawn twice", () => {
    const a = { ...spanned[0]!, zMax: 2.4 },
      b = { ...spanned[1]!, zMax: 2.4 };
    const range = (piece: typeof a) => {
      const s = draw("glow", piece)
        .flatMap((p) => p.clips.flat())
        .map(onWall)
        .map((q) => q.s);
      return [Math.min(...s), Math.max(...s)] as const;
    };
    const [aStart, aEnd] = range(a);
    const [bStart, bEnd] = range(b);
    // both pieces are clipped at all (an unclipped glow leaves nothing to compare)
    for (const v of [aStart, aEnd, bStart, bEnd]) expect(Number.isFinite(v)).toBe(true);
    expect(aEnd).toBeLessThanOrEqual(bStart + 1e-6);
  });
});
