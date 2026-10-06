import { describe, expect, it } from "vitest";
import { composeScene } from "@/engine";
import {
  annexArtFits,
  facadeArtCovers,
  facadeOpenings,
  isAnnex,
  roofUnitTransform,
} from "../courtyard/architectureArt";
import {
  ARCHITECTURE_ART_SIZE,
  BAY,
  ROOF_UNIT,
  ROOF_UNIT_FRAME,
  SHUTTER_ASSEMBLY,
} from "../courtyard/architecturePack";
import { frontagePilot, paintBuilding, paintCutawayWall } from "../courtyard/composedEnvironment";
import { cutawayWalls } from "../courtyard/cutawayGeometry";
import { storefrontFor } from "../courtyard/storefront";
import { framePoint } from "../courtyard/streetPropPack";
import { PROP_PIXELS_PER_METRE } from "../courtyard/sceneArtMetrics";

/** True isometric at 15 px per metre, as the battlefield projects. */
const PPM = 15;
const project = (p: { x: number; y: number }) => ({
  x: (p.x + p.y) * PPM * Math.cos(Math.PI / 6),
  y: (p.x - p.y) * PPM * Math.sin(Math.PI / 6),
});
const scene = (seed: number) => composeScene("intersection", seed).layout.arena;

describe("the roof unit's registration", () => {
  const eq = { x: 4.5, y: 5, width: 2, height: 2 };
  const roofH = 3 * PPM;
  const m = roofUnitTransform(project, eq, roofH);
  const apply = (p: { x: number; y: number }) => ({
    x: m.a * p.x + m.c * p.y + m.e,
    y: m.b * p.x + m.d * p.y + m.f,
  });

  it("puts the frame's 2 m footprint on the saved one, every corner", () => {
    for (const [x, y] of [
      [0, 0],
      [2, 0],
      [2, 2],
      [0, 2],
    ] as const) {
      const got = apply(framePoint(x, y));
      const want = project({ x: eq.x + x, y: eq.y + y });
      expect(got.x).toBeCloseTo(want.x, 6);
      expect(got.y).toBeCloseTo(want.y - roofH, 6);
    }
  });

  it("stands it up at the scene's own metres: the frame's vertical is the scene's", () => {
    // one metre up in the frame is PROP_PIXELS_PER_METRE; in the scene it is PPM
    const base = apply(framePoint(1, 1, 0));
    const top = apply(framePoint(1, 1, ROOF_UNIT.height));
    expect(top.x).toBeCloseTo(base.x, 6);
    expect((base.y - top.y) / PPM).toBeCloseTo(ROOF_UNIT.height, 6);
  });

  it("is drawn from a frame that holds the whole unit and ends on the ground", () => {
    expect(ROOF_UNIT_FRAME.top + ROOF_UNIT_FRAME.height).toBe(320);
    const lid = framePoint(0, 2, ROOF_UNIT.height).y;
    expect(lid).toBeGreaterThan(ROOF_UNIT_FRAME.top);
    expect(ARCHITECTURE_ART_SIZE.roofUnit).toEqual({ width: 512, height: 400 });
    expect(PROP_PIXELS_PER_METRE).toBeCloseTo(73.9, 1);
  });
});

describe("where the window and the shutter go", () => {
  it("is the annex, and only the annex, on every pilot seed", () => {
    for (let seed = 0; seed <= 40; seed++) {
      const env = scene(seed).environment!;
      const annexes = env.structures.filter((s) => isAnnex(s, env.entrances));
      expect(annexes.map((s) => s.id)).toEqual(["building_1"]);
    }
  });

  it("finds the annex's openings where paintBuilding has always drawn them", () => {
    const env = scene(7).environment!;
    const annex = env.structures.find((s) => s.id === "building_1")!;
    expect(facadeOpenings(annex, env.entrances, "east")).toEqual({
      length: 10,
      doors: [5],
      bays: [0.5, 6.5],
    });
    expect(facadeOpenings(annex, env.entrances, "north")).toEqual({
      length: 4,
      doors: [],
      bays: [0.5],
    });
  });

  it("paints the art only on an opening of the size it was drawn for", () => {
    const annex = scene(7).environment!.structures.find((s) => s.id === "building_1")!;
    expect(annex.height).toBe(3);
    expect(annexArtFits(annex)).toEqual({ window: true, shutter: true });
    // a lower shop has a shorter bay and no room for the housing: drawn as before
    expect(annexArtFits({ ...annex, height: 2.5 })).toEqual({ window: false, shutter: false });
    expect(BAY.head - BAY.sill).toBeCloseTo(1.7, 6);
    expect(SHUTTER_ASSEMBLY).toEqual({ width: 1.84, height: 2.5 });
    expect(facadeArtCovers(annex, undefined)).toEqual({ bays: false, doors: false });
  });
});

describe("painting it", () => {
  const art = {
    roofUnit: { width: 512, height: 400, name: "roofUnit" },
    window: { width: 1024, height: 791, name: "window" },
    shutter: { width: 696, height: 946, name: "shutter" },
  };
  const tiles = Object.fromEntries(
    [
      "facade-concrete",
      "roof-membrane",
      "painted-metal",
      "roof-ballast",
      "painted-render",
      "shutter",
    ].map((k) => [k, { width: 512, height: 512, key: k }]),
  );
  const drawn = (paint: (ctx: CanvasRenderingContext2D) => void) => {
    const images: string[] = [];
    const ctx = new Proxy(
      {},
      {
        get: (_t, name: string) => {
          if (name === "drawImage")
            return (img: { name?: string }) => {
              if (img.name) images.push(img.name);
            };
          if (name === "createPattern") return () => ({ setTransform: () => undefined });
          if (name === "createRadialGradient" || name === "createLinearGradient")
            return () => ({ addColorStop: () => undefined });
          return () => undefined;
        },
        set: () => true,
      },
    ) as unknown as CanvasRenderingContext2D;
    paint(ctx);
    return images;
  };
  const env = scene(7).environment!;
  const arena = scene(7);
  const sf = env.structures.map((s) => storefrontFor(s, env, arena.cover ?? [])).find(Boolean)!;
  const pilot = frontagePilot(sf, env.structures, env.entrances);
  const building = (id: string, materials: unknown) => {
    const s = env.structures.find((x) => x.id === id)!;
    return drawn((ctx) =>
      paintBuilding(
        ctx,
        s,
        project,
        env.entrances,
        materials as never,
        undefined,
        pilot.detail(s),
        art as never,
      ),
    );
  };

  it("draws the annex's two bays and one bay, its shutter and its roof unit", () => {
    const images = building("building_1", tiles);
    expect(images.filter((n) => n === "window")).toHaveLength(3);
    // the shutter is drawn in two bands: the curtain, and the housing's front
    expect(images.filter((n) => n === "shutter")).toHaveLength(2);
    expect(images.filter((n) => n === "roofUnit")).toHaveLength(1);
  });

  it("gives a neighbour the roof unit and keeps its own windows", () => {
    const images = building("building_0_middle", tiles);
    expect(images.filter((n) => n === "roofUnit").length).toBeGreaterThan(0);
    expect(images).not.toContain("window");
    expect(images).not.toContain("shutter");
  });

  it("draws nothing of it where a scene takes no materials", () => {
    expect(building("building_1", undefined)).toEqual([]);
    expect(building("building_0_middle", undefined)).toEqual([]);
  });

  it("carries the annex's openings onto the cutaway pieces of the faces that have them", () => {
    const annex = env.structures.find((x) => x.id === "building_1")!;
    const r = annex.rect;
    let front = 0;
    for (const part of cutawayWalls(annex, env.entrances)) {
      const images = drawn((ctx) =>
        paintCutawayWall(ctx, annex, part, project, tiles as never, undefined, undefined, {
          art: art as never,
          entrances: env.entrances,
        }),
      );
      const p = part.rect;
      const onFront = p.y === r.y || p.x + p.width === r.x + r.width;
      if (!onFront) expect(images).toEqual([]);
      else {
        front++;
        // every piece of a front face paints its face's openings, clipped to itself
        expect(images.length).toBeGreaterThan(0);
        expect(images).not.toContain("roofUnit");
      }
    }
    expect(front).toBeGreaterThan(4);
  });
});
