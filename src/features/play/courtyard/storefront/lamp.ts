/** The saved streetlight beside the shop. See `../storefront.ts`. */
import type { Point } from "@/engine";
import { INTERSECTION_NIGHT, type NightLighting } from "../nightLighting";
import { fillPoly, hull, path, strokeLine } from "./draw";
import { faceWorld, type Pass, type Project, type Storefront } from "./model";

/**
 * The saved streetlight's shape, from its saved ground position: a pole, and an arm
 * out from the facade over the pavement to a head. The pool it throws is centred
 * under the head, so the light and its source are one thing. `s` and `out` place the
 * head in the storefront's own face coordinates.
 */
export function streetLamp(sf: Storefront, night: NightLighting = INTERSECTION_NIGHT) {
  if (!sf.lamp) return undefined;
  const o = faceWorld(sf, 0, 0);
  const b = faceWorld(sf, 0, 1);
  const arm = sf.arm ?? {
    dir: { x: b.x - o.x, y: b.y - o.y },
    length: night.lamp.arm,
    clear: false,
  };
  const out = arm.dir;
  const head = { x: sf.lamp.x + out.x * arm.length, y: sf.lamp.y + out.y * arm.length };
  const r = sf.structure.rect;
  const s = sf.edge === "north" ? head.x - r.x : head.y - r.y;
  const outM = sf.edge === "north" ? r.y - head.y : head.x - (r.x + r.width);
  return {
    base: sf.lamp,
    head,
    /** World unit vector from the pole toward the head. */
    out,
    reach: arm.length,
    poleZ: night.lamp.poleHeight,
    headZ: night.lamp.poleHeight - 0.15,
    /** The head in face coordinates: metres along the face, and out from it. */
    s,
    outM,
  };
}

/**
 * The saved streetlight: a footing, a tapered pole, a curved arm and a flat
 * cobra head over the pavement. In the glow pass its lens is the one small bright
 * point, with a tight halo; the light it throws is painted where it falls (the
 * ground, the wall, the awning), never here.
 */
export function paintStreetLamp(
  ctx: CanvasRenderingContext2D,
  project: Project,
  ppm: number,
  sf: Storefront,
  pass: Pass,
) {
  const lamp = streetLamp(sf);
  if (!lamp || pass === "light") return;
  const at = (p: Point, z: number) => {
    const q = project(p);
    return { x: q.x, y: q.y - z * ppm };
  };
  const along = (t: number): Point => ({
    x: lamp.base.x + lamp.out.x * t,
    y: lamp.base.y + lamp.out.y * t,
  });
  // the head: 0.9 m long along the arm, 0.32 m wide, 0.16 m deep
  const side = { x: -lamp.out.y, y: lamp.out.x };
  const corner = (t: number, w: number, z: number) =>
    at({ x: along(t).x + side.x * w, y: along(t).y + side.y * w }, z);
  const reach = lamp.reach;
  const h0 = reach - 0.55;
  const h1 = reach + 0.35;
  const zTop = lamp.headZ + 0.12;
  const zBot = lamp.headZ - 0.04;
  if (pass === "glow") {
    // a faint cone from the lens to the pavement ties the fixture to its pool
    const lensMid = at(along((h0 + h1) / 2 + 0.05), zBot);
    const pool = INTERSECTION_NIGHT.lamp.radius * 0.38;
    const footL = at({ x: lamp.head.x - side.x * pool, y: lamp.head.y - side.y * pool }, 0);
    const footR = at({ x: lamp.head.x + side.x * pool, y: lamp.head.y + side.y * pool }, 0);
    const cone = ctx.createLinearGradient(lensMid.x, lensMid.y, lensMid.x, (footL.y + footR.y) / 2);
    cone.addColorStop(0, "rgba(255,214,150,.09)");
    cone.addColorStop(0.5, "rgba(255,204,140,.03)");
    cone.addColorStop(1, "rgba(255,200,130,0)");
    // a haze, not a solid: no hard boundary for the eye to find
    ctx.save();
    ctx.filter = `blur(${Math.max(2, ppm * 0.35)}px)`;
    path(ctx, [
      { x: lensMid.x - 3, y: lensMid.y },
      { x: lensMid.x + 3, y: lensMid.y },
      footR,
      footL,
    ]);
    ctx.fillStyle = cone;
    ctx.fill();
    ctx.restore();
    // the lens: one small, bright point under the head, with a tight halo
    const r = 0.7 * ppm;
    const g = ctx.createRadialGradient(lensMid.x, lensMid.y, 0, lensMid.x, lensMid.y, r);
    g.addColorStop(0, "rgba(255,222,166,.7)");
    g.addColorStop(0.3, "rgba(255,200,130,.2)");
    g.addColorStop(1, "rgba(255,190,120,0)");
    ctx.fillStyle = g;
    ctx.fillRect(lensMid.x - r, lensMid.y - r, r * 2, r * 2);
    strokeLine(
      ctx,
      corner(h0 + 0.3, 0, zBot),
      corner(h1 - 0.2, 0, zBot),
      "rgba(255,236,196,.95)",
      1.3,
    );
    return;
  }
  const base = at(lamp.base, 0);
  // contact shadow, footing and base plate
  ctx.beginPath();
  ctx.ellipse(base.x, base.y, 6.5, 2.8, 0, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(2,6,9,.5)";
  ctx.fill();
  const foot = (z: number, w: number) => [
    at({ x: lamp.base.x - w, y: lamp.base.y - w }, z),
    at({ x: lamp.base.x + w, y: lamp.base.y - w }, z),
    at({ x: lamp.base.x + w, y: lamp.base.y + w }, z),
    at({ x: lamp.base.x - w, y: lamp.base.y + w }, z),
  ];
  const f0 = foot(0, 0.16);
  const f1 = foot(0.35, 0.16);
  fillPoly(ctx, [f0[0]!, f0[1]!, f1[1]!, f1[0]!], "#2a3539");
  fillPoly(ctx, [f0[1]!, f0[2]!, f1[2]!, f1[1]!], "#1a2327");
  fillPoly(ctx, f1, "#56646a");
  // a tapered pole, its edge caught by the light above it
  const top = at(lamp.base, lamp.poleZ);
  const low = at(lamp.base, 0.35);
  fillPoly(
    ctx,
    [
      { x: low.x - 2.2, y: low.y },
      { x: low.x + 2.2, y: low.y },
      { x: top.x + 1.3, y: top.y },
      { x: top.x - 1.3, y: top.y },
    ],
    "#141c20",
  );
  strokeLine(ctx, { x: low.x - 1.2, y: low.y }, { x: top.x - 0.6, y: top.y }, "#8c9a9c", 0.9);
  // the arm: a curve rising off the pole and settling onto the head
  const a0 = at(lamp.base, lamp.poleZ - 0.1);
  const a1 = at(along(reach * 0.35), lamp.poleZ + 0.18);
  const a2 = at(along(h0 + 0.05), lamp.headZ + 0.08);
  ctx.beginPath();
  ctx.moveTo(a0.x, a0.y);
  ctx.quadraticCurveTo(a1.x, a1.y, a2.x, a2.y);
  ctx.strokeStyle = "#141c20";
  ctx.lineWidth = 2.6;
  ctx.lineCap = "round";
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(a0.x, a0.y - 0.9);
  ctx.quadraticCurveTo(a1.x, a1.y - 0.9, a2.x, a2.y - 0.9);
  ctx.strokeStyle = "#7f8d90";
  ctx.lineWidth = 0.8;
  ctx.stroke();
  ctx.lineCap = "butt";
  // the cobra head: a low box, tapered toward its nose
  const topFace = [
    corner(h0, -0.13, zTop),
    corner(h1, -0.1, zTop - 0.04),
    corner(h1, 0.1, zTop - 0.04),
    corner(h0, 0.13, zTop),
  ];
  const sideA = [
    corner(h0, -0.16, zBot),
    corner(h1, -0.12, zBot),
    corner(h1, -0.1, zTop - 0.04),
    corner(h0, -0.13, zTop),
  ];
  const sideB = [
    corner(h0, 0.16, zBot),
    corner(h1, 0.12, zBot),
    corner(h1, 0.1, zTop - 0.04),
    corner(h0, 0.13, zTop),
  ];
  const nose = [
    corner(h1, -0.12, zBot),
    corner(h1, 0.12, zBot),
    corner(h1, 0.1, zTop - 0.04),
    corner(h1, -0.1, zTop - 0.04),
  ];
  const back = [
    corner(h0, -0.16, zBot),
    corner(h0, 0.16, zBot),
    corner(h0, 0.13, zTop),
    corner(h0, -0.13, zTop),
  ];
  for (const face of [back, sideA, sideB, nose]) fillPoly(ctx, face, "#1b2529");
  fillPoly(ctx, topFace, "#4b5a60");
  path(ctx, hull([...topFace, ...sideA, ...sideB]));
  ctx.strokeStyle = "#0a1013";
  ctx.lineWidth = 0.9;
  ctx.stroke();
  strokeLine(ctx, topFace[0]!, topFace[1]!, "#8d9b9e", 0.7);
  // unlit, the lens is a dull sliver of glass
  const lens = [
    corner(h0 + 0.1, -0.12, zBot),
    corner(h1 - 0.06, -0.12, zBot),
    corner(h1 - 0.06, 0.12, zBot),
    corner(h0 + 0.1, 0.12, zBot),
  ];
  strokeLine(ctx, lens[0]!, lens[1]!, "#80857a", 1);
}
