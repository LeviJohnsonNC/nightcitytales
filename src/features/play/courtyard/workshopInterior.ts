/** Shallow workshop elevations, in metres. Equipment stays behind the display glass. */
import type { facePainter } from "./buildingFaces";

export function paintWorkshopInterior(
  ctx: CanvasRenderingContext2D,
  face: ReturnType<typeof facePainter>,
  a: number,
  b: number,
  variant: "bench" | "storage",
) {
  const { at } = face;
  const p = at(a, -0.12, 2.48),
    q = at(b, -0.12, 2.48),
    bottom = at(a, -0.12, 0.72);
  ctx.save();
  // Normalised elevation coordinates let the narrow street windows and wide return
  // share equipment proportions without stretching every tool across the whole bay.
  const width = b - a,
    height = 1.76;
  ctx.transform(
    (q.x - p.x) / width,
    (q.y - p.y) / width,
    (bottom.x - p.x) / height,
    (bottom.y - p.y) / height,
    p.x,
    p.y,
  );
  ctx.beginPath();
  ctx.rect(0, 0, width, height);
  ctx.clip();
  const box = (x: number, y: number, w: number, h: number, c: string) => {
    ctx.fillStyle = c;
    ctx.fillRect(x, y, w, h);
  };
  const line = (x: number, y: number, xx: number, yy: number, c: string, w = 0.018) => {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(xx, yy);
    ctx.strokeStyle = c;
    ctx.lineWidth = w;
    ctx.stroke();
  };
  const circle = (x: number, y: number, r: number, c: string) => {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = c;
    ctx.fill();
  };
  const wall = ctx.createLinearGradient(0, 0, 0, height);
  wall.addColorStop(0, "#292f2b");
  wall.addColorStop(0.48, "#655e45");
  wall.addColorStop(1, "#242e2e");
  ctx.fillStyle = wall;
  ctx.fillRect(0, 0, width, height);
  for (let x = 0.06; x < width; x += 0.16)
    for (let y = 0.16; y < 0.95; y += 0.15) circle(x, y, 0.009, "#343d33");
  // Deep timber worktop, steel kickspace and mismatched drawers.
  box(0.04, 1.12, width - 0.08, 0.64, "#273631");
  for (let x = 0.07; x < width - 0.2; x += 0.48) {
    box(x, 1.2, Math.min(0.43, width - x - 0.05), 0.46, x % 1 < 0.5 ? "#4b5144" : "#3e4842");
    for (const y of [1.23, 1.41]) {
      line(x, y, Math.min(x + 0.4, width - 0.05), y, "#192b2b");
      box(x + 0.12, y + 0.07, 0.13, 0.018, "#99967e");
    }
  }
  box(0, 1.07, width, 0.09, "#a78c5f");
  box(0, 1.16, width, 0.035, "#302f27");
  const monitor = (x: number, y: number, scale = 1) => {
    box(x + 0.04 * scale, y + 0.32 * scale, 0.3 * scale, 0.08 * scale, "#293430");
    box(x, y, 0.43 * scale, 0.33 * scale, "#8a8d76");
    box(x + 0.04 * scale, y + 0.035 * scale, 0.32 * scale, 0.25 * scale, "#152e30");
    box(x + 0.055 * scale, y + 0.05 * scale, 0.29 * scale, 0.2 * scale, "#527b70");
    line(x + 0.065 * scale, y + 0.17 * scale, x + 0.29 * scale, y + 0.12 * scale, "#a4c1a0", 0.013);
    circle(x + 0.395 * scale, y + 0.26 * scale, 0.015 * scale, "#e3b968");
  };
  if (variant === "bench") {
    monitor(0.12, 0.63, Math.min(1.2, width / 0.8));
    if (width > 2) {
      // Open receiver, copper windings, bench magnifier and a coiled lead.
      box(width * 0.48, 0.89, 0.64, 0.17, "#1d302e");
      box(width * 0.48 + 0.04, 0.88, 0.53, 0.055, "#79846a");
      for (let x = width * 0.48 + 0.09; x < width * 0.48 + 0.5; x += 0.09)
        box(x, 0.82, 0.05, 0.09, "#b88e50");
      line(width * 0.7, 1.05, width * 0.74, 0.54, "#b2b6a2", 0.045);
      line(width * 0.74, 0.54, width * 0.61, 0.39, "#b2b6a2", 0.035);
      circle(width * 0.6, 0.39, 0.09, "#343d36");
      circle(width * 0.6, 0.39, 0.055, "#acbaa3");
      ctx.beginPath();
      ctx.ellipse(width * 0.8, 0.99, 0.18, 0.045, 0, 0, Math.PI * 2);
      ctx.strokeStyle = "#151f23";
      ctx.lineWidth = 0.025;
      ctx.stroke();
    }
    // A few different tools with negative space between them.
    for (const [x, y] of [
      [width * 0.45, 0.22],
      [width * 0.62, 0.29],
      [width * 0.83, 0.18],
    ]) {
      line(x!, y!, x! - 0.025, y! + 0.28, "#b5b59a", 0.025);
      box(x! - 0.045, y! + 0.21, 0.065, 0.14, "#775d43");
      line(x! - 0.07, y!, x! + 0.045, y!, "#b5b59a", 0.04);
    }
  } else {
    // Parts shelving: shallow labelled bins above one dismantled speaker.
    for (const y of [0.28, 0.63]) {
      for (let x = 0.08; x < width - 0.18; x += 0.29) {
        box(x, y, 0.24, 0.21, "#535e52");
        box(x + 0.02, y + 0.05, 0.2, 0.14, "#293d39");
        box(x + 0.055, y + 0.13, 0.09, 0.045, "#c2b28b");
      }
      box(0.02, y + 0.21, width - 0.04, 0.045, "#9b9275");
    }
    box(0.1, 0.79, 0.32, 0.28, "#574736");
    circle(0.26, 0.93, 0.11, "#1a292b");
    circle(0.26, 0.93, 0.055, "#777666");
    if (width > 0.8) {
      box(width - 0.35, 0.85, 0.25, 0.22, "#847963");
      line(width - 0.33, 0.91, width - 0.13, 0.91, "#362f28");
    }
  }
  // Paper job cards, task-light housing and a dusty glass highlight.
  box(width - 0.24, 0.05, 0.16, 0.19, "#b7a47c");
  for (const y of [0.1, 0.14, 0.18]) line(width - 0.22, y, width - 0.11, y, "#655942", 0.012);
  box(0.09, 0.055, Math.min(width - 0.18, 1.15), 0.045, "#cfbc8c");
  box(0, 0, 0.035, height, "#a6a58b");
  ctx.beginPath();
  ctx.moveTo(width * 0.7, 0);
  ctx.lineTo(width * 0.83, 0);
  ctx.lineTo(width * 0.43, height);
  ctx.lineTo(width * 0.37, height);
  ctx.closePath();
  ctx.fillStyle = "rgba(171,198,189,.07)";
  ctx.fill();
  ctx.restore();
}
