/** Built street edges. Cached albedo detail, always attached to the saved wall/roof. */
import type { Point, Rect, SceneEnvironment, SceneStructure } from "@/engine";
import type { ArchitectureArt } from "./architecturePack";
import { facadeOpenings } from "./architectureArt";
import { faceOpenings, facePainter, type Opening } from "./buildingFaces";
import { commercialUpperWindows } from "./commercialUpper";
import { hash, type Edge } from "./frontage";
import { paintFaceAsset } from "./afterRainArt";
import { fillMaterial, type MaterialSet } from "./surfaceMaterials";
import { faceBasis } from "./buildingFaces";

type Project = (p: Point) => Point;
type Clip = { s0: number; s1: number; zMax: number };
export type WallFitting = {
  s0: number;
  s1: number;
  z0: number;
  z1: number;
  kind: "meter" | "aircon" | "notices" | "mail";
};

/** Openings are excluded before fitting services; no fictional doors or painted-over glass. */
export function blockOpenings(
  s: SceneStructure,
  edge: Edge,
  entrances: SceneEnvironment["entrances"],
): Opening[] {
  const f = facadeOpenings(s, entrances, edge);
  const generic =
    s.style === "shop"
      ? f.bays.map((x) => ({
          kind: "bay" as const,
          s0: x,
          s1: x + 2.2,
          z0: 0.65,
          z1: 2.35,
          seed: 0,
        }))
      : faceOpenings(s, edge, entrances);
  return [
    ...generic,
    ...commercialUpperWindows(s, edge),
    ...f.doors.map((x) => ({
      kind: "bay" as const,
      s0: x - 1.05,
      s1: x + 1.05,
      z0: 0,
      z1: 2.65,
      seed: 0,
    })),
  ];
}
export function wallFittings(
  s: SceneStructure,
  edge: Edge,
  entrances: SceneEnvironment["entrances"],
  shopFace = false,
): WallFitting[] {
  if (s.style === "mesh-fence" || s.style === "interior-wall") return [];
  const length = edge === "north" ? s.rect.width : s.rect.height;
  const openings = blockOpenings(s, edge, entrances);
  const fittings: WallFitting[] = [];
  const fits = (r: WallFitting) =>
    r.s0 > 0.15 &&
    r.s1 < length - 0.15 &&
    r.z1 < s.height - 0.22 &&
    !openings.some(
      (o) => r.s0 < o.s1 + 0.13 && r.s1 > o.s0 - 0.13 && r.z0 < o.z1 + 0.15 && r.z1 > o.z0 - 0.15,
    ) &&
    !fittings.some(
      (o) => r.s0 < o.s1 + 0.35 && r.s1 > o.s0 - 0.35 && r.z0 < o.z1 + 0.3 && r.z1 > o.z0 - 0.3,
    );
  // Upper services sit between storeys, never in a window. Ground services use clear piers.
  for (let x = 0.22; x < length - 1.3; x += 1.65) {
    const h = hash(s.rect.x, s.rect.y, x, edge === "north" ? 17 : 23);
    if (h > 0.46) continue;
    const kind: WallFitting["kind"] =
      s.style === "residential" ? (h < 0.2 ? "mail" : "notices") : h < 0.2 ? "meter" : "notices";
    const r = { s0: x, s1: x + 0.92, z0: 0.62, z1: kind === "notices" ? 1.36 : 1.25, kind };
    if (!shopFace && fits(r)) fittings.push(r);
    if (fittings.length >= 3) break;
  }
  if (s.height > 6) {
    for (let x = 1.2; x < length - 1.5; x += 5.7) {
      const r: WallFitting = { s0: x, s1: x + 1.22, z0: 2.82, z1: 3.5, kind: "aircon" };
      if (fits(r)) fittings.push(r);
    }
  }
  return fittings;
}

/** Upper/lower wall construction shares exactly this painter in full and cutaway views. */
export function paintCityBlockFace(
  ctx: CanvasRenderingContext2D,
  s: SceneStructure,
  edge: Edge,
  entrances: SceneEnvironment["entrances"],
  project: Project,
  ppm: number,
  materials: MaterialSet,
  art?: ArchitectureArt,
  clip?: Clip,
  shopFace = false,
) {
  if (s.style === "mesh-fence" || s.style === "interior-wall") return;
  const { at, quad, length } = facePainter(s, edge, project, ppm);
  const path = (ps: Point[]) => {
    ctx.beginPath();
    ps.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
  };
  const fill = (ps: Point[], c: string | CanvasGradient) => {
    path(ps);
    ctx.fillStyle = c;
    ctx.fill();
  };
  const line = (a: Point, b: Point, c: string, w = 0.025) => {
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.strokeStyle = c;
    ctx.lineWidth = w * ppm;
    ctx.stroke();
  };
  const openings = blockOpenings(s, edge, entrances);
  const solid = (a: number, b: number, lo: number, hi: number) =>
    !openings.some(
      (o) => a < o.s1 + 0.08 && b > o.s0 - 0.08 && lo < o.z1 + 0.08 && hi > o.z0 - 0.08,
    );
  const industrial = s.style === "workshop" || s.style === "warehouse";
  ctx.save();
  path(quad(clip?.s0 ?? 0, clip?.s1 ?? length, 0, Math.min(s.height, clip?.zMax ?? s.height)));
  ctx.clip();
  // Stone/brick grounding, with courses broken at actual doors.
  if (!shopFace) {
    const doors = facadeOpenings(s, entrances, edge).doors;
    for (let x = 0; x < length; x += 0.5) {
      const b = Math.min(length, x + 0.5);
      if (doors.some((d) => x < d + 1.04 && b > d - 1.04)) continue;
      const points = quad(x, b, 0.12, 0.57);
      if (
        !fillMaterial(ctx, materials, points, {
          key: "home-masonry",
          basis: faceBasis(s, edge, project, ppm, "home-masonry"),
          target: industrial ? "#484745" : "#62564a",
          strength: 0.8,
        })
      )
        fill(points, "#514a43");
      line(at(x, 0, 0.57), at(b, 0, 0.57), "#8b8170", 0.055);
    }
  }
  // Strong vertical pilasters divide long facades into inhabited bays.
  const rhythm = industrial ? 6 : s.style === "residential" ? 4 : 3.2;
  for (let x = industrial ? 3.15 : 2.5; x < length - 0.3; x += rhythm) {
    const lo = shopFace ? 3.9 : 0.65,
      hi = s.height - 0.25;
    if (hi <= lo || !solid(x, x + 0.2, lo, hi)) continue;
    fill(quad(x, x + 0.2, lo, hi, 0.055), industrial ? "#3e5156" : "#827363");
    fill(quad(x + 0.2, x + 0.3, lo, hi), "rgba(9,16,20,.48)");
    line(at(x, 0.055, lo), at(x, 0.055, hi), "rgba(190,173,140,.35)", 0.025);
    for (let z = lo + 0.55; z < hi; z += 0.55)
      line(at(x, 0.06, z), at(x + 0.2, 0.06, z), "rgba(21,26,28,.45)", 0.022);
  }
  // Window hoods and darker spandrels create depth without altering the opening.
  for (const o of openings.filter((o) => o.z0 > 2.6)) {
    const a = Math.max(0.06, o.s0 - 0.12),
      b = Math.min(length - 0.06, o.s1 + 0.12);
    fill(quad(a, b, o.z1 + 0.04, o.z1 + 0.16, 0.1), "#7a7466");
    fill(quad(a, b, o.z1 - 0.02, o.z1 + 0.04), "rgba(9,15,20,.5)");
    const apron = quad(a, b, o.z0 - 0.42, o.z0 - 0.13);
    fill(apron, s.style === "residential" ? "#454f51" : "#4d544c");
    line(at(a, 0, o.z0 - 0.42), at(b, 0, o.z0 - 0.42), "rgba(162,147,122,.4)", 0.03);
    // A few shallow iron guards, anchored to existing sills, never walkable balconies.
    if (hash(s.rect.x, s.rect.y, o.s0, o.z0) < 0.35) {
      for (let x = a + 0.1; x < b; x += 0.17)
        line(at(x, 0.13, o.z0 - 0.08), at(x, 0.13, o.z0 + 0.35), "#222d31", 0.035);
      line(at(a, 0.13, o.z0 + 0.35), at(b, 0.13, o.z0 + 0.35), "#6d736a", 0.05);
      line(at(a, 0.13, o.z0 - 0.08), at(b, 0.13, o.z0 - 0.08), "#1a2529", 0.06);
    }
  }
  // Services have constrained anchors and neutral albedo. Code supplies projection.
  for (const f of wallFittings(s, edge, entrances, shopFace)) {
    const keys = {
      meter: "blockMeters",
      aircon: "blockAircon",
      notices: "blockNotices",
      mail: "blockMail",
    } as const;
    fill(quad(f.s0 + 0.04, f.s1 + 0.06, f.z0 - 0.055, f.z1 - 0.035), "rgba(4,12,16,.35)");
    if (art?.[keys[f.kind]])
      paintFaceAsset(ctx, art[keys[f.kind]], at, f.s0, f.s1, f.z0, f.z1, 0.065);
    else {
      fill(quad(f.s0, f.s1, f.z0, f.z1, 0.06), f.kind === "notices" ? "#8b7b60" : "#535d58");
      for (let z = f.z0 + 0.12; z < f.z1 - 0.08; z += 0.13)
        line(at(f.s0 + 0.09, 0.075, z), at(f.s1 - 0.09, 0.075, z), "#273438", 0.035);
    }
    if (f.kind === "aircon") {
      const x = f.s1 + 0.12;
      if (solid(x, x + 0.065, f.z0 - 0.5, f.z1)) {
        line(at(x, 0, f.z1), at(x, 0, f.z0 - 0.5), "#1b282c", 0.09);
        line(at(x - 0.02, 0.02, f.z1), at(x - 0.02, 0.02, f.z0 - 0.5), "#8b8c76", 0.025);
      }
    }
  }
  // Fine cables follow the clear band between storeys; poles/windows are never crossed.
  for (const z of [2.7, 6.25]) {
    if (z > s.height - 0.5 || (shopFace && z < 3.85)) continue;
    for (let x = 0.2; x < length - 0.2; x += 0.4) {
      if (!solid(x, Math.min(x + 0.4, length), z - 0.08, z + 0.08)) continue;
      line(at(x, 0.025, z), at(Math.min(x + 0.4, length - 0.15), 0.025, z), "#283331", 0.04);
    }
  }
  // Local water streaks below sills and fixings; no uniform grunge veil.
  for (const o of openings) {
    if (o.z0 < 0.6) continue;
    for (const x of [o.s0 + 0.08, o.s1 - 0.06]) {
      const lo = Math.max(shopFace ? 3.86 : 0.15, o.z0 - 0.55);
      if (lo >= o.z0 - 0.12) continue;
      const p = at(x, 0, o.z0 - 0.12),
        q = at(x, 0, lo),
        g = ctx.createLinearGradient(p.x, p.y, q.x, q.y);
      g.addColorStop(0, "rgba(20,25,23,.23)");
      g.addColorStop(1, "rgba(20,25,23,0)");
      fill(quad(x - 0.035, x + 0.06, lo, o.z0 - 0.12), g);
    }
  }
  ctx.restore();
}

/** Compact maintenance groups break the former row of three identical units. */
export function cityRoofUnits(s: SceneStructure): Rect[] {
  const r = s.rect;
  if (r.width < 3 || r.height < 3 || s.style === "mesh-fence" || s.style === "interior-wall")
    return [];
  const x = r.x + 0.5,
    y = r.y + Math.min(3, r.height - 2.5);
  const a: Rect = { x, y, width: 2, height: 2 };
  if (r.width < 9 || r.height < 6) return [a];
  const stagger = hash(r.x, r.y, s.height) > 0.5;
  return [
    a,
    { x: x + 3.3, y: Math.min(r.y + r.height - 2.5, y + (stagger ? 2.5 : 0)), width: 2, height: 2 },
  ];
}

/** Roof details remain below the parapet silhouette and belong to the roof sprite. */
export function paintCityRoof(
  ctx: CanvasRenderingContext2D,
  s: SceneStructure,
  project: Project,
  ppm: number,
  units: readonly Rect[],
) {
  const r = s.rect,
    h = s.height * ppm;
  if (r.width < 3 || r.height < 3) return;
  const at = (x: number, y: number, z = 0) => {
    const p = project({ x, y });
    return { x: p.x, y: p.y - h - z * ppm };
  };
  const quad = (r: Rect, z = 0) => [
    at(r.x, r.y, z),
    at(r.x + r.width, r.y, z),
    at(r.x + r.width, r.y + r.height, z),
    at(r.x, r.y + r.height, z),
  ];
  const path = (ps: Point[]) => {
    ctx.beginPath();
    ps.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
  };
  const fill = (ps: Point[], c: string) => {
    path(ps);
    ctx.fillStyle = c;
    ctx.fill();
  };
  ctx.save();
  path(quad(r));
  ctx.clip();
  // Walk pads and low cable trays connect equipment to a service strip.
  for (const u of units) {
    for (let y = r.y + 0.55; y < u.y; y += 0.7)
      fill(quad({ x: u.x + 0.25, y, width: 0.65, height: 0.56 }), "#696b60");
    fill(
      quad({
        x: u.x + u.width + 0.12,
        y: r.y + 0.25,
        width: 0.12,
        height: Math.max(0.1, u.y + 1 - r.y),
      }),
      "#263435",
    );
    fill(
      quad(
        {
          x: u.x + u.width + 0.12,
          y: r.y + 0.25,
          width: 0.045,
          height: Math.max(0.1, u.y + 1 - r.y),
        },
        0.025,
      ),
      "#7a7d70",
    );
  }
  // Low, framed skylight well at the far end of larger roofs, clear of equipment.
  const sky = {
    x: r.x + Math.min(r.width - 3, 8),
    y: r.y + Math.min(r.height - 2.2, 1),
    width: 1.9,
    height: 1.2,
  };
  if (
    r.width > 10 &&
    units.every(
      (u) =>
        sky.x >= u.x + u.width + 0.3 ||
        sky.x + sky.width <= u.x - 0.3 ||
        sky.y >= u.y + u.height + 0.3 ||
        sky.y + sky.height <= u.y - 0.3,
    )
  ) {
    fill(
      quad({
        ...sky,
        x: sky.x - 0.15,
        y: sky.y - 0.15,
        width: sky.width + 0.3,
        height: sky.height + 0.3,
      }),
      "#171f22",
    );
    fill(quad(sky, 0.08), "#697266");
    for (let i = 0; i < 3; i++)
      fill(
        quad({ x: sky.x + 0.09 + i * 0.6, y: sky.y + 0.09, width: 0.49, height: 1.02 }, 0.085),
        "#283d45",
      );
  }
  ctx.restore();
}
