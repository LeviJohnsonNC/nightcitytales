/** Rooftop units: their contact shade and their detail. See `../storefront.ts`. */
import type { Point, Rect } from "@/engine";
import { gradientFill, path, strokeLine } from "./draw";
import type { Project } from "./model";

/** A soft contact shadow on the roof along the two sides of a rooftop unit the camera sees. */
export function paintRoofShade(
  ctx: CanvasRenderingContext2D,
  project: Project,
  ppm: number,
  eq: Rect,
  roofH: number,
) {
  const roof = (x: number, y: number): Point => {
    const p = project({ x, y });
    return { x: p.x, y: p.y - roofH };
  };
  const reach = 0.7;
  const north = [
    roof(eq.x, eq.y),
    roof(eq.x + eq.width, eq.y),
    roof(eq.x + eq.width, eq.y - reach),
    roof(eq.x, eq.y - reach),
  ];
  const east = [
    roof(eq.x + eq.width, eq.y),
    roof(eq.x + eq.width, eq.y + eq.height),
    roof(eq.x + eq.width + reach, eq.y + eq.height),
    roof(eq.x + eq.width + reach, eq.y),
  ];
  gradientFill(ctx, north, roof(eq.x, eq.y), roof(eq.x, eq.y - reach), [
    [0, "rgba(4,8,10,.6)"],
    [1, "rgba(4,8,10,0)"],
  ]);
  gradientFill(ctx, east, roof(eq.x + eq.width, eq.y), roof(eq.x + eq.width + reach, eq.y), [
    [0, "rgba(4,8,10,.5)"],
    [1, "rgba(4,8,10,0)"],
  ]);
}

/**
 * Detail on an existing rooftop unit, drawn over its prism: a rimmed lid, a fan with
 * blades and a grille, louvres down its two visible sides, a rust streak, and on
 * every other unit a vent stack. The unit's footprint and height are the renderer's;
 * this adds only what sits on it.
 */
export function paintRooftopUnit(
  ctx: CanvasRenderingContext2D,
  project: Project,
  ppm: number,
  eq: Rect,
  roofH: number,
  lidLift: number,
  index: number,
) {
  const lidH = roofH + lidLift;
  const at = (x: number, y: number, lift: number): Point => {
    const p = project({ x, y });
    return { x: p.x, y: p.y - lift };
  };
  // lid rim
  const inset = 0.14;
  const rim = [
    at(eq.x + inset, eq.y + inset, lidH),
    at(eq.x + eq.width - inset, eq.y + inset, lidH),
    at(eq.x + eq.width - inset, eq.y + eq.height - inset, lidH),
    at(eq.x + inset, eq.y + eq.height - inset, lidH),
  ];
  path(ctx, rim);
  ctx.strokeStyle = "rgba(10,16,20,.7)";
  ctx.lineWidth = 1;
  ctx.stroke();
  strokeLine(ctx, rim[0]!, rim[3]!, "rgba(190,200,196,.35)", 0.8);
  strokeLine(ctx, rim[0]!, rim[1]!, "rgba(190,200,196,.35)", 0.8);
  // louvres on the two faces the camera sees
  for (const f of [0.28, 0.5, 0.72]) {
    const z = roofH + lidLift * f;
    strokeLine(
      ctx,
      at(eq.x + 0.2, eq.y, z),
      at(eq.x + eq.width - 0.2, eq.y, z),
      "rgba(8,14,18,.55)",
      0.9,
    );
    strokeLine(
      ctx,
      at(eq.x + eq.width, eq.y + 0.2, z),
      at(eq.x + eq.width, eq.y + eq.height - 0.2, z),
      "rgba(8,14,18,.55)",
      0.9,
    );
  }
  // fan: a world-space circle, so it is the right ellipse for this camera
  const cx = eq.x + eq.width / 2;
  const cy = eq.y + eq.height / 2;
  const c0 = at(cx, cy, lidH);
  const ex = at(cx + 1, cy, lidH);
  const ey = at(cx, cy + 1, lidH);
  ctx.save();
  ctx.transform(ex.x - c0.x, ex.y - c0.y, ey.x - c0.x, ey.y - c0.y, c0.x, c0.y);
  ctx.beginPath();
  ctx.arc(0, 0, 0.66, 0, Math.PI * 2);
  ctx.fillStyle = "#151e23";
  ctx.fill();
  ctx.strokeStyle = "rgba(150,164,164,.55)";
  ctx.lineWidth = 0.035;
  ctx.stroke();
  const turn = index * 0.5;
  for (let k = 0; k < 5; k++) {
    const a = turn + (k * Math.PI * 2) / 5;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(a) * 0.56, Math.sin(a) * 0.56);
    ctx.strokeStyle = "#35444b";
    ctx.lineWidth = 0.12;
    ctx.lineCap = "round";
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(0, 0, 0.12, 0, Math.PI * 2);
  ctx.fillStyle = "#6c7b7e";
  ctx.fill();
  ctx.strokeStyle = "rgba(150,164,164,.4)";
  ctx.lineWidth = 0.03;
  for (const r of [0.24, 0.42]) {
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
  // a rust streak down the camera-facing side
  const sx = eq.x + eq.width * (0.3 + (0.35 * ((index * 7) % 3)) / 2);
  strokeLine(ctx, at(sx, eq.y, lidH - 1), at(sx, eq.y, roofH + 1), "rgba(122,74,42,.38)", 1.4);
  // every other unit has a vent stack beside it
  if (index % 2 === 1) {
    const vx = eq.x + eq.width - 0.45;
    const vy = eq.y + 0.5;
    const top = lidH + 0.7 * ppm;
    strokeLine(ctx, at(vx, vy, lidH), at(vx, vy, top), "#2a363b", 4);
    strokeLine(ctx, at(vx - 0.03, vy, lidH), at(vx - 0.03, vy, top), "#6f7e82", 1.2);
    const cap = at(vx, vy, top);
    ctx.beginPath();
    ctx.ellipse(cap.x, cap.y, 4.2, 2.1, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#4a585d";
    ctx.fill();
    ctx.strokeStyle = "#151e23";
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }
}
