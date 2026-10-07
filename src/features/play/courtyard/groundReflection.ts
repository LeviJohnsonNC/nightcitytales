/**
 * The shop corner's ground reflections: what the street's surface gives back of the
 * shop's own lit windows, signs and streetlight, at night on the intersection with
 * materials. A pilot, local to the storefront's corner.
 *
 * Two damp treatments were tried and omitted before this (`checkpoint-atmosphere.md` §4,
 * `checkpoint-ground-light.md` §4). Both treated a reflection as a LIGHT: a blurred lobe
 * of colour at each source's mirror point, multiplied by the ground's albedo, with no
 * shape and no surface. This treats it as an IMAGE seen in a partly wet, rough street:
 *
 * 1. **The source is the fixture's own emitted picture, extracted once.** Each source
 *    paints only what gives light (`MirrorSource.paint`: the lit rooms and neon from
 *    their own light and glow passes, the lamp's lens). That picture is reduced to its
 *    emitters by `REFLECTION.floor` on its own, before it is flipped, stretched or added
 *    to anything (`emissive`), so a dim wall can never add up to a reflection however
 *    many copies of it a stretch would sum.
 * 2. **The picture lands where a mirror puts it.** A point at height z over a ground
 *    point shows z·ppm above it on screen, so its reflection is z·ppm below: a flip about
 *    the ground line (`mirrorMatrix`). A rough surface also reflects it from nearer and
 *    further than that (`REFLECTION.stretch`), which makes a streak in its shape.
 * 3. **What stands in front cuts it** (`flippedBody`), standing or as its wreck.
 * 4. **Where the street is wet decides where anything is seen.** A deterministic mask of
 *    irregular, connected patches (`REFLECTION.wet`: world-space noise, wetter in the
 *    gutter) and never the albedo's brightness. Inside a patch the picture is seen whole,
 *    rippled, over a subdued streak; on the patch's proudest grains, a few sharp
 *    highlights. Outside, the street is dry and gives back almost nothing.
 * 5. **Each shop light shows in the wet patches it falls on** (`incident`): a subdued
 *    sheen bounded by the patch, and the same few highlights.
 * 6. **Added, not multiplied by the albedo**, easing toward white by its brightest
 *    channel (`knee`), so a warm window stays warm.
 *
 * Presentation only. Nothing here moves a light, a prop, a wall or a route. It is
 * computed at load and when a prop that touches a layer is wrecked (cached by state),
 * never per frame.
 */
import type { Point } from "@/engine";
import { hash } from "./frontage";
import type { Box } from "./lampShadow";

/** The numbers, tuned by eye at play zoom on seeds 8 and 7, and stated here. */
export const REFLECTION = {
  /** Overall strength of the source pictures, added over the lit ground. */
  strength: 2.4,
  /**
   * What a source must give to be reflected, of full scale, applied to the source's own
   * extracted picture: a surface shows its own colour for dim things, and reflects the
   * bright ones.
   */
  floor: 0.3,
  /** The whole picture, as a wet film shows it: blur in metres across and along. */
  tight: { across: 0.03, along: 0.1 },
  /** The streak's blur, metres. */
  rough: { across: 0.12, along: 0.3 },
  /**
   * How a rough surface stretches a picture: a facet tilted toward the camera reflects a
   * source from nearer its foot than the mirror point, one tilted away from beyond it.
   * The picture is sampled at `samples` flip depths from `from` to `to` (1 is the
   * mirror) and averaged.
   */
  stretch: { from: 0.3, to: 1.35, samples: 24 },
  /**
   * Where the street is wet: noise at these cell sizes (metres) and weights, plus
   * `gutter` within `gutterReach` metres of a kerb, wet from `lo` to `hi`. Thresholding
   * a sum of coarse and fine noise gives connected patches with broken edges.
   */
  wet: {
    cells: [2.1, 0.7, 0.22],
    weights: [0.6, 0.28, 0.12],
    lo: 0.57,
    hi: 0.63,
    gutter: 0.16,
    gutterReach: 0.7,
  },
  /** A wet film's ripple, as world-space noise: cell and push, metres. */
  ripple: { cell: 0.32, across: 0.035, along: 0.12 },
  /**
   * What a wet patch shows of a picture: the whole of it (`tight`) and its streak
   * (`streak`); and how much of the streak dry ground shows (`dry`).
   */
  body: { tight: 0.75, streak: 0.4, dry: 0.02 },
  /**
   * The few sharp highlights: grains of a wet patch above the `lo` quantile of their
   * surface's, fully from `hi`, at `gain` times the streak.
   */
  highlight: { lo: 0.993, hi: 0.999, gain: 1.6 },
  /** Per surface: how much it gives back. Joints and footprints give nothing. */
  surfaces: {
    asphalt: 0.9,
    paving: 0.65,
    concrete: 0.5,
    marking: 1.15,
    threshold: 0.85,
  },
  /** A shop light seen in the wet patches it falls on: a sheen, and the highlights. */
  field: { sheen: 0.32, highlight: 1.1 },
  /** A doorstep is polished by feet: it is this wet wherever it is. */
  threshold: 0.75,
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

/** Which of the reflection is shown: the review harness's diagnostic views. */
export type ReflectionView = "both" | "pictures" | "glints";

/**
 * How a board treats the reflections: shown (`on`), only the fixtures' pictures or only
 * the lights' glints (diagnostics), built and hidden (`hidden`, the visual toggle), or
 * not built at all (`skip`, for measuring their whole cost).
 */
export type ReflectionMode = "on" | "pictures" | "glints" | "hidden" | "skip";
export const REFLECTION_MODES: readonly ReflectionMode[] = [
  "on",
  "pictures",
  "glints",
  "hidden",
  "skip",
];
/**
 * What a board does when nobody asks: nothing is built. The pilot was not accepted
 * visually (`docs/checkpoint-material-pilot.md`): at play zoom its wet patches read as
 * pale stains and its pictures as isolated marks. `/scene-review?reflect=on` shows it.
 */
export const REFLECTION_MODE_DEFAULT: ReflectionMode = "skip";

/** What a mode shows, or nothing. */
export const reflectionView = (mode: ReflectionMode): false | ReflectionView =>
  mode === "on" ? "both" : mode === "pictures" || mode === "glints" ? mode : false;

/**
 * The canvas transform that flips a picture about the ground line through `a` and `b`
 * (screen points; the line must not be vertical): x' = x, y' = yLine + k·(yLine − y).
 */
export function mirrorMatrix(
  a: Point,
  b: Point,
  /** Depth of the flip: 1 is the mirror; less lies nearer the line, more further past. */
  k = 1,
): [number, number, number, number, number, number] {
  const m = (b.y - a.y) / (b.x - a.x);
  const c = a.y - m * a.x;
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

/** The flip depths a rough surface reflects from (`REFLECTION.stretch`). */
export function stretchDepths(samples: number = REFLECTION.stretch.samples): number[] {
  const { from, to } = REFLECTION.stretch;
  if (samples <= 1) return [(from + to) / 2];
  return Array.from({ length: samples }, (_, i) => from + ((to - from) * i) / (samples - 1));
}

/**
 * The emitters of a source's picture, one channel at a time: premultiplied by its
 * alpha, less the floor, rescaled, times the source's `gain`. Dimmer than the floor is
 * nothing, so nothing dim can add up later.
 */
export function emissive(channel: number, alpha: number, gain = 1): number {
  const v = (channel * alpha) / (255 * 255);
  const f = REFLECTION.floor;
  return v <= f ? 0 : ((v - f) / (1 - f)) * 255 * gain;
}

/** A lit thing to reflect. Every point is in scene pixels. */
export interface MirrorSource {
  /** Paints what it emits, as the street sees it at night, in scene pixels. */
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

/** How much a surface gives back at all. */
export function surfaceSpec(cls: SurfaceClass): number {
  const S = REFLECTION.surfaces;
  return cls === SurfaceClass.asphalt
    ? S.asphalt
    : cls === SurfaceClass.paving
      ? S.paving
      : cls === SurfaceClass.concrete
        ? S.concrete
        : cls === SurfaceClass.marking
          ? S.marking
          : cls === SurfaceClass.threshold
            ? S.threshold
            : 0;
}

/**
 * One pixel's response, per unit of source: how much of the whole picture (`tight`) and
 * of its streak (`streak`) it shows, and how much of the light falling on it (`field`).
 * Wet ground shows the picture and a few highlights; dry ground almost nothing.
 */
export function response(
  cls: SurfaceClass,
  /** How wet the pixel is, 0..1. */
  wet: number,
  /** How proud its grain stands among its surface's, 0..1. */
  highlight: number,
) {
  const spec = surfaceSpec(cls);
  if (!spec) return { tight: 0, streak: 0, field: 0 };
  const B = REFLECTION.body;
  const hl = wet * highlight;
  return {
    tight: spec * wet * B.tight,
    streak: spec * (wet * B.streak + (1 - wet) * B.dry + hl * REFLECTION.highlight.gain),
    field: spec * (wet * REFLECTION.field.sheen + hl * REFLECTION.field.highlight),
  };
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
  /** The ground the lights that glint can reach, in scene pixels. */
  reach?: readonly Point[];
  /** The props whose shadow from those lights the glints can see change. */
  glintCasters?: readonly string[];
  /** Paints each surface's class (as `rgb(class,0,0)`) in scene pixels, footprints as 0. */
  paintClasses: (ctx: CanvasRenderingContext2D) => void;
  /** Flip depths for the streak; `REFLECTION.stretch.samples` unless a check sets it. */
  stretchSamples?: number;
}

const canvasOf = (w: number, h: number) => {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
};

/** A rectangle of the ground canvas, in its pixels. */
interface PixelBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Blur three interleaved channels in place, by `rx` pixels across and `ry` down: three
 * box passes each way, close to a gaussian. Done on floats, so a lens brighter than
 * white keeps its brightness through the blur.
 */
function blur3(data: Float32Array, w: number, h: number, rx: number, ry: number) {
  const tmp = new Float32Array(data.length);
  const pass = (src: Float32Array, dst: Float32Array, r: number, horizontal: boolean) => {
    const n = horizontal ? w : h;
    const lines = horizontal ? h : w;
    const step = horizontal ? 3 : w * 3;
    const norm = 1 / (2 * r + 1);
    for (let l = 0; l < lines; l++) {
      const base = horizontal ? l * w * 3 : l * 3;
      for (let c = 0; c < 3; c++) {
        let acc = 0;
        for (let i = -r; i <= r; i++)
          acc += src[base + Math.min(n - 1, Math.max(0, i)) * step + c]!;
        for (let i = 0; i < n; i++) {
          dst[base + i * step + c] = acc * norm;
          const add = Math.min(n - 1, i + r + 1);
          const sub = Math.max(0, i - r);
          acc += src[base + add * step + c]! - src[base + sub * step + c]!;
        }
      }
    }
  };
  // a box of radius r three times is about a gaussian of sigma r
  const bx = Math.max(0, Math.round(rx));
  const by = Math.max(0, Math.round(ry));
  for (let i = 0; i < 3; i++) {
    if (bx) {
      pass(data, tmp, bx, true);
      data.set(tmp);
    }
    if (by) {
      pass(data, tmp, by, false);
      data.set(tmp);
    }
  }
}

/** One source's picture in the street: whole (`tight`) and stretched, before any cut. */
interface SourceFlip {
  /** Its pixels within the main box, as rgb floats. */
  box: PixelBox;
  tight: Float32Array;
  stretched: Float32Array;
}

/** A layer's pixels and its box in the ground canvas. */
export interface ReflectionLayer {
  canvas: HTMLCanvasElement;
  /** Its box in scene pixels. */
  box: Box;
}

/** A state's reflection: each group's picture, and the lights' glints. */
export interface ReflectionLayers {
  groups: Map<string, ReflectionLayer>;
  glints: ReflectionLayer;
}

/** The reflection layer: its boxes, and its pictures for a state. */
export class GroundReflection {
  /** The whole corner it reads, in scene pixels. */
  readonly box: Box;
  /** Its size, in ground canvas pixels. */
  readonly width: number;
  readonly height: number;
  private readonly px: PixelBox;
  private readonly cls: Uint8Array;
  /** How wet each pixel is, 0..1: the mask, never the albedo. */
  readonly wet: Float32Array;
  /** How proud each grain stands among its surface's, 0..1. */
  private readonly highlight: Float32Array;
  /** The wet film's ripple, in pixels. */
  private readonly dx: Float32Array;
  private readonly dy: Float32Array;
  /** Each layer's box in the ground canvas: one per group, and the glints'. */
  private readonly layerBox = new Map<string, PixelBox>();
  /** Each layer by the state of the props that touch it. */
  private readonly cache = new Map<string, ReflectionLayer>();
  /** Each source's emitted picture and flips, before any prop cuts them: made once. */
  private readonly flips = new Map<MirrorSource, SourceFlip>();
  /** The props that can cut each group's picture: in front of it, and over it. */
  private readonly touching = new Map<string, string[]>();
  /** How many layers have been rendered, and the last render's time, for the checks. */
  rendered = 0;
  lastMs = 0;
  /** How long reading the surface took, once, at load. */
  buildMs = 0;

  constructor(readonly setup: ReflectionSetup) {
    const built = performance.now();
    const { ground, origin, resolution: res, sources, ppm } = setup;
    const { from, to } = REFLECTION.stretch;
    // each layer's box: a group's flipped pictures, grown by the streak's blur, or the
    // lights' reach for the glints; the main box is all of them
    const padX = (REFLECTION.rough.across * 3 + 0.1) * ppm;
    const padY = (REFLECTION.rough.along * 3 + 0.1) * ppm;
    const toPixels = (pts: readonly Point[], pad: boolean): PixelBox | undefined => {
      if (!pts.length) return undefined;
      const x0 = Math.max(
        0,
        Math.floor((Math.min(...pts.map((p) => p.x)) - (pad ? padX : 0) - origin.x) * res),
      );
      const y0 = Math.max(
        0,
        Math.floor((Math.min(...pts.map((p) => p.y)) - (pad ? padY : 0) - origin.y) * res),
      );
      const x1 = Math.min(
        ground.width,
        Math.ceil((Math.max(...pts.map((p) => p.x)) + (pad ? padX : 0) - origin.x) * res),
      );
      const y1 = Math.min(
        ground.height,
        Math.ceil((Math.max(...pts.map((p) => p.y)) + (pad ? padY : 0) - origin.y) * res),
      );
      return x1 > x0 && y1 > y0 ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } : undefined;
    };
    const pictureOf = (s: MirrorSource) =>
      [from, to].flatMap((k) => s.extent.map((p) => mirrorPoint(p, s.a, s.b, k)));
    for (const group of this.groups) {
      const b = toPixels(sources.filter((s) => s.group === group).flatMap(pictureOf), true);
      if (b) this.layerBox.set(group, b);
    }
    const reach = toPixels(setup.reach ?? [], false);
    if (reach && setup.incident) this.layerBox.set(GLINTS, reach);
    const all = [...this.layerBox.values()];
    const x0 = Math.min(...all.map((b) => b.x), ground.width);
    const y0 = Math.min(...all.map((b) => b.y), ground.height);
    const x1 = Math.max(...all.map((b) => b.x + b.w), x0 + 1);
    const y1 = Math.max(...all.map((b) => b.y + b.h), y0 + 1);
    this.px = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
    this.width = this.px.w;
    this.height = this.px.h;
    this.box = this.sceneBox(this.px);
    const W = this.width;
    const H = this.height;
    const n = W * H;
    // the albedo's luminance at a few scales: for markings, joints and grains only
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
    // a grain is a piece of aggregate (a few centimetres), not a pixel
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
    const grain = new Float32Array(n).fill(-1);
    this.highlight = new Float32Array(n);
    this.wet = new Float32Array(n);
    this.dx = new Float32Array(n);
    this.dy = new Float32Array(n);
    const r = Math.max(2, Math.round(0.05 * ppm * res));
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
        // proud in every direction: a stone, not the bright side of an edge
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
      }
    // nothing within a few centimetres of a joint glints: a slab's chipped rims line up
    {
      const reachJ = Math.max(2, Math.round(0.06 * ppm * res));
      const dist = chamfer(this.cls, W, H, (k) => k === SurfaceClass.joint);
      for (let i = 0; i < n; i++) if (dist[i]! <= reachJ) grain[i] = -1;
    }
    // the few sharp highlights: each surface's own proudest grains
    {
      const G = REFLECTION.highlight;
      const BINS = 4096;
      const SPAN = 0.4;
      const bin = (v: number) =>
        Math.max(0, Math.min(BINS - 1, Math.floor(((v + SPAN / 2) / SPAN) * BINS)));
      for (let k = 1; k <= 6; k++) {
        if (k === SurfaceClass.joint) continue;
        const hist = new Uint32Array(BINS);
        let count = 0;
        for (let i = 0; i < n; i++)
          if (this.cls[i] === k && grain[i]! > -1) {
            hist[bin(grain[i]!)]!++;
            count++;
          }
        if (count < 50) continue;
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
          if (this.cls[i] === k) this.highlight[i] = smoothstep(lo, hi, grain[i]!);
      }
    }
    // where the street is wet: world-space noise, wetter in the gutter, never the albedo
    {
      const o = setup.project({ x: 0, y: 0 });
      const ex = setup.project({ x: 1, y: 0 });
      const ey = setup.project({ x: 0, y: 1 });
      const [a, b, c, d] = [ex.x - o.x, ex.y - o.y, ey.x - o.x, ey.y - o.y];
      const det = a * d - b * c;
      const noise = valueNoise();
      const Wt = REFLECTION.wet;
      const gutterPx = Wt.gutterReach * ppm * res;
      const kerb = chamfer(
        this.cls,
        W,
        H,
        (k) => k === SurfaceClass.paving || k === SurfaceClass.concrete || k === SurfaceClass.joint,
      );
      const R = REFLECTION.ripple;
      // the noise is smooth over a few centimetres: evaluate it on a grid of STEP pixels
      // and interpolate (the mask is thresholded after, so its edges stay sharp)
      const STEP = 3;
      const gw = Math.ceil(W / STEP) + 1;
      const gh = Math.ceil(H / STEP) + 1;
      const gv = new Float32Array(gw * gh);
      const gx = new Float32Array(gw * gh);
      const gy = new Float32Array(gw * gh);
      const e = 0.05;
      for (let j = 0; j < gh; j++)
        for (let i = 0; i < gw; i++) {
          const sx = this.box.x + (i * STEP + 0.5) / res - o.x;
          const sy = this.box.y + (j * STEP + 0.5) / res - o.y;
          const wx = (d * sx - c * sy) / det;
          const wy = (a * sy - b * sx) / det;
          let v = 0;
          for (let k = 0; k < Wt.cells.length; k++)
            v += Wt.weights[k]! * noise(wx / Wt.cells[k]!, wy / Wt.cells[k]!, 71 + k);
          const g = j * gw + i;
          gv[g] = v;
          // the film's ripple: the slope of its own noise, not of the albedo
          gx[g] =
            noise((wx + e) / R.cell, wy / R.cell, 91) - noise((wx - e) / R.cell, wy / R.cell, 91);
          gy[g] =
            noise(wx / R.cell, (wy + e) / R.cell, 91) - noise(wx / R.cell, (wy - e) / R.cell, 91);
        }
      const lerp = (grid: Float32Array, x: number, y: number) => {
        const fx = x / STEP;
        const fy = y / STEP;
        const i = Math.floor(fx);
        const j = Math.floor(fy);
        const tx = fx - i;
        const ty = fy - j;
        const g = j * gw + i;
        return (
          grid[g]! * (1 - tx) * (1 - ty) +
          grid[g + 1]! * tx * (1 - ty) +
          grid[g + gw]! * (1 - tx) * ty +
          grid[g + gw + 1]! * tx * ty
        );
      };
      const slope = (R.cell / (2 * e)) * ppm * res;
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++) {
          const i = y * W + x;
          let v = lerp(gv, x, y);
          if (this.cls[i] === SurfaceClass.asphalt || this.cls[i] === SurfaceClass.marking)
            v += Wt.gutter * Math.max(0, 1 - kerb[i]! / gutterPx);
          let w = smoothstep(Wt.lo, Wt.hi, v);
          if (this.cls[i] === SurfaceClass.threshold) w = Math.max(w, REFLECTION.threshold);
          this.wet[i] = w;
          this.dx[i] = lerp(gx, x, y) * slope * R.across;
          this.dy[i] = lerp(gy, x, y) * slope * R.along;
        }
    }
    // a prop touches a group when it stands in front of one of its sources and its
    // flipped body, standing, reaches that source's picture
    for (const group of this.groups) {
      const ids = new Set<string>();
      for (const source of sources.filter((x) => x.group === group)) {
        const bb = bounds(pictureOf(source));
        for (const o of setup.occluders) {
          if (!inFrontOf(centreOf(o.body.map(setup.project)), source.a, source.b)) continue;
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

  private sceneBox(b: PixelBox): Box {
    const { origin, resolution: res } = this.setup;
    return {
      x: origin.x + b.x / res,
      y: origin.y + b.y / res,
      width: b.w / res,
      height: b.h / res,
    };
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
   * The reflection for a destruction state: one layer per group of sources (the picture
   * of each fixture in the street) and `glints` (each light where it falls). A layer is
   * rendered only when a prop that touches it changes, and cached by that state.
   */
  render(destroyed: ReadonlySet<string>): ReflectionLayers {
    const started = performance.now();
    let work = false;
    const cached = (key: string, make: () => ReflectionLayer) => {
      let c = this.cache.get(key);
      if (!c) {
        c = make();
        this.cache.set(key, c);
        work = true;
      }
      return c;
    };
    const stateOf = (ids: readonly string[]) => ids.filter((id) => destroyed.has(id)).join("|");
    const groups = new Map<string, ReflectionLayer>();
    for (const group of this.groups) {
      const ids = this.touching.get(group) ?? [];
      if (!this.layerBox.has(group)) continue;
      groups.set(
        group,
        cached(`${group}#${stateOf(ids)}`, () => this.pictures(group, destroyed, ids)),
      );
    }
    const glints = cached(`${GLINTS}#${stateOf(this.setup.glintCasters ?? [])}`, () =>
      this.glints(destroyed),
    );
    if (work) {
      this.rendered++;
      this.lastMs = performance.now() - started;
      performance.measure("ground-reflection-render", { start: started });
    }
    return { groups, glints };
  }

  /** What is kept in memory, for the cost report. */
  retained() {
    const layers = [...this.cache.entries()].map(([key, l]) => ({
      key,
      width: l.canvas.width,
      height: l.canvas.height,
    }));
    const flips = [...this.flips.values()].map((f) => ({ width: f.box.w, height: f.box.h }));
    return {
      main: { width: this.width, height: this.height },
      boxes: [...this.layerBox.entries()].map(([k, b]) => ({ key: k, width: b.w, height: b.h })),
      layers,
      layerBytes: layers.reduce((s, l) => s + l.width * l.height * 4, 0),
      flipBytes: flips.reduce((s, f) => s + f.width * f.height * 3 * 4 * 2, 0),
      surfaceBytes: this.width * this.height * (1 + 4 * 4),
    };
  }

  /** Each light where it falls on a wet patch, from the light as it now falls. */
  private glints(destroyed: ReadonlySet<string>): ReflectionLayer {
    const b = this.layerBox.get(GLINTS) ?? { x: this.px.x, y: this.px.y, w: 1, h: 1 };
    const out = canvasOf(b.w, b.h);
    const lit = this.setup
      .incident?.(destroyed, { x: b.x, y: b.y, width: b.w, height: b.h })
      .getContext("2d", { willReadFrequently: true })!
      .getImageData(0, 0, b.w, b.h).data;
    if (lit) {
      const ctx = out.getContext("2d")!;
      const img = ctx.createImageData(b.w, b.h);
      const o = img.data;
      for (let y = 0; y < b.h; y++)
        for (let x = 0; x < b.w; x++) {
          const i = (y + b.y - this.px.y) * this.width + (x + b.x - this.px.x);
          const g = response(this.cls[i]! as SurfaceClass, this.wet[i]!, this.highlight[i]!).field;
          const q = (y * b.w + x) * 4;
          if (g > 0) knee(o, q, g * lit[q]!, g * lit[q + 1]!, g * lit[q + 2]!);
        }
      ctx.putImageData(img, 0, 0);
    }
    return { canvas: out, box: this.sceneBox(b) };
  }

  /**
   * A source's emitted picture, extracted from what it paints and floored before any
   * flip, stretch or sum; then its whole and stretched pictures in the street, before
   * any prop cuts them. Made once per source.
   */
  flipOf(source: MirrorSource): SourceFlip {
    const known = this.flips.get(source);
    if (known) return known;
    const { resolution: res } = this.setup;
    // 1. the emitters, in the source's own frame
    const eb = bounds(source.extent);
    const ex0 = Math.floor(eb.x0 * res) / res;
    const ey0 = Math.floor(eb.y0 * res) / res;
    const ew = Math.max(1, Math.ceil((eb.x1 - ex0) * res));
    const eh = Math.max(1, Math.ceil((eb.y1 - ey0) * res));
    const ec = canvasOf(ew, eh);
    const ectx = ec.getContext("2d", { willReadFrequently: true })!;
    ectx.scale(res, res);
    ectx.translate(-ex0, -ey0);
    ectx.beginPath();
    source.extent.forEach((p, i) => (i ? ectx.lineTo(p.x, p.y) : ectx.moveTo(p.x, p.y)));
    ectx.closePath();
    ectx.clip();
    source.paint(ectx);
    const ed = ectx.getImageData(0, 0, ew, eh).data;
    const E = new Float32Array(ew * eh * 3);
    const gain = source.gain ?? 1;
    for (let i = 0; i < ew * eh; i++) {
      const a = ed[i * 4 + 3]!;
      for (let c = 0; c < 3; c++) E[i * 3 + c] = emissive(ed[i * 4 + c]!, a, gain);
    }
    // 2. sampled where a mirror (and a rough surface) puts it
    const { from, to } = REFLECTION.stretch;
    const pic = bounds(
      [from, to].flatMap((k) => source.extent.map((p) => mirrorPoint(p, source.a, source.b, k))),
    );
    const bx0 = Math.max(this.px.x, Math.floor((pic.x0 - this.setup.origin.x) * res));
    const by0 = Math.max(this.px.y, Math.floor((pic.y0 - this.setup.origin.y) * res));
    const bx1 = Math.min(this.px.x + this.width, Math.ceil((pic.x1 - this.setup.origin.x) * res));
    const by1 = Math.min(this.px.y + this.height, Math.ceil((pic.y1 - this.setup.origin.y) * res));
    const box = { x: bx0, y: by0, w: Math.max(0, bx1 - bx0), h: Math.max(0, by1 - by0) };
    const tight = new Float32Array(box.w * box.h * 3);
    const stretched = new Float32Array(box.w * box.h * 3);
    const depths = stretchDepths(this.setup.stretchSamples);
    const m = (source.b.y - source.a.y) / (source.b.x - source.a.x);
    const sample = (xs: number, ys: number, out: Float32Array, o: number, w: number) => {
      const u = Math.floor((xs - ex0) * res);
      const v = Math.floor((ys - ey0) * res);
      if (u < 0 || v < 0 || u >= ew || v >= eh) return;
      const j = (v * ew + u) * 3;
      out[o] = out[o]! + E[j]! * w;
      out[o + 1] = out[o + 1]! + E[j + 1]! * w;
      out[o + 2] = out[o + 2]! + E[j + 2]! * w;
    };
    const share = 1 / depths.length;
    for (let y = 0; y < box.h; y++)
      for (let x = 0; x < box.w; x++) {
        const sx = this.setup.origin.x + (box.x + x + 0.5) / res;
        const sy = this.setup.origin.y + (box.y + y + 0.5) / res;
        const yl = source.a.y + m * (sx - source.a.x);
        const d = sy - yl;
        if (d <= 0) continue;
        const o = (y * box.w + x) * 3;
        sample(sx, yl - d, tight, o, 1);
        for (const k of depths) sample(sx, yl - d / k, stretched, o, share);
      }
    const made = { box, tight, stretched };
    this.flips.set(source, made);
    return made;
  }

  /** A group's pictures in the street for a state, through this surface. */
  private pictures(
    group: string,
    destroyed: ReadonlySet<string>,
    touching: readonly string[],
  ): ReflectionLayer {
    const { resolution: res, project, ppm } = this.setup;
    const b = this.layerBox.get(group)!;
    const sources = this.setup.sources.filter((s) => s.group === group);
    const occluders = this.setup.occluders.filter((o) => touching.includes(o.id));
    const tight = new Float32Array(b.w * b.h * 3);
    const stretched = new Float32Array(b.w * b.h * 3);
    for (const source of sources) {
      const f = this.flipOf(source);
      // what stands in front of this source, flipped below its foot, as it now stands
      const cut = canvasOf(b.w, b.h);
      const cctx = cut.getContext("2d", { willReadFrequently: true })!;
      cctx.scale(res, res);
      cctx.translate(-(this.setup.origin.x + b.x / res), -(this.setup.origin.y + b.y / res));
      cctx.fillStyle = "#fff";
      let any = false;
      for (const o of occluders) {
        if (!inFrontOf(centreOf(o.body.map(project)), source.a, source.b)) continue;
        const shape = flippedBody(project, o.body, destroyed.has(o.id) ? o.wreck : o.height, ppm);
        cctx.beginPath();
        shape.forEach((p, i) => (i ? cctx.lineTo(p.x, p.y) : cctx.moveTo(p.x, p.y)));
        cctx.closePath();
        cctx.fill();
        any = true;
      }
      const mask = any ? cctx.getImageData(0, 0, b.w, b.h).data : undefined;
      for (let y = 0; y < f.box.h; y++) {
        const ly = y + f.box.y - b.y;
        if (ly < 0 || ly >= b.h) continue;
        for (let x = 0; x < f.box.w; x++) {
          const lx = x + f.box.x - b.x;
          if (lx < 0 || lx >= b.w) continue;
          const li = ly * b.w + lx;
          const keep = mask ? 1 - mask[li * 4 + 3]! / 255 : 1;
          if (!keep) continue;
          const s = (y * f.box.w + x) * 3;
          for (let c = 0; c < 3; c++) {
            tight[li * 3 + c] = tight[li * 3 + c]! + f.tight[s + c]! * keep;
            stretched[li * 3 + c] = stretched[li * 3 + c]! + f.stretched[s + c]! * keep;
          }
        }
      }
    }
    const scale = ppm * res;
    blur3(tight, b.w, b.h, REFLECTION.tight.across * scale, REFLECTION.tight.along * scale);
    blur3(stretched, b.w, b.h, REFLECTION.rough.across * scale, REFLECTION.rough.along * scale);
    const out = canvasOf(b.w, b.h);
    const octx = out.getContext("2d")!;
    const img = octx.createImageData(b.w, b.h);
    const o = img.data;
    const k = REFLECTION.strength;
    for (let y = 0; y < b.h; y++)
      for (let x = 0; x < b.w; x++) {
        const li = y * b.w + x;
        const mi = (y + b.y - this.px.y) * this.width + (x + b.x - this.px.x);
        const r = response(this.cls[mi]! as SurfaceClass, this.wet[mi]!, this.highlight[mi]!);
        if (!r.tight && !r.streak) continue;
        // the whole picture, sampled where the film's ripple turns the view
        const tx = Math.max(0, Math.min(b.w - 1, Math.round(x + this.dx[mi]!)));
        const ty = Math.max(0, Math.min(b.h - 1, Math.round(y + this.dy[mi]!)));
        const tj = (ty * b.w + tx) * 3;
        knee(
          o,
          li * 4,
          k * (r.tight * tight[tj]! + r.streak * stretched[li * 3]!),
          k * (r.tight * tight[tj + 1]! + r.streak * stretched[li * 3 + 1]!),
          k * (r.tight * tight[tj + 2]! + r.streak * stretched[li * 3 + 2]!),
        );
      }
    octx.putImageData(img, 0, 0);
    return { canvas: out, box: this.sceneBox(b) };
  }
}

const GLINTS = "glints";

/**
 * Value noise in [0, 1] on a unit lattice, smoothly interpolated; the lattice is hashed
 * once per cell. Deterministic: the same world point always gives the same value.
 */
function valueNoise() {
  const lattice = new Map<number, number>();
  const h = (i: number, j: number, seed: number) => {
    const key = (seed * 8192 + i + 4096) * 8192 + j + 4096;
    let v = lattice.get(key);
    if (v === undefined) lattice.set(key, (v = hash(i, j, seed)));
    return v;
  };
  return (x: number, y: number, seed: number) => {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    return (
      h(ix, iy, seed) * (1 - sx) * (1 - sy) +
      h(ix + 1, iy, seed) * sx * (1 - sy) +
      h(ix, iy + 1, seed) * (1 - sx) * sy +
      h(ix + 1, iy + 1, seed) * sx * sy
    );
  };
}

/** Each pixel's distance (chamfer, in pixels) to the nearest pixel of a class. */
function chamfer(cls: Uint8Array, w: number, h: number, of: (k: number) => boolean) {
  const INF = 1e9;
  const d = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) d[i] = of(cls[i]!) ? 0 : INF;
  const D = Math.SQRT2;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      let v = d[i]!;
      if (x > 0) v = Math.min(v, d[i - 1]! + 1);
      if (y > 0) {
        v = Math.min(v, d[i - w]! + 1);
        if (x > 0) v = Math.min(v, d[i - w - 1]! + D);
        if (x < w - 1) v = Math.min(v, d[i - w + 1]! + D);
      }
      d[i] = v;
    }
  for (let y = h - 1; y >= 0; y--)
    for (let x = w - 1; x >= 0; x--) {
      const i = y * w + x;
      let v = d[i]!;
      if (x < w - 1) v = Math.min(v, d[i + 1]! + 1);
      if (y < h - 1) {
        v = Math.min(v, d[i + w]! + 1);
        if (x < w - 1) v = Math.min(v, d[i + w + 1]! + D);
        if (x > 0) v = Math.min(v, d[i + w - 1]! + D);
      }
      d[i] = v;
    }
  return d;
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
