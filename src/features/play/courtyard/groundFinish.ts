/**
 * The intersection's ground, finished: the wear a street gets from being used, put
 * where its use puts it, and nowhere else.
 *
 * Presentation only, painted into the ground canvas on intersection scenes with
 * materials (a missing tile is the old drawing). Nothing here adds collision, moves a
 * zone, an entrance or a route, or touches a tactical overlay: the grid, routes, rings
 * and markers are drawn above the ground and are never weathered.
 *
 *   - slabs: a few paving slabs sit a shade off their neighbours, and a few are
 *     newer repairs, chosen by the slab alone
 *   - gutters: silt and damp gather in the channel either side of each gully
 *   - paint: crossings and lane paint are worn where wheels run, and chipped
 *   - parked machines: an oil drip under some engines and the generator
 *   - wall bases: dirt along every building's foot that the shop's block does not
 *     already carry, and in its internal corners
 *   - thresholds: feet wear a door's step, and loading doors are scuffed by trolleys
 *
 * Every mark is deterministic (`hash` of a world position) and none is evenly spread:
 * no stain is the same twice, and no surface is covered in grunge.
 */
import type { Arena, Point, Rect, SceneEnvironment, SceneStructure } from "@/engine";
import { hash, type Edge } from "./frontage";
import { paintStreetLife } from "./streetLife";

type Project = (p: Point) => Point;

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
/** A soft elliptical stain in world metres, flattened by the projection. */
function stain(
  ctx: CanvasRenderingContext2D,
  project: Project,
  centre: Point,
  rx: number,
  ry: number,
  color: string,
) {
  const c = project(centre);
  const ex = project({ x: centre.x + rx, y: centre.y });
  const ey = project({ x: centre.x, y: centre.y + ry });
  const ax = { x: ex.x - c.x, y: ex.y - c.y },
    ay = { x: ey.x - c.x, y: ey.y - c.y };
  ctx.save();
  // map a unit circle onto the projected ellipse
  ctx.transform(ax.x, ax.y, ay.x, ay.y, c.x, c.y);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
  g.addColorStop(0, color);
  g.addColorStop(
    0.55,
    color.replace(/[\d.]+\)$/, (a) => `${Number(a.slice(0, -1)) * 0.55})`),
  );
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, 1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
const quad = (project: Project, r: Rect) =>
  [
    { x: r.x, y: r.y },
    { x: r.x + r.width, y: r.y },
    { x: r.x + r.width, y: r.y + r.height },
    { x: r.x, y: r.y + r.height },
  ].map(project);
const inside = (p: Point, r: Rect) =>
  p.x >= r.x && p.x <= r.x + r.width && p.y >= r.y && p.y <= r.y + r.height;

/* ------------------------------------------------------------------ asphalt */

/** Utility cuts follow each saved carriageway, independent of camera and lighting. */
export function roadRepairs(env: SceneEnvironment): Rect[] {
  const out: Rect[] = [];
  for (const z of env.zones.filter((z) => z.kind === "road")) {
    const vertical = z.axis === "y";
    const length = vertical ? z.rect.height : z.rect.width;
    const span = vertical ? z.rect.width : z.rect.height;
    if (span < 3) continue;
    for (let t = 2; t < length - 6; t += 11) {
      const h = hash(z.rect.x, z.rect.y, t, 71);
      const across = span * (h < 0.5 ? 0.16 : 0.61);
      const along = t + hash(t, z.rect.x, 72) * 2;
      const width = Math.min(1.15 + h * 0.65, span - across - 0.3);
      const run = Math.min(2.6 + hash(t, z.rect.y, 73) * 1.8, length - along - 0.3);
      out.push({
        x: z.rect.x + (vertical ? across : along),
        y: z.rect.y + (vertical ? along : across),
        width: vertical ? width : run,
        height: vertical ? run : width,
      });
    }
  }
  return out;
}

/** A narrow, branching fracture; width is in metres, like the paving it belongs to. */
function fracture(ctx: CanvasRenderingContext2D, project: Project, points: Point[], width = 0.045) {
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!,
      b = points[i]!;
    const dx = b.x - a.x,
      dy = b.y - a.y;
    const length = Math.hypot(dx, dy);
    if (!length) continue;
    const ox = ((-dy / length) * width) / 2,
      oy = ((dx / length) * width) / 2;
    poly(
      ctx,
      [
        { x: a.x + ox, y: a.y + oy },
        { x: b.x + ox, y: b.y + oy },
        { x: b.x - ox, y: b.y - oy },
        { x: a.x - ox, y: a.y - oy },
      ].map(project),
      "rgba(6,10,12,.65)",
    );
  }
}

/** Cached albedo only: laid after zone surfaces, before crossings and lane paint. */
export function paintRoadSurface(
  ctx: CanvasRenderingContext2D,
  project: Project,
  env: SceneEnvironment,
) {
  const roads = env.zones.filter((z) => ["road", "intersection", "crosswalk"].includes(z.kind));
  if (!roads.length) return;
  ctx.save();
  ctx.beginPath();
  for (const z of roads) {
    quad(project, z.rect).forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
  }
  ctx.clip();
  for (const r of roadRepairs(env)) {
    // Ragged saw-cut corners, with the existing asphalt grain showing through.
    const points = [
      { x: r.x + 0.13, y: r.y },
      { x: r.x + r.width - 0.09, y: r.y + 0.04 },
      { x: r.x + r.width, y: r.y + 0.18 },
      { x: r.x + r.width - 0.03, y: r.y + r.height - 0.15 },
      { x: r.x + r.width - 0.19, y: r.y + r.height },
      { x: r.x + 0.08, y: r.y + r.height - 0.05 },
      { x: r.x, y: r.y + r.height - 0.24 },
      { x: r.x + 0.02, y: r.y + 0.16 },
    ];
    poly(
      ctx,
      points.map(project),
      hash(r.x, r.y, 74) < 0.6 ? "rgba(113,112,99,.18)" : "rgba(4,11,14,.32)",
    );
    fracture(ctx, project, [...points, points[0]!], 0.055);
    fracture(
      ctx,
      project,
      [
        points[4]!,
        { x: r.x + r.width + 0.3, y: r.y + r.height + 0.35 },
        { x: r.x + r.width + 0.22, y: r.y + r.height + 0.65 },
      ],
      0.035,
    );
  }
  // A few connected cracks, not a repeated noise layer over the whole street.
  const left = Math.min(...roads.map((z) => z.rect.x));
  const top = Math.min(...roads.map((z) => z.rect.y));
  const right = Math.max(...roads.map((z) => z.rect.x + z.rect.width));
  const bottom = Math.max(...roads.map((z) => z.rect.y + z.rect.height));
  for (let x = Math.floor(left / 6) * 6; x < right; x += 6)
    for (let y = Math.floor(top / 6) * 6; y < bottom; y += 6) {
      if (hash(x, y, 75) > 0.38) continue;
      const start = { x: x + hash(x, y, 76) * 3, y: y + hash(x, y, 77) * 3 };
      if (!roads.some((z) => inside(start, z.rect))) continue;
      const points = Array.from({ length: 7 }, (_, i) => ({
        x: start.x + i * 0.43,
        y: start.y + i * 0.24 + (hash(x, y, i, 78) - 0.5) * 0.48,
      }));
      fracture(ctx, project, points);
      const p = points[3]!;
      fracture(
        ctx,
        project,
        [p, { x: p.x + 0.15, y: p.y - 0.44 }, { x: p.x + 0.48, y: p.y - 0.7 }],
        0.03,
      );
    }
  ctx.restore();
}

/* ------------------------------------------------------------------ paving */

/** Which 1 m slabs of the pavement are off-tone or repaired: by the slab alone. */
export function slabFinish(x: number, y: number): "dark" | "light" | "repair" | undefined {
  const h = hash(x, y, 11);
  if (h < 0.022) return "repair";
  if (h < 0.09) return "dark";
  if (h > 0.955) return "light";
  return undefined;
}

function paintSlabs(
  ctx: CanvasRenderingContext2D,
  project: Project,
  env: SceneEnvironment,
  enhanced: boolean,
) {
  for (const z of env.zones.filter((z) => z.kind === "sidewalk"))
    for (let x = Math.ceil(z.rect.x); x < z.rect.x + z.rect.width - 0.5; x++)
      for (let y = Math.ceil(z.rect.y); y < z.rect.y + z.rect.height - 0.5; y++) {
        const finish = slabFinish(x, y);
        const slab = quad(project, { x: x + 0.02, y: y + 0.02, width: 0.96, height: 0.96 });
        if (finish === "dark")
          poly(ctx, slab, enhanced ? "rgba(6,10,12,.13)" : "rgba(6,10,12,.09)");
        if (finish === "light") poly(ctx, slab, "rgba(220,220,210,.045)");
        if (finish === "repair") {
          // a newer, paler slab with a crisp edge where it was cut in
          poly(ctx, slab, enhanced ? "rgba(160,158,146,.20)" : "rgba(160,158,146,.15)");
          for (let i = 0; i < 4; i++)
            stroke(ctx, slab[i]!, slab[(i + 1) % 4]!, "rgba(18,22,22,.38)", 0.7);
        }
        if (enhanced && finish !== "repair" && hash(x, y, 81) < 0.065) {
          const offset = 0.25 + hash(x, y, 82) * 0.4;
          fracture(
            ctx,
            project,
            [
              { x: x + 0.02, y: y + offset },
              { x: x + 0.35, y: y + offset + 0.12 },
              { x: x + 0.57, y: y + offset + 0.06 },
              { x: x + 0.85, y: y + 0.98 },
            ],
            0.035,
          );
          poly(
            ctx,
            [
              { x: x + 0.78, y: y + 0.98 },
              { x: x + 0.98, y: y + 0.79 },
              { x: x + 0.98, y: y + 0.98 },
            ].map(project),
            "rgba(16,21,20,.38)",
          );
        }
      }
}

/* ------------------------------------------------------------------ paint */

/**
 * Crossing and lane paint worn where wheels run: two tracks along each road's
 * travel direction, a little either side of every lane's centre, and a few chips.
 * The paint stays legible; it loses its edge, not its pattern.
 */
function wearRoadPaint(ctx: CanvasRenderingContext2D, project: Project, env: SceneEnvironment) {
  const worn = "rgba(30,38,42,.42)";
  const track = "rgba(30,38,42,.2)";
  for (const z of env.zones.filter((z) => z.kind === "crosswalk")) {
    // traffic crosses a crossing along the road it is painted on
    const road = env.zones.find((r) => r.kind === "road" && overlaps(r.rect, z.rect));
    const vertical = road ? road.axis === "y" : z.axis === "x";
    const span = vertical ? z.rect.width : z.rect.height;
    // lane centres: a quarter and three quarters across the carriageway
    for (const lane of [0.25, 0.75])
      for (const off of [-0.85, 0.85]) {
        const c = (vertical ? z.rect.x : z.rect.y) + span * lane + off;
        const len = vertical ? z.rect.height : z.rect.width;
        // a continuous track: long, narrow stains overlapping along the direction of travel
        for (let t = 0; t < len; t += 0.3) {
          const p = vertical ? { x: c, y: z.rect.y + t + 0.15 } : { x: z.rect.x + t + 0.15, y: c };
          stain(ctx, project, p, vertical ? 0.2 : 0.5, vertical ? 0.5 : 0.2, track);
        }
      }
    // a few chips, by position
    for (let x = z.rect.x; x < z.rect.x + z.rect.width; x += 0.5)
      for (let y = z.rect.y; y < z.rect.y + z.rect.height; y += 0.5)
        if (hash(x, y, 21) < 0.12)
          stain(ctx, project, { x: x + 0.2, y: y + 0.2 }, 0.12, 0.09, worn);
  }
  // lane dashes: an occasional dash scuffed half away
  for (const z of env.zones.filter((z) => z.kind === "road")) {
    const vertical = z.axis === "y";
    const len = vertical ? z.rect.height : z.rect.width;
    for (let t = 0; t < len; t += 3) {
      if (hash(z.rect.x, z.rect.y, t, 23) > 0.4) continue;
      const p = {
        x: z.rect.x + (vertical ? z.rect.width / 2 : t + 0.3 + hash(t, 24) * 0.8),
        y: z.rect.y + (vertical ? t + 0.3 + hash(t, 25) * 0.8 : z.rect.height / 2),
      };
      stain(ctx, project, p, 0.35, 0.35, worn);
    }
  }
}

function overlaps(a: Rect, b: Rect, slack = 0) {
  return (
    a.x < b.x + b.width + slack &&
    b.x < a.x + a.width + slack &&
    a.y < b.y + b.height + slack &&
    b.y < a.y + a.height + slack
  );
}

/* ------------------------------------------------------------------ machines */

/**
 * An oil drip under an engine: not every car has one, none is the same size, and it
 * sits under the engine block, where the sump is.
 */
export function oilDrips(arena: Arena): { at: Point; r: number; strength: number }[] {
  const env = arena.environment!;
  const out: { at: Point; r: number; strength: number }[] = [];
  for (const p of env.props) {
    const piece = arena.cover?.find((c) => c.id === p.coverId);
    if (!piece) continue;
    const r = piece.rect;
    const h = hash(r.x, r.y, 31);
    if (p.art === "sedan-engine" && h < 0.7)
      out.push({
        at: {
          x: r.x + r.width * (0.35 + h * 0.4),
          y: r.y + r.height * (0.4 + hash(r.y, 32) * 0.3),
        },
        r: 0.35 + h * 0.4,
        strength: 0.16 + h * 0.12,
      });
    if (p.art === "generator")
      out.push({
        at: { x: r.x + r.width * 0.5, y: r.y + r.height + 0.25 },
        r: 0.45,
        strength: 0.2,
      });
  }
  return out;
}

/* ------------------------------------------------------------------ walls */

/** The open stretches of a camera-facing face, as (a, b) metres along it. */
function openSpans(s: SceneStructure, edge: Edge, all: readonly SceneStructure[]) {
  const r = s.rect;
  const len = edge === "north" ? r.width : r.height;
  const blocked: [number, number][] = [];
  for (const o of all) {
    if (o === s || o.style === "mesh-fence" || o.style === "interior-wall") continue;
    const q = o.rect;
    if (edge === "north" && Math.abs(q.y + q.height - r.y) < 0.01)
      blocked.push([Math.max(0, q.x - r.x), Math.min(len, q.x + q.width - r.x)]);
    if (edge === "east" && Math.abs(q.x - (r.x + r.width)) < 0.01)
      blocked.push([Math.max(0, q.y - r.y), Math.min(len, q.y + q.height - r.y)]);
  }
  const spans: [number, number][] = [];
  let s0 = 0;
  for (const [a, b] of blocked.filter(([a, b]) => b > a).sort((p, q) => p[0] - q[0])) {
    if (a > s0) spans.push([s0, a]);
    s0 = Math.max(s0, b);
  }
  if (s0 < len) spans.push([s0, len]);
  return spans;
}

function paintWallFeet(
  ctx: CanvasRenderingContext2D,
  project: Project,
  structures: readonly SceneStructure[],
  skip: ReadonlySet<string>,
) {
  for (const s of structures) {
    if (skip.has(s.id) || s.style === "mesh-fence" || s.style === "interior-wall") continue;
    for (const edge of ["north", "east"] as const)
      for (const [a, b] of openSpans(s, edge, structures)) {
        const r = s.rect;
        const at = (t: number, out: number): Point =>
          edge === "north" ? { x: r.x + t, y: r.y - out } : { x: r.x + r.width + out, y: r.y + t };
        // a tight contact line, then a short soft fall of dirt and splash
        const strip = [at(a, 0), at(b, 0), at(b, 0.4), at(a, 0.4)].map(project);
        const g = ctx.createLinearGradient(
          project(at(a, 0)).x,
          project(at(a, 0)).y,
          project(at(a, 0.4)).x,
          project(at(a, 0.4)).y,
        );
        g.addColorStop(0, "rgba(10,10,8,.36)");
        g.addColorStop(0.18, "rgba(10,10,8,.14)");
        g.addColorStop(1, "rgba(10,10,8,0)");
        poly(ctx, strip, g as unknown as string);
        // heavier where the face meets another mass: dirt gathers in a corner
        for (const [t, open] of [
          [a, a > 0.01],
          [b, b < (edge === "north" ? r.width : r.height) - 0.01],
        ] as const)
          if (open) stain(ctx, project, at(t, 0.15), 0.5, 0.5, "rgba(12,10,8,.32)");
      }
  }
}

/* ------------------------------------------------------------------ doors */

function paintThresholdWear(
  ctx: CanvasRenderingContext2D,
  project: Project,
  env: SceneEnvironment,
  skip: ReadonlySet<string>,
) {
  for (const e of env.entrances ?? []) {
    if (skip.has(e.structureId)) continue;
    const s = env.structures.find((x) => x.id === e.structureId);
    if (!s) continue;
    const industrial = s.style === "workshop" || s.style === "warehouse";
    // feet darken the step's middle; trolleys and pallets scuff a wider, longer fan
    stain(
      ctx,
      project,
      e.position,
      industrial ? 0.9 : 0.6,
      industrial ? 0.9 : 0.6,
      "rgba(14,14,12,.2)",
    );
    if (industrial)
      for (const off of [-0.55, 0.55]) {
        const vertical = Math.abs(e.position.x - (s.rect.x + s.rect.width)) < 1.2;
        const p = vertical
          ? { x: e.position.x + 0.6, y: e.position.y + off }
          : { x: e.position.x + off, y: e.position.y - 0.6 };
        stain(ctx, project, p, 0.22, 0.22, "rgba(8,8,8,.16)");
      }
  }
}

/** Flat threshold inserts, centred on saved exterior entrances, never new steps. */
export function entryAprons(env: SceneEnvironment): Rect[] {
  return (env.entrances ?? []).flatMap((e) => {
    const s = env.structures.find((s) => s.id === e.structureId);
    if (!s || s.style !== "shop") return [];
    const r = s.rect,
      p = e.position;
    if (p.y < r.y) return [{ x: p.x - 1, y: r.y - 1.1, width: 2, height: 1 }];
    if (p.y > r.y + r.height) return [{ x: p.x - 1, y: r.y + r.height + 0.1, width: 2, height: 1 }];
    if (p.x < r.x) return [{ x: r.x - 1.1, y: p.y - 1, width: 1, height: 2 }];
    if (p.x > r.x + r.width) return [{ x: r.x + r.width + 0.1, y: p.y - 1, width: 1, height: 2 }];
    return [];
  });
}
function paintEntryAprons(ctx: CanvasRenderingContext2D, project: Project, env: SceneEnvironment) {
  for (const r of entryAprons(env)) {
    poly(ctx, quad(project, r), "rgba(158,148,122,.6)");
    const inset = { x: r.x + 0.12, y: r.y + 0.12, width: r.width - 0.24, height: r.height - 0.24 };
    poly(ctx, quad(project, inset), "#303c37");
    const longX = r.width > r.height;
    for (let t = 0.08; t < (longX ? inset.width : inset.height); t += 0.1) {
      const a = { x: inset.x + (longX ? t : 0), y: inset.y + (longX ? 0 : t) };
      const b = { x: a.x + (longX ? 0 : inset.width), y: a.y + (longX ? inset.height : 0) };
      stroke(ctx, project(a), project(b), "rgba(151,151,127,.38)", 0.65);
    }
  }
}

/* ------------------------------------------------------------------ gutters */

function paintGutterSilt(ctx: CanvasRenderingContext2D, project: Project, env: SceneEnvironment) {
  // silt and damp collect along the channel to either side of a gully, thinning away
  const roads = env.zones.filter((z) => z.kind === "road" || z.kind === "intersection");
  for (const d of env.dressing.filter((x) => x.kind === "drain")) {
    const road = roads.find((z) =>
      inside(d.position, {
        ...z.rect,
        x: z.rect.x - 1,
        y: z.rect.y - 1,
        width: z.rect.width + 2,
        height: z.rect.height + 2,
      }),
    );
    const alongY = road ? road.axis === "y" : true;
    for (let k = -3; k <= 3; k++) {
      if (k === 0) continue;
      const fade = 1 - Math.abs(k) / 4;
      const p = alongY
        ? { x: d.position.x, y: d.position.y + k * 0.45 }
        : { x: d.position.x + k * 0.45, y: d.position.y };
      stain(
        ctx,
        project,
        p,
        alongY ? 0.28 : 0.5,
        alongY ? 0.5 : 0.28,
        `rgba(22,20,14,${(0.22 * fade).toFixed(3)})`,
      );
    }
  }
}

/** Everything above, in the order a street collects it. */
export function paintGroundFinish(
  ctx: CanvasRenderingContext2D,
  arena: Arena,
  project: Project,
  /** Masses whose ground the shop's block already finishes (`paintFrontageGround`). */
  skip: ReadonlySet<string> = new Set(),
  enhancedPaving = false,
) {
  const env = arena.environment!;
  paintSlabs(ctx, project, env, enhancedPaving);
  paintGutterSilt(ctx, project, env);
  wearRoadPaint(ctx, project, env);
  for (const o of oilDrips(arena))
    stain(ctx, project, o.at, o.r, o.r * 0.8, `rgba(8,8,10,${o.strength.toFixed(3)})`);
  paintWallFeet(ctx, project, env.structures, skip);
  paintThresholdWear(ctx, project, env, skip);
  if (enhancedPaving) paintEntryAprons(ctx, project, env);
  if (enhancedPaving) paintStreetLife(ctx, arena, project);
}
