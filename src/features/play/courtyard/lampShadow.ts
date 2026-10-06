/**
 * Lamp shadows: where a nearby solid stands between a particular light and the ground.
 *
 * Presentation only, at night on the intersection. The ground's light (`nightLighting.ts`)
 * used to be painted as if nothing stood on the pavement: the shop lamp's pool ran
 * straight under the food cart and out the other side, and a window's spill went
 * through the planter in front of it. Here each nearby prop is a box (its saved 2 m
 * footprint, inset to the body, and a stated height), and each light a point at its
 * fixture's height, so the shadow is the box projected from that point onto the
 * ground: short under a high lamp, long beside a low window.
 *
 * Three rules keep it honest:
 *
 *   - **It belongs to the light, not the night.** A shadow only takes away light that
 *     particular source gave; it never darkens the ambient, and the contact shade
 *     under each prop (`contactShade.ts`) stays a separate thing. Lights off, it is gone.
 *   - **It belongs to the object as it stands.** A destroyed prop casts its wreck's low
 *     shadow, never its intact one. The board shows a "restore" sprite with exactly
 *     the light the intact shadow took and the wreck's does not.
 *   - **Fading is not a shadow change.** A prop faded so a person behind it can be
 *     seen is still there, and so is its shadow.
 *
 * Not a general shadow system: only props, only the ground, only the lights the
 * scene already has. Buildings already stop the light at their walls.
 */
import type { Arena, Point, Rect } from "@/engine";
import type { GroundLight } from "./nightLighting";

/**
 * Presentation heights in metres, for the box a prop casts: the body that stops
 * light, not its tallest antenna. `wreck` is the walkable remains (the round-two and
 * round-one wreck volumes). Stated guesses for the atlas props, tuned by eye.
 */
export const CASTER_HEIGHT: Record<string, { height: number; wreck: number; inset?: Rect }> = {
  "sedan-engine": {
    height: 0.95,
    wreck: 0.55,
    inset: { x: 0.12, y: 0.2, width: 1.88, height: 1.6 },
  },
  "sedan-cabin": { height: 1.45, wreck: 0.55, inset: { x: 0, y: 0.2, width: 1.86, height: 1.6 } },
  planter: { height: 0.95, wreck: 0.35 },
  // the cabinet is 0.9 m deep (`CABINET`): local y 0.4-1.3
  mailboxes: { height: 1.52, wreck: 0.5, inset: { x: 0.12, y: 0.4, width: 1.76, height: 0.9 } },
  "shop-display": { height: 1.31, wreck: 0.45 },
  "food-cart": { height: 1.4, wreck: 0.4 },
  cargo: { height: 1.1, wreck: 0.4 },
  dumpster: { height: 1.3, wreck: 0.4 },
  generator: { height: 1.1, wreck: 0.4 },
};

export const LAMP_SHADOW = {
  /** How much of a light the umbra takes away: never all of it, since light bounces. */
  strength: 0.72,
  /** The penumbra, in metres of blur on the ground. */
  softness: 0.3,
  /** A light whose reach stops this far short of a caster does not see it. */
  margin: 0.5,
  /** Where a window's light comes from: the middle of the bay's height. */
  windowZ: 1.5,
  /** A pool with no fixture saved for it hangs this high (the entrance's downlight). */
  poolZ: 2.7,
  /** A source no higher than the box above it throws a shadow at most this many times
   * its height long; the light's own reach clips it sooner. */
  stretch: 6,
} as const;

/** A solid that casts, on the ground: its body's footprint and how tall it stands. */
export interface ShadowCaster {
  coverId: string;
  art: string;
  /** Ground footprint of the body, world metres. */
  body: Point[];
  height: number;
  wreck: number;
}

/** A light as a point at its fixture's height. */
export interface ShadowSource {
  at: Point;
  z: number;
}

const inset = (rect: Rect, local: Rect | undefined, rotation: 0 | 90): Point[] => {
  const b = local ?? { x: 0.12, y: 0.12, width: 1.76, height: 1.76 };
  // a section's frame is rect's own 2 m; rotation 90 maps local (x, y) to (2 - y, x)
  const corners = [
    { x: b.x, y: b.y },
    { x: b.x + b.width, y: b.y },
    { x: b.x + b.width, y: b.y + b.height },
    { x: b.x, y: b.y + b.height },
  ].map((p) => (rotation === 90 ? { x: 2 - p.y, y: p.x } : p));
  return corners.map((p) => ({ x: rect.x + p.x, y: rect.y + p.y }));
};

/** Every prop in the scene that casts, from its saved cover piece and art. */
export function shadowCasters(arena: Arena): ShadowCaster[] {
  const env = arena.environment;
  if (!env) return [];
  return env.props.flatMap((p) => {
    const spec = CASTER_HEIGHT[p.art];
    const piece = arena.cover?.find((c) => c.id === p.coverId);
    if (!spec || !piece) return [];
    return [
      {
        coverId: p.coverId,
        art: p.art,
        body: inset(piece.rect, spec.inset, p.rotation === 90 ? 90 : 0),
        height: spec.height,
        wreck: spec.wreck,
      },
    ];
  });
}

const centreOf = (pts: readonly Point[]) => ({
  x: pts.reduce((s, p) => s + p.x, 0) / pts.length,
  y: pts.reduce((s, p) => s + p.y, 0) / pts.length,
});

/** How far a light reaches from its source on the ground, for the reach test. */
function reaches(light: GroundLight, c: Point, margin: number) {
  if (light.kind === "pool")
    return Math.hypot(c.x - light.centre.x, c.y - light.centre.y) < light.radius + margin;
  const dx = c.x - light.origin.x;
  const dy = c.y - light.origin.y;
  const s = dx * light.along.x + dy * light.along.y;
  const out = dx * light.out.x + dy * light.out.y;
  return (
    out > -margin &&
    out < light.reach + margin &&
    s > light.s0 - light.spread - margin &&
    s < light.s1 + light.spread + margin
  );
}

/**
 * Where a light comes from, as seen by one caster: a pool's fixture overhead, or the
 * point of a window's bay nearest the caster. Null when the light cannot cast it: out
 * of reach, or overhead it (a light directly above a box lights its top).
 */
export function sourceFor(
  light: GroundLight,
  caster: ShadowCaster,
  /** The pool's fixture height, if one is saved. */
  poolZ: number = LAMP_SHADOW.poolZ,
): ShadowSource | null {
  const c = centreOf(caster.body);
  if (!reaches(light, c, LAMP_SHADOW.margin)) return null;
  let source: ShadowSource;
  if (light.kind === "pool") source = { at: light.centre, z: poolZ };
  else {
    const dx = c.x - light.origin.x;
    const dy = c.y - light.origin.y;
    const s = Math.max(light.s0, Math.min(light.s1, dx * light.along.x + dy * light.along.y));
    source = {
      at: { x: light.origin.x + light.along.x * s, y: light.origin.y + light.along.y * s },
      z: LAMP_SHADOW.windowZ,
    };
  }
  if (insidePolygon(source.at, caster.body)) return null;
  return source;
}

function insidePolygon(p: Point, poly: readonly Point[]) {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]!;
    const b = poly[j]!;
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x)
      hit = !hit;
  }
  return hit;
}

/** The convex hull of a point set (monotone chain), counter-clockwise. */
export function hull(points: readonly Point[]): Point[] {
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

/**
 * The ground shadow of a box (footprint `body`, height `h`) from a point source: the
 * hull of its footprint and its top corners projected along the rays from the source
 * to the ground. In world metres.
 */
export function boxShadow(body: readonly Point[], h: number, source: ShadowSource): Point[] {
  if (h <= 0) return [];
  const k =
    source.z > h ? Math.min(source.z / (source.z - h), LAMP_SHADOW.stretch) : LAMP_SHADOW.stretch;
  const tops = body.map((p) => ({
    x: source.at.x + (p.x - source.at.x) * k,
    y: source.at.y + (p.y - source.at.y) * k,
  }));
  return hull([...body, ...tops]);
}

type Project = (p: Point) => Point;

const tracePolygon = (ctx: CanvasRenderingContext2D, project: Project, poly: readonly Point[]) => {
  poly.map(project).forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.closePath();
};

/** A device-pixel box in `ctx` round world points, padded and kept on the canvas. */
export function deviceBox(
  ctx: CanvasRenderingContext2D,
  project: Project,
  pts: readonly Point[],
  pad: number,
) {
  const m = ctx.getTransform();
  const xs: number[] = [];
  const ys: number[] = [];
  for (const p of pts) {
    const q = m.transformPoint(project(p));
    xs.push(q.x);
    ys.push(q.y);
  }
  const x0 = Math.max(0, Math.floor(Math.min(...xs) - pad));
  const y0 = Math.max(0, Math.floor(Math.min(...ys) - pad));
  const x1 = Math.min(ctx.canvas.width, Math.ceil(Math.max(...xs) + pad));
  const y1 = Math.min(ctx.canvas.height, Math.ceil(Math.max(...ys) + pad));
  return x1 > x0 && y1 > y0 ? { x: x0, y: y0, width: x1 - x0, height: y1 - y0 } : null;
}

/** A canvas over `box` of `like`, drawing with the same transform. */
function scratch(
  like: CanvasRenderingContext2D,
  box: { x: number; y: number; width: number; height: number },
) {
  const canvas = document.createElement("canvas");
  canvas.width = box.width;
  canvas.height = box.height;
  const ctx = canvas.getContext("2d")!;
  ctx.setTransform(new DOMMatrix().translate(-box.x, -box.y).multiply(like.getTransform()));
  return ctx;
}

/** Fill a set of shadow polygons, softened, at `alpha`, with whatever composite is set. */
function fillShadows(
  ctx: CanvasRenderingContext2D,
  project: Project,
  polys: readonly Point[][],
  alpha: number,
  /** Pixels per metre in this canvas. */
  scale: number,
) {
  if (!polys.length) return;
  ctx.save();
  ctx.filter = `blur(${Math.max(0.5, LAMP_SHADOW.softness * scale)}px)`;
  ctx.fillStyle = `rgba(0,0,0,${alpha})`;
  ctx.beginPath();
  for (const poly of polys) tracePolygon(ctx, project, poly);
  ctx.fill("nonzero");
  ctx.restore();
}

/**
 * Device pixels past a box that a blur can reach into it: a window fan's feather and a
 * shadow's penumbra are at most about 16 px of standard deviation on the ground canvas.
 * Anything drawn on a canvas of its own is drawn this far past the part that is kept.
 */
export const BLUR_MARGIN = 48;

/** Pixels per metre in a canvas drawn through `project` with the transform set. */
function pixelsPerMetre(ctx: CanvasRenderingContext2D, project: Project) {
  const m = ctx.getTransform();
  const a = project({ x: 0, y: 0 });
  const b = project({ x: 1, y: 0 });
  const dx = (b.x - a.x) * m.a + (b.y - a.y) * m.c;
  const dy = (b.x - a.x) * m.b + (b.y - a.y) * m.d;
  return Math.hypot(dx, dy);
}

/** The ground a light can reach, in world metres: a pool's square, a window's fan. */
export function lightExtent(light: GroundLight): Point[] {
  if (light.kind === "pool") {
    const { x, y } = light.centre;
    const r = light.radius;
    return [
      { x: x - r, y: y - r },
      { x: x + r, y: y - r },
      { x: x + r, y: y + r },
      { x: x - r, y: y + r },
    ];
  }
  const at = (s: number, out: number) => ({
    x: light.origin.x + light.along.x * s + light.out.x * out,
    y: light.origin.y + light.along.y * s + light.out.y * out,
  });
  return [
    at(light.s0 - light.spread, 0),
    at(light.s1 + light.spread, 0),
    at(light.s1 + light.spread, light.reach),
    at(light.s0 - light.spread, light.reach),
  ];
}

/** Pixel grid every light's own canvas starts on (see `paintShadowedLights`). */
export const ALIGN = 16;

/**
 * Paint each light, less its shadows from the casters as given, and add it to `ctx`.
 *
 * Each light is painted on a canvas of its own (so one light's shadow never takes away
 * another's light), covering its whole reach plus `BLUR_MARGIN`, and starting on the
 * `ALIGN` grid of the canvas `ctx` stands for. A crop of the ground (`ctx` translated by
 * a multiple of `ALIGN`) therefore paints every pixel exactly as the whole ground does:
 * the same canvas, at the same dither phase, added the same way.
 */
export function paintShadowedLights(
  ctx: CanvasRenderingContext2D,
  project: Project,
  lights: readonly GroundLight[],
  casters: readonly ShadowCaster[],
  zOf: (light: GroundLight) => number,
  paint: (ctx: CanvasRenderingContext2D, light: GroundLight) => void,
) {
  const scale = pixelsPerMetre(ctx, project);
  const m = ctx.getTransform();
  for (const light of lights) {
    const xs: number[] = [];
    const ys: number[] = [];
    for (const p of lightExtent(light)) {
      const q = m.transformPoint(project(p));
      xs.push(q.x);
      ys.push(q.y);
    }
    // the box on the grid, in this canvas's pixels; e is its offset from the grid
    const e = { x: ((m.e % ALIGN) + ALIGN) % ALIGN, y: ((m.f % ALIGN) + ALIGN) % ALIGN };
    const align = (v: number, off: number) => Math.floor((v - off) / ALIGN) * ALIGN + off;
    const x0 = align(Math.min(...xs) - BLUR_MARGIN, e.x);
    const y0 = align(Math.min(...ys) - BLUR_MARGIN, e.y);
    const x1 = Math.ceil(Math.max(...xs) + BLUR_MARGIN);
    const y1 = Math.ceil(Math.max(...ys) + BLUR_MARGIN);
    if (x1 <= 0 || y1 <= 0 || x0 >= ctx.canvas.width || y0 >= ctx.canvas.height) continue;
    const box = { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
    const layer = scratch(ctx, box);
    paint(layer, light);
    const shadows = casters.flatMap((c) => {
      const s = sourceFor(light, c, zOf(light));
      return s ? [boxShadow(c.body, c.height, s)] : [];
    });
    if (shadows.length) {
      layer.globalCompositeOperation = "destination-out";
      fillShadows(layer, project, shadows, LAMP_SHADOW.strength, scale);
    }
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = "lighter";
    ctx.drawImage(layer.canvas, box.x, box.y);
    ctx.restore();
  }
}

/**
 * Where a caster's intact shadows can lie, in world metres (every light's, together),
 * or null when it shades nothing: the area its restore sprite needs.
 */
export function shadowArea(
  lights: readonly GroundLight[],
  caster: ShadowCaster,
  zOf: (light: GroundLight) => number,
): Point[] | null {
  const pts = lights.flatMap((light) => {
    const source = sourceFor(light, caster, zOf(light));
    return source ? boxShadow(caster.body, caster.height, source) : [];
  });
  return pts.length ? pts : null;
}

/** A box in device pixels. */
export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

const overlaps = (a: Box, b: Box) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
const union = (a: Box, b: Box): Box => {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return {
    x,
    y,
    width: Math.max(a.x + a.width, b.x + b.width) - x,
    height: Math.max(a.y + a.height, b.y + b.height) - y,
  };
};

/**
 * Group casters whose shadow boxes touch into regions, until no two regions touch. Inside
 * a region's box, only its own casters' shadows reach the ground, so the region's light is
 * a function of their states alone, whatever the rest of the street is doing.
 */
export function shadowRegions(items: readonly { id: string; box: Box }[]) {
  let regions = items.map((i) => ({ ids: [i.id], box: i.box }));
  for (let merged = true; merged;) {
    merged = false;
    outer: for (let i = 0; i < regions.length; i++)
      for (let j = i + 1; j < regions.length; j++)
        if (overlaps(regions[i]!.box, regions[j]!.box)) {
          regions[i] = {
            ids: [...regions[i]!.ids, ...regions[j]!.ids],
            box: union(regions[i]!.box, regions[j]!.box),
          };
          regions = regions.filter((_, k) => k !== j);
          merged = true;
          break outer;
        }
  }
  return regions.map((r) => ({ ids: [...r.ids].sort(), box: r.box }));
}

/** The casters as they stand: a destroyed one is its wreck's lower box. */
export const castersAsStanding = (
  casters: readonly ShadowCaster[],
  destroyed: ReadonlySet<string>,
): ShadowCaster[] => casters.map((c) => (destroyed.has(c.coverId) ? { ...c, height: c.wreck } : c));
