import { existsSync, statSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { composeScene } from "@/engine";
import { battlefieldProjection } from "../battlefieldProjection";
import {
  MATERIAL_KEYS,
  SURFACE_MATERIALS,
  fillMaterial,
  gradeFor,
  groundBasis,
  materialUrl,
  patternMatrix,
  prepareMaterials,
  wallBasis,
  type TileSource,
} from "../courtyard/surfaceMaterials";
import { paintBuilding, paintComposedGround } from "../courtyard/composedEnvironment";

const { project, pixelsPerMetre } = battlefieldProjection(32, 32);
const apply = (m: ReturnType<typeof patternMatrix>, u: number, v: number) => ({
  x: m.a * u + m.c * v + m.e,
  y: m.b * u + m.d * v + m.f,
});

describe("surface materials: physical scale and registration", () => {
  it("ships a derivative for every material, at a size worth sending", () => {
    for (const key of MATERIAL_KEYS) {
      const file = `public${materialUrl(key)}`;
      expect(existsSync(file), file).toBe(true);
      expect(statSync(file).size).toBeLessThan(200 * 1024);
    }
  });

  it("lays a ground tile over exactly its stated metres, anchored to world metre zero", () => {
    for (const key of MATERIAL_KEYS) {
      const { metres } = SURFACE_MATERIALS[key];
      const m = patternMatrix(groundBasis(project), metres, 512);
      const origin = project({ x: 0, y: 0 });
      const edge = apply(m, 512, 0);
      const far = project({ x: metres, y: 0 });
      expect(apply(m, 0, 0).x).toBeCloseTo(origin.x);
      expect(apply(m, 0, 0).y).toBeCloseTo(origin.y);
      expect(edge.x).toBeCloseTo(far.x);
      expect(edge.y).toBeCloseTo(far.y);
      const side = apply(m, 0, 512);
      const other = project({ x: 0, y: metres });
      expect(side.x).toBeCloseTo(other.x);
      expect(side.y).toBeCloseTo(other.y);
    }
  });

  it("keeps sidewalk joints on whole-metre lines, where zone edges are", () => {
    expect(SURFACE_MATERIALS.sidewalk.metres % 4).toBe(0);
  });

  it("stands a wall tile on the ground line at the same scale as the ground", () => {
    const metres = SURFACE_MATERIALS["facade-concrete"].metres;
    const m = patternMatrix(wallBasis(project, "x", 10, metres, pixelsPerMetre), metres, 512);
    const foot = project({ x: 0, y: 10 });
    const bottomLeft = apply(m, 0, 512);
    expect(bottomLeft.x).toBeCloseTo(foot.x);
    expect(bottomLeft.y).toBeCloseTo(foot.y);
    // One tile of wall is as tall as its metres, and as wide along the wall.
    expect(apply(m, 0, 512).y - apply(m, 0, 0).y).toBeCloseTo(metres * pixelsPerMetre);
    const along = apply(m, 512, 0);
    expect(Math.hypot(along.x - apply(m, 0, 0).x, along.y - apply(m, 0, 0).y)).toBeCloseTo(
      metres * pixelsPerMetre,
    );
  });

  it("grades a surface back to the colour its flat fill had", () => {
    for (const key of MATERIAL_KEYS) {
      const grade = gradeFor(key, "#33423f", 0.8).match(/\d+/g)!.map(Number);
      const mean = SURFACE_MATERIALS[key].mean;
      // grade x (1 - s + s x albedo) is the average finished colour.
      [0x33, 0x42, 0x3f].forEach((target, i) => {
        const result = grade[i]! * (0.2 + 0.8 * (mean[i]! / 255));
        expect(Math.abs(result - target)).toBeLessThan(1.5);
      });
    }
  });
});

const fakeCanvas = () => {
  const data = new Uint8ClampedArray(4 * 64 * 64).fill(100);
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => ({
      drawImage: () => undefined,
      getImageData: () => ({ data }),
      putImageData: () => undefined,
    }),
  };
  return canvas as unknown as HTMLCanvasElement;
};

describe("surface materials: sizing", () => {
  const tile = { width: 512, height: 512 } as TileSource;

  it("halves a tile only down to the density the scene is drawn at", () => {
    const at = (ppm: number) => prepareMaterials({ shutter: tile }, ppm, fakeCanvas).shutter!.width;
    // 3.6 m of shutter: 512px is wanted at ~142px/m, 256 at ~71, and so on.
    expect(at(200)).toBe(512);
    expect(at(30)).toBe(128);
    expect(at(1)).toBeGreaterThanOrEqual(32);
  });
});

describe("surface materials: painting", () => {
  const tile = { width: 512, height: 512 } as TileSource;
  const recorder = () => {
    const pattern = { setTransform: vi.fn() };
    const calls: string[] = [];
    const ctx = new Proxy(
      {},
      {
        get: (_t, name: string) => {
          if (name === "createPattern") return () => pattern;
          if (name === "createRadialGradient" || name === "createLinearGradient")
            return () => ({ addColorStop: () => undefined });
          return (...args: unknown[]) => {
            calls.push(`${name}(${args.length})`);
          };
        },
        set: () => true,
      },
    ) as unknown as CanvasRenderingContext2D;
    return { ctx, calls, pattern };
  };

  it("draws nothing, and says so, without the material", () => {
    const { ctx, calls } = recorder();
    const drawn = fillMaterial(ctx, undefined, [{ x: 0, y: 0 }], {
      key: "asphalt",
      basis: groundBasis(project),
      target: "#20292e",
    });
    expect(drawn).toBe(false);
    expect(calls).toEqual([]);
  });

  it("paints only the intersection with materials: its shops, homes and sheds", () => {
    const set = prepareMaterials({ asphalt: tile, sidewalk: tile }, 30, fakeCanvas);
    expect(Object.keys(set)).toHaveLength(2);

    const intersection = composeScene("intersection", 7).layout.arena;
    const alley = composeScene("alley", 5).layout.arena;
    const used = (arena: typeof intersection, materials?: typeof set) => {
      const { ctx, pattern } = recorder();
      paintComposedGround(ctx, arena, project, materials);
      return pattern.setTransform.mock.calls.length;
    };
    expect(used(intersection)).toBe(0);
    expect(used(intersection, set)).toBeGreaterThan(0);
    expect(used(alley, set)).toBe(0);

    const structures = intersection.environment!.structures;
    const painted = (style: string) => {
      const { ctx, pattern } = recorder();
      const s = structures.find((x) => x.style === style)!;
      paintBuilding(ctx, s, project, intersection.environment!.entrances, {
        "facade-concrete": tile,
        "roof-membrane": tile,
        shutter: tile,
        "painted-metal": tile,
        "painted-render": tile,
      });
      return pattern.setTransform.mock.calls.length;
    };
    expect(painted("shop")).toBeGreaterThan(0);
    // the completion pilot (buildingFaces.ts): render for homes, sheet metal for sheds
    expect(painted("workshop")).toBeGreaterThan(0);
    expect(painted("residential")).toBeGreaterThan(0);
    // and with no tiles, every one of them is its old flat drawing
    const flat = (style: string) => {
      const { ctx, pattern } = recorder();
      const s = structures.find((x) => x.style === style)!;
      paintBuilding(ctx, s, project, intersection.environment!.entrances);
      return pattern.setTransform.mock.calls.length;
    };
    for (const style of ["shop", "workshop", "residential"]) expect(flat(style)).toBe(0);
  });
});
