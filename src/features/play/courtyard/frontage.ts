/**
 * The architectural pilot: the corner shop's block and the street in front of it,
 * detailed as built things rather than flat fills. Presentation only — nothing here
 * adds or moves a wall, an entrance, a cover piece or a route.
 *
 * WHAT IS DETAILED, AND WHY EACH THING IS WHERE IT IS
 *   - The block: the storefront's building and every commercial mass flush against
 *     it (`frontageBlock`). The shop keeps its warm, lit face; its neighbours get a
 *     restrained identity of their own — dark painted render, a metal-capped
 *     parapet, high barred windows, a louvre — and no lit glass, sign or door. A door
 *     is never painted where no entrance is saved (4D.5: entrances own door markers).
 *   - Roof edges: every block roof is a parapet with a coping and the inner face the
 *     camera sees on its far sides, so the roofs, which fill half the frame at play
 *     zoom, read as built thickness rather than a flat slab.
 *   - Water: each roof drains through one scupper to one downpipe on a solid pier of a
 *     camera-facing wall (`downpipes`), whose shoe stains the pavement at its foot;
 *     the street drains along a concrete channel to the saved gullies.
 *   - Kerbs: every pavement edge that meets a carriageway is a run of 1 m kerb stones
 *     (`kerbRuns`); its face shows where the road lies toward the camera, and it drops
 *     flush with tactile paving where a crossing meets it.
 *   - Wear: at the building's feet (splash and grime), at the shop door (feet), and
 *     under the vendor's cart (grease) — where use puts it, never as an all-over noise.
 */
import type { Point, Rect, SceneEnvironment, SceneStructure } from "@/engine";
import {
  SURFACE_MATERIALS,
  fillMaterial,
  groundBasis,
  wallBasis,
  type MaterialSet,
} from "./surfaceMaterials";

type Project = (p: Point) => Point;
export type Edge = "north" | "east";

/* ------------------------------------------------------------------ geometry */

const touches = (a: Rect, b: Rect) => {
  const overlapX = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const overlapY = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  const flushX = a.x + a.width === b.x || b.x + b.width === a.x;
  const flushY = a.y + a.height === b.y || b.y + b.height === a.y;
  return (flushX && overlapY > 0) || (flushY && overlapX > 0);
};

/**
 * The storefront's building and the commercial masses built flush against it, and
 * against those: one block, one pilot. Only `shop`-style masses join; a residential
 * tower or a workshop across a court is not the shop's frontage.
 */
export function frontageBlock(
  structures: readonly SceneStructure[],
  shop: SceneStructure,
): SceneStructure[] {
  const block = [shop];
  for (let grew = true; grew;) {
    grew = false;
    for (const s of structures)
      if (s.style === "shop" && !block.includes(s) && block.some((b) => touches(b.rect, s.rect))) {
        block.push(s);
        grew = true;
      }
  }
  return block.slice(1);
}

/** A camera-facing face of a mass: `s` metres along it, `out` from the wall. */
export function edgeFrame(r: Rect, edge: Edge) {
  const length = edge === "north" ? r.width : r.height;
  const world = (s: number, out: number): Point =>
    edge === "north" ? { x: r.x + s, y: r.y - out } : { x: r.x + r.width + out, y: r.y + s };
  return { length, world };
}

/**
 * The stretches of a camera-facing face that are open air: a face has nothing to
 * show where another mass stands flush against it.
 */
export function exposedSpans(
  structure: SceneStructure,
  edge: Edge,
  structures: readonly SceneStructure[],
): [number, number][] {
  const r = structure.rect;
  const { length } = edgeFrame(r, edge);
  let spans: [number, number][] = [[0, length]];
  for (const o of structures) {
    if (o === structure || o.style === "mesh-fence" || o.style === "interior-wall") continue;
    const n = o.rect;
    let cut: [number, number] | undefined;
    if (edge === "north" && n.y + n.height === r.y)
      cut = [Math.max(0, n.x - r.x), Math.min(length, n.x + n.width - r.x)];
    if (edge === "east" && n.x === r.x + r.width)
      cut = [Math.max(0, n.y - r.y), Math.min(length, n.y + n.height - r.y)];
    if (!cut || cut[1] <= cut[0]) continue;
    spans = spans.flatMap(([a, b]): [number, number][] =>
      cut![1] <= a || cut![0] >= b
        ? [[a, b]]
        : [
            ...(cut![0] > a ? [[a, cut![0]] as [number, number]] : []),
            ...(cut![1] < b ? [[cut![1], b] as [number, number]] : []),
          ],
    );
  }
  return spans.filter(([a, b]) => b - a > 0.3);
}

/** What a neighbour's face carries, so walls, pipes and ground agree on it. */
export interface NeighbourFace {
  edge: Edge;
  span: [number, number];
  /** High windows, barred: start of each 1.6 m opening. */
  windows: number[];
  /** A louvred grille, if the span has a pier long enough for one. */
  louvre?: number;
}

const NEIGHBOUR = {
  windowWidth: 1.6,
  windowBottom: 2.0,
  windowTop: 2.75,
  louvreWidth: 0.9,
  louvreBottom: 2.15,
  louvreTop: 2.75,
  pitch: 3.2,
} as const;
export { NEIGHBOUR as NEIGHBOUR_FACE };

/** The neighbour's openings along one exposed span: sparse, high and regular. */
export function neighbourFace(edge: Edge, span: [number, number]): NeighbourFace {
  const [a, b] = span;
  const windows: number[] = [];
  for (let s = a + 0.9; s + NEIGHBOUR.windowWidth <= b - 0.9; s += NEIGHBOUR.pitch) windows.push(s);
  // a louvre on the first pier wide enough for it, clear of every window
  const last = windows.length ? windows[windows.length - 1]! + NEIGHBOUR.windowWidth : a;
  const louvre = b - last >= NEIGHBOUR.louvreWidth + 1.4 ? last + 0.6 : undefined;
  return { edge, span, windows, ...(louvre !== undefined ? { louvre } : {}) };
}

/** A downpipe: on which mass, on which face, how far along it. */
export interface Downpipe {
  structure: SceneStructure;
  edge: Edge;
  s: number;
}

/**
 * Where each block roof drains. One downpipe per mass, on a camera-facing face, at
 * the last solid stretch of wall before the face ends or meets another mass: the
 * internal corner, where water from a flat roof is taken down. Never across a door,
 * window or bay (`busy` lists the occupied stretches of each face).
 */
export function downpipes(
  masses: readonly SceneStructure[],
  structures: readonly SceneStructure[],
  busy: (s: SceneStructure, edge: Edge) => [number, number][],
): Downpipe[] {
  const out: Downpipe[] = [];
  for (const m of masses) {
    for (const edge of ["north", "east"] as const) {
      const spans = exposedSpans(m, edge, structures);
      if (!spans.length) continue;
      // the longest open stretch: the face people actually see
      const [a, b] = [...spans].sort((x, y) => y[1] - y[0] - (x[1] - x[0]))[0]!;
      const taken = busy(m, edge);
      // walk back from the span's end to the first clear 0.4 m of wall
      for (let s = b - 0.35; s >= a + 0.3; s -= 0.1)
        if (!taken.some(([p, q]) => s > p - 0.25 && s < q + 0.25)) {
          out.push({ structure: m, edge, s });
          break;
        }
      if (out.some((d) => d.structure === m)) break;
    }
  }
  return out;
}

/** A pavement edge that meets a carriageway: the kerb, and which side the road is. */
export interface KerbRun {
  /** The line, in world metres, along the pavement's edge. */
  from: Point;
  to: Point;
  /** The direction the kerb's face looks: toward the road. */
  faces: "north" | "south" | "east" | "west";
  /** Dropped flush where a crossing meets the kerb. */
  dropped: boolean;
}

const ROADLIKE = new Set(["road", "intersection", "parking", "crosswalk"]);

/**
 * Every run of kerb on the scene's saved ground: each pavement edge, split where it
 * meets carriageway, with the stretches a crosswalk reaches marked as dropped.
 */
export function kerbRuns(zones: SceneEnvironment["zones"]): KerbRun[] {
  const runs: KerbRun[] = [];
  const walks = zones.filter((z) => z.kind === "sidewalk");
  const roads = zones.filter((z) => ROADLIKE.has(z.kind));
  for (const w of walks) {
    const r = w.rect;
    const edges = [
      { faces: "north" as const, axis: "x" as const, at: r.y, lo: r.x, hi: r.x + r.width },
      {
        faces: "south" as const,
        axis: "x" as const,
        at: r.y + r.height,
        lo: r.x,
        hi: r.x + r.width,
      },
      { faces: "west" as const, axis: "y" as const, at: r.x, lo: r.y, hi: r.y + r.height },
      {
        faces: "east" as const,
        axis: "y" as const,
        at: r.x + r.width,
        lo: r.y,
        hi: r.y + r.height,
      },
    ];
    for (const e of edges) {
      // what lies just across this edge, along it
      const across = (z: (typeof roads)[number]) => {
        const q = z.rect;
        const flush =
          e.faces === "north"
            ? q.y + q.height === e.at
            : e.faces === "south"
              ? q.y === e.at
              : e.faces === "west"
                ? q.x + q.width === e.at
                : q.x === e.at;
        if (!flush) return undefined;
        const lo = Math.max(e.lo, e.axis === "x" ? q.x : q.y);
        const hi = Math.min(e.hi, e.axis === "x" ? q.x + q.width : q.y + q.height);
        return hi > lo ? ([lo, hi] as [number, number]) : undefined;
      };
      const carriage = roads
        .filter((z) => z.kind !== "crosswalk")
        .flatMap((z) => {
          const s = across(z);
          return s ? [s] : [];
        });
      // a crosswalk lies over the carriageway; where it reaches the kerb, the kerb drops
      const crossings = roads
        .filter((z) => z.kind === "crosswalk")
        .flatMap((z) => {
          const q = z.rect;
          const lo = Math.max(e.lo, e.axis === "x" ? q.x : q.y);
          const hi = Math.min(e.hi, e.axis === "x" ? q.x + q.width : q.y + q.height);
          const reaches =
            e.axis === "x"
              ? q.y <= e.at + 1e-9 && q.y + q.height >= e.at - 1e-9
              : q.x <= e.at + 1e-9 && q.x + q.width >= e.at - 1e-9;
          return reaches && hi > lo ? [[lo, hi] as [number, number]] : [];
        });
      for (const [lo, hi] of merge(carriage)) {
        const cuts = merge(crossings)
          .map(([a, b]) => [Math.max(a, lo), Math.min(b, hi)] as [number, number])
          .filter(([a, b]) => b > a);
        let t = lo;
        const point = (v: number): Point =>
          e.axis === "x" ? { x: v, y: e.at } : { x: e.at, y: v };
        for (const [a, b] of cuts) {
          if (a > t) runs.push({ from: point(t), to: point(a), faces: e.faces, dropped: false });
          runs.push({ from: point(a), to: point(b), faces: e.faces, dropped: true });
          t = b;
        }
        if (hi > t) runs.push({ from: point(t), to: point(hi), faces: e.faces, dropped: false });
      }
    }
  }
  return runs;
}

function merge(spans: [number, number][]): [number, number][] {
  const sorted = [...spans].sort((a, b) => a[0] - b[0]);
  const out: [number, number][] = [];
  for (const s of sorted) {
    const last = out[out.length - 1];
    if (last && s[0] <= last[1] + 1e-9) last[1] = Math.max(last[1], s[1]);
    else out.push([...s]);
  }
  return out;
}

/** The kerb's face is seen only where the road lies toward the camera (+x, -y). */
export const kerbFaceVisible = (run: KerbRun) => run.faces === "east" || run.faces === "north";

/** Unit vector, in world metres, from the kerb toward the road. */
export function towardRoad(run: KerbRun): Point {
  return run.faces === "north"
    ? { x: 0, y: -1 }
    : run.faces === "south"
      ? { x: 0, y: 1 }
      : run.faces === "west"
        ? { x: -1, y: 0 }
        : { x: 1, y: 0 };
}

/** A small, stable hash: the same stone is always the same stone. */
export function hash(...n: number[]) {
  let h = 2166136261;
  for (const v of n) {
    h ^= Math.round(v * 1000);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return (h >>> 0) / 4294967296;
}

/* ------------------------------------------------------------------ painting */

const KERB = {
  /** Kerb stone width on the pavement side, and its standing height above the road. */
  width: 0.32,
  upstand: 0.12,
  dropped: 0.02,
  stone: 1,
  /** The concrete channel along the road side, that carries water to the gullies. */
  channel: 0.3,
  tactileDepth: 0.8,
} as const;
export { KERB };

function poly(ctx: CanvasRenderingContext2D, pts: readonly Point[], fill: string) {
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}
function stroke(ctx: CanvasRenderingContext2D, a: Point, b: Point, color: string, width: number) {
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
}
function gradient(
  ctx: CanvasRenderingContext2D,
  pts: readonly Point[],
  from: Point,
  to: Point,
  stops: [number, string][],
) {
  const g = ctx.createLinearGradient(from.x, from.y, to.x, to.y);
  for (const [t, c] of stops) g.addColorStop(t, c);
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.closePath();
  ctx.fillStyle = g;
  ctx.fill();
}
function blot(ctx: CanvasRenderingContext2D, centre: Point, rx: number, ry: number, color: string) {
  const g = ctx.createRadialGradient(centre.x, centre.y, 0, centre.x, centre.y, rx);
  g.addColorStop(0, color);
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.save();
  ctx.translate(centre.x, centre.y);
  ctx.scale(1, ry / rx);
  ctx.translate(-centre.x, -centre.y);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(centre.x, centre.y, rx, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * The street's kerbs, channel, crossings and gullies, on the ground canvas. Every
 * mark is flush with the ground or a few centimetres proud of it: nothing here
 * stops a step or a shot.
 */
export function paintStreetscape(
  ctx: CanvasRenderingContext2D,
  env: SceneEnvironment,
  project: Project,
  ppm: number,
  /** Kerb stones are the scene's own concrete, where it is loaded. */
  materials?: MaterialSet,
) {
  const concrete = SURFACE_MATERIALS["facade-concrete"].metres;
  const runs = kerbRuns(env.zones);
  const lift = (p: Point, z: number) => ({ x: p.x, y: p.y - z * ppm });
  const along = (run: KerbRun, t: number, out: number): Point => {
    const n = towardRoad(run);
    return {
      x: run.from.x + (run.to.x - run.from.x) * t + n.x * out,
      y: run.from.y + (run.to.y - run.from.y) * t + n.y * out,
    };
  };
  const length = (run: KerbRun) => Math.hypot(run.to.x - run.from.x, run.to.y - run.from.y);

  // 1. the channel: a strip of pale concrete along the road side of every kerb,
  //    jointed every metre, that carries the street's water to its gullies
  for (const run of runs) {
    const quad = [
      along(run, 0, 0),
      along(run, 1, 0),
      along(run, 1, KERB.channel),
      along(run, 0, KERB.channel),
    ].map(project);
    poly(ctx, quad, "rgba(120,124,118,.34)");
    // the channel falls to the kerb: darker, damp, at the kerb line
    gradient(ctx, quad, project(along(run, 0, 0)), project(along(run, 0, KERB.channel)), [
      [0, "rgba(10,16,18,.35)"],
      [0.5, "rgba(10,16,18,.08)"],
      [1, "rgba(10,16,18,0)"],
    ]);
    const L = length(run);
    for (let s = 1; s < L; s += 1)
      stroke(
        ctx,
        project(along(run, s / L, 0)),
        project(along(run, s / L, KERB.channel)),
        "rgba(20,26,28,.45)",
        0.6,
      );
  }

  // 2. tactile paving where a crossing meets a dropped kerb: blistered buff slabs on
  //    the pavement, as deep as the crossing's approach
  for (const run of runs.filter((r) => r.dropped)) {
    const n = towardRoad(run);
    const back = (p: Point, d: number): Point => ({ x: p.x - n.x * d, y: p.y - n.y * d });
    const pad = [
      back(along(run, 0, 0), KERB.width + 0.05),
      back(along(run, 1, 0), KERB.width + 0.05),
      back(along(run, 1, 0), KERB.width + KERB.tactileDepth),
      back(along(run, 0, 0), KERB.width + KERB.tactileDepth),
    ];
    poly(ctx, pad.map(project), "rgba(118,106,74,.82)");
    const L = length(run);
    for (let s = 0.06; s < L; s += 0.12)
      for (let d = KERB.width + 0.11; d < KERB.width + KERB.tactileDepth; d += 0.12) {
        const p = project(back(along(run, s / L, 0), d));
        ctx.fillStyle = "rgba(160,146,104,.6)";
        ctx.fillRect(p.x - 0.7, p.y - 0.5, 1.4, 1);
      }
  }

  // 3. the kerb itself: stones on the pavement's edge, each its own tone, jointed
  for (const run of runs) {
    const L = length(run);
    const n = towardRoad(run);
    const back = (p: Point, d: number): Point => ({ x: p.x - n.x * d, y: p.y - n.y * d });
    const height = run.dropped ? KERB.dropped : KERB.upstand;
    const face = kerbFaceVisible(run);
    for (let s = 0; s < L - 1e-6; s += KERB.stone) {
      const e = Math.min(L, s + KERB.stone);
      const a = along(run, s / L, 0);
      const b = along(run, e / L, 0);
      const tone = hash(a.x, a.y, 3);
      const top = [a, b, back(b, KERB.width), back(a, KERB.width)].map(project);
      const v = Math.round(144 + tone * 18);
      const stoneTop = `#${[v, v + 2, v - 6].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
      if (
        !fillMaterial(ctx, materials, top, {
          key: "facade-concrete",
          basis: groundBasis(project),
          target: stoneTop,
          strength: 0.7,
        })
      )
        poly(ctx, top, stoneTop);
      // the arris catches light along the road side
      stroke(ctx, project(a), project(b), "rgba(220,216,197,.5)", 0.8);
      if (face) {
        // the kerb's face, standing above the channel, in the stone's own shade
        const fv = Math.round(83 + tone * 14);
        const stoneFace = `#${[fv, fv + 2, fv - 2].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
        const facePts = [
          project(a),
          project(b),
          lift(project(b), -height),
          lift(project(a), -height),
        ];
        const axis = run.faces === "north" ? "x" : "y";
        const at = run.faces === "north" ? a.y : a.x;
        if (
          !fillMaterial(ctx, materials, facePts, {
            key: "facade-concrete",
            basis: wallBasis(project, axis, at, concrete, ppm),
            target: stoneFace,
            strength: 0.7,
          })
        )
          poly(ctx, facePts, stoneFace);
        stroke(ctx, lift(project(a), -height), lift(project(b), -height), "rgba(4,8,10,.55)", 1);
      } else {
        // the road beyond a kerb faced away from us lies in its shade
        const shade = [a, b, along(run, e / L, 0.1), along(run, s / L, 0.1)].map(project);
        poly(ctx, shade, "rgba(4,8,10,.28)");
      }
      // the joint
      stroke(ctx, project(a), project(back(a, KERB.width)), "rgba(30,34,34,.7)", 0.7);
      if (face) stroke(ctx, project(a), lift(project(a), -height), "rgba(20,24,24,.7)", 0.7);
      // a few stones are chipped at the arris: one in nine, always the same ones
      if (tone > 0.89 && !run.dropped) {
        const m = along(run, (s + 0.45) / L, 0);
        const chip = [m, along(run, (s + 0.62) / L, 0), back(along(run, (s + 0.55) / L, 0), 0.07)];
        poly(ctx, chip.map(project), "rgba(52,56,54,.85)");
      }
    }
  }

  // 4. gullies: the saved drains, set in the channel at the nearest kerb and turned
  //    along it, with a kerb inlet and the damp they gather
  for (const d of env.dressing.filter((x) => x.kind === "drain")) {
    let best: { run: KerbRun; t: number; dist: number } | undefined;
    for (const run of runs) {
      const L = length(run);
      const ux = (run.to.x - run.from.x) / L;
      const uy = (run.to.y - run.from.y) / L;
      const t = Math.max(
        0,
        Math.min(L, (d.position.x - run.from.x) * ux + (d.position.y - run.from.y) * uy),
      );
      const q = { x: run.from.x + ux * t, y: run.from.y + uy * t };
      const dist = Math.hypot(d.position.x - q.x, d.position.y - q.y);
      if (!best || dist < best.dist) best = { run, t: t / L, dist };
    }
    if (!best || best.dist > 1.5) continue;
    const { run, t } = best;
    const L = length(run);
    const half = 0.32 / L;
    const t0 = Math.max(0, t - half);
    const t1 = Math.min(1, t + half);
    blot(ctx, project(along(run, t, 0.2)), 0.9 * ppm, 0.5 * ppm, "rgba(6,12,14,.38)");
    const frame = [
      along(run, t0, 0.02),
      along(run, t1, 0.02),
      along(run, t1, 0.4),
      along(run, t0, 0.4),
    ].map(project);
    poly(ctx, frame, "#2a3133");
    const grate = [
      along(run, t0 + 0.04 / L, 0.06),
      along(run, t1 - 0.04 / L, 0.06),
      along(run, t1 - 0.04 / L, 0.36),
      along(run, t0 + 0.04 / L, 0.36),
    ].map(project);
    poly(ctx, grate, "#0b1114");
    // bars across the flow
    for (let k = 1; k < 6; k++) {
      const tk = t0 + ((t1 - t0) * k) / 6;
      stroke(ctx, project(along(run, tk, 0.06)), project(along(run, tk, 0.36)), "#59646a", 0.8);
    }
    if (kerbFaceVisible(run)) {
      const mouth = [along(run, t0, 0), along(run, t1, 0)].map(project);
      poly(
        ctx,
        [
          mouth[0]!,
          mouth[1]!,
          lift(mouth[1]!, -KERB.upstand * 0.7),
          lift(mouth[0]!, -KERB.upstand * 0.7),
        ],
        "#070b0d",
      );
    }
  }
}

/** Options for the block's ground: its walls' feet, its pipes' shoes, its door. */
export interface FrontageGround {
  ctx: CanvasRenderingContext2D;
  project: Project;
  ppm: number;
  block: readonly SceneStructure[];
  structures: readonly SceneStructure[];
  pipes: readonly Downpipe[];
  /** The shop door, in world metres at the wall, and the face it opens on. */
  door?: { at: Point; edge: Edge };
  /** Where a vendor stands and cooks, by the cover piece it is drawn on. */
  stalls: readonly Rect[];
}

/** Grime at the block's feet, the stains its pipes leave, and the shop door's wear. */
export function paintFrontageGround(o: FrontageGround) {
  const { ctx, project, ppm } = o;
  // splash and grime where wall meets pavement, along every open camera-facing face
  for (const m of o.block)
    for (const edge of ["north", "east"] as const)
      for (const [a, b] of exposedSpans(m, edge, o.structures)) {
        const f = edgeFrame(m.rect, edge);
        const strip = [f.world(a, 0), f.world(b, 0), f.world(b, 0.45), f.world(a, 0.45)].map(
          project,
        );
        gradient(ctx, strip, project(f.world(a, 0)), project(f.world(a, 0.45)), [
          [0, "rgba(16,14,10,.42)"],
          [0.4, "rgba(16,14,10,.14)"],
          [1, "rgba(16,14,10,0)"],
        ]);
        // dirt gathers in the internal corner where this face meets another mass
        for (const [s, open] of [
          [a, a > 0.01],
          [b, b < f.length - 0.01],
        ] as const)
          if (open) blot(ctx, project(f.world(s, 0.1)), 0.55 * ppm, 0.3 * ppm, "rgba(14,12,8,.4)");
      }
  // each downpipe's shoe throws water out across the pavement: a damp fan and silt
  for (const p of o.pipes) {
    const f = edgeFrame(p.structure.rect, p.edge);
    blot(ctx, project(f.world(p.s, 0.3)), 0.6 * ppm, 0.32 * ppm, "rgba(8,14,16,.5)");
    blot(ctx, project(f.world(p.s, 0.75)), 0.45 * ppm, 0.22 * ppm, "rgba(8,14,16,.25)");
  }
  // the shop door: the threshold polished pale by feet, its edges darkened by them
  if (o.door) {
    const { at, edge } = o.door;
    const out: Point = edge === "north" ? { x: 0, y: -1 } : { x: 1, y: 0 };
    const along: Point = edge === "north" ? { x: 1, y: 0 } : { x: 0, y: 1 };
    const w = (s: number, d: number) =>
      project({ x: at.x + along.x * s + out.x * d, y: at.y + along.y * s + out.y * d });
    blot(ctx, w(0, 0.7), 0.95 * ppm, 0.5 * ppm, "rgba(190,184,168,.12)");
    for (const s of [-0.95, 0.95]) blot(ctx, w(s, 0.25), 0.35 * ppm, 0.2 * ppm, "rgba(12,10,8,.3)");
  }
  // where a vendor cooks: drips and grease under the stall's front
  for (const r of o.stalls) {
    const c = project({ x: r.x + r.width * 0.55, y: r.y + r.height * 0.4 });
    blot(ctx, c, 1.1 * ppm, 0.55 * ppm, "rgba(26,18,8,.34)");
    for (let k = 0; k < 4; k++) {
      const q = project({
        x: r.x + 0.4 + hash(r.x, k) * (r.width - 0.8),
        y: r.y - 0.25 - hash(r.y, k, 2) * 0.5,
      });
      blot(ctx, q, 0.16 * ppm, 0.09 * ppm, "rgba(30,20,8,.4)");
    }
  }
}

/** What a mass is in the pilot. */
export type FrontageRole = "shop" | "neighbour";

/**
 * A roof's edge: a parapet with a coping, its inner face shown on the two far sides
 * (the only inner faces the camera sees), and the drip line under the coping on the
 * two camera-facing walls. The shop's coping is wide pre-cast concrete; a
 * neighbour's is a narrow pressed-metal cap.
 */
export function paintParapet(
  ctx: CanvasRenderingContext2D,
  project: Project,
  ppm: number,
  structure: SceneStructure,
  role: FrontageRole,
  /** The coping is the scene's concrete (shop) or painted metal (neighbour), where loaded. */
  materials?: MaterialSet,
) {
  const r = structure.rect;
  const h = structure.height;
  const at = (x: number, y: number, z: number) => {
    const p = project({ x, y });
    return { x: p.x, y: p.y - z * ppm };
  };
  const cw = role === "shop" ? 0.32 : 0.22;
  const rise = role === "shop" ? 0.32 : 0.24;
  const o = [
    at(r.x, r.y, h),
    at(r.x + r.width, r.y, h),
    at(r.x + r.width, r.y + r.height, h),
    at(r.x, r.y + r.height, h),
  ];
  const i = [
    at(r.x + cw, r.y + cw, h),
    at(r.x + r.width - cw, r.y + cw, h),
    at(r.x + r.width - cw, r.y + r.height - cw, h),
    at(r.x + cw, r.y + r.height - cw, h),
  ];
  const down = (p: Point) => ({ x: p.x, y: p.y + rise * ppm });
  // inner faces on the far sides (south: y max, west: x min): the roof lies below
  const south = [i[3]!, i[2]!, down(i[2]!), down(i[3]!)];
  const west = [i[0]!, i[3]!, down(i[3]!), down(i[0]!)];
  poly(ctx, west, role === "shop" ? "#4f5555" : "#3d4142");
  poly(ctx, south, role === "shop" ? "#5d6463" : "#474b4c");
  // the roof's own shade at the foot of every inner face
  for (const [a, b] of [
    [down(i[0]!), down(i[3]!)],
    [down(i[3]!), down(i[2]!)],
    [i[0]!, i[1]!],
    [i[1]!, i[2]!],
  ] as const)
    stroke(ctx, a, b, "rgba(4,8,10,.45)", 2.2);
  // the coping: four strips round the roof, lit on top
  const strips = [
    [o[0]!, o[1]!, i[1]!, i[0]!],
    [o[1]!, o[2]!, i[2]!, i[1]!],
    [o[2]!, o[3]!, i[3]!, i[2]!],
    [o[3]!, o[0]!, i[0]!, i[3]!],
  ];
  for (const [k, s] of strips.entries()) {
    const near = k === 0 || k === 1;
    const flat = role === "shop" ? (near ? "#7f837c" : "#70746e") : near ? "#636b6f" : "#575e62";
    if (
      !fillMaterial(ctx, materials, s, {
        key: role === "shop" ? "facade-concrete" : "painted-metal",
        basis: groundBasis(project, h * ppm),
        target: flat,
        strength: 0.75,
      })
    )
      poly(ctx, s, flat);
  }
  // joints in a concrete coping, every 1.2 m; a metal cap has lapped seams every 2.4 m
  const step = role === "shop" ? 1.2 : 2.4;
  for (const [a0, a1, b0, b1, len] of [
    [o[0]!, o[1]!, i[0]!, i[1]!, r.width],
    [o[1]!, o[2]!, i[1]!, i[2]!, r.height],
    [o[3]!, o[2]!, i[3]!, i[2]!, r.width],
    [o[0]!, o[3]!, i[0]!, i[3]!, r.height],
  ] as const)
    for (let t = step; t < len - 0.2; t += step) {
      const u = t / len;
      stroke(
        ctx,
        { x: a0.x + (a1.x - a0.x) * u, y: a0.y + (a1.y - a0.y) * u },
        { x: b0.x + (b1.x - b0.x) * u, y: b0.y + (b1.y - b0.y) * u },
        "rgba(20,26,28,.6)",
        0.7,
      );
    }
  // the outer arris along the camera-facing walls, and the drip line beneath it
  for (const [a, b] of [
    [o[0]!, o[1]!],
    [o[1]!, o[2]!],
  ] as const) {
    stroke(ctx, a, b, role === "shop" ? "#a3a69c" : "#8a9498", 0.8);
    stroke(
      ctx,
      { x: a.x, y: a.y + 0.07 * ppm },
      { x: b.x, y: b.y + 0.07 * ppm },
      "rgba(4,8,10,.55)",
      1.4,
    );
  }
}

/** One roof outlet, near where the roof falls to its scupper: a grate and its stain. */
export function paintRoofOutlet(
  ctx: CanvasRenderingContext2D,
  project: Project,
  ppm: number,
  pipe: Downpipe,
) {
  const r = pipe.structure.rect;
  const h = pipe.structure.height;
  const f = edgeFrame(r, pipe.edge);
  // inside the parapet, a metre back from the scupper
  const w = f.world(pipe.s, -0.9);
  const p = project(w);
  const c = { x: p.x, y: p.y - h * ppm };
  blot(ctx, c, 0.9 * ppm, 0.5 * ppm, "rgba(10,14,14,.35)");
  ctx.fillStyle = "#1a2124";
  ctx.beginPath();
  ctx.ellipse(c.x, c.y, 0.2 * ppm, 0.11 * ppm, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#6a7477";
  ctx.lineWidth = 0.8;
  ctx.stroke();
  for (const dx of [-0.08, 0, 0.08]) {
    ctx.beginPath();
    ctx.moveTo(c.x + dx * ppm, c.y - 0.08 * ppm);
    ctx.lineTo(c.x + dx * ppm, c.y + 0.08 * ppm);
    ctx.strokeStyle = "#4b5558";
    ctx.stroke();
  }
}

/**
 * A downpipe on its wall, with the parapet's scupper and hopper at the top, a bracket
 * every 1.2 m, and the shoe that throws water clear at the foot. It stands 6 cm off
 * the wall, inside the wall's own sprite, so it sorts and fades with the wall.
 */
export function paintDownpipe(
  ctx: CanvasRenderingContext2D,
  project: Project,
  ppm: number,
  pipe: Downpipe,
  role: FrontageRole,
) {
  const f = edgeFrame(pipe.structure.rect, pipe.edge);
  const top = pipe.structure.height - 0.25;
  const at = (s: number, out: number, z: number) => {
    const p = project(f.world(s, out));
    return { x: p.x, y: p.y - z * ppm };
  };
  const r = 0.05;
  const out = 0.08;
  const metal =
    role === "shop" ? ["#2c3438", "#56636a", "#8d9aa0"] : ["#262b2d", "#4a5254", "#7b8588"];
  // the scupper: a dark slot through the parapet, a lip, a rust streak below it
  poly(
    ctx,
    [
      at(pipe.s - 0.12, 0, top + 0.12),
      at(pipe.s + 0.12, 0, top + 0.12),
      at(pipe.s + 0.12, 0, top + 0.02),
      at(pipe.s - 0.12, 0, top + 0.02),
    ],
    "#0a0f11",
  );
  gradient(
    ctx,
    [
      at(pipe.s - 0.1, 0, top),
      at(pipe.s + 0.1, 0, top),
      at(pipe.s + 0.16, 0, top - 0.9),
      at(pipe.s - 0.16, 0, top - 0.9),
    ],
    at(pipe.s, 0, top),
    at(pipe.s, 0, top - 0.9),
    [
      [0, "rgba(70,40,20,.35)"],
      [1, "rgba(70,40,20,0)"],
    ],
  );
  // the hopper head: a small box that takes the scupper's water
  const hz0 = top - 0.32;
  poly(
    ctx,
    [
      at(pipe.s - 0.14, out + 0.06, hz0),
      at(pipe.s + 0.14, out + 0.06, hz0),
      at(pipe.s + 0.14, out + 0.06, top),
      at(pipe.s - 0.14, out + 0.06, top),
    ],
    metal[1]!,
  );
  poly(
    ctx,
    [
      at(pipe.s - 0.14, 0, top),
      at(pipe.s + 0.14, 0, top),
      at(pipe.s + 0.14, out + 0.06, top),
      at(pipe.s - 0.14, out + 0.06, top),
    ],
    metal[2]!,
  );
  // the pipe: dark side, lit side, a fine highlight
  const shoe = 0.18;
  poly(
    ctx,
    [
      at(pipe.s - r, out, shoe),
      at(pipe.s + r, out, shoe),
      at(pipe.s + r, out, hz0),
      at(pipe.s - r, out, hz0),
    ],
    metal[1]!,
  );
  poly(
    ctx,
    [
      at(pipe.s - r, out, shoe),
      at(pipe.s - r * 0.2, out, shoe),
      at(pipe.s - r * 0.2, out, hz0),
      at(pipe.s - r, out, hz0),
    ],
    metal[0]!,
  );
  stroke(ctx, at(pipe.s + r * 0.45, out, shoe), at(pipe.s + r * 0.45, out, hz0), metal[2]!, 0.7);
  // its shadow on the wall beside it
  gradient(
    ctx,
    [
      at(pipe.s + r, 0, shoe),
      at(pipe.s + r + 0.12, 0, shoe),
      at(pipe.s + r + 0.12, 0, hz0),
      at(pipe.s + r, 0, hz0),
    ],
    at(pipe.s + r, 0, 1),
    at(pipe.s + r + 0.12, 0, 1),
    [
      [0, "rgba(0,0,0,.35)"],
      [1, "rgba(0,0,0,0)"],
    ],
  );
  // brackets
  for (let z = shoe + 0.6; z < hz0 - 0.2; z += 1.2)
    poly(
      ctx,
      [
        at(pipe.s - r - 0.02, out, z),
        at(pipe.s + r + 0.02, out, z),
        at(pipe.s + r + 0.02, out, z + 0.05),
        at(pipe.s - r - 0.02, out, z + 0.05),
      ],
      metal[0]!,
    );
  // the shoe: kicked out toward the pavement
  poly(
    ctx,
    [
      at(pipe.s - r, out, shoe),
      at(pipe.s + r, out, shoe),
      at(pipe.s + r, out + 0.16, 0.06),
      at(pipe.s - r, out + 0.16, 0.06),
    ],
    metal[1]!,
  );
  // splash grime on the wall at its foot
  gradient(
    ctx,
    [
      at(pipe.s - 0.45, 0, 0),
      at(pipe.s + 0.45, 0, 0),
      at(pipe.s + 0.45, 0, 0.7),
      at(pipe.s - 0.45, 0, 0.7),
    ],
    at(pipe.s, 0, 0),
    at(pipe.s, 0, 0.7),
    [
      [0, "rgba(18,16,10,.45)"],
      [1, "rgba(18,16,10,0)"],
    ],
  );
}

/**
 * The wall's base on the stretches of a face that are solid wall: a rendered plinth
 * 30 cm high, standing 2 cm proud, with a weathered top and splash grime above it.
 */
export function paintPlinth(
  ctx: CanvasRenderingContext2D,
  project: Project,
  ppm: number,
  structure: SceneStructure,
  edge: Edge,
  spans: readonly [number, number][],
  role: FrontageRole,
) {
  const f = edgeFrame(structure.rect, edge);
  const at = (s: number, out: number, z: number) => {
    const p = project(f.world(s, out));
    return { x: p.x, y: p.y - z * ppm };
  };
  const hgt = role === "shop" ? 0.3 : 0.38;
  const fill = role === "shop" ? "#3b3f3f" : "#2f3332";
  for (const [a, b] of spans) {
    // grime splashed up from the pavement, strongest at the foot
    gradient(
      ctx,
      [at(a, 0, hgt), at(b, 0, hgt), at(b, 0, hgt + 0.55), at(a, 0, hgt + 0.55)],
      at(a, 0, hgt),
      at(a, 0, hgt + 0.55),
      [
        [0, "rgba(22,18,12,.28)"],
        [1, "rgba(22,18,12,0)"],
      ],
    );
    poly(ctx, [at(a, 0.02, 0), at(b, 0.02, 0), at(b, 0.02, hgt), at(a, 0.02, hgt)], fill);
    // the plinth's weathered top: a lit edge, then its shadow onto the wall
    stroke(ctx, at(a, 0.02, hgt), at(b, 0.02, hgt), role === "shop" ? "#7d817b" : "#636a69", 1);
    // contact with the pavement
    stroke(ctx, at(a, 0.02, 0.01), at(b, 0.02, 0.01), "rgba(0,0,0,.6)", 1.6);
  }
}

/** Solid stretches of a span: the span less the given openings, each padded. */
export function solidSpans(
  span: readonly [number, number],
  openings: readonly [number, number][],
  pad = 0.04,
): [number, number][] {
  let out: [number, number][] = [[span[0], span[1]]];
  for (const [p, q] of openings) {
    const lo = p - pad;
    const hi = q + pad;
    out = out.flatMap(([a, b]): [number, number][] =>
      hi <= a || lo >= b
        ? [[a, b]]
        : [
            ...(lo > a ? [[a, lo] as [number, number]] : []),
            ...(hi < b ? [[hi, b] as [number, number]] : []),
          ],
    );
  }
  return out.filter(([a, b]) => b - a > 0.05);
}

/**
 * A neighbour's face: dark painted render (laid by the caller), high barred windows
 * of reeded glass with no light behind them, one louvre, a plinth. Restrained on
 * purpose: the warm shop is the corner's focal point.
 */
export function paintNeighbourFace(
  ctx: CanvasRenderingContext2D,
  project: Project,
  ppm: number,
  structure: SceneStructure,
  face: NeighbourFace,
) {
  const f = edgeFrame(structure.rect, face.edge);
  const at = (s: number, out: number, z: number) => {
    const p = project(f.world(s, out));
    return { x: p.x, y: p.y - z * ppm };
  };
  const N = NEIGHBOUR;
  const quad = (s0: number, s1: number, z0: number, z1: number, out = 0) => [
    at(s0, out, z0),
    at(s1, out, z0),
    at(s1, out, z1),
    at(s0, out, z1),
  ];
  for (const s0 of face.windows) {
    const s1 = s0 + N.windowWidth;
    // reveal: the render returns into the opening; the glass is set back
    poly(ctx, quad(s0, s1, N.windowBottom, N.windowTop), "#161c1e");
    poly(
      ctx,
      quad(s0 + 0.06, s1 - 0.06, N.windowBottom + 0.05, N.windowTop - 0.05, -0.1),
      "#3b4a4c",
    );
    // reeded glass: fine vertical flutes, no room or light behind it
    for (let s = s0 + 0.1; s < s1 - 0.08; s += 0.06)
      stroke(
        ctx,
        at(s, -0.1, N.windowBottom + 0.06),
        at(s, -0.1, N.windowTop - 0.06),
        "rgba(120,140,140,.22)",
        0.6,
      );
    // the near jamb's depth and the head's shade
    poly(
      ctx,
      [
        at(s0, 0, N.windowBottom),
        at(s0, -0.1, N.windowBottom),
        at(s0, -0.1, N.windowTop),
        at(s0, 0, N.windowTop),
      ],
      "#0c1113",
    );
    gradient(
      ctx,
      quad(s0, s1, N.windowTop - 0.25, N.windowTop, -0.1),
      at(s0, -0.1, N.windowTop),
      at(s0, -0.1, N.windowTop - 0.25),
      [
        [0, "rgba(0,0,0,.5)"],
        [1, "rgba(0,0,0,0)"],
      ],
    );
    // security bars, standing proud
    for (let s = s0 + 0.16; s < s1 - 0.1; s += 0.18)
      stroke(
        ctx,
        at(s, 0.03, N.windowBottom + 0.02),
        at(s, 0.03, N.windowTop - 0.02),
        "#20282a",
        1.4,
      );
    stroke(
      ctx,
      at(s0 + 0.05, 0.03, N.windowBottom + 0.12),
      at(s1 - 0.05, 0.03, N.windowBottom + 0.12),
      "#20282a",
      1.2,
    );
    // a pressed-metal sill with its drip shadow
    poly(
      ctx,
      [
        at(s0 - 0.05, 0, N.windowBottom),
        at(s1 + 0.05, 0, N.windowBottom),
        at(s1 + 0.05, 0.06, N.windowBottom),
        at(s0 - 0.05, 0.06, N.windowBottom),
      ],
      "#7a8486",
    );
    gradient(
      ctx,
      quad(s0 - 0.05, s1 + 0.05, N.windowBottom - 0.3, N.windowBottom),
      at(s0, 0, N.windowBottom),
      at(s0, 0, N.windowBottom - 0.3),
      [
        [0, "rgba(0,0,0,.32)"],
        [1, "rgba(0,0,0,0)"],
      ],
    );
  }
  if (face.louvre !== undefined) {
    const s0 = face.louvre;
    const s1 = s0 + N.louvreWidth;
    poly(ctx, quad(s0, s1, N.louvreBottom, N.louvreTop, 0.02), "#2b3335");
    for (let z = N.louvreBottom + 0.06; z < N.louvreTop - 0.02; z += 0.07) {
      stroke(ctx, at(s0 + 0.04, 0.03, z), at(s1 - 0.04, 0.03, z), "#11171a", 1.1);
      stroke(ctx, at(s0 + 0.04, 0.03, z + 0.02), at(s1 - 0.04, 0.03, z + 0.02), "#56606263", 0.6);
    }
    // a little soot from the extract above it
    gradient(
      ctx,
      quad(s0, s1, N.louvreTop, N.louvreTop + 0.6),
      at(s0, 0, N.louvreTop),
      at(s0, 0, N.louvreTop + 0.6),
      [
        [0, "rgba(10,10,10,.3)"],
        [1, "rgba(10,10,10,0)"],
      ],
    );
  }
}
