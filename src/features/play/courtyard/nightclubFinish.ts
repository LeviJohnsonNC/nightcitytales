/** Club finishes use saved room bounds; no new obstacles or moving light effects. */
import type { Point, Rect, SceneEnvironment } from "@/engine";
import { fillMaterial, groundBasis, type MaterialSet } from "./surfaceMaterials";
import type { IndustrialLight } from "./industrialFinish";

type Project = (p: Point) => Point;
export function paintNightclubFloor(
  ctx: CanvasRenderingContext2D,
  project: Project,
  r: Rect,
  kind: string,
  materials: MaterialSet,
) {
  const carpet = kind === "seating",
    timber = kind === "performance";
  const color = carpet
    ? "#493341"
    : timber
      ? "#514147"
      : kind === "reception"
        ? "#62564e"
        : kind === "dance"
          ? "#343743"
          : "#495050";
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
      strength: carpet ? 0.3 : 0.42,
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
  // Fine joints replace luminous square outlines. The lounge's carpet has no grout.
  if (!carpet) {
    const pitch = timber ? 0.35 : 1.5;
    ctx.strokeStyle = "rgba(8,12,18,.23)";
    ctx.lineWidth = 0.015;
    for (let y = r.y; y < r.y + r.height; y += pitch) {
      ctx.beginPath();
      ctx.moveTo(r.x, y);
      ctx.lineTo(r.x + r.width, y);
      ctx.stroke();
    }
    if (!timber)
      for (let x = r.x; x < r.x + r.width; x += pitch) {
        ctx.beginPath();
        ctx.moveTo(x, r.y);
        ctx.lineTo(x, r.y + r.height);
        ctx.stroke();
      }
  }
  // Restrained dry wear stays registered to the floor, not a rain/reflection overlay.
  for (let i = 0; i < 75; i++) {
    const x = r.x + ((i * 0.618034) % 1) * r.width,
      y = r.y + ((i * 0.414214) % 1) * r.height;
    ctx.strokeStyle = i % 3 ? "rgba(8,10,18,.07)" : "rgba(192,177,181,.075)";
    ctx.lineWidth = 0.012;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 0.12 + (i % 5) * 0.09, y + 0.025);
    ctx.stroke();
  }
  ctx.restore();
}
export function nightclubLights(env: SceneEnvironment): IndustrialLight[] {
  if (env.recipe !== "nightclub" || !env.interior) return [];
  return env.zones
    .filter(
      (z) =>
        !z.floorUse &&
        ["reception", "seating", "performance", "dance", "service", "corridor"].includes(z.kind),
    )
    .flatMap((z, room) => {
      const r = z.rect,
        alongY = r.height > r.width,
        length = alongY ? r.height : r.width;
      const club = z.kind === "dance" || z.kind === "performance";
      const warm = z.kind === "seating" || z.kind === "reception" || z.id === "bar";
      const count = Math.max(club ? 2 : 1, Math.ceil(length / 7));
      return Array.from({ length: count }, (_, i) => ({
        id: `club-strip-${room}-${i}`,
        kind: "pool" as const,
        bounds: r,
        centre: alongY
          ? { x: r.x + r.width / 2, y: r.y + (length * (i + 0.5)) / count }
          : { x: r.x + (length * (i + 0.5)) / count, y: r.y + r.height / 2 },
        sourceZ: 2.8,
        radius: Math.max(3.5, Math.min(7, Math.max(r.width, r.height) * 0.65)),
        color: club
          ? i % 2
            ? ([0.25, 0.72, 1] as const)
            : ([1, 0.18, 0.5] as const)
          : warm
            ? ([1, 0.68, 0.4] as const)
            : ([0.66, 0.81, 0.86] as const),
        intensity: club ? 0.48 : z.kind === "corridor" ? 0.13 : warm ? 0.3 : 0.22,
      }));
    });
}
