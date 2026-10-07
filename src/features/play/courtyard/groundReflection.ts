/**
 * The shop corner's ground reflections: what the street's surface gives back of the
 * shop's own lit windows, signs and streetlight, at night on the intersection with
 * materials. A pilot, local to the storefront's corner.
 *
 * Two damp treatments were tried and omitted before this (`checkpoint-atmosphere.md` §4,
 * `checkpoint-ground-light.md` §4). Both treated a reflection as a LIGHT: a blurred lobe
 * of colour at each source's mirror point, multiplied by the ground's albedo. That has
 * neither a shape nor a surface, and read as coloured haze. This treats it as an IMAGE
 * seen in a rough surface:
 *
 * 1. **The source is the fixture's own picture.** Each source is painted by the same
 *    glow pass its sprite is lit with (the shopfront's lit room and neon, the blade
 *    sign, the lamp's lens), flipped about the ground line under it. A point at height
 *    z over a ground point shows z·ppm above that point on screen, so its reflection is
 *    z·ppm below it: a flip about the ground line, `mirrorMatrix`. A window reflects as
 *    a window, with its mullions; a pink sign as pink letters.
 * 2. **What stands in front cuts it.** A prop between a source and the camera hides
 *    the source's reflection by its own flipped body (`flippedBody`), standing or as its
 *    wreck. Building footprints take none.
 * 3. **The surface decides the response, per pixel, from its own texture.**
 *    - Every ground pixel is classed asphalt, paving, a joint, a marking or hard
 *      standing (`SurfaceClass`).
 *    - Each class has a specular weight and a share that is smooth.
 *    - The smooth share sees a tight image, rippled by the texture's own slope.
 *    - The rough share sees a long vertical streak of the image, which is dim except
 *      on the grains of the texture that stand proud of their neighbours: `glint`.
 *      So a rough reflection is a few crisp sparkles inside a subdued streak, not a
 *      wash.
 *    - Joints and building footprints give nothing back; markings are the smoothest.
 *    - A few patches are smoother than the rest (a world-space noise, `REFLECTION.patch`).
 * 4. **It is added, not multiplied by the albedo.** A reflection is the source's colour
 *    off the surface's top, not light the surface's pigment absorbed: multiplying it by
 *    dark asphalt is what left the earlier attempts with no colour and no edge.
 *
 * Presentation only. Nothing here moves a light, a prop, a wall or a route. It is
 * computed at load and when a prop near the corner is wrecked (cached by state),
 * never per frame.
 */
import type { Point } from "@/engine";
import { hash } from "./frontage";
import type { Box } from "./lampShadow";

/** The numbers, tuned by eye at play zoom on seed 7 and stated here. */
export const REFLECTION = {
  /** Overall strength of the reflection, added over the lit ground. */
  strength: 2,
  /** The smooth share's image: blur in metres across and along the view. */
  tight: { across: 0.04, along: 0.16 },
  /** The rough share's streak, metres: the blur over the stretched picture below. */
  rough: { across: 0.16, along: 0.45 },
  /**
   * How a rough surface stretches a picture. A facet tilted toward the camera reflects a
   * source from a ground point nearer its foot than the mirror point, and one tilted away
   * from beyond it, so the picture is drawn flipped at each of these depths (1 is the
   * mirror) and the streak runs from near the source's foot to past its mirror point.
   */
  stretch: Array.from({ length: 22 }, (_, i) => 0.3 + (i * 1.05) / 21),
  /** How far the texture's slope pushes the tight image, in metres, across and along. */
  ripple: { across: 0.05, along: 0.18 },
  /**
   * The rough share's response: `base` everywhere in the streak, plus `gain` on a grain
   * that stands proud of its neighbourhood. Which grains are proud is the texture's own:
   * per surface, those above its `lo` quantile glint, fully from its `hi` quantile, so
   * asphalt's fine aggregate and a slab's coarser pitting both give about the same few.
   */
  glint: { base: 0.12, gain: 2.6, lo: 0.982, hi: 0.997 },
  /**
   * Smoother patches: a world-space noise cell (metres) and the band that is smooth. In
   * one, more of the picture is seen whole (`smooth`) and the streak is less broken
   * (`sheen` added to the glints' base).
   */
  patch: { cell: 2.4, lo: 0.62, hi: 0.84, smooth: 0.45, sheen: 0.5, pool: 0.09 },
  /**
   * Per surface: specular weight, the smooth share outside a patch, and how much its
   * proud grains glint. A polished doorstep's regular tiles would glint as a grid of
   * points, so it barely does.
   */
  surfaces: {
    asphalt: { spec: 0.85, smooth: 0.06, grains: 1 },
    paving: { spec: 0.55, smooth: 0.18, grains: 1 },
    marking: { spec: 1.05, smooth: 0.55, grains: 0.5 },
    concrete: { spec: 0.4, smooth: 0.1, grains: 1 },
    threshold: { spec: 0.7, smooth: 0.5, grains: 0.08 },
  },
  /**
   * What a source must give to be reflected, of full scale: a surface reflects the
   * bright things over it and shows its own colour for the dark ones, so a wall's
   * night colour adds nothing and only the lit room, the neon and the lens remain.
   */
  floor: 0.5,
  /**
   * The second response: a light's own glints inside the light it throws. A rough
   * surface under a lamp shows the lamp in every grain tilted toward the camera, which
   * reads as crisp points of light over the pool, not as a brighter pool. Per surface:
   * `sheen` is the whole surface's share (a smooth paint film), `glints` the grains'.
   * Both are of the incident light, so a shadow, a wreck and the lights switch hold.
   */
  field: {
    asphalt: { sheen: 0, glints: 0.75 },
    paving: { sheen: 0.03, glints: 0.32 },
    concrete: { sheen: 0.02, glints: 0.3 },
    marking: { sheen: 0.22, glints: 0.3 },
    // a doorstep's regular tiles catch light as a grid of points: polished, it gives
    // back a sheen instead
    threshold: { sheen: 0.08, glints: 0.04 },
  },
  /** Where a bright reflection starts to ease off rather than clip, of 255. */
  knee: 150,
  /** A marking is asphalt this much brighter (luminance 0..1) than its surroundings. */
  marking: 0.14,
  /** A paving joint is this fraction darker than its neighbourhood. */
  joint: 0.86,
} as const;

/** What a ground pixel is, for its response. 0 gives nothing back. */
export const SurfaceClass = {
  none: 0,
  asphalt: 1,
  paving: 2,
  concrete: 3,
  marking: 4,
  joint: 5,
  /** A doorstep: stone polished by feet, smoother than the walk it opens on. */
  threshold: 6,
} as const;
export type SurfaceClass = (typeof SurfaceClass)[keyof typeof SurfaceClass];

/**
 * The canvas transform that flips a picture about the ground line through `a` and `b`
 * (screen points; the line must not be vertical): x' = x, y' = 2·yLine(x) − y.
 */
export function mirrorMatrix(
  a: Point,
  b: Point,
  /** Depth of the flip: 1 is the mirror; less lies nearer the line, more further past. */
  k = 1,
): [number, number, number, number, number, number] {
  const m = (b.y - a.y) / (b.x - a.x);
  const c = a.y - m * a.x;
  // y' = yLine(x) + k·(yLine(x) − y)
  return [1, (1 + k) * m, 0, -k, 0, (1 + k) * c];
}

/** A point flipped about the ground line through `a` and `b`. */
export function mirrorPoint(p: Point, a: Point, b: Point, k = 1): Point {
  const [, mk, , dk, , ck] = mirrorMatrix(a, b, k);
  return { x: p.x, y: mk * p.x + dk * p.y + ck };
}

/** Is a screen point below (nearer the camera than) the ground line through a and b? */
export const inFrontOf = (p: Point, a: Point, b: Point) =>
  p.y > a.y + ((b.y - a.y) / (b.x - a.x)) * (p.x - a.x);

/** A lit thing to reflect. Every point is in scene pixels. */
export interface MirrorSource {
  /** Paints its picture as the street sees it at night, in scene pixels. */
  paint: (ctx: CanvasRenderingContext2D) => void;
  /** The sprite it belongs to: its reflection shows and fades with it. */
  group: string;
  /** Its ground line: the picture is flipped about the line through these. */
  a: Point;
  b: Point;
  /** Where its picture lies (before the flip); it is clipped to this. */
  extent: Point[];
  /**
   * How much brighter the source is than its sprite can show. A sprite stops at white;
   * a lamp's lens is many times a lit window, and a reflection keeps the difference.
   */
  gain?: number;
}

/** A prop that can stand between a source and the camera. */
export interface MirrorOccluder {
  id: string;
  /** Its body's footprint, world metres. */
  body: Point[];
  height: number;
  wreck: number;
}

/**
 * A prop's body flipped below its own footprint, on screen: the hull of its footprint
 * and the footprint lowered by its height. Where it lies, it hides what is behind it.
 */
export function flippedBody(
  project: (p: Point) => Point,
  body: readonly Point[],
  height: number,
  ppm: number,
): Point[] {
  const ground = body.map(project);
  return convexHull([...ground, ...ground.map((p) => ({ x: p.x, y: p.y + height * ppm }))]);
}

function convexHull(points: readonly Point[]): Point[] {
  const pts = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  if (pts.length < 3) return pts;
  const cross = (o: Point, a: Point, b: Point) =>
    (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower: Point[] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower.at(-2)!, lower.at(-1)!, p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: Point[] = [];
  for (const p of [...pts].reverse()) {
    while (upper.length >= 2 && cross(upper.at(-2)!, upper.at(-1)!, p) <= 0) upper.pop();
    upper.push(p);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

const smoothstep = (lo: number, hi: number, v: number) => {
  const t = Math.max(0, Math.min(1, (v - lo) / (hi - lo)));
  return t * t * (3 - 2 * t);
};

/** One surface's response at one pixel, per unit of source: 0 for nothing back. */
export function response(
  cls: SurfaceClass,
  /** Extra smoothness from a patch, 0..1. */
  patch: number,
  /** How proud this grain stands among its surface's, 0..1 (`GroundReflection`). */
  glint: number,
) {
  const s =
    cls === SurfaceClass.asphalt
      ? REFLECTION.surfaces.asphalt
      : cls === SurfaceClass.paving
        ? REFLECTION.surfaces.paving
        : cls === SurfaceClass.marking
          ? REFLECTION.surfaces.marking
          : cls === SurfaceClass.concrete
            ? REFLECTION.surfaces.concrete
            : cls === SurfaceClass.threshold
              ? REFLECTION.surfaces.threshold
              : undefined;
  if (!s) return { smooth: 0, rough: 0 };
  const smooth = Math.min(0.9, s.smooth + patch * REFLECTION.patch.smooth);
  const g = REFLECTION.glint;
  const rough =
    (1 - smooth) * (g.base + patch * REFLECTION.patch.sheen + g.gain * glint * s.grains);
  return { smooth: s.spec * smooth, rough: s.spec * rough };
}

/** Everything the reflection is made from. */
export interface ReflectionSetup {
  /** The ground's albedo canvas, and where its pixel (0, 0) is in scene pixels. */
  ground: HTMLCanvasElement;
  origin: Point;
  /** Ground canvas pixels per scene pixel. */
  resolution: number;
  project: (p: Point) => Point;
  /** Scene pixels per metre. */
  ppm: number;
  sources: readonly MirrorSource[];
  occluders: readonly MirrorOccluder[];
  /**
   * The light reaching the ground for a state, before any surface takes it, over `crop`
   * of the ground canvas (`incidentLight`). Without it there are no glints.
   */
  incident?: (destroyed: ReadonlySet<string>, crop: Box) => HTMLCanvasElement;
  /** More of the ground to cover, in scene pixels: the reach of the lights that glint. */
  reach?: readonly Point[];
  /** The props whose shadow from those lights the glints can see change. */
  glintCasters?: readonly string[];
  /** Paints each surface's class (as `rgb(class,0,0)`) in scene pixels, footprints as 0. */
  paintClasses: (ctx: CanvasRenderingContext2D) => void;
}

const canvasOf = (w: number, h: number) => {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
};

/**
 * A picture blurred by `across` pixels across and `along` pixels down the screen.
 * The canvas blur is round, so the picture is squeezed vertically by along/across,
 * blurred round, and stretched back.
 */
function streak(src: HTMLCanvasElement, across: number, along: number) {
  const k = Math.max(1, along / Math.max(0.5, across));
  const h = Math.max(1, Math.round(src.height / k));
  const small = canvasOf(src.width, h);
  const s = small.getContext("2d")!;
  s.filter = `blur(${Math.max(0.5, across).toFixed(2)}px)`;
  s.drawImage(src, 0, 0, src.width, h);
  const out = canvasOf(src.width, src.height);
  const o = out.getContext("2d", { willReadFrequently: true })!;
  o.imageSmoothingQuality = "high";
  o.drawImage(small, 0, 0, src.width, src.height);
  return o.getImageData(0, 0, src.width, src.height).data;
}

/** The reflection layer: its box in scene pixels, and its picture for a state. */
export class GroundReflection {
  readonly box: Box;
  /** Its canvas size, in ground canvas pixels. */
  readonly width: number;
  readonly height: number;
  private readonly cls: Uint8Array;
  private readonly patch: Float32Array;
  /** How proud each grain stands among its surface's, 0..1. */
  private readonly glint: Float32Array;
  /** The texture's slope, for the ripple, in pixels. */
  private readonly dx: Float32Array;
  private readonly dy: Float32Array;
  /** Each group's pictures and the glints, by the state of the props that touch them. */
  private readonly cache = new Map<string, HTMLCanvasElement>();
  /** Each source flipped, before any prop cuts it: drawn once. */
  private readonly flips = new Map<
    MirrorSource,
    { mirror: HTMLCanvasElement; stretched: HTMLCanvasElement }
  >();
  /** The props that can cut each group's picture: in front of it, and over it. */
  private readonly touching = new Map<string, string[]>();
  /** How many states have been rendered, and the last one's time, for the checks. */
  rendered = 0;
  lastMs = 0;
  /** How long reading the surface took, once, at load. */
  buildMs = 0;
  /** The flipped sources of the last render, before the surface, for the evidence. */
  lastImage?: HTMLCanvasElement;

  constructor(readonly setup: ReflectionSetup) {
    const built = performance.now();
    const { ground, origin, resolution: res, sources, ppm } = setup;
    // the box: every source's flipped picture, grown by the streak, on ground pixels
    const depths = [Math.min(...REFLECTION.stretch), Math.max(...REFLECTION.stretch)];
    const pts = [
      ...sources.flatMap((s) =>
        depths.flatMap((k) => s.extent.map((p) => mirrorPoint(p, s.a, s.b, k))),
      ),
      ...(setup.reach ?? []),
    ];
    const padX = REFLECTION.rough.across * ppm * 3 + 4;
    const padY = REFLECTION.rough.along * ppm * 3 + 4;
    const x0 = Math.max(0, Math.floor((Math.min(...pts.map((p) => p.x)) - padX - origin.x) * res));
    const y0 = Math.max(0, Math.floor((Math.min(...pts.map((p) => p.y)) - padY - origin.y) * res));
    const x1 = Math.min(
      ground.width,
      Math.ceil((Math.max(...pts.map((p) => p.x)) + padX - origin.x) * res),
    );
    const y1 = Math.min(
      ground.height,
      Math.ceil((Math.max(...pts.map((p) => p.y)) + padY - origin.y) * res),
    );
    this.width = Math.max(1, x1 - x0);
    this.height = Math.max(1, y1 - y0);
    this.box = {
      x: origin.x + x0 / res,
      y: origin.y + y0 / res,
      width: this.width / res,
      height: this.height / res,
    };
    const W = this.width;
    const H = this.height;
    const n = W * H;
    // the albedo's luminance, and its neighbourhood's at two scales
    const lum = (blur: number) => {
      const c = canvasOf(W, H);
      const ctx = c.getContext("2d", { willReadFrequently: true })!;
      if (blur) ctx.filter = `blur(${blur}px)`;
      ctx.drawImage(ground, x0, y0, W, H, 0, 0, W, H);
      const d = ctx.getImageData(0, 0, W, H).data;
      const out = new Float32Array(n);
      for (let i = 0; i < n; i++)
        out[i] = (0.2126 * d[i * 4]! + 0.7152 * d[i * 4 + 1]! + 0.0722 * d[i * 4 + 2]!) / 255;
      return out;
    };
    const L = lum(0);
    const near = lum(Math.max(1, 0.06 * ppm * res));
    const wide = lum(Math.max(2, 0.35 * ppm * res));
    // a grain is the size of a piece of aggregate (a few centimetres), not a pixel: at
    // play zoom a pixel-sized glint is dust
    const stone = lum(Math.max(0.6, 0.025 * ppm * res));
    const bed = lum(Math.max(2, 0.12 * ppm * res));
    // the surface classes, painted in scene pixels
    const classes = canvasOf(W, H);
    const cctx = classes.getContext("2d", { willReadFrequently: true })!;
    cctx.imageSmoothingEnabled = false;
    cctx.save();
    cctx.scale(res, res);
    cctx.translate(-this.box.x, -this.box.y);
    setup.paintClasses(cctx);
    cctx.restore();
    const cd = cctx.getImageData(0, 0, W, H).data;
    this.cls = new Uint8Array(n);
    const grain = new Float32Array(n);
    this.glint = new Float32Array(n);
    this.patch = new Float32Array(n);
    this.dx = new Float32Array(n);
    this.dy = new Float32Array(n);
    // scene pixels back to world metres, for the patches
    const o = setup.project({ x: 0, y: 0 });
    const ex = setup.project({ x: 1, y: 0 });
    const ey = setup.project({ x: 0, y: 1 });
    const [a, b, c, d] = [ex.x - o.x, ex.y - o.y, ey.x - o.x, ey.y - o.y];
    const det = a * d - b * c;
    const P = REFLECTION.patch;
    // the noise's lattice is a few dozen cells over the corner: hash each once
    const lattice = new Map<number, number>();
    const cell = (wx: number, wy: number) => {
      const ix = Math.floor(wx / P.cell);
      const iy = Math.floor(wy / P.cell);
      const fx = wx / P.cell - ix;
      const fy = wy / P.cell - iy;
      const sx = fx * fx * (3 - 2 * fx);
      const sy = fy * fy * (3 - 2 * fy);
      const h = (i: number, j: number) => {
        const key = i * 4096 + j;
        let v = lattice.get(key);
        if (v === undefined) lattice.set(key, (v = hash(i, j, 61)));
        return v;
      };
      return (
        h(ix, iy) * (1 - sx) * (1 - sy) +
        h(ix + 1, iy) * sx * (1 - sy) +
        h(ix, iy + 1) * (1 - sx) * sy +
        h(ix + 1, iy + 1) * sx * sy
      );
    };
    const r = Math.max(2, Math.round(0.05 * ppm * res));
    const rippleX = REFLECTION.ripple.across * ppm * res;
    const rippleY = REFLECTION.ripple.along * ppm * res;
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        let k = cd[i * 4]! as SurfaceClass;
        if (k === SurfaceClass.asphalt && L[i]! - wide[i]! > REFLECTION.marking)
          k = SurfaceClass.marking;
        else if (
          (k === SurfaceClass.paving ||
            k === SurfaceClass.concrete ||
            k === SurfaceClass.threshold) &&
          near[i]! < REFLECTION.joint * wide[i]!
        )
          k = SurfaceClass.joint;
        this.cls[i] = k;
        // proud in every direction: a stone, not the bright side of an edge. A kerb's or a
        // joint's long edge stands above its neighbours across it but not along it, and
        // taken as grains it reads as a dotted line
        if (x >= r && x < W - r && y >= r && y < H - r) {
          const v = stone[i]!;
          grain[i] = Math.min(
            v - bed[i]!,
            v - stone[i - r]!,
            v - stone[i + r]!,
            v - stone[i - r * W]!,
            v - stone[i + r * W]!,
            v - stone[i - r * W - r]!,
            v - stone[i + r * W + r]!,
            v - stone[i - r * W + r]!,
            v - stone[i + r * W - r]!,
          );
        }
        const sx = this.box.x + x / res - o.x;
        const sy = this.box.y + y / res - o.y;
        const wx = (d * sx - c * sy) / det;
        const wy = (a * sy - b * sx) / det;
        this.patch[i] = smoothstep(P.lo, P.hi, cell(wx, wy));
        if (x > 0 && x < W - 1 && y > 0 && y < H - 1) {
          this.dx[i] = (near[i + 1]! - near[i - 1]!) * rippleX * 20;
          this.dy[i] = (near[i + W]! - near[i - W]!) * rippleY * 20;
        }
      }
    // each surface's own proud grains: its quantiles, not a number for all of them
    // a slab's chipped edge stands proud along every joint: taken as grains, the chips
    // line up into dotted rows, so nothing within a few centimetres of a joint glints
    {
      const reach = Math.max(2, Math.round(0.06 * ppm * res));
      const near = new Uint8Array(n);
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++) {
          if (this.cls[y * W + x] !== SurfaceClass.joint) continue;
          for (let dy = -reach; dy <= reach; dy++) {
            const yy = y + dy;
            if (yy < 0 || yy >= H) continue;
            for (let dx = -reach; dx <= reach; dx++) {
              const xx = x + dx;
              if (xx >= 0 && xx < W) near[yy * W + xx] = 1;
            }
          }
        }
      for (let i = 0; i < n; i++) if (near[i]) grain[i] = -1;
    }
    // a histogram, not a sort: a quantile to a ten-thousandth of full scale is plenty
    const G = REFLECTION.glint;
    const BINS = 4096;
    const SPAN = 0.4;
    const bin = (v: number) =>
      Math.max(0, Math.min(BINS - 1, Math.floor(((v + SPAN / 2) / SPAN) * BINS)));
    for (let k = 1; k <= 6; k++) {
      const hist = new Uint32Array(BINS);
      let count = 0;
      for (let i = 0; i < n; i++)
        if (this.cls[i] === k) {
          hist[bin(grain[i]!)]!++;
          count++;
        }
      if (count < 20) continue;
      const at = (q: number) => {
        let seen = 0;
        for (let b = 0; b < BINS; b++) {
          seen += hist[b]!;
          if (seen >= count * q) return ((b + 0.5) / BINS) * SPAN - SPAN / 2;
        }
        return SPAN / 2;
      };
      const lo = at(G.lo);
      const hi = Math.max(lo + 1e-4, at(G.hi));
      for (let i = 0; i < n; i++)
        if (this.cls[i] === k) this.glint[i] = smoothstep(lo, hi, grain[i]!);
    }
    // a prop touches a group when it stands in front of one of its sources and its
    // flipped body, standing, reaches that source's picture
    for (const group of this.groups) {
      const ids = new Set<string>();
      for (const source of sources.filter((x) => x.group === group)) {
        const pic = [Math.min(...REFLECTION.stretch), Math.max(...REFLECTION.stretch)].flatMap(
          (k) => source.extent.map((p) => mirrorPoint(p, source.a, source.b, k)),
        );
        const bb = bounds(pic);
        for (const o of setup.occluders) {
          const ground = o.body.map(setup.project);
          if (!inFrontOf(centreOf(ground), source.a, source.b)) continue;
          const body = bounds(flippedBody(setup.project, o.body, o.height, ppm));
          if (body.x1 >= bb.x0 && body.x0 <= bb.x1 && body.y1 >= bb.y0 && body.y0 <= bb.y1)
            ids.add(o.id);
        }
      }
      this.touching.set(group, [...ids].sort());
    }
    this.buildMs = performance.now() - built;
    performance.measure("ground-reflection-build", { start: built });
  }

  /** The state's key: the props that touch the reflection, as wrecked. */
  key(destroyed: ReadonlySet<string>) {
    const ids = new Set([
      ...[...this.touching.values()].flat(),
      ...(this.setup.glintCasters ?? []),
    ]);
    return [...ids]
      .filter((id) => destroyed.has(id))
      .sort()
      .join("|");
  }

  /** The fixtures reflected, by group: each is shown and faded with its own sprite. */
  get groups(): string[] {
    return [...new Set(this.setup.sources.map((s) => s.group))];
  }

  /**
   * The reflection for a destruction state: one canvas over `box` per group of sources
   * (the picture of each fixture in the street), and `glints` (each light's own glints
   * where it falls). A layer is rendered only when a prop that touches it changes, and
   * cached by that state.
   */
  render(destroyed: ReadonlySet<string>): ReflectionLayers {
    const started = performance.now();
    let work = false;
    const cached = (key: string, make: () => HTMLCanvasElement) => {
      let c = this.cache.get(key);
      if (!c) {
        c = make();
        this.cache.set(key, c);
        work = true;
      }
      return c;
    };
    const stateOf = (ids: readonly string[]) => ids.filter((id) => destroyed.has(id)).join("|");
    const layers: ReflectionLayers = {
      groups: new Map(
        this.groups.map((group) => {
          const ids = this.touching.get(group) ?? [];
          return [
            group,
            cached(`${group}#${stateOf(ids)}`, () =>
              this.pictures(
                this.setup.sources.filter((s) => s.group === group),
                destroyed,
                ids,
              ),
            ),
          ];
        }),
      ),
      glints: cached(`glints#${stateOf(this.setup.glintCasters ?? [])}`, () =>
        this.glints(destroyed),
      ),
    };
    if (work) {
      this.rendered++;
      this.lastMs = performance.now() - started;
      performance.measure("ground-reflection-render", { start: started });
    }
    return layers;
  }

  /** Each light's glints where it falls, from the light as it now falls. */
  private glints(destroyed: ReadonlySet<string>): HTMLCanvasElement {
    const { resolution: res } = this.setup;
    const W = this.width;
    const H = this.height;
    const out = canvasOf(W, H);
    const x0 = Math.round((this.box.x - this.setup.origin.x) * res);
    const y0 = Math.round((this.box.y - this.setup.origin.y) * res);
    const lit = this.setup
      .incident?.(destroyed, { x: x0, y: y0, width: W, height: H })
      .getContext("2d", { willReadFrequently: true })!
      .getImageData(0, 0, W, H).data;
    if (!lit) return out;
    const ctx = out.getContext("2d")!;
    const px = ctx.createImageData(W, H);
    const o = px.data;
    const F = REFLECTION.field;
    for (let i = 0; i < W * H; i++) {
      const cls = this.cls[i]! as SurfaceClass;
      const f =
        cls === SurfaceClass.asphalt
          ? F.asphalt
          : cls === SurfaceClass.paving
            ? F.paving
            : cls === SurfaceClass.marking
              ? F.marking
              : cls === SurfaceClass.concrete
                ? F.concrete
                : cls === SurfaceClass.threshold
                  ? F.threshold
                  : undefined;
      if (!f) continue;
      // a smoother patch shows the light it stands in as a soft sheen, not only grains
      const g = f.sheen + this.patch[i]! * REFLECTION.patch.pool + f.glints * this.glint[i]!;
      if (g * (lit[i * 4]! + lit[i * 4 + 1]! + lit[i * 4 + 2]!) < 1) continue;
      knee(o, i * 4, g * lit[i * 4]!, g * lit[i * 4 + 1]!, g * lit[i * 4 + 2]!);
    }
    ctx.putImageData(px, 0, 0);
    return out;
  }

  /**
   * A source flipped about its own ground line, and at every depth a rough surface
   * reflects it from, before any prop cuts it. Drawn once.
   */
  private flipsOf(source: MirrorSource) {
    const known = this.flips.get(source);
    if (known) return known;
    const { resolution: res } = this.setup;
    const draw = (depths: readonly number[]) => {
      const c = canvasOf(this.width, this.height);
      const ctx = c.getContext("2d")!;
      ctx.scale(res, res);
      ctx.translate(-this.box.x, -this.box.y);
      ctx.globalCompositeOperation = "lighter";
      // a sprite's colour stops at 1: a brighter source is drawn over itself
      const gain = source.gain ?? 1;
      for (const k of depths)
        for (let g = gain; g > 0; g--) {
          ctx.save();
          ctx.globalAlpha = Math.min(1, g) / depths.length;
          ctx.transform(...mirrorMatrix(source.a, source.b, k));
          ctx.beginPath();
          source.extent.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
          ctx.closePath();
          ctx.clip();
          source.paint(ctx);
          ctx.restore();
        }
      return c;
    };
    const made = { mirror: draw([1]), stretched: draw(REFLECTION.stretch) };
    this.flips.set(source, made);
    return made;
  }

  /** Some sources' pictures in the street, through this surface. */
  private pictures(
    sources: readonly MirrorSource[],
    destroyed: ReadonlySet<string>,
    touching: readonly string[],
  ): HTMLCanvasElement {
    const { resolution: res, project, ppm } = this.setup;
    const W = this.width;
    const H = this.height;
    const occluders = this.setup.occluders.filter((o) => touching.includes(o.id));
    // every source's flips, cut by what stands in front of it
    const cut = (which: "mirror" | "stretched", share: number) => {
      const image = canvasOf(W, H);
      const ictx = image.getContext("2d", { willReadFrequently: true })!;
      for (const source of sources) {
        const one = canvasOf(W, H);
        const ctx = one.getContext("2d")!;
        ctx.drawImage(this.flipsOf(source)[which], 0, 0);
        ctx.save();
        ctx.scale(res, res);
        ctx.translate(-this.box.x, -this.box.y);
        ctx.globalCompositeOperation = "destination-out";
        ctx.fillStyle = "#000";
        for (const o of occluders) {
          if (!inFrontOf(centreOf(o.body.map(project)), source.a, source.b)) continue;
          const shape = flippedBody(project, o.body, destroyed.has(o.id) ? o.wreck : o.height, ppm);
          ctx.beginPath();
          shape.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
        ictx.globalCompositeOperation = "lighter";
        ictx.drawImage(one, 0, 0);
      }
      // only what is brighter than the floor is reflected (premultiplied, then kneed);
      // opaque everywhere, so the blurs below never unpremultiply a faint edge
      const px = ictx.getImageData(0, 0, W, H);
      const d = px.data;
      const f = REFLECTION.floor * 255 * share;
      for (let i = 0; i < d.length; i += 4) {
        const a = d[i + 3]! / 255;
        for (let c = 0; c < 3; c++)
          d[i + c] = Math.max(0, d[i + c]! * a - f) / (1 - REFLECTION.floor);
        d[i + 3] = 255;
      }
      ictx.putImageData(px, 0, 0);
      return image;
    };
    const mirror = cut("mirror", 1);
    const stretched = cut("stretched", 1 / REFLECTION.stretch.length);
    this.lastImage = stretched;
    const scale = ppm * res;
    const tight = streak(mirror, REFLECTION.tight.across * scale, REFLECTION.tight.along * scale);
    const rough = streak(
      stretched,
      REFLECTION.rough.across * scale,
      REFLECTION.rough.along * scale,
    );
    const out = canvasOf(W, H);
    const octx = out.getContext("2d")!;
    const px = octx.createImageData(W, H);
    const o = px.data;
    const k = REFLECTION.strength;
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        const q = i * 4;
        if (
          !rough[q] &&
          !rough[q + 1] &&
          !rough[q + 2] &&
          !tight[q] &&
          !tight[q + 1] &&
          !tight[q + 2]
        )
          continue;
        const r = response(this.cls[i]! as SurfaceClass, this.patch[i]!, this.glint[i]!);
        if (!r.smooth && !r.rough) continue;
        // the tight image, sampled where the surface's slope turns the view
        const tx = Math.max(0, Math.min(W - 1, Math.round(x + this.dx[i]!)));
        const ty = Math.max(0, Math.min(H - 1, Math.round(y + this.dy[i]!)));
        const j = (ty * W + tx) * 4;
        knee(
          o,
          q,
          k * (r.smooth * tight[j]! + r.rough * rough[q]!),
          k * (r.smooth * tight[j + 1]! + r.rough * rough[q + 1]!),
          k * (r.smooth * tight[j + 2]! + r.rough * rough[q + 2]!),
        );
      }
    octx.putImageData(px, 0, 0);
    return out;
  }
}

const centreOf = (pts: readonly Point[]) => ({
  x: pts.reduce((s, p) => s + p.x, 0) / pts.length,
  y: pts.reduce((s, p) => s + p.y, 0) / pts.length,
});

const bounds = (pts: readonly Point[]) => ({
  x0: Math.min(...pts.map((p) => p.x)),
  x1: Math.max(...pts.map((p) => p.x)),
  y0: Math.min(...pts.map((p) => p.y)),
  y1: Math.max(...pts.map((p) => p.y)),
});

/** A state's reflection: each group's picture, and the lights' glints. */
export interface ReflectionLayers {
  groups: Map<string, HTMLCanvasElement>;
  glints: HTMLCanvasElement;
}

/**
 * Write a colour, eased toward white past `REFLECTION.knee` by its brightest channel so
 * its hue holds: a hard clip turns a warm window white.
 */
function knee(o: Uint8ClampedArray, q: number, r: number, g: number, b: number) {
  const m = Math.max(r, g, b);
  if (m <= 0) return;
  const K = REFLECTION.knee;
  const t = m > K ? (K + (255 - K) * (1 - Math.exp(-(m - K) / (255 - K)))) / m : 1;
  o[q] = r * t;
  o[q + 1] = g * t;
  o[q + 2] = b * t;
  o[q + 3] = 255;
}
