/** Residential roof construction inside the existing envelope; no saved geometry. */
import type { Point, Rect, SceneStructure } from "@/engine";
import { rooftopUnits } from "./architectureArt";
import { fillMaterial, groundBasis, type MaterialSet } from "./surfaceMaterials";

type Project = (p: Point) => Point;
const COPING = 0.3;
export const RESIDENTIAL_ROOF_RECESS = 0.24;

/** Internal drains, kept clear of the existing equipment and the parapet. */
export function residentialRoofDrains(s: SceneStructure): Point[] {
  const r = s.rect;
  const candidates = [
    { x: r.x + r.width - 0.75, y: r.y + r.height - 0.75 },
    { x: r.x + 0.75, y: r.y + r.height - 0.75 },
    { x: r.x + r.width - 0.75, y: r.y + 0.75 },
    { x: r.x + 0.75, y: r.y + 0.75 },
  ];
  return candidates
    .filter((p) =>
      rooftopUnits(s).every(
        (u) =>
          p.x < u.x - 0.5 ||
          p.x > u.x + u.width + 0.5 ||
          p.y < u.y - 0.5 ||
          p.y > u.y + u.height + 0.5,
      ),
    )
    .slice(0, r.width * r.height > 120 ? 2 : 1);
}

export function paintResidentialRoof(
  ctx: CanvasRenderingContext2D,
  project: Project,
  ppm: number,
  s: SceneStructure,
  materials: MaterialSet,
) {
  const r = s.rect,
    h = s.height,
    deck = h - RESIDENTIAL_ROOF_RECESS;
  const at = (x: number, y: number, z = deck): Point => {
    const p = project({ x, y });
    return { x: p.x, y: p.y - z * ppm };
  };
  const rect = (b: Rect, z = deck) => [
    at(b.x, b.y, z),
    at(b.x + b.width, b.y, z),
    at(b.x + b.width, b.y + b.height, z),
    at(b.x, b.y + b.height, z),
  ];
  const path = (p: Point[]) => {
    ctx.beginPath();
    p.forEach((v, i) => (i ? ctx.lineTo(v.x, v.y) : ctx.moveTo(v.x, v.y)));
    ctx.closePath();
  };
  const poly = (p: Point[], color: string) => {
    path(p);
    ctx.fillStyle = color;
    ctx.fill();
  };
  const line = (a: Point, b: Point, color: string, width: number) => {
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(0.35, width * ppm);
    ctx.stroke();
  };
  const inset: Rect = {
    x: r.x + COPING,
    y: r.y + COPING,
    width: r.width - 2 * COPING,
    height: r.height - 2 * COPING,
  };
  const outside = rect(r, h),
    inside = rect(inset, h),
    floor = rect(inset);
  ctx.save();
  // Neither lowered deck nor weathering can escape the original roof silhouette.
  path(outside);
  ctx.clip();
  poly(outside, "#444541");
  const surface = rect(r);
  if (
    !fillMaterial(ctx, materials, surface, {
      key: "roof-membrane",
      basis: groundBasis(project, deck * ppm),
      target: "#4d4c45",
      strength: 0.65,
    })
  )
    poly(surface, "#4d4c45");

  // Lapped membrane strips in metres, with staggered cross-joints, not a grid
  // stretched to the roof. Broad fields remain quiet at ordinary play scale.
  for (let x = inset.x + 1.2, lane = 0; x < inset.x + inset.width; x += 1.2, lane++) {
    if (lane % 2 === 0)
      poly(
        rect({ x: x - 1.2, y: inset.y, width: 1.2, height: inset.height }),
        "rgba(183,174,149,.035)",
      );
    line(at(x, inset.y), at(x, inset.y + inset.height), "rgba(14,18,18,.5)", 0.055);
    line(
      at(x + 0.045, inset.y),
      at(x + 0.045, inset.y + inset.height),
      "rgba(167,161,143,.18)",
      0.025,
    );
    for (let y = inset.y + 3 + (lane % 2) * 2.7; y < inset.y + inset.height; y += 6)
      line(at(x - 1.2, y), at(x, y), "rgba(14,18,18,.16)", 0.025);
  }

  // Small repaired lap joints on large roofs; both follow the membrane lanes.
  // Keep the annex quiet instead of scattering decorative rectangles everywhere.
  if (r.width * r.height > 120) {
    for (const [lane, run] of [
      [4, 6.1],
      [9, 3.4],
    ]) {
      const repair = {
        x: inset.x + lane! * 1.2 - 0.12,
        y: inset.y + run!,
        width: 1.44,
        height: 0.8,
      };
      if (
        repair.x + repair.width > inset.x + inset.width ||
        repair.y + repair.height > inset.y + inset.height
      )
        continue;
      if (
        rooftopUnits(s).some(
          (u) =>
            repair.x < u.x + u.width + 0.3 &&
            repair.x + repair.width > u.x - 0.3 &&
            repair.y < u.y + u.height + 0.3 &&
            repair.y + repair.height > u.y - 0.3,
        )
      )
        continue;
      poly(rect(repair), "rgba(20,26,24,.18)");
      line(
        at(repair.x, repair.y),
        at(repair.x + repair.width, repair.y),
        "rgba(156,154,137,.18)",
        0.035,
      );
    }
  }

  // Waterproofing repairs and raised curbs under the EXISTING equipment. The
  // units stay at their original height; the curb meets the recessed membrane.
  for (const u of rooftopUnits(s)) {
    const apron = { x: u.x - 0.16, y: u.y - 0.16, width: u.width + 0.32, height: u.height + 0.32 };
    poly(rect(apron), "rgba(27,31,29,.32)");
    const bottom = rect(u),
      top = rect(u, h);
    poly([bottom[0]!, bottom[1]!, top[1]!, top[0]!], "#373d3c");
    poly([bottom[1]!, bottom[2]!, top[2]!, top[1]!], "#2c3333");
    line(top[0]!, top[1]!, "#6f756e", 0.04);
  }
  for (const d of residentialRoofDrains(s)) {
    // Dry silt collecting at the low point: restrained concentric stains, no glow
    // or reflective puddle. A square strainer is projected on the roof plane.
    for (let n = 5; n >= 1; n--) {
      const radius = 0.16 + n * 0.075;
      poly(
        rect({ x: d.x - radius, y: d.y - radius, width: radius * 2, height: radius * 2 }),
        "rgba(23,26,23,.035)",
      );
    }
    poly(rect({ x: d.x - 0.19, y: d.y - 0.19, width: 0.38, height: 0.38 }), "#77766a");
    poly(rect({ x: d.x - 0.14, y: d.y - 0.14, width: 0.28, height: 0.28 }), "#242d2b");
    for (const t of [-0.08, 0, 0.08])
      line(at(d.x + t, d.y - 0.13), at(d.x + t, d.y + 0.13), "#5c645d", 0.025);
  }

  // The back two inner faces reveal the deck's drop. Near inner faces are hidden
  // by the parapet, while coping stays exactly at the existing building height.
  poly([inside[0]!, inside[3]!, floor[3]!, floor[0]!], "#44463f");
  poly([inside[3]!, inside[2]!, floor[2]!, floor[3]!], "#585b50");
  for (const [a, b] of [
    [floor[0]!, floor[3]!],
    [floor[3]!, floor[2]!],
    [inside[0]!, inside[1]!],
    [inside[1]!, inside[2]!],
  ])
    line(a!, b!, "rgba(9,15,14,.48)", 0.065);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    const strip = [outside[i]!, outside[j]!, inside[j]!, inside[i]!];
    const target = i < 2 ? "#898477" : "#767366";
    if (
      !fillMaterial(ctx, materials, strip, {
        key: "facade-concrete",
        basis: groundBasis(project, h * ppm),
        target,
        strength: 0.7,
      })
    )
      poly(strip, target);
    const length = i % 2 === 0 ? r.width : r.height;
    for (let distance = 1.2; distance < length - 0.25; distance += 1.2) {
      const t = distance / length;
      const lerp = (a: Point, b: Point) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
      line(
        lerp(outside[i]!, outside[j]!),
        lerp(inside[i]!, inside[j]!),
        "rgba(37,39,34,.45)",
        0.025,
      );
    }
    if (i < 2) line(outside[i]!, outside[j]!, "#a29b8a", 0.045);
  }
  ctx.restore();
}
