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
    (noise(x * 0.58, y * 0.58) * 0.6 +
      noise(x * 1.9, y * 1.9) * 0.3 +
      noise(x * 6, y * 6) * 0.1 +
      0.17 * gutter -
      0.38) *
      4.4,
  );
}
/** The same field drives the substrate and the source-image reflections. */
export function rainField(env: SceneEnvironment) {
  const roads = env.zones.filter(
    (z) => z.kind === "road" || z.kind === "intersection" || z.kind === "crosswalk",
  );
  return (x: number, y: number) => {
    const road = roads.find((z) => inside(x, y, z.rect));
    const gutter = road
      ? 1 -
        smooth(
          Math.min(
            x - road.rect.x,
            road.rect.x + road.rect.width - x,
            y - road.rect.y,
            road.rect.y + road.rect.height - y,
          ) / 1.1,
        )
      : 0.2;
    return rainWetness(x, y, gutter);
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
    ["road", "intersection", "crosswalk", "sidewalk"].includes(z.kind),
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
      pixels.data[k] = 6;
      pixels.data[k + 1] = 13;
      pixels.data[k + 2] = 20;
      pixels.data[k + 3] = Math.round((road ? 15 : 6) + w * (road ? 48 : 24));
    }
  ctx.putImageData(pixels, 0, 0);
  return canvas;
}
