import { describe, expect, it } from "vitest";
import { composeScene } from "@/engine";
import {
  KERB,
  downpipes,
  exposedSpans,
  frontageBlock,
  kerbFaceVisible,
  kerbRuns,
  neighbourFace,
  solidSpans,
} from "../courtyard/frontage";
import { frontagePilot, paintBuilding } from "../courtyard/composedEnvironment";
import { meterBox, METER_BOX, storefrontFor, storefrontOpenings } from "../courtyard/storefront";

const project = (p: { x: number; y: number }) => ({ x: (p.x - p.y) * 32, y: (p.x + p.y) * 16 });
const scene = (seed: number) => composeScene("intersection", seed).layout.arena;
const pilotOf = (seed: number) => {
  const arena = scene(seed);
  const env = arena.environment!;
  for (const s of env.structures) {
    const sf = storefrontFor(s, env, arena.cover ?? []);
    if (sf) return { arena, env, sf, pilot: frontagePilot(sf, env.structures, env.entrances) };
  }
  return undefined;
};

describe("the architectural pilot: the shop's block", () => {
  it("is the seed-7 shop and the two commercial masses built flush against it", () => {
    const p = pilotOf(7)!;
    expect(p.sf.structure.id).toBe("building_0");
    expect(p.pilot.neighbours.map((n) => n.id).sort()).toEqual([
      "building_0_middle",
      "building_0_rear",
    ]);
  });

  it("knows which stretches of each face are open air", () => {
    const { env } = pilotOf(7)!;
    const s = (id: string) => env.structures.find((x) => x.id === id)!;
    // the middle stands in front of the shop's face from 8 m to 18 m
    expect(exposedSpans(s("building_0"), "north", env.structures)).toEqual([
      [0, 8],
      [18, 20],
    ]);
    // the rear is flush against the middle's north face; its east face is open
    expect(exposedSpans(s("building_0_middle"), "north", env.structures)).toEqual([]);
    expect(exposedSpans(s("building_0_middle"), "east", env.structures)).toEqual([[0, 6]]);
  });

  it("never joins a block across the street or into another kind of building", () => {
    for (let seed = 0; seed <= 40; seed++) {
      const p = pilotOf(seed);
      if (!p) continue;
      for (const n of p.pilot.neighbours) expect(n.style).toBe("shop");
      expect(frontageBlock(p.env.structures, p.sf.structure)).toEqual(p.pilot.neighbours);
    }
  });

  it("drains each roof by one pipe, on open wall, clear of every opening and fitting", () => {
    let checked = 0;
    for (let seed = 0; seed <= 40; seed++) {
      const p = pilotOf(seed);
      if (!p) continue;
      const { pilot, sf, env } = p;
      expect(new Set(pilot.pipes.map((d) => d.structure.id)).size).toBe(pilot.pipes.length);
      for (const pipe of pilot.pipes) {
        const open = exposedSpans(pipe.structure, pipe.edge, env.structures);
        expect(open.some(([a, b]) => pipe.s > a && pipe.s < b)).toBe(true);
        const taken: [number, number][] =
          pipe.structure === sf.structure && pipe.edge === sf.edge
            ? [
                ...storefrontOpenings(sf),
                ...(meterBox(sf) !== undefined
                  ? [[meterBox(sf)!, meterBox(sf)! + METER_BOX.width] as [number, number]]
                  : []),
              ]
            : open.flatMap((span) => {
                const f = neighbourFace(pipe.edge, span);
                return [
                  ...f.windows.map((w) => [w, w + 1.6] as [number, number]),
                  ...(f.louvre !== undefined
                    ? [[f.louvre, f.louvre + 0.9] as [number, number]]
                    : []),
                ];
              });
        for (const [a, b] of taken) expect(pipe.s <= a - 0.2 || pipe.s >= b + 0.2).toBe(true);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(10);
  });

  it("puts the seed-7 shop's pipe on the pier between its two bays", () => {
    const { pilot, sf } = pilotOf(7)!;
    const pipe = pilot.pipes.find((d) => d.structure === sf.structure)!;
    expect(pipe.edge).toBe("north");
    expect(pipe.s).toBeGreaterThan(5.7);
    expect(pipe.s).toBeLessThan(6.5);
  });

  it("never paints a door on a neighbour: openings are high windows and a louvre", () => {
    const f = neighbourFace("east", [0, 6]);
    expect(f.windows.length).toBeGreaterThan(0);
    for (const w of f.windows) expect(w).toBeGreaterThanOrEqual(0.9);
    expect(Object.keys(f).sort()).toEqual(["edge", "louvre", "span", "windows"]);
  });

  it("splits a face into its solid stretches around openings", () => {
    expect(
      solidSpans(
        [0, 8],
        [
          [0.08, 1.92],
          [3.5, 5.7],
          [6.5, 8.7],
        ],
        0,
      ),
    ).toEqual([
      [0, 0.08],
      [1.92, 3.5],
      [5.7, 6.5],
    ]);
  });
});

describe("the architectural pilot: kerbs", () => {
  it("runs only along pavement edges that meet carriageway, never along a pavement or a building", () => {
    for (const seed of [0, 1, 4, 7, 8]) {
      const env = scene(seed).environment!;
      const roadlike = env.zones.filter((z) =>
        ["road", "intersection", "parking", "crosswalk"].includes(z.kind),
      );
      for (const run of kerbRuns(env.zones)) {
        const mid = { x: (run.from.x + run.to.x) / 2, y: (run.from.y + run.to.y) / 2 };
        const n =
          run.faces === "north"
            ? { x: 0, y: -0.1 }
            : run.faces === "south"
              ? { x: 0, y: 0.1 }
              : run.faces === "west"
                ? { x: -0.1, y: 0 }
                : { x: 0.1, y: 0 };
        const road = { x: mid.x + n.x, y: mid.y + n.y };
        const inside = (
          r: { x: number; y: number; width: number; height: number },
          p: { x: number; y: number },
        ) => p.x >= r.x && p.x <= r.x + r.width && p.y >= r.y && p.y <= r.y + r.height;
        expect(
          roadlike.some((z) => inside(z.rect, road)),
          `${seed} ${JSON.stringify(run)}`,
        ).toBe(true);
        // a dropped kerb is where a crossing meets it
        if (run.dropped)
          expect(env.zones.some((z) => z.kind === "crosswalk" && inside(z.rect, road))).toBe(true);
      }
    }
  });

  it("shows a kerb's face only where the road lies toward the camera", () => {
    const runs = kerbRuns(scene(7).environment!.zones);
    expect(runs.some(kerbFaceVisible)).toBe(true);
    expect(runs.some((r) => !kerbFaceVisible(r))).toBe(true);
    for (const r of runs.filter(kerbFaceVisible)) expect(["east", "north"]).toContain(r.faces);
    // a dropped kerb stands almost flush
    expect(KERB.dropped).toBeLessThan(KERB.upstand / 4);
  });

  it("drops the kerb at every crossing of seed 7", () => {
    const env = scene(7).environment!;
    const dropped = kerbRuns(env.zones).filter((r) => r.dropped);
    // four crossings, each met by pavement at both of its ends
    expect(dropped.length).toBeGreaterThanOrEqual(8);
  });
});

describe("the architectural pilot: the neighbours' own materials", () => {
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
  const keysLaid = (structureId: string) => {
    const { env, pilot } = pilotOf(7)!;
    const used = new Set<string>();
    const ctx = new Proxy(
      {},
      {
        get: (_t, name: string) => {
          if (name === "createPattern")
            return (tile: { key: string }) => {
              used.add(tile.key);
              return { setTransform: () => undefined };
            };
          if (name === "createRadialGradient" || name === "createLinearGradient")
            return () => ({ addColorStop: () => undefined });
          return () => undefined;
        },
        set: () => true,
      },
    ) as unknown as CanvasRenderingContext2D;
    const s = env.structures.find((x) => x.id === structureId)!;
    paintBuilding(ctx, s, project, env.entrances, tiles as never, undefined, pilot.detail(s));
    return used;
  };

  it("lays ballast and render on a neighbour, and never on the shop", () => {
    const neighbour = keysLaid("building_0_middle");
    expect(neighbour.has("roof-ballast")).toBe(true);
    expect(neighbour.has("painted-render")).toBe(true);
    expect(neighbour.has("roof-membrane")).toBe(false);
    const shop = keysLaid("building_0");
    expect(shop.has("roof-ballast")).toBe(false);
    expect(shop.has("painted-render")).toBe(false);
  });
});
