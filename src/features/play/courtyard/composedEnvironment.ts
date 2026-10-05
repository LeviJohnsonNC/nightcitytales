/** World-building art from the same resolved parcels that constrain play. */
import type Phaser from "phaser";
import { attachmentPoint } from "@/engine";
import { interiorThresholds } from "./interiorThresholds";
import { activityGroundPoints, activityOccluders } from "./activityReveal";
import { cutawayWalls, type CutawayWall } from "./cutawayGeometry";
import {
  SURFACE_MATERIALS,
  fillMaterial,
  groundBasis,
  prepareMaterials,
  wallBasis,
  type MaterialKey,
  type MaterialSet,
  type TileSource,
} from "./surfaceMaterials";
import type { Arena, Point, Rect, SceneStructure, SceneEnvironment } from "@/engine";

type Project = (p: Point) => Point;
function painter(ctx: CanvasRenderingContext2D, project: Project) {
  /** A null colour strokes the outline only: its fill was laid as a material. */
  const poly = (points: Point[], color: string | null, stroke?: string) => {
    ctx.beginPath();
    points.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
    if (color) {
      ctx.fillStyle = color;
      ctx.fill();
    }
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 0.7;
      ctx.stroke();
    }
  };
  const corners = (r: Rect, z = 0) =>
    [
      { x: r.x, y: r.y },
      { x: r.x + r.width, y: r.y },
      { x: r.x + r.width, y: r.y + r.height },
      { x: r.x, y: r.y + r.height },
    ].map((p) => {
      const q = project(p);
      return { x: q.x, y: q.y - z };
    });
  const rect = (r: Rect, color: string, stroke?: string) => poly(corners(r), color, stroke);
  const line = (a: Point, b: Point, color: string, width = 1) => {
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
  };
  const glow = (p: Point, radius: number, color: string) => {
    const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius);
    g.addColorStop(0, color);
    g.addColorStop(1, "transparent");
    ctx.fillStyle = g;
    ctx.fillRect(p.x - radius, p.y - radius, radius * 2, radius * 2);
  };
  return { poly, corners, rect, line, glow };
}

export function paintComposedGround(
  ctx: CanvasRenderingContext2D,
  arena: Arena,
  project: Project,
  materials?: MaterialSet,
) {
  const env = arena.environment!;
  const { rect, line, glow, corners: zoneCorners } = painter(ctx, project);
  // Roads and walks of an intersection take real materials; everything else
  // keeps its flat fill until its own pass.
  const textured = !env.interior && env.recipe === "intersection" ? materials : undefined;
  const ground = groundBasis(project);
  if (env.interior) rect({ x: 0, y: 0, ...arena.extent }, "#3b464c");
  if (!env.interior) rect({ x: -20, y: -20, width: 72, height: 72 }, "#293034");
  const floors: Record<string, string> = {
    reception: "#6c6257",
    workspace: "#34494e",
    meeting: "#4a5159",
    service: "#41474c",
    seating: "#442d49",
    performance: "#322a45",
    dance: "#232838",
    corridor: "#606366",
    doorway: "#748181",
    storage: "#454b4d",
    workbay: "#343e43",
    staging: "#665f46",
  };
  for (const z of env.zones) {
    if (z.kind === "aisle") continue;
    if (env.interior) {
      const color = floors[z.kind] ?? "#3b464c";
      rect(z.rect, color, "#19262f");
      for (let x = z.rect.x; x < z.rect.x + z.rect.width; x += 2)
        for (let y = z.rect.y; y < z.rect.y + z.rect.height; y += 2)
          rect(
            { x: x + 0.035, y: y + 0.035, width: 1.93, height: 1.93 },
            color,
            z.kind === "dance" ? "#745f85" : "#ffffff0b",
          );
      if (z.kind === "dance" || z.kind === "performance") {
        const corners = painter(ctx, project).corners(z.rect);
        for (let i = 0; i < 4; i++) line(corners[i]!, corners[(i + 1) % 4]!, "#ad699e", 2);
        glow(
          project({ x: z.rect.x + z.rect.width / 2, y: z.rect.y + z.rect.height / 2 }),
          100,
          "rgba(141,57,144,.13)",
        );
      }
      continue;
    }
    const road = ["road", "parking", "alley", "intersection"].includes(z.kind);
    const flat = road
      ? "#20292e"
      : z.kind === "garden"
        ? "#53604b"
        : z.kind === "driveway"
          ? "#4c4e4a"
          : z.kind === "loading"
            ? "#353b3c"
            : "#41494a";
    // The old fill is the fallback and the colour the material is graded to.
    // A crosswalk is laid across the carriageway, so it sits on asphalt.
    const surface: MaterialKey | undefined =
      z.kind === "road" || z.kind === "intersection" || z.kind === "crosswalk"
        ? "asphalt"
        : z.kind === "sidewalk"
          ? "sidewalk"
          : undefined;
    const target = z.kind === "crosswalk" ? "#20292e" : flat;
    const laid =
      surface !== undefined &&
      fillMaterial(ctx, textured, zoneCorners(z.rect), {
        key: surface,
        basis: ground,
        target,
        strength: surface === "asphalt" ? 0.75 : 0.8,
      });
    if (!laid) rect(z.rect, flat);
    if (!road && z.kind !== "crosswalk" && z.kind !== "garden" && z.kind !== "loading") {
      // A laid sidewalk has its own slab joints; the drawn metre grid is for
      // the flat fallback. The kerb line stays either way.
      if (!(laid && z.kind === "sidewalk"))
        for (let x = z.rect.x; x < z.rect.x + z.rect.width; x += 1)
          for (let y = z.rect.y; y < z.rect.y + z.rect.height; y += 1)
            rect(
              { x: x + 0.025, y: y + 0.025, width: 0.95, height: 0.95 },
              (x + y) % 3 === 0 ? "#3c4547" : "#454d4e",
              "#333d40",
            );
      const c = painter(ctx, project).corners(z.rect);
      for (let i = 0; i < 4; i++) line(c[i]!, c[(i + 1) % 4]!, "#79817b", 1.5);
    }
    if (z.kind === "crosswalk") {
      const horizontal = z.axis === "x";
      const length = horizontal ? z.rect.width : z.rect.height;
      for (let t = 0.3; t < length; t += 1)
        rect(
          {
            x: z.rect.x + (horizontal ? t : 0.2),
            y: z.rect.y + (horizontal ? 0.2 : t),
            width: horizontal ? 0.45 : z.rect.width - 0.4,
            height: horizontal ? z.rect.height - 0.4 : 0.45,
          },
          "#aaa99a",
        );
    }
  }
  // Saved functional floor reservations use the same treatment in any recipe.
  // Paint boundaries and material, not debug labels or another set of obstacles.
  for (const z of env.zones.filter((z) => z.floorUse)) {
    const colors = {
      customer: ["#746b53", "#b7a67b"],
      forecourt: ["#947b55", "#d3b986"],
      handling: ["#454845", "#c3a65c"],
      entry: ["#717970", "#a9b5a2"],
      staff: ["#3f5057", "#778e95"],
      visitor: ["#81745e", "#ac9c7e"],
    }[z.floorUse!]!;
    rect(z.rect, colors[0]!, colors[1]!);
    if (z.floorUse === "forecourt") {
      // A warm paved customer apron reads separately from the grey through-walk.
      // Keep all marks flush with the ground: these are not physical barriers.
      const r = z.rect;
      for (let y = r.y + 0.5; y < r.y + r.height; y += 0.5)
        line(project({ x: r.x, y }), project({ x: r.x + r.width, y }), "#ad936a", 0.7);
      for (let x = r.x + 0.5; x < r.x + r.width; x += 0.5)
        line(project({ x, y: r.y }), project({ x, y: r.y + r.height }), "#ad936a", 0.7);
    }
    if (z.floorUse === "handling") {
      const r = z.rect;
      // Short safety marks define the working apron without filling the route.
      for (let y = r.y + 0.2; y < r.y + r.height; y += 0.8)
        line(
          project({ x: r.x + 0.05, y }),
          project({ x: r.x + 0.4, y: y + 0.25 }),
          colors[1]!,
          1.4,
        );
    }
    if (z.floorUse === "entry") {
      const r = z.rect;
      rect(
        { x: r.x + 0.2, y: r.y + 0.2, width: r.width - 0.4, height: r.height - 0.4 },
        "#445150",
        "#8d9e95",
      );
    }
  }
  // Arrival landings are reserved floor geometry, visible before furniture.
  for (const z of env.zones.filter((z) => z.id === "entry_landing"))
    rect(z.rect, "#89785d", "#b5a17c");
  // Material changes and door sills make the saved openings readable without
  // debug markers. Main entries use a broad warm mat; service entries are metal.
  for (const threshold of interiorThresholds(arena)) {
    if (threshold.role === "passage") {
      rect(threshold.mat, "#606366");
      continue;
    }
    rect(
      threshold.mat,
      threshold.role === "primary"
        ? "#ae9770"
        : threshold.role === "service"
          ? "#777d79"
          : "#9aa5a0",
      "#27343b",
    );
    if (threshold.role !== "primary") continue;
    for (
      let t = 0.2;
      t < (threshold.horizontal ? threshold.mat.width : threshold.mat.height);
      t += 0.25
    ) {
      const r = threshold.mat;
      rect(
        threshold.horizontal
          ? { x: r.x + t, y: r.y, width: 0.035, height: r.height }
          : { x: r.x, y: r.y + t, width: r.width, height: 0.035 },
        "#26333855",
      );
    }
  }
  for (const cluster of env.clusters.filter((c) =>
    ["vehicle_bay", "service_bay"].includes(c.kind),
  )) {
    const pieces = env.props
      .filter((p) => p.clusterId === cluster.id)
      .map((p) => arena.cover!.find((c) => c.id === p.coverId)!.rect);
    const x = Math.min(...pieces.map((r) => r.x)),
      y = Math.min(...pieces.map((r) => r.y));
    const box = {
      x: x - 0.2,
      y: y - 0.2,
      width: Math.max(...pieces.map((r) => r.x + r.width)) - x + 0.4,
      height: Math.max(...pieces.map((r) => r.y + r.height)) - y + 0.4,
    };
    const corners = painter(ctx, project).corners(box);
    for (let i = 0; i < 4; i++) line(corners[i]!, corners[(i + 1) % 4]!, "#bdaa63", 1.2);
  }
  // Explicit curb bays are saved ground geometry, shared by any exterior recipe.
  // Their edge/end lines distinguish stationary vehicles from the through lane.
  for (const z of env.zones.filter((z) => z.kind === "parking")) {
    const r = z.rect;
    rect(
      { x: r.x + 0.1, y: r.y + 0.1, width: r.width - 0.2, height: r.height - 0.2 },
      "#30383b",
      "#a8aaa0",
    );
  }
  // Mark exterior parked-car groups from their saved sections. Intersection
  // curb lanes previously looked like travel lanes with arbitrary cars in them.
  if (!env.interior)
    for (const cluster of env.clusters.filter((c) => c.kind === "parking")) {
      const pieces = env.props
        .filter((p) => p.clusterId === cluster.id)
        .map((p) => arena.cover!.find((c) => c.id === p.coverId)!.rect);
      if (!pieces.length) continue;
      const x = Math.min(...pieces.map((r) => r.x)),
        y = Math.min(...pieces.map((r) => r.y));
      const width = Math.max(...pieces.map((r) => r.x + r.width)) - x;
      const height = Math.max(...pieces.map((r) => r.y + r.height)) - y;
      if (
        env.zones.some(
          (z) =>
            z.kind === "parking" &&
            x >= z.rect.x &&
            y >= z.rect.y &&
            x + width <= z.rect.x + z.rect.width &&
            y + height <= z.rect.y + z.rect.height,
        )
      )
        continue;
      const c = painter(ctx, project).corners({
        x: x + 0.08,
        y: y + 0.08,
        width: width - 0.16,
        height: height - 0.16,
      });
      for (let i = 0; i < 4; i++) line(c[i]!, c[(i + 1) % 4]!, "#858c82", 1);
    }
  // Lane paint belongs to the saved roads, interrupted at crossings and junctions.
  for (const z of env.zones.filter((z) => z.kind === "road")) {
    const vertical = z.axis === "y",
      length = vertical ? z.rect.height : z.rect.width;
    for (let t = 0; t < length; t += 3) {
      const p = {
        x: z.rect.x + (vertical ? z.rect.width / 2 : t),
        y: z.rect.y + (vertical ? t : z.rect.height / 2),
      };
      if (
        env.zones.some(
          (o) =>
            ["intersection", "crosswalk"].includes(o.kind) &&
            p.x >= o.rect.x &&
            p.x <= o.rect.x + o.rect.width &&
            p.y >= o.rect.y - 1 &&
            p.y <= o.rect.y + o.rect.height + 1,
        )
      )
        continue;
      rect({ ...p, width: vertical ? 0.08 : 1.4, height: vertical ? 1.4 : 0.08 }, "#b2a270");
    }
  }
  // Approaches are reserved geometry, not decorative doors placed behind crates.
  for (const e of env.entrances ?? []) {
    const p = e.position;
    rect({ x: p.x - 0.8, y: p.y - 0.8, width: 1.6, height: 1.6 }, "#596360");
    const structure = env.structures.find((s) => s.id === e.structureId)!;
    const wall = {
      x: Math.max(structure.rect.x, Math.min(p.x, structure.rect.x + structure.rect.width)),
      y: Math.max(structure.rect.y, Math.min(p.y, structure.rect.y + structure.rect.height)),
    };
    // A sill meets the actual facade rather than a floating debug-style box.
    const alongY = wall.x !== p.x;
    line(
      project({ x: wall.x - (alongY ? 0 : 0.8), y: wall.y - (alongY ? 0.8 : 0) }),
      project({ x: wall.x + (alongY ? 0 : 0.8), y: wall.y + (alongY ? 0.8 : 0) }),
      "#b1afa0",
      2,
    );
  }
  let seed = env.seed + 417;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let i = 0; i < 7500; i++) {
    const p = project({ x: random() * 48 - 8, y: random() * 48 - 8 });
    ctx.fillStyle = i % 3 ? "rgba(187,197,185,.045)" : "rgba(0,0,0,.12)";
    ctx.fillRect(p.x, p.y, random() * 3 + 0.3, 0.7);
  }
  for (const d of env.dressing) {
    const p = project(d.position);
    if (d.kind === "lamp" || d.kind === "sign")
      glow(p, 55, d.kind === "lamp" ? "rgba(243,185,104,.14)" : "rgba(77,196,195,.13)");
    if (d.kind === "drain") {
      rect({ x: d.position.x - 0.2, y: d.position.y - 0.2, width: 0.45, height: 0.7 }, "#141f25");
      for (let i = 0; i < 5; i++)
        line(
          project({ x: d.position.x - 0.2, y: d.position.y - 0.15 + i * 0.12 }),
          project({ x: d.position.x + 0.25, y: d.position.y - 0.15 + i * 0.12 }),
          "#526066",
          0.6,
        );
    }
    if (d.kind === "litter")
      for (let i = 0; i < 8; i++) {
        const q = project({ x: d.position.x + random() * 0.7, y: d.position.y + random() * 0.7 });
        ctx.fillStyle = i % 2 ? "#62665c" : "#888279";
        ctx.fillRect(q.x, q.y, 2 + random() * 2, 1.4);
      }
  }
}

/** Inaccessible mass is ground art; perimeter pieces sort independently. */
export function paintCutawayFloor(
  ctx: CanvasRenderingContext2D,
  structure: SceneStructure,
  project: Project,
) {
  const { rect, line } = painter(ctx, project);
  const r = structure.rect;
  rect(r, "#182329");
  for (let x = r.x + 0.6; x < r.x + r.width; x += 1.2)
    line(project({ x, y: r.y + 0.35 }), project({ x, y: r.y + r.height - 0.35 }), "#253238", 0.8);
}

function paintCutawayWall(
  ctx: CanvasRenderingContext2D,
  structure: SceneStructure,
  part: CutawayWall,
  project: Project,
  materials?: MaterialSet,
) {
  const { poly, corners } = painter(ctx, project);
  const metre = Math.hypot(
    project({ x: 1, y: 0 }).x - project({ x: 0, y: 0 }).x,
    project({ x: 1, y: 0 }).y - project({ x: 0, y: 0 }).y,
  );
  const warm = structure.style === "residential" || structure.style === "shop";
  const base = corners(part.rect),
    top = corners(part.rect, part.height * metre);
  const north = [base[0]!, base[1]!, top[1]!, top[0]!],
    east = [base[1]!, base[2]!, top[2]!, top[1]!];
  const r = part.rect;
  // The same facade material, anchored to the same world metres, as the full
  // building it replaces: revealing the street must not change what the wall is.
  const clad = materials && structure.style === "shop" ? materials : undefined;
  const concrete = SURFACE_MATERIALS["facade-concrete"].metres;
  const side = (points: Point[], flat: string, basis: ReturnType<typeof wallBasis>) => {
    if (fillMaterial(ctx, clad, points, { key: "facade-concrete", basis, target: flat })) {
      poly(points, null, "#17272d");
    } else poly(points, flat, "#17272d");
  };
  side(north, warm ? "#73675a" : "#59666a", wallBasis(project, "x", r.y, concrete, metre));
  side(east, "#35434a", wallBasis(project, "y", r.x + r.width, concrete, metre));
  poly(top, warm ? "#b0a18b" : "#95a4a0", "#293b42");
}

export function paintCutaway(
  ctx: CanvasRenderingContext2D,
  structure: SceneStructure,
  project: Project,
  entrances: SceneEnvironment["entrances"] = [],
  materials?: MaterialSet,
) {
  paintCutawayFloor(ctx, structure, project);
  const parts = cutawayWalls(structure, entrances);
  parts.sort(
    (a, b) =>
      project({ x: a.rect.x + a.rect.width / 2, y: a.rect.y + a.rect.height / 2 }).y -
      project({ x: b.rect.x + b.rect.width / 2, y: b.rect.y + b.rect.height / 2 }).y,
  );
  for (const part of parts) paintCutawayWall(ctx, structure, part, project, materials);
}

export function paintBuilding(
  ctx: CanvasRenderingContext2D,
  structure: SceneStructure,
  project: Project,
  entrances: SceneEnvironment["entrances"],
  materials?: MaterialSet,
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
    poly([base[0]!, base[1]!, top[1]!, top[0]!], "#687875", "#24353b");
    poly([base[1]!, base[2]!, top[2]!, top[1]!], "#384951", "#24353b");
    poly(top, "#94a19a");
    line(base[0]!, base[1]!, "#192f3a", 2);
    line(base[1]!, base[2]!, "#192f3a", 2);
    return;
  }
  const palette =
    structure.style === "residential"
      ? ["#766957", "#554f49", "#675346"]
      : structure.style === "shop"
        ? ["#49474a", "#333941", "#646360"]
        : structure.style === "workshop"
          ? ["#4b4940", "#353b3b", "#686356"]
          : ["#3e4a50", "#2c3942", "#56656b"];
  // Commercial frontage takes concrete, a membrane roof, painted rooftop units and
  // shuttered doors; every other building keeps its flat fills for now. Materials
  // are laid first, so windows, bays, doors and trim below paint over them.
  const clad = structure.style === "shop" ? materials : undefined;
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
  // Two camera-facing walls; windows, shutters, conduits, lintels share their planes.
  surface(
    [base[0]!, base[1]!, top[1]!, top[0]!],
    palette[0]!,
    "#111c25",
    "facade-concrete",
    wallBasis(project, "x", r.y, metres("facade-concrete"), pixelsPerMetre),
  );
  surface(
    [base[1]!, base[2]!, top[2]!, top[1]!],
    palette[1]!,
    "#111c25",
    "facade-concrete",
    wallBasis(project, "y", r.x + r.width, metres("facade-concrete"), pixelsPerMetre),
  );
  const face = (a: Point, b: Point, length: number, shade: string, edge: "north" | "east") => {
    const at = (t: number, z: number) => ({
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t - z,
    });
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
      (level) => level + (industrial ? 0.45 : 1.2) < structure.height,
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
      start + 2.2 < length;
      start += structure.style === "residential" ? 4 : 3
    ) {
      if (doors.some((door) => door > start - 1.1 && door < start + 3.3)) continue;
      const lo = start / length,
        hi = (start + 2.2) / length;
      const low = (industrial ? 1.25 : 0.65) * pixelsPerMetre,
        high = Math.min(2.35, structure.height - 0.3) * pixelsPerMetre;
      if (high <= low) continue;
      const shop = structure.style === "shop";
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
    line(at(0, 0.2 * pixelsPerMetre), at(1, 0.2 * pixelsPerMetre), "#73786f", 2);
    for (const centre of doors) {
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
    for (const t of [0.04, 0.94]) {
      line(at(t, 0), at(t, h), "#151f28", 3);
      line(at(t + 0.007, 0), at(t + 0.007, h), "#66706c", 0.8);
    }
  };
  face(base[0]!, base[1]!, r.width, "#515658", "north");
  face(base[1]!, base[2]!, r.height, "#353d42", "east");
  surface(top, palette[2]!, "#6c716b", "roof-membrane", groundBasis(project, h));
  // Roof seams and a raised rim give a mass rather than a flat perimeter rectangle.
  for (let i = 0; i < 4; i++) line(top[i]!, top[(i + 1) % 4]!, "#82837a", 2);
  for (let t = 0.15; t < 1; t += 0.18)
    line(
      { x: top[0]!.x + (top[1]!.x - top[0]!.x) * t, y: top[0]!.y + (top[1]!.y - top[0]!.y) * t },
      { x: top[3]!.x + (top[2]!.x - top[3]!.x) * t, y: top[3]!.y + (top[2]!.y - top[3]!.y) * t },
      "#323f43",
      1,
    );
  // Rooftop service equipment is dressing on an inaccessible building, not cover.
  for (let i = 0; i < Math.min(3, Math.floor((r.width - 1) / 3)); i++) {
    const equipment = {
      x: r.x + 0.5 + i * 3,
      y: r.y + Math.min(3, r.height - 2.5),
      width: 2,
      height: 2,
    };
    const bottom = corners(equipment, h),
      lid = corners(equipment, h + 8);
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
  // Paint with the parent mass: attachments inherit its sorting and actor fading.
  // The fixed isometric camera sees north/east facades, never the rear faces.
  for (const a of structure.attachments ?? []) {
    if (a.edge !== "north" && a.edge !== "east") continue;
    const at = (t: number, out: number, z: number) => {
      const p = project(attachmentPoint(structure, a, t, out));
      return { x: p.x, y: p.y - z * pixelsPerMetre };
    };
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

/** Each large mass is a separate sprite so actors can reveal it by occlusion fading. */
/** A material-bearing scene is drawn at twice the pixels, so a tile that covers a
 * few metres has the grain it was made with. The ceiling is the smallest GPU
 * texture limit worth supporting; past it the scene falls back toward 1x. */
const MATERIAL_SUPERSAMPLE = 2;
const MAX_TEXTURE_PIXELS = 4096;

export function createComposedEnvironment(
  scene: Phaser.Scene,
  arena: Arena,
  project: Project,
  /** Decoded tiles for the surfaces the recipe takes; absent means flat fills. */
  tiles?: Partial<Record<MaterialKey, TileSource>>,
): Phaser.GameObjects.Image[] {
  // Ground must extend with saved continuation geometry, not stop at the old
  // 1100x700 art sheet while building sprites float beyond its edge.
  const groundRect = arena.environment!.interior
    ? { x: 0, y: 0, ...arena.extent }
    : { x: -20, y: -20, width: 72, height: 72 };
  const groundCorners = [
    { x: groundRect.x, y: groundRect.y },
    { x: groundRect.x + groundRect.width, y: groundRect.y },
    { x: groundRect.x, y: groundRect.y + groundRect.height },
    { x: groundRect.x + groundRect.width, y: groundRect.y + groundRect.height },
  ].map(project);
  const gx = Math.floor(Math.min(...groundCorners.map((p) => p.x))) - 2;
  const gy = Math.floor(Math.min(...groundCorners.map((p) => p.y))) - 2;
  const gw = Math.ceil(Math.max(...groundCorners.map((p) => p.x))) - gx + 2;
  const gh = Math.ceil(Math.max(...groundCorners.map((p) => p.y))) - gy + 2;
  const metre = Math.hypot(
    project({ x: 1, y: 0 }).x - project({ x: 0, y: 0 }).x,
    project({ x: 1, y: 0 }).y - project({ x: 0, y: 0 }).y,
  );
  const materialised = arena.environment!.recipe === "intersection" && tiles !== undefined;
  const resolution = materialised
    ? Math.max(1, Math.min(MATERIAL_SUPERSAMPLE, MAX_TEXTURE_PIXELS / Math.max(gw, gh)))
    : 1;
  const materials = materialised ? prepareMaterials(tiles, metre * resolution) : undefined;
  const ground = scene.textures.createCanvas(
    "composed-ground",
    Math.ceil(gw * resolution),
    Math.ceil(gh * resolution),
  )!;
  ground.context.scale(resolution, resolution);
  ground.context.translate(-gx, -gy);
  paintComposedGround(ground.context, arena, project, materials);
  ground.refresh();
  scene.add
    .image(gx + gw / 2, gy + gh / 2, "composed-ground")
    .setDisplaySize(gw, gh)
    .setDepth(-1000);
  const objects: Phaser.GameObjects.Image[] = [];
  const occluders = activityOccluders(arena);
  const activity = activityGroundPoints(arena);
  const add = (
    key: string,
    paint: (ctx: CanvasRenderingContext2D) => void,
    depth: number,
    bounds: Rect = { x: 0, y: 0, width: 1100, height: 700 },
    /** Drawn at this many pixels per scene pixel, shown at scene size. */
    scale = 1,
  ) => {
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(bounds.width * scale);
    canvas.height = Math.ceil(bounds.height * scale);
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    ctx.scale(scale, scale);
    ctx.translate(-bounds.x, -bounds.y);
    paint(ctx);
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let left = canvas.width,
      right = 0,
      top = canvas.height,
      bottom = 0;
    for (let y = 0; y < canvas.height; y++)
      for (let x = 0; x < canvas.width; x++)
        if (pixels[(y * canvas.width + x) * 4 + 3]! > 5) {
          left = Math.min(left, x);
          right = Math.max(right, x);
          top = Math.min(top, y);
          bottom = Math.max(bottom, y);
        }
    if (right <= left || bottom <= top) return;
    const texture = scene.textures.createCanvas(key, right - left + 1, bottom - top + 1)!;
    texture.context.drawImage(
      canvas,
      left,
      top,
      right - left + 1,
      bottom - top + 1,
      0,
      0,
      right - left + 1,
      bottom - top + 1,
    );
    texture.refresh();
    const image = scene.add
      .image(bounds.x + (left + right) / 2 / scale, bounds.y + bottom / scale, key)
      .setOrigin(0.5, 1)
      .setScale(1 / scale)
      .setDepth(depth);
    objects.push(image);
    return image;
  };
  // Narrow jambs sit at opening boundaries. Each has its own depth so actors
  // remain correctly sorted; these are trim, not new collision objects.
  for (const threshold of interiorThresholds(arena)) {
    if (threshold.role === "passage") continue;
    const frameHeight = (threshold.role === "primary" ? 2.6 : 2.2) * metre;
    const ends = threshold.posts.map(project);
    const cap = ends.map((p) => ({ x: p.x, y: p.y - frameHeight }));
    add(
      `threshold-${threshold.id}-lintel`,
      (ctx) => {
        const { line } = painter(ctx, project);
        line(cap[0]!, cap[1]!, "#263439", 7);
        line(cap[0]!, cap[1]!, threshold.role === "primary" ? "#c9b284" : "#a5b1ac", 3);
      },
      Math.max(...ends.map((p) => p.y)),
      {
        x: Math.min(...cap.map((p) => p.x)) - 5,
        y: Math.min(...cap.map((p) => p.y)) - 5,
        width: Math.abs(cap[0]!.x - cap[1]!.x) + 10,
        height: Math.abs(cap[0]!.y - cap[1]!.y) + 10,
      },
    )?.setData("groundY", Math.max(...ends.map((p) => p.y)));
    for (const [i, post] of threshold.posts.entries()) {
      const p = project(post);
      const height = frameHeight;
      add(
        `threshold-${threshold.id}-${i}`,
        (ctx) => {
          const { line } = painter(ctx, project);
          line(p, { x: p.x, y: p.y - height }, "#263439", 6);
          line(
            { x: p.x + 1, y: p.y },
            { x: p.x + 1, y: p.y - height },
            threshold.role === "primary" ? "#c9b284" : "#a5b1ac",
            2.5,
          );
        },
        p.y,
        { x: p.x - 5, y: p.y - height - 4, width: 10, height: height + 8 },
      );
    }
  }
  for (const structure of arena.environment!.structures) {
    // Split wall painting, not collision, into grid-sized depth slices. A long
    // strip must not sort every section at its nearest corner's depth.
    const pieces: SceneStructure[] = [];
    if (structure.style === "interior-wall" || structure.style === "mesh-fence") {
      for (let y = structure.rect.y; y < structure.rect.y + structure.rect.height; y += 2)
        for (let x = structure.rect.x; x < structure.rect.x + structure.rect.width; x += 2)
          pieces.push({
            ...structure,
            id: `${structure.id}_${x}_${y}`,
            rect: {
              x,
              y,
              width: Math.min(2, structure.rect.x + structure.rect.width - x),
              height: Math.min(2, structure.rect.y + structure.rect.height - y),
            },
          });
    } else pieces.push(structure);
    for (const s of pieces) {
      const corners = [
        { x: s.rect.x, y: s.rect.y },
        { x: s.rect.x + s.rect.width, y: s.rect.y },
        { x: s.rect.x, y: s.rect.y + s.rect.height },
        { x: s.rect.x + s.rect.width, y: s.rect.y + s.rect.height },
      ].map(project);
      // A mass occludes from its nearest ground corner. Its centre can move
      // off-map as it grows, incorrectly painting ground props over its roof.
      let depth =
        s.style === "interior-wall" || s.style === "mesh-fence"
          ? project({ x: s.rect.x + s.rect.width / 2, y: s.rect.y + s.rect.height / 2 }).y
          : Math.max(...corners.map((p) => p.y));
      // Keep abutting foreground wings ahead of their parent mass: a long
      // side wall must not paint across the roof of an attached return.
      if (s.style !== "interior-wall" && s.style !== "mesh-fence") {
        const r = s.rect;
        for (const neighbour of arena.environment!.structures) {
          const n = neighbour.rect;
          const east = n.x === r.x + r.width && n.y < r.y + r.height && n.y + n.height > r.y;
          const north = n.y + n.height === r.y && n.x < r.x + r.width && n.x + n.width > r.x;
          if (east || north) depth = Math.min(depth, project({ x: n.x + n.width, y: n.y }).y - 0.1);
        }
      }
      const artCorners = [
        ...corners,
        ...(s.attachments ?? []).flatMap((a) =>
          [0, a.span].map((t) => project(attachmentPoint(s, a, t, a.projection))),
        ),
      ];
      const left = Math.floor(Math.min(...artCorners.map((p) => p.x))) - 8;
      const pixelsPerMetre = Math.hypot(
        project({ x: 1, y: 0 }).x - project({ x: 0, y: 0 }).x,
        project({ x: 1, y: 0 }).y - project({ x: 0, y: 0 }).y,
      );
      const top = Math.floor(Math.min(...corners.map((p) => p.y)) - s.height * pixelsPerMetre) - 16;
      const bounds = {
        x: left,
        y: top,
        width: Math.ceil(Math.max(...artCorners.map((p) => p.x))) - left + 8,
        height: Math.ceil(Math.max(...artCorners.map((p) => p.y))) - top + 8,
      };
      // Only a building that takes a material is worth drawing at double size.
      const clad = materials && s.style === "shop" ? resolution : 1;
      add(
        `structure-${s.id}`,
        (ctx) => paintBuilding(ctx, s, project, arena.environment!.entrances, materials),
        depth,
        bounds,
        clad,
      )
        ?.setData("activityLayer", occluders.has(structure.id) ? "full" : undefined)
        .setData("sortRect", s.rect);
      if (occluders.has(structure.id)) {
        add(`cutaway-${s.id}-ground`, (ctx) => paintCutawayFloor(ctx, s, project), -950, bounds)
          ?.setData("activityLayer", "cutaway")
          .setVisible(false);
        for (const [index, part] of cutawayWalls(
          s,
          arena.environment!.entrances,
          activity,
        ).entries()) {
          const r = part.rect;
          add(
            `cutaway-${s.id}-wall-${index}`,
            (ctx) => paintCutawayWall(ctx, s, part, project, materials),
            project({ x: r.x + r.width / 2, y: r.y + r.height / 2 }).y,
            bounds,
            clad,
          )
            ?.setData("activityLayer", "cutaway")
            .setData("sortRect", r)
            .setData("cutawayHeight", part.height)
            .setVisible(false);
        }
      }
    }
  }
  for (const d of arena.environment!.dressing) {
    if (d.kind === "litter" || d.kind === "drain") continue;
    const p = project(d.position);
    add(
      `dressing-${d.id}`,
      (ctx) => {
        const { line, glow, poly } = painter(ctx, project);
        ctx.fillStyle = "rgba(0,0,0,.24)";
        ctx.beginPath();
        ctx.ellipse(p.x + 3, p.y, 8, 3, 0, 0, Math.PI * 2);
        ctx.fill();
        if (d.kind === "lamp") {
          line(p, { x: p.x, y: p.y - 48 }, "#18232b", 3);
          line({ x: p.x + 1, y: p.y }, { x: p.x + 1, y: p.y - 48 }, "#7e8274", 0.8);
          line({ x: p.x, y: p.y - 48 }, { x: p.x + 12, y: p.y - 43 }, "#7e8274", 2);
          glow({ x: p.x + 12, y: p.y - 43 }, 13, "rgba(255,199,115,.35)");
          ctx.fillStyle = "#e1c294";
          ctx.fillRect(p.x + 8, p.y - 44, 7, 2);
        } else if (d.kind === "sign") {
          line(p, { x: p.x, y: p.y - 19 }, "#6f7976", 1.5);
          ctx.fillStyle = "#263d44";
          ctx.fillRect(p.x - 5, p.y - 28, 12, 14);
          ctx.fillStyle = "#c49671";
          ctx.fillRect(p.x - 3, p.y - 25, 8, 2);
          ctx.fillStyle = "#69b8b1";
          ctx.fillRect(p.x - 3, p.y - 20, 7, 1);
        } else if (d.kind === "stools") {
          for (const x of [-5, 5]) {
            line({ x: p.x + x, y: p.y }, { x: p.x + x, y: p.y - 5 }, "#707b78", 1);
            ctx.fillStyle = "#947a5c";
            ctx.beginPath();
            ctx.ellipse(p.x + x, p.y - 6, 3, 1.6, 0, 0, Math.PI * 2);
            ctx.fill();
          }
        } else if (d.kind === "bollards") {
          for (let i = 0; i < 3; i++) {
            line(
              { x: p.x + i * 5, y: p.y + i * 2 },
              { x: p.x + i * 5, y: p.y + i * 2 - 7 },
              "#a99a65",
              2,
            );
          }
        } else {
          poly(
            [
              { x: p.x - 5, y: p.y - 2 },
              { x: p.x, y: p.y - 5 },
              { x: p.x + 7, y: p.y - 1 },
              { x: p.x + 2, y: p.y + 2 },
            ],
            "#7e725b",
          );
          ctx.fillStyle = "#4a554e";
          ctx.fillRect(p.x - 4, p.y - 7, 6, 6);
          ctx.fillStyle = "#9c8a6b";
          ctx.fillRect(p.x - 3, p.y - 7, 5, 1);
        }
      },
      p.y,
    )?.setData("sortRect", { ...d.position, width: 0, height: 0 });
  }
  return objects;
}
