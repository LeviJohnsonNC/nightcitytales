/** Recessed upper rooms inside the saved commercial envelope. Ground collision,
 * entrances and inaccessible floor semantics stay with the original building. */
import type { Point, SceneStructure } from "@/engine";
import type { ArchitectureArt } from "./architecturePack";
import { paintRoofUnitArt, rooftopUnits } from "./architectureArt";
import { COMMERCIAL_BASE, hasCommercialUpper, paintCommercialUpper } from "./commercialUpper";
import { occupiedUse } from "./occupiedFrontage";
import { paintRoofShade } from "./storefront";
import { paintResidentialRoof } from "./residentialRoof";
import { fillMaterial, groundBasis, type MaterialSet } from "./surfaceMaterials";

export function commercialTerrace(s: SceneStructure): SceneStructure | undefined {
  if (!hasCommercialUpper(s) || occupiedUse(s) || Math.min(s.rect.width, s.rect.height) < 5) return;
  // The low corner has a broad terrace; its taller neighbour has a tighter ledge.
  const setback = s.height < 8 ? 1.35 : 0.8;
  return {
    ...s,
    rect: {
      x: s.rect.x + 0.2,
      y: s.rect.y + setback,
      width: s.rect.width - setback - 0.2,
      height: s.rect.height - setback - 0.2,
    },
    attachments: [],
  };
}

export function paintCommercialTerrace(
  ctx: CanvasRenderingContext2D,
  s: SceneStructure,
  upper: SceneStructure,
  project: (p: Point) => Point,
  ppm: number,
  materials: MaterialSet,
  art?: ArchitectureArt,
  roofMaterial: "roof-membrane" | "roof-ballast" = "roof-membrane",
) {
  const r = s.rect;
  const at = (x: number, y: number, z: number): Point => {
    const p = project({ x, y });
    return { x: p.x, y: p.y - z * ppm };
  };
  const path = (ps: Point[]) => {
    ctx.beginPath();
    ps.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
  };
  const poly = (ps: Point[], color: string) => {
    path(ps);
    ctx.fillStyle = color;
    ctx.fill();
  };
  const line = (a: Point, b: Point, color: string, width: number) => {
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.strokeStyle = color;
    ctx.lineWidth = width * ppm;
    ctx.stroke();
  };
  const corners = (b: SceneStructure["rect"], z: number) => [
    at(b.x, b.y, z),
    at(b.x + b.width, b.y, z),
    at(b.x + b.width, b.y + b.height, z),
    at(b.x, b.y + b.height, z),
  ];
  ctx.save();
  const deck = corners(r, COMMERCIAL_BASE);
  if (
    !fillMaterial(ctx, materials, deck, {
      key: "facade-concrete",
      basis: groundBasis(project, COMMERCIAL_BASE * ppm),
      target: "#777463",
      strength: 0.75,
    })
  )
    poly(deck, "#777463");
  // Broad wall-foot shadow grounds the recessed rooms on the exposed slab.
  const u = upper.rect;
  poly(
    [
      at(u.x, u.y, COMMERCIAL_BASE),
      at(u.x + u.width, u.y, COMMERCIAL_BASE),
      at(u.x + u.width + 0.42, u.y - 0.42, COMMERCIAL_BASE),
      at(u.x, u.y - 0.42, COMMERCIAL_BASE),
    ],
    "rgba(12,23,25,.38)",
  );
  poly(
    [
      at(u.x + u.width, u.y, COMMERCIAL_BASE),
      at(u.x + u.width, u.y + u.height, COMMERCIAL_BASE),
      at(u.x + u.width + 0.42, u.y + u.height, COMMERCIAL_BASE),
      at(u.x + u.width + 0.42, u.y - 0.42, COMMERCIAL_BASE),
    ],
    "rgba(12,23,25,.38)",
  );
  for (const edge of ["north", "east"] as const)
    paintCommercialUpper(ctx, upper, edge, project, ppm, materials, art);
  const units = rooftopUnits(upper);
  paintResidentialRoof(ctx, project, ppm, upper, materials, units, roofMaterial);
  if (art?.roofUnit)
    for (const unit of units) {
      paintRoofShade(ctx, project, ppm, unit, upper.height * ppm);
      paintRoofUnitArt(ctx, project, unit, upper.height * ppm, art.roofUnit);
    }

  // Low solid coping and open rail: a readable outdoor edge, never a new wall.
  for (const edge of ["north", "east"] as const) {
    const length = edge === "north" ? r.width : r.height;
    const p = (d: number, z: number) =>
      edge === "north" ? at(r.x + d, r.y, z) : at(r.x + r.width, r.y + d, z);
    poly(
      [
        p(0, COMMERCIAL_BASE - 0.17),
        p(length, COMMERCIAL_BASE - 0.17),
        p(length, COMMERCIAL_BASE + 0.12),
        p(0, COMMERCIAL_BASE + 0.12),
      ],
      edge === "north" ? "#8e8875" : "#626959",
    );
    line(p(0, COMMERCIAL_BASE + 0.12), p(length, COMMERCIAL_BASE + 0.12), "#b0ac94", 0.055);
    for (const z of [COMMERCIAL_BASE + 0.43, COMMERCIAL_BASE + 0.9])
      line(p(0.12, z), p(length - 0.12, z), "#738277", 0.04);
    for (let d = 0.18; d < length; d += 1.25)
      line(p(d, COMMERCIAL_BASE + 0.12), p(d, COMMERCIAL_BASE + 0.91), "#5b6d66", 0.045);
  }
  ctx.restore();
}
