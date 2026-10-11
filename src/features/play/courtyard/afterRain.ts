/** Cached rain film. Dark substrate and source-coloured reflections share one wetness field. */
import type { Point, Rect, SceneEnvironment } from "@/engine";
const inside = (x: number, y: number, r: Rect) =>
  x >= r.x && y >= r.y && x <= r.x + r.width && y <= r.y + r.height;
const smooth = (v: number) => {
  const t = Math.max(0, Math.min(1, v));
  return t * t * (3 - 2 * t);
};
const random = (x: number, y: number) => {
  let n = Math.imul(x, 374761393) + Math.imul(y, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
};
function noise(x: number, y: number) {
  const ix = Math.floor(x),
    iy = Math.floor(y),
    a = smooth(x - ix),
    b = smooth(y - iy);
  return (
    (random(ix, iy) * (1 - a) + random(ix + 1, iy) * a) * (1 - b) +
    (random(ix, iy + 1) * (1 - a) + random(ix + 1, iy + 1) * a) * b
  );
}
/** Continuous in world space; gutter pooling is independent of camera and light. */
export function rainWetness(x: number, y: number, gutter = 0) {
  return smooth(
    (noise(x * 0.42, y * 0.42) * 0.72 +
      noise(x * 2.3, y * 2.3) * 0.2 +
      noise(x * 6, y * 6) * 0.08 +
      0.22 * gutter -
      0.43) *
      10,
  );
}
/** Exposed edges of the carriageway union. Crosswalks and overlapping road zones
 * must not create fictitious gutters across the middle of the intersection. */
export function roadEdges(env: SceneEnvironment): { a: Point; b: Point }[] {
  const roads = env.zones
    .filter((z) => ["road", "intersection", "crosswalk"].includes(z.kind))
    .map((z) => z.rect);
  const edges: { a: Point; b: Point }[] = [];
  for (const r of roads) {
    for (const horizontal of [true, false]) {
      const start = horizontal ? r.x : r.y;
      const end = start + (horizontal ? r.width : r.height);
      for (const far of [false, true]) {
        const fixed = horizontal ? r.y + (far ? r.height : 0) : r.x + (far ? r.width : 0);
        const cuts = [
          ...new Set([
            start,
            end,
            ...roads
              .flatMap((q) => (horizontal ? [q.x, q.x + q.width] : [q.y, q.y + q.height]))
              .filter((v) => v > start && v < end),
          ]),
        ].sort((a, b) => a - b);
        const point = (t: number, offset = 0) =>
          horizontal ? { x: t, y: fixed + offset } : { x: fixed + offset, y: t };
        for (let i = 1; i < cuts.length; i++) {
          const probe = point((cuts[i - 1]! + cuts[i]!) / 2, far ? 0.01 : -0.01);
          if (roads.some((q) => inside(probe.x, probe.y, q))) continue;
          edges.push({ a: point(cuts[i - 1]!), b: point(cuts[i]!) });
        }
      }
    }
  }
  return edges;
}
/** The same world field drives dark substrate and source-image reflections. */
export function rainField(env: SceneEnvironment) {
  const edges = roadEdges(env);
  return (x: number, y: number) => {
    let distance = 1.1;
    for (const { a, b } of edges) {
      const px = Math.max(Math.min(a.x, b.x), Math.min(Math.max(a.x, b.x), x));
      const py = Math.max(Math.min(a.y, b.y), Math.min(Math.max(a.y, b.y), y));
      distance = Math.min(distance, Math.hypot(x - px, y - py));
    }
    return rainWetness(x, y, 1 - smooth(distance / 1.1));
  };
}
/** One cached albedo film, with existing paint and cracks visible underneath. */
export function createRainSurface(
  env: SceneEnvironment,
  project: (p: Point) => Point,
  bounds: Rect,
) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(bounds.width);
  canvas.height = Math.ceil(bounds.height);
  const ctx = canvas.getContext("2d")!,
    pixels = ctx.createImageData(canvas.width, canvas.height);
  const o = project({ x: 0, y: 0 }),
    u = project({ x: 1, y: 0 }),
    v = project({ x: 0, y: 1 });
  const a = u.x - o.x,
    b = u.y - o.y,
    c = v.x - o.x,
    d = v.y - o.y,
    det = a * d - b * c;
  const zones = env.zones.filter((z) =>
    ["road", "intersection", "crosswalk", "sidewalk", "alley", "parking"].includes(z.kind),
  );
  const walls = env.structures.filter(
    (s) => s.style !== "mesh-fence" && s.style !== "interior-wall",
  );
  const wet = rainField(env);
  for (let j = 0; j < canvas.height; j++)
    for (let i = 0; i < canvas.width; i++) {
      const sx = bounds.x + i + 0.5 - o.x,
        sy = bounds.y + j + 0.5 - o.y,
        x = (sx * d - sy * c) / det,
        y = (sy * a - sx * b) / det;
      const zone = zones.find((z) => inside(x, y, z.rect));
      if (!zone || walls.some((s) => inside(x, y, s.rect))) continue;
      const road = zone.kind !== "sidewalk",
        w = wet(x, y),
        k = (j * canvas.width + i) * 4;
      pixels.data[k] = road ? 7 : 22;
      pixels.data[k + 1] = road ? 10 : 25;
      pixels.data[k + 2] = road ? 13 : 27;
      pixels.data[k + 3] = Math.round(w * (road ? 58 : 44));
    }
  ctx.putImageData(pixels, 0, 0);
  return canvas;
}
