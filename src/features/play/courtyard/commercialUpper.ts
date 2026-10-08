import { paintFaceAsset } from "./afterRainArt";
/** Upper commercial storeys, derived only from the saved building envelope. */
import type { Point, SceneStructure } from "@/engine";
import type { ArchitectureArt } from "./architecturePack";
import { faceBasis, facePainter, paintHomeWindow, type Opening } from "./buildingFaces";
import { hash, type Edge } from "./frontage";
import { fillMaterial, type MaterialSet } from "./surfaceMaterials";

export const COMMERCIAL_BASE = 3.85;
export const hasCommercialUpper = (s: SceneStructure) => s.style === "shop" && s.height >= 6.8;

/** Office/room bays have a consistent structural rhythm across each elevation. */
export function commercialUpperWindows(s: SceneStructure, edge: Edge): Opening[] {
  if (!hasCommercialUpper(s)) return [];
  const length = edge === "north" ? s.rect.width : s.rect.height;
  const count = Math.floor((length - 0.8) / 3.2);
  if (!count) return [];
  const pitch = (length - 0.8) / count;
  const windows: Opening[] = [];
  for (let z = 4.45; z + 1.65 < s.height - 0.35; z += 3)
    for (let i = 0; i < count; i++) {
      const seed = hash(s.rect.x, s.rect.y, i, z, edge === "north" ? 1 : 2);
      const centre = 0.4 + (i + 0.5) * pitch;
      windows.push({
        kind: "window",
        s0: centre - 0.88,
        s1: centre + 0.88,
        z0: z,
        z1: z + 1.65,
        seed,
        occupancy: seed < 0.38 ? "blind" : seed < 0.7 ? "curtains" : "dark",
      });
    }
  return windows;
}

/** Same painter for a whole elevation and the retained portion on reveal. */
export function paintCommercialUpper(
  ctx: CanvasRenderingContext2D,
  s: SceneStructure,
  edge: Edge,
  project: (p: Point) => Point,
  ppm: number,
  materials: MaterialSet,
  art?: ArchitectureArt,
  clip?: { s0: number; s1: number; zMax: number },
) {
  if (!hasCommercialUpper(s) || (clip && clip.zMax <= COMMERCIAL_BASE)) return;
  const face = facePainter(s, edge, project, ppm);
  const { quad, at, length } = face;
  const path = (points: Point[]) => {
    ctx.beginPath();
    points.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
  };
  const fill = (points: Point[], colour: string) => {
    path(points);
    ctx.fillStyle = colour;
    ctx.fill();
  };
  ctx.save();
  path(
    quad(
      clip?.s0 ?? 0,
      clip?.s1 ?? length,
      COMMERCIAL_BASE,
      Math.min(s.height, clip?.zMax ?? s.height),
    ),
  );
  ctx.clip();
  const warm = s.height < 8;
  const wall = quad(0, length, COMMERCIAL_BASE, s.height);
  const target = edge === "north" ? (warm ? "#84765f" : "#58635d") : warm ? "#605947" : "#3d4946";
  if (
    !fillMaterial(ctx, materials, wall, {
      key: "painted-render",
      basis: faceBasis(s, edge, project, ppm, "painted-render"),
      target,
      strength: 0.8,
    })
  )
    fill(wall, target);
  const windows = commercialUpperWindows(s, edge);
  // A continuous stone frame with a deep spandrel over the trading floor.
  const band = (z: number) => {
    fill(quad(0, length, z - 0.12, z + 0.16), edge === "north" ? "#998b72" : "#706953");
    fill(quad(0, length, z - 0.3, z - 0.12), "rgba(12,16,16,.35)");
    fill(
      [
        at(0, 0, z + 0.16),
        at(length, 0, z + 0.16),
        at(length, 0.13, z + 0.16),
        at(0, 0.13, z + 0.16),
      ],
      "#a89b82",
    );
  };
  band(COMMERCIAL_BASE + 0.14);
  for (let z = 7; z < s.height - 0.6; z += 3) band(z);
  const firstRow = windows.filter((w) => w.z0 === 4.45);
  const piers = [
    0.1,
    ...firstRow.slice(1).map((w, i) => (firstRow[i]!.s1 + w.s0) / 2),
    length - 0.32,
  ];
  for (const x of piers) {
    fill(quad(x, x + 0.22, COMMERCIAL_BASE + 0.3, s.height - 0.18), warm ? "#8b7e66" : "#737b6b");
    fill(quad(x + 0.22, x + 0.3, COMMERCIAL_BASE + 0.3, s.height - 0.18), "rgba(13,18,18,.32)");
  }
  for (const w of windows) paintHomeWindow(ctx, face, ppm, w, art);
  if (art?.marketServices && firstRow.length > 1) {
    const a = firstRow[0]!.s1,
      b = firstRow[1]!.s0;
    if (b - a > 1.04)
      paintFaceAsset(
        ctx,
        art.marketServices,
        at,
        (a + b) / 2 - 0.42,
        (a + b) / 2 + 0.42,
        4.02,
        6.12,
        0.12,
      );
  }
  band(s.height - 0.18);
  ctx.restore();
}
