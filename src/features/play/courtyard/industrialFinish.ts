/** Industrial finish follows saved room bounds; it never creates cover or routes. */
import type { Point, Rect, SceneEnvironment } from "@/engine";
import { fillMaterial, groundBasis, type MaterialSet } from "./surfaceMaterials";
import type { PoolLight } from "./nightLighting";

type Project = (p: Point) => Point;
const corners = (r: Rect) => [
  { x: r.x, y: r.y },
  { x: r.x + r.width, y: r.y },
  { x: r.x + r.width, y: r.y + r.height },
  { x: r.x, y: r.y + r.height },
];
export function paintIndustrialFloor(
  ctx: CanvasRenderingContext2D,
  project: Project,
  r: Rect,
  kind: string,
  materials: MaterialSet,
  garage = false,
) {
  const color =
    kind === "reception"
      ? "#777466"
      : garage
        ? kind === "service"
          ? "#596761"
          : "#555f60"
        : kind === "service"
          ? "#626b68"
          : "#62676a";
  const polygon = corners(r).map(project);
  if (
    !fillMaterial(ctx, materials, polygon, {
      key: "facade-concrete",
      basis: groundBasis(project),
      target: color,
      strength: 0.65,
    })
  ) {
    ctx.beginPath();
    polygon.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }
  const { origin, u, v } = groundBasis(project);
  ctx.save();
  ctx.transform(u.x, u.y, v.x, v.y, origin.x, origin.y);
  ctx.beginPath();
  ctx.rect(r.x, r.y, r.width, r.height);
  ctx.clip();
  // Large poured slabs, scuffed by handling; no outdoor paving or rain indoors.
  ctx.lineWidth = 0.035;
  ctx.strokeStyle = "rgba(20,29,32,.3)";
  for (let x = Math.ceil(r.x / 4) * 4; x < r.x + r.width; x += 4) {
    ctx.beginPath();
    ctx.moveTo(x, r.y);
    ctx.lineTo(x, r.y + r.height);
    ctx.stroke();
  }
  for (let y = Math.ceil(r.y / 4) * 4; y < r.y + r.height; y += 4) {
    ctx.beginPath();
    ctx.moveTo(r.x, y);
    ctx.lineTo(r.x + r.width, y);
    ctx.stroke();
  }
  for (let i = 0; i < 90; i++) {
    const x = r.x + ((i * 0.618033 + r.y * 0.13) % 1) * r.width;
    const y = r.y + ((i * 0.414214 + r.x * 0.17) % 1) * r.height;
    ctx.strokeStyle = i % 3 ? "rgba(19,28,30,.09)" : "rgba(207,202,183,.09)";
    ctx.lineWidth = 0.015 + (i % 3) * 0.009;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 0.15 + (i % 6) * 0.09, y + 0.04);
    ctx.stroke();
  }
  ctx.restore();
}

export interface IndustrialLight extends PoolLight {
  id: string;
  bounds: Rect;
}
/** Suspended industrial strips remain in the ceiling cutaway. Pools and actors
 * share these bounds, so a task light cannot shine through a closed partition. */
export function industrialLights(env: SceneEnvironment): IndustrialLight[] {
  if (!["warehouse", "garage"].includes(env.recipe) || !env.interior) return [];
  return env.zones
    .filter(
      (z) =>
        ["storage", "service", "reception", "staging", "workbay"].includes(z.kind) && !z.floorUse,
    )
    .flatMap((z, room) => {
      const r = z.rect;
      const alongY = r.height > r.width;
      const length = alongY ? r.height : r.width;
      const count = Math.max(1, Math.ceil(length / 8));
      const warm = z.kind === "service" || z.kind === "reception";
      return Array.from({ length: count }, (_, i) => ({
        id: `${env.recipe}-strip-${room}-${i}`,
        kind: "pool" as const,
        centre: alongY
          ? { x: r.x + r.width * 0.48, y: r.y + (length * (i + 0.5)) / count }
          : { x: r.x + (length * (i + 0.5)) / count, y: r.y + r.height * 0.52 },
        radius: Math.max(5, Math.min(9, Math.max(r.width, r.height) * 0.55)),
        sourceZ: 3.8,
        bounds: r,
        color: warm ? ([1, 0.79, 0.52] as const) : ([0.8, 0.88, 0.94] as const),
        intensity: warm ? 0.29 : z.kind === "workbay" ? 0.29 : 0.24,
      }));
    });
}
/** Suspended strip body, drawn high and narrow so sightlines remain usable. */
export function paintIndustrialFixture(
  ctx: CanvasRenderingContext2D,
  project: Project,
  ppm: number,
  light: IndustrialLight,
  glow = false,
) {
  const p = project(light.centre);
  const a = project({ x: light.centre.x - 0.65, y: light.centre.y });
  const b = project({ x: light.centre.x + 0.65, y: light.centre.y });
  const lift = light.sourceZ! * ppm;
  const line = (from: Point, to: Point, color: string, width: number) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(from.x, from.y - lift);
    ctx.lineTo(to.x, to.y - lift);
    ctx.stroke();
  };
  if (!glow) {
    line(a, { x: a.x, y: a.y - ppm * 0.48 }, "#4c585b", 0.7);
    line(b, { x: b.x, y: b.y - ppm * 0.48 }, "#4c585b", 0.7);
    line(a, b, "#19272d", ppm * 0.19);
    line({ x: a.x, y: a.y - 1 }, { x: b.x, y: b.y - 1 }, "#899695", ppm * 0.08);
    line({ x: a.x, y: a.y + 1 }, { x: b.x, y: b.y + 1 }, "#b8bdab", ppm * 0.055);
  } else {
    const color = light.color.map((c) => Math.round(c * 255)).join(",");
    line(a, b, `rgba(${color},.85)`, ppm * 0.065);
    const halo = ctx.createRadialGradient(p.x, p.y - lift, 0, p.x, p.y - lift, ppm * 0.85);
    halo.addColorStop(0, `rgba(${color},.11)`);
    halo.addColorStop(1, `rgba(${color},0)`);
    ctx.fillStyle = halo;
    ctx.fillRect(p.x - ppm, p.y - lift - ppm, ppm * 2, ppm * 2);
  }
}
