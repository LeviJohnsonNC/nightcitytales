import { describe, expect, it } from "vitest";
import { composeScene } from "@/engine";
import {
  WINDOW_PANES,
  WINDOW_VARIANTS,
  annexArtFits,
  facadeArtCovers,
  facadeOpenings,
  isAnnex,
  rooftopUnits,
  roofUnitTransform,
  shopFace,
  variantOf,
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
      "home-masonry",
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
    // the shutter is drawn from four bands of its art: the curtain, and the housing's
    // end, front and top (the top and end are the front's own steel, not flat fills)
    expect(images.filter((n) => n === "shutter")).toHaveLength(4);
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

  it("carries residential interiors onto retained exterior walls, never interior ends", () => {
    const home = env.structures.find((x) => x.style === "residential")!;
    const homeArt = Object.fromEntries(
      ["homeCurtains", "homeBlind", "homeNets"].map((name) => [
        name,
        { name, width: 468, height: 396 },
      ]),
    );
    const full = drawn((ctx) =>
      paintBuilding(
        ctx,
        home,
        project,
        env.entrances,
        tiles as never,
        undefined,
        undefined,
        homeArt as never,
      ),
    );
    expect(full.some((name) => name.startsWith("home"))).toBe(true);
    let finished = 0;
    for (const part of cutawayWalls(home, env.entrances)) {
      const images = drawn((ctx) =>
        paintCutawayWall(
          ctx,
          home,
          part,
          project,
          tiles as never,
          undefined,
          "painted-render",
          undefined,
          undefined,
          { entrances: env.entrances, art: homeArt as never },
        ),
      );
      const r = home.rect,
        p = part.rect;
      if (p.y === r.y || p.x + p.width === r.x + r.width) {
        // The original face is drawn in original coordinates under the segment clip.
        expect(images.some((name) => name.startsWith("home"))).toBe(true);
        finished++;
      } else expect(images).toEqual([]);
    }
    expect(finished).toBeGreaterThan(0);
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
          edges: ["north", "east"],
          doors: true,
          finish: true,
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

describe("the finished corner: which faces take what", () => {
  const art = { window: {}, shutter: {}, roofUnit: {} } as never;
  const env = scene(7).environment!;
  const arena = scene(7);
  const sf = env.structures.map((s) => storefrontFor(s, env, arena.cover ?? [])).find(Boolean)!;
  const pilot = frontagePilot(sf, env.structures, env.entrances);
  const face = (id: string) => {
    const s = env.structures.find((x) => x.id === id)!;
    return shopFace(s, env.entrances, art, s.id === sf.structure.id, pilot.detail(s)?.role);
  };

  it("gives the storefront's other face the window, and nothing else", () => {
    expect(face("building_0")).toMatchObject({ doors: false, finish: false });
  });

  it("keeps the neighbours' barred windows, and residential and industrial openings", () => {
    expect(face("building_0_middle")).toBeUndefined();
    expect(face("building_0_rear")).toBeUndefined();
    expect(face("building_1_block")).toBeUndefined();
    expect(face("building_2")).toBeUndefined();
    expect(face("building_3")).toBeUndefined();
  });

  it("gives the annex its shutter and its finished wall", () => {
    expect(face("building_1")).toMatchObject({ doors: true, finish: true });
  });

  it("takes nothing without the art", () => {
    const s = env.structures.find((x) => x.id === "building_1")!;
    expect(shopFace(s, env.entrances, undefined, false, undefined)).toBeUndefined();
  });
});

describe("a row of windows does not repeat", () => {
  it("picks a bay's variant from the bay alone, the same every time", () => {
    expect(variantOf("building_0", "east", 0.5)).toBe(variantOf("building_0", "east", 0.5));
  });

  it("uses more than one variant along every row of four or more", () => {
    for (let seed = 0; seed <= 12; seed++) {
      const env = scene(seed).environment!;
      for (const s of env.structures.filter((x) => x.style === "shop"))
        for (const edge of ["north", "east"] as const) {
          const { bays } = facadeOpenings(s, env.entrances, edge);
          if (bays.length < 4) continue;
          expect(new Set(bays.map((b) => variantOf(s.id, edge, b))).size).toBeGreaterThan(1);
        }
    }
  });

  it("varies the window only inside its panes, which sit on the frame's own bands", () => {
    const P = WINDOW_PANES;
    expect(P.left.x0).toBeCloseTo(BAY.frame / BAY.width, 9);
    expect(P.right.x1).toBeCloseTo(1 - BAY.frame / BAY.width, 9);
    expect(P.right.x0 - P.left.x1).toBeCloseTo(BAY.mullion / BAY.width, 9);
    expect(P.left.x1 - P.left.x0).toBeCloseTo(P.right.x1 - P.right.x0, 9);
    expect(P.blindTop).toBeGreaterThan(P.y0);
    for (const v of WINDOW_VARIANTS) expect(v.blind).toBeLessThanOrEqual(P.blindFoot - P.blindTop);
  });
});

describe("the storefront's units", () => {
  it("stand where the drawn boxes always stood, on every roof", () => {
    for (const seed of [0, 7, 8]) {
      for (const s of scene(seed).environment!.structures) {
        const r = s.rect;
        const units = rooftopUnits(s);
        expect(units).toHaveLength(Math.max(0, Math.min(3, Math.floor((r.width - 1) / 3))));
        units.forEach((u, i) =>
          expect(u).toEqual({
            x: r.x + 0.5 + i * 3,
            y: r.y + Math.min(3, r.height - 2.5),
            width: 2,
            height: 2,
          }),
        );
      }
    }
  });
});
