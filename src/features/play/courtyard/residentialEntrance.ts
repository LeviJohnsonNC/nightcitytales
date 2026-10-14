/** Saved door finishes only: no new openings, collision or projecting street props. */
import type { SceneStructure, Point } from "@/engine";
import type { facePainter } from "./buildingFaces";
import { hash, type Edge } from "./frontage";

export function residentialEntranceStyle(s: SceneStructure, edge: Edge, centre: number) {
  return (["glazed", "security", "vestibule"] as const)[
    Math.floor(hash(s.rect.x, s.rect.y, centre, edge === "north" ? 17 : 43) * 3)
  ]!;
}

export function paintResidentialEntrance(
  ctx: CanvasRenderingContext2D,
  face: ReturnType<typeof facePainter>,
  s: SceneStructure,
  edge: Edge,
  c: number,
  pass: "albedo" | "glow",
) {
  const style = residentialEntranceStyle(s, edge, c);
  if (style === "glazed") return; // Existing painted glass-door asset and its emission.
  const top = Math.min(2.2, s.height - 0.5);
  const fill = (points: Point[], color: string) => {
    ctx.beginPath();
    points.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  };
  const panel = (a: number, b: number, lo: number, hi: number, color: string) =>
    fill(face.quad(c + a, c + b, lo, hi, 0.018), color);
  const panes =
    style === "security"
      ? [[-0.45, 0.45, top - 0.46, top - 0.15]]
      : [
          [-0.62, -0.08, 0.75, top - 0.2],
          [0.08, 0.62, 0.75, top - 0.2],
        ];
  if (pass === "glow") {
    for (const [a, b, lo, hi] of panes) panel(a!, b!, lo!, hi!, "rgba(255,200,128,.58)");
    return;
  }
  panel(-0.92, 0.92, 0, top + 0.3, style === "security" ? "#626960" : "#857362");
  panel(-0.78, 0.78, 0, top + 0.1, "#111e24");
  panel(-0.7, 0.7, 0.07, top, style === "security" ? "#405653" : "#423c38");
  if (style === "security") {
    for (const z of [0.28, 0.73, 1.18]) {
      panel(-0.57, 0.57, z, z + 0.28, "#2a3b3b");
      panel(-0.54, 0.54, z + 0.02, z + 0.25, "#53635b");
    }
    panel(0.39, 0.46, 0.88, 1.16, "#b6b09a");
    panel(-0.51, -0.27, 1.22, 1.42, "#b7ab88");
  } else {
    // Paired leaves, kick plates and a shallow transom read as a shared lobby.
    for (const a of [-0.61, 0.09]) panel(a, a + 0.52, 0.16, 0.59, "#797769");
    panel(-0.035, 0.035, 0.08, top, "#b09a77");
    for (const a of [-0.16, 0.12]) panel(a, a + 0.035, 0.84, 1.18, "#c7b891");
    panel(-0.65, 0.65, top + 0.13, top + 0.22, "#342d28");
  }
  for (const [a, b, lo, hi] of panes) {
    panel(a!, b!, lo!, hi!, "#b79a69");
    panel(a! + 0.035, b! - 0.035, lo! + 0.035, hi! - 0.035, "#665943");
    panel(a! + 0.07, a! + 0.11, lo! + 0.06, hi! - 0.06, "#d2b880");
  }
}
