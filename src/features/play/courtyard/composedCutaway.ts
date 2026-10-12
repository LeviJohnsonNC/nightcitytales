import { paintOccupiedFrontage } from "./occupiedFrontage";
import { paintCityBlockFace } from "./cityBlock";
import { paintFrontageIdentity } from "./frontageIdentity";
import { paintCommercialUpper } from "./commercialUpper";
import {
  buildingUse,
  facePainter,
  paintHomeFace,
  paintHomeAnnex,
  clipHomeFace,
} from "./buildingFaces";
import { type CutawayWall } from "./cutawayGeometry";
import { composedBays, paintNeighbourFront, paintReturnFace } from "./streetfront";
import { type ArchitectureArt } from "./architecturePack";
import { isAnnex, paintShopWall, type ShopFace, paintFacadeArt } from "./architectureArt";
import {
  SURFACE_MATERIALS,
  fillMaterial,
  wallBasis,
  type MaterialKey,
  type MaterialSet,
} from "./surfaceMaterials";
import type { Point, Rect, SceneStructure, SceneEnvironment } from "@/engine";
import { paintStorefrontFace, type Pass, type Storefront, type StorefrontArt } from "./storefront";
import { painter, type Project } from "./composedPainter";
import { type Returns } from "./composedBuilding";

/**
 * Inaccessible mass is ground art; perimeter pieces sort independently.
 *
 * Drawn as a CUT SOLID, the way a section drawing shows mass: an opaque neutral a
 * shade lighter than the street (so it reads as something there, not a dark hole),
 * a fine level hatch, and the line where the walls stand. It used to be a dark
 * floor with stripes, the value of the asphalt, which read as an empty room someone
 * could walk into. Nothing here is furniture, and nothing of the street shows
 * through it.
 */
export function paintCutawayFloor(
  ctx: CanvasRenderingContext2D,
  structure: SceneStructure,
  project: Project,
) {
  const { rect, line, corners } = painter(ctx, project);
  const r = structure.rect;
  rect(r, "#3b3d3e");
  // the hatch: lines of constant x - y, level on screen, every 0.4 m, clipped to the mass
  const outline = corners(r);
  ctx.save();
  ctx.beginPath();
  outline.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.closePath();
  ctx.clip();
  for (let c = r.x - (r.y + r.height); c <= r.x + r.width - r.y; c += 0.4) {
    // the line x - y = c, from where it enters the footprint's bounding range to where it leaves
    const a = { x: c + r.y - 2, y: r.y - 2 };
    const b = { x: c + r.y + r.height + 2, y: r.y + r.height + 2 };
    line(project(a), project(b), "rgba(196,190,178,.2)", 0.8);
  }
  ctx.restore();
  // where the walls stand: the edge of the solid, cut at its thickness
  const t = 0.24;
  const inner = corners({
    x: r.x + t,
    y: r.y + t,
    width: r.width - 2 * t,
    height: r.height - 2 * t,
  });
  for (let i = 0; i < 4; i++) line(inner[i]!, inner[(i + 1) % 4]!, "rgba(206,200,186,.34)", 1);
  for (let i = 0; i < 4; i++) line(outline[i]!, outline[(i + 1) % 4]!, "rgba(8,12,14,.5)", 1);
}

export function sectionBounds(r: Rect, height: number, project: Project, ppm: number): Rect {
  const points = [r.x, r.x + r.width].flatMap((x) =>
    [r.y, r.y + r.height].map((y) => project({ x, y })),
  );
  const x = Math.floor(Math.min(...points.map((p) => p.x))) - 2;
  const y = Math.floor(Math.min(...points.map((p) => p.y)) - height * ppm) - 2;
  return {
    x,
    y,
    width: Math.ceil(Math.max(...points.map((p) => p.x))) - x + 2,
    height: Math.ceil(Math.max(...points.map((p) => p.y))) - y + 2,
  };
}

export function paintCutawayWall(
  ctx: CanvasRenderingContext2D,
  structure: SceneStructure,
  part: CutawayWall,
  project: Project,
  materials?: MaterialSet,
  storefront?: { sf: Storefront; art: StorefrontArt; pass: Pass },
  /** The wall's material, as the full building lays it (`paintBuilding`). */
  wallMaterial: MaterialKey = "facade-concrete",
  /** The painted openings and wall finish, where the full building has them. */
  annex?: ShopFace & { entrances: SceneEnvironment["entrances"] },
  /** The shop's composed return faces (`streetfront.ts`), carried up the piece. */
  returns?: Returns,
  home?: { entrances: SceneEnvironment["entrances"]; art: ArchitectureArt | undefined },
) {
  const { poly, corners } = painter(ctx, project);
  const metre = Math.hypot(
    project({ x: 1, y: 0 }).x - project({ x: 0, y: 0 }).x,
    project({ x: 1, y: 0 }).y - project({ x: 0, y: 0 }).y,
  );
  const lightPass = storefront && storefront.pass !== "albedo";
  const warm = structure.style === "residential" || structure.style === "shop";
  const base = corners(part.rect),
    top = corners(part.rect, part.height * metre);
  const north = [base[0]!, base[1]!, top[1]!, top[0]!],
    east = [base[1]!, base[2]!, top[2]!, top[1]!];
  const r = part.rect;
  // The same facade material, anchored to the same world metres, as the full
  // building it replaces: revealing the street must not change what the wall is.
  const clad =
    materials && (structure.style === "shop" || buildingUse(structure)) ? materials : undefined;
  const concrete = SURFACE_MATERIALS[wallMaterial].metres;
  const side = (points: Point[], flat: string, basis: ReturnType<typeof wallBasis>) => {
    if (fillMaterial(ctx, clad, points, { key: wallMaterial, basis, target: flat })) {
      poly(points, null, "#17272d");
    } else poly(points, flat, "#17272d");
  };
  if (!lightPass) {
    side(north, warm ? "#73675a" : "#59666a", wallBasis(project, "x", r.y, concrete, metre));
    side(east, "#35434a", wallBasis(project, "y", r.x + r.width, concrete, metre));
    poly(top, warm ? "#b0a18b" : "#95a4a0", "#293b42");
  }
  if (home && clad && structure.style === "residential" && !lightPass) {
    for (const edge of ["north", "east"] as const) {
      const wall = structure.rect;
      if (!(edge === "north" ? r.y === wall.y : r.x + r.width === wall.x + wall.width)) continue;
      const s0 = edge === "north" ? r.x - wall.x : r.y - wall.y;
      paintHomeFace(ctx, structure, edge, project, metre, home.entrances, clad, home.art, {
        s0,
        s1: s0 + (edge === "north" ? r.width : r.height),
        zMax: part.height,
      });
    }
  }
  // A piece of a face with painted openings carries them up to its height, as the
  // storefront's face does below.
  if (annex && !lightPass) {
    const wall = structure.rect;
    for (const edge of annex.edges) {
      const onFace = edge === "north" ? r.y === wall.y : r.x + r.width === wall.x + wall.width;
      if (!onFace) continue;
      const s0 = edge === "north" ? r.x - wall.x : r.y - wall.y;
      const s1 = s0 + (edge === "north" ? r.width : r.height);
      const clip = { s0, s1, zMax: part.height };
      if (isAnnex(structure, annex.entrances))
        paintHomeAnnex(ctx, structure, edge, project, metre, clad, clip);
      const composed = returns?.faces.find((f) => f.structure === structure && f.edge === edge);
      if (composed)
        paintReturnFace(ctx, composed, project, metre, returns!.art, materials, "wall", clip);
      if (annex.finish)
        paintShopWall({
          ctx,
          structure,
          edge,
          project,
          ppm: metre,
          entrances: annex.entrances,
          doors: annex.doors,
          clip,
          masonry: annex.art.paintedServiceMasonry,
        });
      paintFacadeArt({
        ctx,
        structure,
        edge,
        project,
        ppm: metre,
        art: annex.art,
        entrances: annex.entrances,
        doors: annex.doors,
        clip,
        ...(composed ? { skip: composedBays(composed) } : {}),
      });
      if (composed)
        paintReturnFace(ctx, composed, project, metre, returns!.art, materials, "fittings", clip);
    }
  }
  if (!lightPass && materials && home?.art)
    for (const edge of ["north", "east"] as const) {
      const wall = structure.rect;
      if (!(edge === "north" ? r.y === wall.y : r.x + r.width === wall.x + wall.width)) continue;
      const s0 = edge === "north" ? r.x - wall.x : r.y - wall.y;
      const face = facePainter(structure, edge, project, metre);
      ctx.save();
      clipHomeFace(ctx, face, {
        s0,
        s1: s0 + (edge === "north" ? r.width : r.height),
        zMax: part.height,
      });
      paintFrontageIdentity(
        ctx,
        structure,
        edge,
        { entrances: home.entrances, structures: [structure] },
        project,
        metre,
        "albedo",
        home.art,
      );
      ctx.restore();
    }
  // The repair base belongs to the surviving wall, including low automatic sections.
  if (!lightPass && returns)
    for (const front of returns.neighbours.filter((f) => f.structure === structure)) {
      const wall = structure.rect;
      const north = front.edge === "north";
      if (!(north ? r.y === wall.y : r.x + r.width === wall.x + wall.width)) continue;
      const s0 = north ? r.x - wall.x : r.y - wall.y;
      const s1 = s0 + (north ? r.width : r.height);
      if (s1 <= front.span[0] || s0 >= front.span[1]) continue;
      const q = facePainter(structure, front.edge, project, metre).quad(s0, s1, 0, part.height);
      ctx.save();
      ctx.beginPath();
      q.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.closePath();
      ctx.clip();
      paintNeighbourFront(ctx, front, project, metre, returns.art.service, materials);
      ctx.restore();
    }
  // A piece of the storefront's own face carries that face's detail up to its height,
  // so revealing the street does not change what the wall is.
  if (storefront) {
    const sf = storefront.sf;
    const wall = sf.structure.rect;
    const onFace = sf.edge === "north" ? r.y === wall.y : r.x + r.width === wall.x + wall.width;
    if (onFace) {
      const s0 = sf.edge === "north" ? r.x - wall.x : r.y - wall.y;
      const s1 = s0 + (sf.edge === "north" ? r.width : r.height);
      paintStorefrontFace({
        ctx,
        sf,
        project,
        ppm: metre,
        art: storefront.art,
        materials: clad,
        pass: storefront.pass,
        clip: { s0, s1, zMax: part.height },
      });
    }
  }
  if (clad && !lightPass)
    for (const edge of ["north", "east"] as const) {
      const wall = structure.rect;
      if (!(edge === "north" ? r.y === wall.y : r.x + r.width === wall.x + wall.width)) continue;
      const s0 = edge === "north" ? r.x - wall.x : r.y - wall.y;
      paintCommercialUpper(ctx, structure, edge, project, metre, clad, home?.art, {
        s0,
        s1: s0 + (edge === "north" ? r.width : r.height),
        zMax: part.height,
      });
      paintCityBlockFace(
        ctx,
        structure,
        edge,
        home?.entrances ?? annex?.entrances,
        project,
        metre,
        clad,
        home?.art ?? annex?.art,
        { s0, s1: s0 + (edge === "north" ? r.width : r.height), zMax: part.height },
        !!storefront && storefront.sf.edge === edge,
      );
      ctx.save();
      clipHomeFace(ctx, facePainter(structure, edge, project, metre), {
        s0,
        s1: s0 + (edge === "north" ? r.width : r.height),
        zMax: part.height,
      });
      paintOccupiedFrontage(
        ctx,
        structure,
        edge,
        home?.entrances ?? annex?.entrances,
        project,
        metre,
        "albedo",
        home?.art ?? annex?.art,
      );
      ctx.restore();
    }
}
