import { paintFaceAsset } from "./afterRainArt";
/** Upper commercial storeys, derived only from the saved building envelope. */
import type { Point, SceneStructure } from "@/engine";
import type { ArchitectureArt } from "./architecturePack";
import { faceBasis, facePainter, paintHomeWindow, type Opening } from "./buildingFaces";
import { hash, type Edge } from "./frontage";
import { fillMaterial, type MaterialSet } from "./surfaceMaterials";
import { paintArchitecturalBay } from "./paintedArchitecture";
import { occupiedUse } from "./occupiedFrontage";

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
  const target = edge === "north" ? (warm ? "#9b7959" : "#65766b") : warm ? "#705b47" : "#46564f";
  if (
    !fillMaterial(ctx, materials, wall, {
      key: "painted-render",
      basis: faceBasis(s, edge, project, ppm, "painted-render"),
      target,
      strength: 0.8,
    })
  )
    fill(wall, target);
  // Broad eave shadow and quiet upper-storey values establish a hierarchy before
  // windows/trim are painted. Gradients use world height, shared by cutaway faces.
  const top = at(0, 0, s.height),
    foot = at(0, 0, COMMERCIAL_BASE);
  const shade = ctx.createLinearGradient(top.x, top.y, foot.x, foot.y);
  shade.addColorStop(0, "rgba(10,23,23,.48)");
  shade.addColorStop(0.24, "rgba(16,28,27,.19)");
  shade.addColorStop(0.7, "rgba(16,28,27,.06)");
  shade.addColorStop(1, "rgba(10,22,21,.3)");
  path(wall);
  ctx.fillStyle = shade;
  ctx.fill();
  const windows = commercialUpperWindows(s, edge);
  // A continuous stone frame with a deep spandrel over the trading floor.
  const band = (z: number) => {
    fill(quad(0, length, z - 0.12, z + 0.16), edge === "north" ? "#958975" : "#706953");
    fill(quad(0, length, z - 0.3, z - 0.12), "rgba(12,16,16,.23)");
    fill(
      [
        at(0, 0, z + 0.16),
        at(length, 0, z + 0.16),
        at(length, 0.13, z + 0.16),
        at(0, 0.13, z + 0.16),
      ],
      "#827e6d",
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
    fill(quad(x, x + 0.22, COMMERCIAL_BASE + 0.3, s.height - 0.18), warm ? "#82765f" : "#657062");
    fill(quad(x + 0.22, x + 0.3, COMMERCIAL_BASE + 0.3, s.height - 0.18), "rgba(13,18,18,.21)");
  }
  const painted = occupiedUse(s) || !warm ? art?.paintedRepairUpper : art?.paintedMarketUpper;
  for (const w of windows) {
    const row = windows.filter((candidate) => candidate.z0 === w.z0);
    const index = row.indexOf(w);
    const s0 = index === 0 ? 0 : (row[index - 1]!.s1 + w.s0) / 2;
    const s1 = index === row.length - 1 ? length : (w.s1 + row[index + 1]!.s0) / 2;
    if (
      !paintArchitecturalBay(
        ctx,
        painted,
        at,
        { s0, s1, z0: w.z0 - 0.6, z1: Math.min(s.height, w.z0 + 2.4) },
        w,
        "upper",
      )
    ) {
      paintHomeWindow(ctx, face, ppm, w, art);
      continue;
    }
    // The artwork supplies surface character. Real ledges and window reveals
    // retain a coherent architectural depth at the saved aperture positions.
    fill(
      [at(w.s0, 0, w.z0), at(w.s1, 0, w.z0), at(w.s1, 0.16, w.z0), at(w.s0, 0.16, w.z0)],
      warm ? "#80705b" : "#929180",
    );
    fill(quad(w.s0 - 0.08, w.s1 + 0.08, w.z0 - 0.12, w.z0, 0.16), warm ? "#3d322b" : "#51564d");
    if (w.occupancy === "dark") fill(quad(w.s0, w.s1, w.z0, w.z1), "rgba(13,23,27,.63)");
    else if (w.occupancy === "blind")
      fill(quad(w.s0, w.s1, w.z0 + 0.85, w.z1), "rgba(34,36,31,.35)");
    if (edge === "east")
      fill(quad(s0, s1, w.z0 - 0.6, Math.min(s.height, w.z0 + 2.4)), "rgba(12,25,28,.18)");
  }
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
