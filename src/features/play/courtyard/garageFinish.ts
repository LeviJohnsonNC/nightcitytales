/** Flush wear inside existing vehicle footprints: never new props or obstacles. */
import type { Arena, Point } from "@/engine";
import { groundBasis } from "./surfaceMaterials";

export function paintGarageWear(
  ctx: CanvasRenderingContext2D,
  project: (p: Point) => Point,
  arena: Arena,
) {
  const env = arena.environment;
  if (env?.recipe !== "garage") return;
  const { origin, u, v } = groundBasis(project);
  ctx.save();
  ctx.transform(u.x, u.y, v.x, v.y, origin.x, origin.y);
  for (const prop of env.props) {
    if (prop.art !== "sedan-engine" && prop.art !== "sedan-cabin") continue;
    const cover = arena.cover?.find((c) => c.id === prop.coverId);
    if (!cover) continue;
    const r = cover.rect;
    ctx.save();
    ctx.beginPath();
    ctx.rect(r.x, r.y, r.width, r.height);
    ctx.clip();
    ctx.translate(r.x, r.y);
    if (prop.rotation === 90) {
      ctx.translate(r.width, 0);
      ctx.rotate(Math.PI / 2);
    }
    // Two scrubbed tyre tracks, irregular grease within the engine's footprint.
    for (const y of [0.27, 1.54]) {
      ctx.strokeStyle = "rgba(14,24,25,.24)";
      ctx.lineWidth = 0.16;
      ctx.beginPath();
      ctx.moveTo(0.08, y);
      ctx.bezierCurveTo(0.7, y + 0.03, 1.4, y - 0.02, 1.92, y);
      ctx.stroke();
    }
    if (prop.art === "sedan-engine") {
      for (let i = 0; i < 7; i++) {
        ctx.fillStyle = `rgba(30,30,23,${0.035 + (i % 3) * 0.014})`;
        ctx.beginPath();
        ctx.ellipse(
          0.55 + (i % 3) * 0.19,
          0.68 + Math.floor(i / 3) * 0.21,
          0.27,
          0.13 + i * 0.015,
          i * 0.5,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
    }
    ctx.restore();
  }
  ctx.restore();
}
