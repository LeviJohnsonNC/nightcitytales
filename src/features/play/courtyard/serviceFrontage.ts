/** Alley service entrances. Art and emission stay inside the saved doorway. */
import type { Point, SceneEnvironment, SceneStructure } from "@/engine";
import type { ArchitectureArt } from "./architecturePack";
import { facadeOpenings } from "./architectureArt";
import { facePainter } from "./buildingFaces";
import { paintFaceAsset } from "./afterRainArt";
import type { Edge } from "./frontage";

export function serviceDoors(
  s: SceneStructure,
  edge: Edge,
  entrances: SceneEnvironment["entrances"],
) {
  const { length, doors } = facadeOpenings(s, entrances, edge);
  return doors.flatMap((c) => {
    const fitting = s.attachments?.find(
      (a) =>
        a.edge === edge &&
        (a.id === "alley-workroom" || a.id.startsWith("alley-receiving-")) &&
        Math.abs(a.offset + a.span / 2 - c) < 0.01,
    );
    return fitting && c >= 0.9 && c <= length - 0.9
      ? [{ c, warm: fitting.id === "alley-workroom" }]
      : [];
  });
}
export function hasServiceFrontage(s: SceneStructure) {
  return (
    s.attachments?.some((a) => a.id === "alley-workroom" || a.id.startsWith("alley-receiving-")) ??
    false
  );
}
export function paintServiceFrontage(
  ctx: CanvasRenderingContext2D,
  s: SceneStructure,
  edge: Edge,
  entrances: SceneEnvironment["entrances"],
  project: (p: Point) => Point,
  ppm: number,
  pass: "albedo" | "light" | "glow",
  art?: ArchitectureArt,
) {
  const { at, quad } = facePainter(s, edge, project, ppm);
  const fill = (points: Point[], color: string) => {
    ctx.beginPath();
    points.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  };
  const panel = (a: number, b: number, lo: number, hi: number, color: string, out = 0.07) =>
    fill(quad(a, b, lo, hi, out), color);
  for (const { c, warm } of serviceDoors(s, edge, entrances)) {
    const a = c - 0.78,
      b = c + 0.78,
      top = Math.min(2.35, s.height - 0.5);
    if (pass === "glow") {
      panel(c - 0.62, c + 0.62, top + 0.13, top + 0.18, warm ? "#ffe0a1" : "#a9d9e4", 0.14);
      continue;
    }
    if (pass === "light") {
      // Only the open room emits; receiving shutters reflect light but emit none.
      if (warm) panel(a + 0.05, b - 0.05, 0.08, top - 0.1, "rgba(255,194,111,.48)", -0.04);
      continue;
    }
    panel(a - 0.12, b + 0.12, 0.02, top + 0.3, "#17282c");
    if (warm) {
      ctx.save();
      ctx.beginPath();
      quad(a, b, 0.04, top).forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.closePath();
      ctx.clip();
      panel(a, b, 0.04, top, "#594b33", -0.25);
      paintFaceAsset(ctx, art?.repairOpenRoom, at, a, b, 0.04, top, -0.05);
      fill([at(a, 0, 0.04), at(a, 0, top), at(a, -0.25, top), at(a, -0.25, 0.04)], "#796b4c");
      fill([at(a, 0, top), at(b, 0, top), at(b, -0.25, top), at(a, -0.25, top)], "#182624");
      fill([at(a, 0, 0.05), at(b, 0, 0.05), at(b, -0.3, 0.05), at(a, -0.3, 0.05)], "#a08b65");
      ctx.restore();
    } else {
      panel(a, b, 0.02, top, "#4c5a58");
      paintFaceAsset(ctx, art?.repairShutter, at, a, b, 0.02, top, 0.02);
    }
    for (const x of [a - 0.08, b]) panel(x, x + 0.08, 0.02, top + 0.3, "#969687", 0.1);
    panel(a - 0.12, b + 0.12, top, top + 0.3, "#344343", 0.12);
    panel(c - 0.62, c + 0.62, top + 0.13, top + 0.18, warm ? "#c6b58f" : "#94adb0", 0.14);
    panel(a - 0.08, b + 0.08, 0.02, 0.08, "#9b9274", 0.14);
    // Small enamel trade plate, above the housing; no floating neon billboard.
    if (top + 0.7 < s.height) {
      panel(a, b, top + 0.38, top + 0.68, warm ? "#60533d" : "#354d55");
      const p = at(a, 0.09, top + 0.65),
        q = at(b, 0.09, top + 0.65);
      ctx.save();
      ctx.transform((q.x - p.x) / (b - a), (q.y - p.y) / (b - a), 0, ppm, p.x, p.y);
      ctx.font = "600 0.16px monospace";
      ctx.textAlign = "center";
      ctx.fillStyle = "#c6c2a5";
      ctx.fillText(warm ? "SERVICE / 24" : "RECEIVING", (b - a) / 2, 0.17, b - a - 0.12);
      ctx.restore();
    }
  }
}
