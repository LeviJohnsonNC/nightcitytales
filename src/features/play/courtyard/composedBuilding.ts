import { residentialPalette } from "./residentialFinish";
import { paintOccupiedFrontage } from "./occupiedFrontage";
import { paintCityBlockFace, paintCityRoof, cityRoofUnits } from "./cityBlock";
import { paintFrontageIdentity } from "./frontageIdentity";
import { paintCommercialUpper, COMMERCIAL_BASE } from "./commercialUpper";
import { commercialTerrace, paintCommercialTerrace } from "./commercialTerrace";
import { paintResidentialRoof, RESIDENTIAL_ROOF_RECESS } from "./residentialRoof";
import { attachmentPoint } from "@/engine";
import {
  USE_WALL,
  buildingUse,
  faceBasis,
  faceOpenings,
  facePainter,
  paintHomeFace,
  paintHomeAnnex,
  paintLoadingDoor,
  paintServiceSurround,
  paintShedGlazing,
  paintShedWall,
} from "./buildingFaces";
import {
  composedBays,
  paintNeighbourFront,
  paintReturnFace,
  type NeighbourFront,
  type ReturnArt,
  type ReturnFace,
} from "./streetfront";
import { type ArchitectureArt } from "./architecturePack";
import {
  isAnnex,
  facadeArtCovers,
  facadeOpenings,
  paintShopWall,
  shopFace,
  paintRoofUnitLight,
  rooftopUnits,
  paintFacadeArt,
  paintRoofUnitArt,
} from "./architectureArt";
import {
  SURFACE_MATERIALS,
  fillMaterial,
  groundBasis,
  wallBasis,
  type MaterialKey,
  type MaterialSet,
  type TileSource,
} from "./surfaceMaterials";
import type { Point, SceneStructure, SceneEnvironment } from "@/engine";
import {
  paintRooftopUnit,
  paintRoofShade,
  paintStorefrontFace,
  meterBox,
  METER_BOX,
  storefrontOpenings,
  streetLamp,
  type Pass,
  type Storefront,
  type StorefrontArt,
} from "./storefront";
import {
  downpipes,
  exposedSpans,
  frontageBlock,
  neighbourFace,
  paintDownpipe,
  paintNeighbourFace,
  paintParapet,
  paintPlinth,
  paintRoofOutlet,
  solidSpans,
  type Downpipe,
  type Edge,
  type FrontageRole,
} from "./frontage";
import { paintGroundLight, type GroundLight } from "./nightLighting";
import { painter, type Project } from "./composedPainter";

/** The shop's composed return faces and the art they show (`streetfront.ts`). */
export interface Returns {
  faces: readonly ReturnFace[];
  art: ReturnArt & { service?: TileSource };
  /** The neighbours' faces, and the one fascia board among them. */
  neighbours: readonly NeighbourFront[];
}

/** A mass's part in the architectural pilot, and what the block shares. */
export interface BlockDetail {
  role: FrontageRole;
  pipes: readonly Downpipe[];
  structures: readonly SceneStructure[];
}

/** The generic face's openings: the bays and doors `paintBuilding` draws on it. */
function genericOpenings(
  structure: SceneStructure,
  entrances: SceneEnvironment["entrances"],
  edge: Edge,
): [number, number][] {
  const r = structure.rect;
  const length = edge === "north" ? r.width : r.height;
  const doors = (entrances ?? [])
    .filter(
      (e) =>
        e.structureId === structure.id &&
        (edge === "north" ? e.position.y === r.y - 1 : e.position.x === r.x + r.width + 1),
    )
    .map((e) => (edge === "north" ? e.position.x - r.x : e.position.y - r.y));
  const out: [number, number][] = doors.map((d) => [d - 0.9, d + 0.9]);
  const step = structure.style === "residential" ? 4 : 3;
  for (let start = 0.5; start + 2.2 < length; start += step)
    if (!doors.some((door) => door > start - 1.1 && door < start + 3.3))
      out.push([start, start + 2.2]);
  return out;
}

/** What the storefront's own face carries from the pilot. */
function frontageOnFace(detail: BlockDetail, structure: SceneStructure, edge: Edge) {
  const pipe = detail.pipes.find((p) => p.structure === structure && p.edge === edge);
  return pipe ? { pipe } : {};
}

/**
 * The architectural pilot for one storefront: its block, what each mass is, and where
 * each roof drains — computed once, so the walls, the roofs and the ground agree.
 */
export function frontagePilot(
  sf: Storefront,
  structures: readonly SceneStructure[],
  entrances: SceneEnvironment["entrances"],
) {
  const neighbours = frontageBlock(structures, sf.structure);
  const masses = [sf.structure, ...neighbours];
  const busy = (s: SceneStructure, edge: Edge): [number, number][] => {
    if (s === sf.structure && edge === sf.edge) {
      const meter = meterBox(sf);
      return [
        ...storefrontOpenings(sf),
        ...(meter !== undefined ? [[meter, meter + METER_BOX.width] as [number, number]] : []),
      ];
    }
    if (neighbours.includes(s))
      return exposedSpans(s, edge, structures).flatMap((span) => {
        const f = neighbourFace(edge, span);
        return [
          ...f.windows.map((w) => [w, w + 1.6] as [number, number]),
          ...(f.louvre !== undefined ? [[f.louvre, f.louvre + 0.9] as [number, number]] : []),
        ];
      });
    return genericOpenings(s, entrances, edge);
  };
  const pipes = downpipes(masses, structures, busy);
  const detail = (s: SceneStructure): BlockDetail | undefined =>
    s === sf.structure
      ? { role: "shop", pipes, structures }
      : neighbours.includes(s)
        ? { role: "neighbour", pipes, structures }
        : undefined;
  return { masses, neighbours, pipes, detail };
}

export function paintBuilding(
  ctx: CanvasRenderingContext2D,
  structure: SceneStructure,
  project: Project,
  entrances: SceneEnvironment["entrances"],
  materials?: MaterialSet,
  /** The finished storefront, for the one shop that has its art. */
  storefront?: { sf: Storefront; art: StorefrontArt; pass: Pass },
  /** The architectural pilot (`frontage.ts`): what this mass is in the shop's block. */
  frontage?: BlockDetail,
  /** The architectural art pilot's painted roof unit, window and shutter. */
  architecture?: ArchitectureArt,
  /** The shop's composed return faces (`streetfront.ts`). */
  returns?: Returns,
  office = false,
  nightclub = false,
  residentialStreet = false,
) {
  const { poly, corners, line, glow } = painter(ctx, project);
  const r = structure.rect;
  const pixelsPerMetre = Math.hypot(
    project({ x: 1, y: 0 }).x - project({ x: 0, y: 0 }).x,
    project({ x: 1, y: 0 }).y - project({ x: 0, y: 0 }).y,
  );
  const h = structure.height * pixelsPerMetre;
  const base = corners(r),
    top = corners(r, h);
  if (storefront && storefront.pass !== "albedo") {
    paintStorefrontFace({
      ctx,
      sf: storefront.sf,
      project,
      ppm: pixelsPerMetre,
      art: storefront.art,
      materials,
      pass: storefront.pass,
    });
    // the streetlight reaches the roof's near edge, and the units standing on it
    const lamp = streetLamp(storefront.sf);
    const unit = materials ? architecture?.roofUnit : undefined;
    const upper = materials ? commercialTerrace(structure) : undefined;
    const roof = upper ? corners(upper.rect, h) : top;
    const units = upper
      ? rooftopUnits(upper)
      : materials
        ? cityRoofUnits(structure)
        : rooftopUnits(structure);
    if (lamp && storefront.pass === "light" && unit) {
      // painted units: the pool on each at its own lid, inside its own silhouette
      const pool: GroundLight = {
        kind: "pool",
        centre: lamp.head,
        radius: 3,
        color: [1, 0.8, 0.56],
        intensity: 0.4,
      };
      paintRoofUnitLight(ctx, project, roof, units, h, unit, (c, lift) =>
        paintGroundLight(c, project, pool, lift),
      );
    } else if (lamp && storefront.pass === "light") {
      ctx.save();
      ctx.beginPath();
      roof.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.closePath();
      ctx.clip();
      paintGroundLight(
        ctx,
        project,
        { kind: "pool", centre: lamp.head, radius: 3, color: [1, 0.8, 0.56], intensity: 0.4 },
        h,
      );
      ctx.restore();
    }
    return;
  }
  if (structure.style === "mesh-fence") {
    const vertical = r.width < r.height;
    const length = vertical ? r.height : r.width;
    const at = (t: number, z: number) => {
      const p = project(
        vertical ? { x: r.x + r.width / 2, y: r.y + t } : { x: r.x + t, y: r.y + r.height / 2 },
      );
      return { x: p.x, y: p.y - z * pixelsPerMetre };
    };
    // Open mesh, with no opaque panel that might imply bulletproof cover.
    for (const z of [0.12, 1.9]) line(at(0, z), at(length, z), "#8b9790", 1.5);
    for (let t = 0; t <= length; t += 2) {
      line(at(t, 0), at(t, 2), "#253c42", 4);
      line(at(t, 0), at(t, 2), "#a3aaa0", 1.5);
    }
    for (let t = -2; t < length + 2; t += 0.3)
      for (const slope of [-1, 1]) {
        const lo = Math.max(0, slope === 1 ? -t : t - length),
          hi = Math.min(1.8, slope === 1 ? length - t : t);
        if (hi > lo)
          line(at(t + slope * lo, lo + 0.1), at(t + slope * hi, hi + 0.1), "#81958f88", 0.7);
      }
    return;
  }
  if (structure.style === "interior-wall") {
    for (const [face, color, axis, at] of [
      [
        [base[0]!, base[1]!, top[1]!, top[0]!],
        materials ? (nightclub ? "#60575e" : office ? "#9b998b" : "#7c8178") : "#687875",
        "x",
        r.y,
      ],
      [
        [base[1]!, base[2]!, top[2]!, top[1]!],
        materials ? (nightclub ? "#45434d" : office ? "#737970" : "#505e61") : "#384951",
        "y",
        r.x + r.width,
      ],
    ] as const) {
      if (
        !fillMaterial(ctx, materials, face, {
          key: office || nightclub ? "painted-render" : "facade-concrete",
          basis: wallBasis(project, axis, at, 4, pixelsPerMetre),
          target: color,
          strength: office || nightclub ? 0.5 : 0.92,
        })
      )
        poly([...face], color, "#24353b");
      if (materials) {
        const lower = [
          face[0],
          face[1],
          { x: face[1].x, y: face[1].y - pixelsPerMetre * 0.48 },
          { x: face[0].x, y: face[0].y - pixelsPerMetre * 0.48 },
        ];
        poly(lower, nightclub ? "#352d3a" : office ? "#414f4d" : "#384e52", "#273c40");
        line(lower[2]!, lower[3]!, "#c0ac76", 0.7);
      }
    }
    poly(top, nightclub ? "#7a7277" : office ? "#a7aa9b" : "#94a19a");
    line(base[0]!, base[1]!, "#192f3a", 2);
    line(base[1]!, base[2]!, "#192f3a", 2);
    return;
  }
  const palette =
    structure.style === "residential"
      ? residentialStreet
        ? residentialPalette(structure)
        : ["#766957", "#554f49", "#675346"]
      : frontage?.role === "neighbour"
        ? // the shop's neighbours: dark painted render and a paler, cooler roof
          ["#666b60", "#454c46", materials ? "#353b3c" : "#4d5352"]
        : structure.style === "shop"
          ? ["#66615a", "#454d4b", materials ? "#454947" : "#646360"]
          : structure.style === "workshop"
            ? ["#345b66", "#25414d", "#495657"]
            : ["#3e4a50", "#2c3942", "#56656b"];
  // Commercial frontage takes concrete, a membrane roof, painted rooftop units and
  // shuttered doors; every other building keeps its flat fills for now. Materials
  // are laid first, so windows, bays, doors and trim below paint over them.
  // The pilot's homes and sheds (`buildingFaces.ts`) take their own walls and openings.
  const use = materials ? buildingUse(structure) : undefined;
  const clad = structure.style === "shop" || use ? materials : undefined;
  // The painted window goes on every commercial face but the storefront's own (which
  // has its lit interior) and its neighbours' (barred and quiet); the shutter on the
  // annex's door; the finished wall on shops outside the storefront's block.
  const shopArt = clad
    ? shopFace(structure, entrances, architecture, !!storefront, frontage?.role)
    : undefined;
  const covers = facadeArtCovers(structure, shopArt?.art, shopArt?.doors);
  const metres = (key: MaterialKey) => SURFACE_MATERIALS[key].metres;
  const surface = (
    points: Point[],
    flat: string,
    stroke: string,
    key: MaterialKey,
    basis: ReturnType<typeof wallBasis>,
  ) =>
    poly(
      points,
      fillMaterial(ctx, clad, points, { key, basis, target: flat }) ? null : flat,
      stroke,
    );
  const terrace = clad ? commercialTerrace(structure) : undefined;
  if (terrace) {
    // Retain the complete street floor, then build recessed rooms on its slab.
    const rim = corners(r, COMMERCIAL_BASE * pixelsPerMetre);
    ctx.save();
    ctx.beginPath();
    [base[0]!, base[1]!, base[2]!, rim[2]!, rim[1]!, rim[0]!].forEach((p, i) =>
      i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y),
    );
    ctx.closePath();
    ctx.clip();
  }
  // Two camera-facing walls; windows, shutters, conduits, lintels share their planes.
  // The shop's neighbours are a different building: painted render, not its concrete.
  const wall: MaterialKey = use
    ? USE_WALL[use]
    : frontage?.role === "neighbour"
      ? "painted-render"
      : "facade-concrete";
  surface(
    [base[0]!, base[1]!, top[1]!, top[0]!],
    palette[0]!,
    "#293c38",
    wall,
    wallBasis(project, "x", r.y, metres(wall), pixelsPerMetre),
  );
  surface(
    [base[1]!, base[2]!, top[2]!, top[1]!],
    palette[1]!,
    "#293c38",
    wall,
    wallBasis(project, "y", r.x + r.width, metres(wall), pixelsPerMetre),
  );
  const face = (a: Point, b: Point, length: number, shade: string, edge: "north" | "east") => {
    // The storefront's face is painted whole by its own routine, over the concrete.
    if (storefront && storefront.sf.edge === edge) return;
    // The shop's other face, composed (`streetfront.ts`): its band and course first,
    // its display, grille, sign and extract last, over everything else here.
    const composed = returns?.faces.find((f) => f.structure === structure && f.edge === edge);
    if (composed)
      paintReturnFace(ctx, composed, project, pixelsPerMetre, returns!.art, materials, "wall");
    if (frontage) {
      const pipe = frontage.pipes.find((p) => p.structure === structure && p.edge === edge);
      if (frontage.role === "neighbour") {
        // restrained: render, high barred windows, a louvre, a plinth; no door where
        // no entrance is saved, no light, no sign
        for (const span of exposedSpans(structure, edge, frontage.structures)) {
          const f = neighbourFace(edge, span);
          paintPlinth(ctx, project, pixelsPerMetre, structure, edge, [span], "neighbour");
          paintNeighbourFace(ctx, project, pixelsPerMetre, structure, f);
          const front = returns?.neighbours.find(
            (n) => n.structure === structure && n.edge === edge && n.span[0] === span[0],
          );
          if (front)
            paintNeighbourFront(
              ctx,
              front,
              project,
              pixelsPerMetre,
              returns!.art.service,
              materials,
            );
        }
        if (pipe) paintDownpipe(ctx, project, pixelsPerMetre, pipe, "neighbour");
        return;
      }
      // the shop's other face keeps its bays and gains a plinth between them
      paintPlinth(
        ctx,
        project,
        pixelsPerMetre,
        structure,
        edge,
        solidSpans([0, length], genericOpenings(structure, entrances, edge)),
        "shop",
      );
      if (pipe) paintDownpipe(ctx, project, pixelsPerMetre, pipe, "shop");
    }
    const at = (t: number, z: number) => ({
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t - z,
    });
    // A home or a shed in the pilot: its own wall, and the same openings, finished.
    const finished = use ? facePainter(structure, edge, project, pixelsPerMetre) : undefined;
    if (finished && use === "industrial")
      paintShedWall(
        ctx,
        finished,
        pixelsPerMetre,
        structure.height,
        clad,
        faceBasis(structure, edge, project, pixelsPerMetre, "facade-concrete"),
      );
    if (finished && use === "residential")
      paintHomeFace(ctx, structure, edge, project, pixelsPerMetre, entrances, clad, architecture);
    if (shopArt && isAnnex(structure, entrances))
      paintHomeAnnex(ctx, structure, edge, project, pixelsPerMetre, clad);
    for (const o of finished && use === "industrial"
      ? faceOpenings(structure, edge, entrances)
      : [])
      paintShedGlazing(ctx, finished!, pixelsPerMetre, o);
    // Storeys use world metres. Industrial sheds have a single clerestory,
    // not the same stacked apartment windows regardless of physical height.
    const industrial = structure.style === "workshop" || structure.style === "warehouse";
    const levels = industrial
      ? [Math.max(1.8, structure.height - 0.9)]
      : Array.from(
          { length: Math.max(1, Math.floor(structure.height / 3)) },
          (_, i) => 3.8 + i * 3,
        );
    for (const floor of levels.filter(
      (level) => !finished && level + (industrial ? 0.45 : 1.2) < structure.height,
    )) {
      const level = floor * pixelsPerMetre;
      const windowHeight = (industrial ? 0.45 : 1.2) * pixelsPerMetre;
      line(at(0, level), at(1, level), "#515355", 1);
      for (let i = 0; i < length; i += structure.style === "residential" ? 4 : 2) {
        const x = (i + 0.2) / length,
          w = 1.4 / length;
        const lit = (i + Math.floor(level)) % 4 === 0;
        poly(
          [
            at(x, level),
            at(x + w, level),
            at(x + w, level + windowHeight),
            at(x, level + windowHeight),
          ],
          lit ? "#988264" : "#14232c",
          "#616665",
        );
        line(at(x + w * 0.5, level), at(x + w * 0.5, level + windowHeight), shade, 0.9);
      }
    }
    // Shop/service doors at ground level, visually shut and mechanically solid.
    const doors =
      entrances === undefined
        ? Array.from({ length: Math.max(0, Math.floor((length - 2) / 4)) }, (_, i) => 2 + i * 4)
        : entrances
            .filter(
              (e) =>
                e.structureId === structure.id &&
                (edge === "north" ? e.position.y === r.y - 1 : e.position.x === r.x + r.width + 1),
            )
            .map((e) => (edge === "north" ? e.position.x - r.x : e.position.y - r.y));
    // Ground-floor bays give the street edge an occupied frontage, attached to
    // the existing facade. Recesses never add sidewalk collision or false doors.
    for (
      let start = 0.5;
      !finished && start + 2.2 < length;
      start += structure.style === "residential" ? 4 : 3
    ) {
      if (doors.some((door) => door > start - 1.1 && door < start + 3.3)) continue;
      const lo = start / length,
        hi = (start + 2.2) / length;
      const low = (industrial ? 1.25 : 0.65) * pixelsPerMetre,
        high = Math.min(2.35, structure.height - 0.3) * pixelsPerMetre;
      if (high <= low) continue;
      const shop = structure.style === "shop";
      // painted, below, by the art, in its own recess
      if (covers.bays) continue;
      poly(
        [at(lo, low), at(hi, low), at(hi, high), at(lo, high)],
        shop ? "#243f43" : industrial ? "#303d43" : "#263740",
        "#818780",
      );
      line(at((lo + hi) / 2, low), at((lo + hi) / 2, high), "#747e78", 1.5);
      if (industrial) {
        for (let z = low + 3; z < high; z += 4) line(at(lo, z), at(hi, z), "#536066", 0.9);
      } else {
        line(at(lo, low + 4), at(hi, low + 4), "#b5a387", 2);
        line(at(lo, high + 3), at(hi, high + 3), shop ? "#7b9a91" : "#95866f", 3);
      }
      // Flush facade piers and a continuous base articulate the mass without
      // putting decorative obstacles into the clear pedestrian route.
      line(at(lo - 0.01, 0), at(lo - 0.01, high + 5), "#242f35", 3);
    }
    if (!shopArt?.finish && !finished)
      line(at(0, 0.2 * pixelsPerMetre), at(1, 0.2 * pixelsPerMetre), "#73786f", 2);
    for (const centre of use === "residential" ? [] : doors) {
      if (covers.doors) continue;
      if (finished && use === "industrial") {
        paintLoadingDoor(
          ctx,
          finished,
          pixelsPerMetre,
          centre,
          Math.min(2.2, structure.height - 0.5),
          clad,
          faceBasis(structure, edge, project, pixelsPerMetre, "shutter"),
        );
        continue;
      }
      const x = (centre - 0.8) / length,
        w = 1.6 / length,
        doorHeight = Math.min(2.2, structure.height - 0.5) * pixelsPerMetre;
      const doorPlane = [at(x, 1), at(x + w, 1), at(x + w, doorHeight), at(x, doorHeight)];
      // The drawn slat lines mark a shop door as a roller shutter, so a shutter
      // texture belongs on exactly this plane and nowhere else.
      const shutter =
        clad !== undefined &&
        fillMaterial(ctx, clad, doorPlane, {
          key: "shutter",
          basis:
            edge === "north"
              ? wallBasis(project, "x", r.y, metres("shutter"), pixelsPerMetre)
              : wallBasis(project, "y", r.x + r.width, metres("shutter"), pixelsPerMetre),
          target: "#2b373c",
          strength: 0.9,
        });
      poly(doorPlane, shutter ? null : "#172329", "#626761");
      for (
        let z = 3;
        !shutter && structure.style !== "residential" && z < doorHeight;
        z += 0.2 * pixelsPerMetre
      )
        line(at(x, z), at(x + w, z), "#39464a", 1);
      const colour =
        structure.style === "residential"
          ? "#c6b38b"
          : structure.style === "shop"
            ? "#68b8ae"
            : "#bc925e";
      poly(
        [
          at(x - 0.02, doorHeight + 2),
          at(x + w + 0.02, doorHeight + 2),
          at(x + w + 0.02, doorHeight + 5),
          at(x - 0.02, doorHeight + 5),
        ],
        colour,
      );
      glow(
        at(x + w / 2, doorHeight + 3),
        20,
        structure.style === "shop" ? "rgba(58,199,188,.12)" : "rgba(230,157,66,.09)",
      );
    }
    if (shopArt?.finish)
      paintShopWall({
        ctx,
        structure,
        edge,
        project,
        ppm: pixelsPerMetre,
        entrances,
        doors: shopArt.doors,
        masonry: shopArt.art.paintedServiceMasonry,
      });
    if (shopArt)
      paintFacadeArt({
        ctx,
        structure,
        edge,
        project,
        ppm: pixelsPerMetre,
        art: shopArt.art,
        entrances,
        doors: shopArt.doors,
        ...(composed ? { skip: composedBays(composed) } : {}),
      });
    if (composed)
      paintReturnFace(ctx, composed, project, pixelsPerMetre, returns!.art, materials, "fittings");
    for (const t of shopArt?.finish || finished ? [] : [0.04, 0.94]) {
      line(at(t, 0), at(t, h), "#151f28", 3);
      line(at(t + 0.007, 0), at(t + 0.007, h), "#66706c", 0.8);
    }
  };
  face(base[0]!, base[1]!, r.width, "#515658", "north");
  face(base[1]!, base[2]!, r.height, "#353d42", "east");
  if (materials)
    for (const edge of ["north", "east"] as const)
      paintFrontageIdentity(
        ctx,
        structure,
        edge,
        { entrances, structures: frontage?.structures ?? [structure] },
        project,
        pixelsPerMetre,
        "albedo",
        architecture,
      );
  if (storefront)
    paintStorefrontFace({
      ctx,
      sf: storefront.sf,
      project,
      ppm: pixelsPerMetre,
      art: storefront.art,
      materials: clad,
      pass: "albedo",
      ...(frontage ? { frontage: frontageOnFace(frontage, structure, storefront.sf.edge) } : {}),
    });
  if (clad)
    for (const edge of ["north", "east"] as const)
      paintCommercialUpper(ctx, structure, edge, project, pixelsPerMetre, clad, architecture);
  if (clad)
    for (const edge of ["north", "east"] as const)
      paintCityBlockFace(
        ctx,
        structure,
        edge,
        entrances,
        project,
        pixelsPerMetre,
        clad,
        architecture,
        undefined,
        !!storefront && storefront.sf.edge === edge,
      );
  if (clad)
    for (const edge of ["north", "east"] as const) {
      // Finish the occupied facade after generic services, so nothing paints over its sign.
      paintOccupiedFrontage(
        ctx,
        structure,
        edge,
        entrances,
        project,
        pixelsPerMetre,
        "albedo",
        architecture,
      );
    }
  if (terrace) {
    ctx.restore();
    paintCommercialTerrace(
      ctx,
      structure,
      terrace,
      project,
      pixelsPerMetre,
      clad!,
      architecture,
      frontage?.role === "neighbour" ? "roof-ballast" : "roof-membrane",
    );
  } else {
    surface(
      top,
      palette[2]!,
      "#6c716b",
      frontage?.role === "neighbour" ? "roof-ballast" : "roof-membrane",
      groundBasis(project, h),
    );
    const homeRoof = clad && (use === "residential" || isAnnex(structure, entrances));
    if (homeRoof)
      paintResidentialRoof(
        ctx,
        project,
        pixelsPerMetre,
        structure,
        clad!,
        cityRoofUnits(structure),
      );
    else {
      // Roof seams and a raised rim give a mass rather than a flat perimeter rectangle.
      for (let i = 0; i < 4; i++) line(top[i]!, top[(i + 1) % 4]!, "#82837a", 2);
      // a neighbour's roof is ballasted, not a seamed membrane
      for (let t = 0.15; frontage?.role !== "neighbour" && t < 1; t += 0.18)
        line(
          {
            x: top[0]!.x + (top[1]!.x - top[0]!.x) * t,
            y: top[0]!.y + (top[1]!.y - top[0]!.y) * t,
          },
          {
            x: top[3]!.x + (top[2]!.x - top[3]!.x) * t,
            y: top[3]!.y + (top[2]!.y - top[3]!.y) * t,
          },
          "#323f43",
          1,
        );
      // a finished shop outside the block takes the same precast coping as the shop
      if (!frontage && shopArt?.finish)
        paintParapet(ctx, project, pixelsPerMetre, structure, "shop", clad);
      if (frontage) {
        paintParapet(ctx, project, pixelsPerMetre, structure, frontage.role, clad);
        for (const pipe of frontage.pipes.filter((p) => p.structure === structure))
          paintRoofOutlet(ctx, project, pixelsPerMetre, pipe);
      }
    }
    if (materials) paintCityRoof(ctx, structure, project, pixelsPerMetre, cityRoofUnits(structure));
    // Rooftop service equipment is dressing on an inaccessible building, not cover.
    for (const [i, equipment] of (materials
      ? cityRoofUnits(structure)
      : rooftopUnits(structure)
    ).entries()) {
      // the painted unit, in place of the drawn box, on every roof that takes materials
      const unit = materials ? architecture?.roofUnit : undefined;
      if (unit) {
        if (homeRoof) {
          ctx.save();
          ctx.beginPath();
          top.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
          ctx.closePath();
          ctx.clip();
        }
        paintRoofShade(
          ctx,
          project,
          pixelsPerMetre,
          equipment,
          h - (homeRoof ? RESIDENTIAL_ROOF_RECESS * pixelsPerMetre : 0),
        );
        if (homeRoof) ctx.restore();
        paintRoofUnitArt(ctx, project, equipment, h, unit);
        continue;
      }
      const bottom = corners(equipment, h),
        lid = corners(equipment, h + 8);
      if (storefront) paintRoofShade(ctx, project, pixelsPerMetre, equipment, h);
      // Painted sheet metal: a unit sits on the roof, so its tile stands on it.
      surface(
        [bottom[0]!, bottom[1]!, lid[1]!, lid[0]!],
        "#303e45",
        "#171f26",
        "painted-metal",
        wallBasis(project, "x", equipment.y, metres("painted-metal"), pixelsPerMetre, h),
      );
      surface(
        [bottom[1]!, bottom[2]!, lid[2]!, lid[1]!],
        "#26333b",
        "#171f26",
        "painted-metal",
        wallBasis(
          project,
          "y",
          equipment.x + equipment.width,
          metres("painted-metal"),
          pixelsPerMetre,
          h,
        ),
      );
      surface(lid, "#65706b", "#7e8279", "painted-metal", groundBasis(project, h + 8));
      if (storefront) {
        paintRooftopUnit(ctx, project, pixelsPerMetre, equipment, h, 8, i);
        continue;
      }
      const center = project({ x: equipment.x + 1, y: equipment.y + 1 });
      ctx.beginPath();
      ctx.ellipse(center.x, center.y - h - 8, 6, 3, 0, 0, Math.PI * 2);
      ctx.fillStyle = "#28373c";
      ctx.fill();
      line(
        { x: center.x - 5, y: center.y - h - 8 },
        { x: center.x + 5, y: center.y - h - 8 },
        "#909584",
        0.6,
      );
      line(
        { x: center.x, y: center.y - h - 11 },
        { x: center.x, y: center.y - h - 5 },
        "#909584",
        0.6,
      );
    }
  }
  // Paint with the parent mass: attachments inherit its sorting and actor fading.
  // The fixed isometric camera sees north/east facades, never the rear faces.
  for (const a of structure.attachments ?? []) {
    if (a.edge !== "north" && a.edge !== "east") continue;
    // The storefront's canopy is its own sprite, so it can sort and fade by itself.
    if (storefront && a.id === storefront.sf.awning.id) continue;
    // A painted roller shutter's guide rails and housing ARE its door's surround: where
    // one is painted, the saved surround over that door is drawn as it (the attachment
    // is unchanged; only its cream drawing gives way).
    if (covers.doors && a.kind === "entry-surround") {
      const centre = a.offset + a.span / 2;
      const { doors } = facadeOpenings(structure, entrances, a.edge);
      if (doors.some((d) => Math.abs(d - centre) < 0.5)) continue;
    }
    const at = (t: number, out: number, z: number) => {
      const p = project(attachmentPoint(structure, a, t, out));
      return { x: p.x, y: p.y - z * pixelsPerMetre };
    };
    if (a.kind === "service-surround" && use === "industrial") {
      paintServiceSurround(ctx, at, pixelsPerMetre, a.span, a.height, a.projection);
      continue;
    }
    if (a.kind === "awning") {
      const count = Math.ceil(a.span / 0.4);
      for (let i = 0; i < count; i++) {
        const lo = (a.span * i) / count,
          hi = (a.span * (i + 1)) / count;
        poly(
          [
            at(lo, 0, a.height),
            at(hi, 0, a.height),
            at(hi, a.projection, a.height - 0.25),
            at(lo, a.projection, a.height - 0.25),
          ],
          i % 2 ? "#c6b999" : "#527b76",
          "#364a4c",
        );
        poly(
          [
            at(lo, a.projection, a.height - 0.25),
            at(hi, a.projection, a.height - 0.25),
            at(hi, a.projection, a.height - 0.4),
            at(lo, a.projection, a.height - 0.4),
          ],
          i % 2 ? "#a89c7f" : "#3d5f5c",
        );
      }
      for (const t of [0, a.span])
        line(at(t, 0, a.height - 0.7), at(t, a.projection, a.height - 0.25), "#303f42", 2);
    } else {
      const commercial = a.kind === "retail-fascia",
        service = a.kind === "service-surround";
      const color = commercial ? "#467c76" : service ? "#a39469" : "#c0af91";
      poly(
        [
          at(0, a.projection, a.height - 0.3),
          at(a.span, a.projection, a.height - 0.3),
          at(a.span, 0, a.height),
          at(0, 0, a.height),
        ],
        color,
        "#26373d",
      );
      if (!commercial) {
        for (const t of [0, a.span]) {
          line(at(t, 0.05, 0), at(t, 0.05, a.height), "#243238", 7);
          line(at(t, 0.06, 0), at(t, 0.06, a.height), color, 3);
          if (service)
            for (let z = 0.2; z < 1; z += 0.2)
              line(at(t, 0.07, z), at(t, 0.07, z + 0.08), "#2e3638", 4);
        }
      } else {
        // One long display header belongs to the shop, rather than another stall.
        line(
          at(0.2, a.projection, a.height - 0.18),
          at(a.span - 0.2, a.projection, a.height - 0.18),
          "#b9c7b3",
          2,
        );
      }
    }
  }
}
