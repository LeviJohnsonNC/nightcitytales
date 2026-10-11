/** Office presentation follows saved rooms; floors and lights add no geometry. */
import type { Point, Rect, SceneEnvironment } from "@/engine";
import { fillMaterial, groundBasis, type MaterialSet } from "./surfaceMaterials";
import type { IndustrialLight } from "./industrialFinish";

type Project = (p: Point) => Point;
export function paintOfficeFloor(
  ctx: CanvasRenderingContext2D,
  project: Project,
  r: Rect,
  kind: string,
  materials: MaterialSet,
) {
  const carpet = kind === "workspace",
    timber = kind === "meeting";
  const color = carpet
    ? "#52605b"
    : timber
      ? "#76634f"
      : kind === "reception"
        ? "#817a6b"
        : "#69716e";
  const points = [
    { x: r.x, y: r.y },
    { x: r.x + r.width, y: r.y },
    { x: r.x + r.width, y: r.y + r.height },
    { x: r.x, y: r.y + r.height },
  ].map(project);
  if (
    !fillMaterial(ctx, materials, points, {
      key: carpet || timber ? "painted-render" : "facade-concrete",
      basis: groundBasis(project),
      target: color,
      strength: carpet ? 0.36 : 0.45,
    })
  ) {
    ctx.beginPath();
    points.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
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
  const pitch = timber ? 0.35 : carpet ? 1 : 1.5;
  ctx.lineWidth = timber ? 0.017 : 0.012;
  ctx.strokeStyle = timber ? "rgba(31,26,22,.25)" : "rgba(19,29,28,.18)";
  for (let y = Math.floor(r.y / pitch) * pitch; y < r.y + r.height; y += pitch) {
    ctx.beginPath();
    ctx.moveTo(r.x, y);
    ctx.lineTo(r.x + r.width, y);
    ctx.stroke();
    if (timber) {
      const offset = Math.round(y / pitch) % 2;
      for (let x = r.x + offset; x < r.x + r.width; x += 2) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + pitch);
        ctx.stroke();
      }
    }
  }
  if (!timber)
    for (let x = Math.floor(r.x / pitch) * pitch; x < r.x + r.width; x += pitch) {
      ctx.beginPath();
      ctx.moveTo(x, r.y);
      ctx.lineTo(x, r.y + r.height);
      ctx.stroke();
    }
  // Carpet tiles change pile direction, without looking like paving slabs.
  if (carpet)
    for (let x = Math.floor(r.x); x < r.x + r.width; x++)
      for (let y = Math.floor(r.y); y < r.y + r.height; y++) {
        ctx.fillStyle = (x + y) % 2 ? "rgba(18,30,27,.025)" : "rgba(186,186,157,.018)";
        ctx.fillRect(x + 0.015, y + 0.015, 0.97, 0.97);
      }
  ctx.restore();
}
export function officeLights(env: SceneEnvironment): IndustrialLight[] {
  if (env.recipe !== "office" || !env.interior) return [];
  return env.zones
    .filter(
      (z) =>
        ["reception", "workspace", "meeting", "service", "corridor"].includes(z.kind) &&
        !z.floorUse,
    )
    .flatMap((z, room) => {
      const r = z.rect,
        alongY = r.height > r.width,
        length = alongY ? r.height : r.width;
      const count = Math.max(1, Math.ceil(length / 7));
      const warm = z.kind === "reception" || z.kind === "meeting";
      return Array.from({ length: count }, (_, i) => ({
        id: `office-panel-${room}-${i}`,
        kind: "pool" as const,
        bounds: r,
        centre: alongY
          ? { x: r.x + r.width / 2, y: r.y + (length * (i + 0.5)) / count }
          : { x: r.x + (length * (i + 0.5)) / count, y: r.y + r.height / 2 },
        sourceZ: 2.9,
        radius: Math.max(3.5, Math.min(7, Math.max(r.width, r.height) * 0.65)),
        color: warm ? ([1, 0.84, 0.65] as const) : ([0.84, 0.91, 0.96] as const),
        intensity: z.kind === "corridor" ? 0.15 : warm ? 0.29 : 0.26,
      }));
    });
}
export function paintOfficeFixture(
  ctx: CanvasRenderingContext2D,
  project: Project,
  ppm: number,
  light: IndustrialLight,
  glow = false,
) {
  const at = (x: number, y: number, z = 0) => {
    const p = project({ x: light.centre.x + x, y: light.centre.y + y });
    return { x: p.x, y: p.y - (light.sourceZ! + z) * ppm };
  };
  const poly = (w: number, d: number, z: number, color: string) => {
    const points = [at(-w, -d, z), at(w, -d, z), at(w, d, z), at(-w, d, z)];
    ctx.beginPath();
    points.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  };
  if (glow)
    poly(0.56, 0.18, -0.02, `rgba(${light.color.map((c) => Math.round(c * 255)).join(",")},.18)`);
  else {
    poly(0.65, 0.25, 0.035, "#313e41");
    poly(0.61, 0.22, 0, "#9ea59b");
    poly(0.56, 0.18, -0.02, "#838a7c");
  }
}
