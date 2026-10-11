/** The storefront's shadows and lights on the ground. See `../storefront.ts`. */
import type { Point, SceneStructure } from "@/engine";
import {
  INTERSECTION_NIGHT,
  paintGroundLight,
  type GroundLight,
  type NightLighting,
} from "../nightLighting";
import { STOREFRONT_FACE } from "../storefrontPack";
import { bladeSign } from "./blade";
import { gradientFill } from "./draw";
import { streetLamp } from "./lamp";
import { faceWorld, type Pass, type Project, type Storefront } from "./model";

export interface GroundOptions {
  ctx: CanvasRenderingContext2D;
  sf: Storefront;
  project: Project;
  ppm: number;
  structures: readonly SceneStructure[];
  pass: Pass;
}

/** A ground-plane polygon from world points. */
const groundPoly = (project: Project, pts: Point[]) => pts.map(project);

/** Clip to the whole ground except the footprints of buildings: light and shade
 * fall on pavement, never through a building into its cutaway floor. */
function clipToOpenGround(
  ctx: CanvasRenderingContext2D,
  project: Project,
  structures: readonly SceneStructure[],
) {
  ctx.beginPath();
  ctx.rect(-4000, -4000, 8000, 8000);
  for (const s of structures) {
    if (s.style === "interior-wall" || s.style === "mesh-fence") continue;
    const r = s.rect;
    const pts = groundPoly(project, [
      { x: r.x, y: r.y },
      { x: r.x + r.width, y: r.y },
      { x: r.x + r.width, y: r.y + r.height },
      { x: r.x, y: r.y + r.height },
    ]);
    pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
  }
  ctx.clip("evenodd");
}

/**
 * The shop's lights on the ground, in world metres: a warm fan out of each window,
 * a pool under the entrance's downlight, and the streetlight's pool under its head.
 * The ground's light sprite and the tint of everyone standing in them both read this.
 */
export function storefrontLights(sf: Storefront, night: NightLighting): GroundLight[] {
  const o = faceWorld(sf, 0, 0);
  const a = faceWorld(sf, 1, 0);
  const b = faceWorld(sf, 0, 1);
  const along = { x: a.x - o.x, y: a.y - o.y };
  const out = { x: b.x - o.x, y: b.y - o.y };
  const lights: GroundLight[] = sf.litBays.map((s0) => ({
    kind: "spill",
    origin: o,
    along,
    out,
    s0,
    s1: s0 + STOREFRONT_FACE.bayWidth,
    reach: night.window.reach,
    spread: night.window.spread,
    color: night.window.color,
    intensity: night.window.intensity,
  }));
  lights.push({
    kind: "pool",
    centre: faceWorld(sf, sf.door, night.entrance.out),
    radius: night.entrance.radius,
    color: night.entrance.color,
    intensity: night.entrance.intensity,
  });
  const blade = bladeSign(sf);
  if (blade)
    lights.push({
      kind: "pool",
      centre: faceWorld(sf, blade.s, (blade.out0 + blade.out1) / 2),
      sourceZ: (blade.z0 + blade.z1) / 2,
      ...night.blade,
    });
  const lamp = streetLamp(sf);
  if (lamp)
    lights.push({
      kind: "pool",
      centre: lamp.head,
      radius: night.lamp.radius,
      color: night.lamp.color,
      intensity: night.lamp.intensity,
    });
  return lights;
}

/**
 * Painted into the ground canvas: in the albedo, the contact shadow along the
 * building's base and the awning's shadow on the pavement; in the light pass, the
 * shop's lights. All of it falls on open pavement only, never into a footprint.
 */
export function paintStorefrontGround(o: GroundOptions) {
  const { ctx, sf, project } = o;
  if (o.pass === "glow") return;
  const across = (s: number, out: number) => project(faceWorld(sf, s, out));
  ctx.save();
  clipToOpenGround(ctx, project, o.structures);
  if (o.pass === "light") {
    for (const light of storefrontLights(sf, INTERSECTION_NIGHT))
      paintGroundLight(ctx, project, light);
    ctx.restore();
    return;
  }

  // contact shadow along the wall's foot, 0.8 m deep, darkest at the wall
  {
    const strip = groundPoly(project, [
      faceWorld(sf, 0, 0),
      faceWorld(sf, sf.length, 0),
      faceWorld(sf, sf.length, 0.8),
      faceWorld(sf, 0, 0.8),
    ]);
    gradientFill(ctx, strip, across(0, 0), across(0, 0.8), [
      [0, "rgba(2,6,9,.72)"],
      [0.3, "rgba(2,6,9,.3)"],
      [1, "rgba(2,6,9,0)"],
    ]);
  }
  // the awning: a shadow on the pavement under and just beyond its edge
  {
    const { span, offset, projection } = sf.awning;
    const reach = projection + 0.9;
    const shade = groundPoly(project, [
      faceWorld(sf, offset - 0.1, 0),
      faceWorld(sf, offset + span + 0.1, 0),
      faceWorld(sf, offset + span + 0.5, reach),
      faceWorld(sf, offset + 0.5, reach),
    ]);
    gradientFill(ctx, shade, across(offset, 0), across(offset + 0.5, reach), [
      [0, "rgba(2,6,9,.52)"],
      [0.7, "rgba(2,6,9,.28)"],
      [1, "rgba(2,6,9,0)"],
    ]);
  }
  ctx.restore();
}
