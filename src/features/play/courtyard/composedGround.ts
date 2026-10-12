import { residentialGround, groundSurfaceZones } from "./residentialFinish";
import { paintNightclubFloor } from "./nightclubFinish";
import { paintOfficeFloor } from "./officeFinish";
import { paintGarageWear } from "./garageFinish";
import { paintIndustrialFloor } from "./industrialFinish";
import { fixtureLamp } from "./cityFixtures";
import { interiorThresholds } from "./interiorThresholds";
import { paintRoadSurface } from "./groundFinish";
import { fillMaterial, groundBasis, type MaterialKey, type MaterialSet } from "./surfaceMaterials";
import type { Arena, Rect, SceneStructure, SceneEnvironment } from "@/engine";
import { paintStreetscape } from "./frontage";
import {
  blocksLight,
  paintGroundLight,
  type GroundLight,
  type NightLighting,
} from "./nightLighting";
import { SurfaceClass } from "./groundReflection";
import { painter, type Project } from "./composedPainter";

export function paintComposedGround(
  ctx: CanvasRenderingContext2D,
  arena: Arena,
  project: Project,
  materials?: MaterialSet,
  /** At night the lamps' and signs' light is its own layer, not baked into the ground. */
  night?: NightLighting,
) {
  const env = arena.environment!;
  const { rect, line, glow, corners: zoneCorners } = painter(ctx, project);
  // Roads and walks of an intersection take real materials; everything else
  // keeps its flat fill until its own pass.
  const textured =
    !env.interior && ["intersection", "alley", "residential"].includes(env.recipe)
      ? materials
      : undefined;
  const ground = groundBasis(project);
  if (env.interior) {
    rect({ x: 0, y: 0, ...arena.extent }, "#3b464c");
    if (env.recipe === "nightclub" && materials)
      paintNightclubFloor(ctx, project, { x: 0, y: 0, ...arena.extent }, "corridor", materials);
    if (env.recipe === "office" && materials)
      paintOfficeFloor(ctx, project, { x: 0, y: 0, ...arena.extent }, "corridor", materials);
    if (["warehouse", "garage"].includes(env.recipe) && materials)
      paintIndustrialFloor(
        ctx,
        project,
        { x: 0, y: 0, ...arena.extent },
        "corridor",
        materials,
        env.recipe === "garage",
      );
  }
  if (!env.interior) {
    const all = { x: -20, y: -20, width: 72, height: 72 };
    // Ground no zone claims (between a building and the walk) is old concrete hard
    // standing on a finished street, in large slabs; otherwise the flat dark fill.
    if (
      textured &&
      fillMaterial(ctx, textured, zoneCorners(all), {
        key: "facade-concrete",
        basis: ground,
        target: "#363c3d",
        strength: 0.7,
      })
    ) {
      for (let t = -20; t <= 52; t += 2) {
        line(project({ x: t, y: -20 }), project({ x: t, y: 52 }), "rgba(14,18,20,.35)", 0.8);
        line(project({ x: -20, y: t }), project({ x: 52, y: t }), "rgba(14,18,20,.35)", 0.8);
      }
    } else rect(all, "#293034");
  }
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
  const paintCrossing = (z: SceneEnvironment["zones"][number]) => {
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
  };
  for (const z of groundSurfaceZones(env)) {
    if (z.kind === "aisle") continue;
    if (env.interior) {
      if (env.recipe === "nightclub" && materials) {
        paintNightclubFloor(ctx, project, z.rect, z.kind, materials);
        continue;
      }
      if (env.recipe === "office" && materials) {
        paintOfficeFloor(ctx, project, z.rect, z.kind, materials);
        continue;
      }
      if (["warehouse", "garage"].includes(env.recipe) && materials) {
        paintIndustrialFloor(ctx, project, z.rect, z.kind, materials, env.recipe === "garage");
        continue;
      }
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
    // The old fill remains the fallback; loaded street materials retain more midtone detail.
    // A crosswalk is laid across the carriageway, so it sits on asphalt.
    // A loading court is surfaced like the road it opens on.
    const domestic = env.recipe === "residential" ? residentialGround(z.kind) : undefined;
    const surface: MaterialKey | undefined =
      domestic?.key ??
      (env.recipe === "alley" && z.kind === "loading"
        ? "facade-concrete"
        : z.kind === "road" ||
            z.kind === "intersection" ||
            z.kind === "crosswalk" ||
            z.kind === "loading" ||
            z.kind === "alley" ||
            z.kind === "parking"
          ? "asphalt"
          : z.kind === "sidewalk"
            ? "sidewalk"
            : undefined);
    const target =
      domestic?.target ??
      (surface === "asphalt" ? "#424b50" : surface === "sidewalk" ? "#66665b" : flat);
    const laid =
      surface !== undefined &&
      fillMaterial(ctx, textured, zoneCorners(z.rect), {
        key: surface,
        basis: ground,
        target,
        strength: surface === "asphalt" ? 0.98 : 0.92,
      });
    if (!laid) rect(z.rect, flat);
    if (!road && z.kind !== "crosswalk" && z.kind !== "garden" && z.kind !== "loading") {
      // A laid sidewalk has its own slab joints; the drawn metre grid is for
      // the flat fallback. The kerb line stays either way.
      if (!(laid && (z.kind === "sidewalk" || domestic)))
        for (let x = z.rect.x; x < z.rect.x + z.rect.width; x += 1)
          for (let y = z.rect.y; y < z.rect.y + z.rect.height; y += 1)
            rect(
              { x: x + 0.025, y: y + 0.025, width: 0.95, height: 0.95 },
              (x + y) % 3 === 0 ? "#3c4547" : "#454d4e",
              "#333d40",
            );
      // A laid walk meets the road at its kerb (`paintStreetscape`) and its
      // neighbours flush: the drawn outline is for the flat fallback.
      const c = painter(ctx, project).corners(z.rect);
      if (!laid) for (let i = 0; i < 4; i++) line(c[i]!, c[(i + 1) % 4]!, "#79817b", 1.5);
    }
    if (!textured?.asphalt) paintCrossing(z);
  }
  if (textured?.asphalt) paintRoadSurface(ctx, project, env);
  if (textured?.asphalt) for (const z of env.zones) paintCrossing(z);
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
    // On a finished street a working apron is asphalt and an entry is paved, both
    // laid at world scale under their marks; the flat fill is the fallback.
    const apron: MaterialKey | undefined =
      textured && z.floorUse === "handling"
        ? env.recipe === "alley"
          ? "facade-concrete"
          : "asphalt"
        : textured && z.floorUse === "entry"
          ? "sidewalk"
          : undefined;
    if (
      apron &&
      fillMaterial(ctx, textured, zoneCorners(z.rect), {
        key: apron,
        basis: ground,
        target: apron === "asphalt" ? "#3d4243" : "#5d605b",
        strength: 0.8,
      })
    ) {
      const c = zoneCorners(z.rect);
      // an entry's edge is a granite strip, not a painted outline
      if (z.floorUse === "entry")
        for (let i = 0; i < 4; i++) line(c[i]!, c[(i + 1) % 4]!, "rgba(170,168,156,.35)", 1.2);
      else for (let i = 0; i < 4; i++) line(c[i]!, c[(i + 1) % 4]!, colors[1]!, 1.2);
    } else if (env.recipe === "nightclub" && materials) {
      paintNightclubFloor(ctx, project, z.rect, "service", materials);
      rect(z.rect, null, colors[1]!);
    } else if (env.recipe === "office" && materials) {
      paintOfficeFloor(ctx, project, z.rect, "reception", materials);
      rect(z.rect, null, colors[1]!);
    } else if (["warehouse", "garage"].includes(env.recipe) && materials) {
      paintIndustrialFloor(ctx, project, z.rect, z.kind, materials, env.recipe === "garage");
      rect(z.rect, null, colors[1]!);
    } else rect(z.rect, colors[0]!, colors[1]!);
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
    if (z.floorUse === "entry" && !apron) {
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
    // The compact prototype parks on one curb: centre paint on its saved
    // travel reservation, not the full asphalt including parked cars.
    const travel =
      env.recipeVersion >= 11 && z.id === "street"
        ? env.zones.find((o) => o.id === "travel-lane")?.rect
        : undefined;
    for (let t = 0; t < length; t += 3) {
      const p = {
        x: travel ? travel.x + travel.width / 2 : z.rect.x + (vertical ? z.rect.width / 2 : t),
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
    const pad = { x: p.x - 0.8, y: p.y - 0.8, width: 1.6, height: 1.6 };
    // A threshold slab: one piece of paler concrete in front of the door, so the way
    // in is found by its material, not by a flat tinted square.
    if (
      textured &&
      fillMaterial(ctx, textured, zoneCorners(pad), {
        key: "facade-concrete",
        basis: ground,
        target: "#64665f",
        strength: 0.75,
      })
    ) {
      const c = zoneCorners(pad);
      for (let i = 0; i < 4; i++) line(c[i]!, c[(i + 1) % 4]!, "rgba(16,20,20,.5)", 0.9);
    } else rect(pad, "#596360");
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
  if (env.recipe === "garage" && materials) paintGarageWear(ctx, project, arena);
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
  // The architectural pilot's street: kerbs, channel, crossings and gullies.
  if (textured)
    paintStreetscape(
      ctx,
      env,
      project,
      Math.hypot(
        project({ x: 1, y: 0 }).x - project({ x: 0, y: 0 }).x,
        project({ x: 1, y: 0 }).y - project({ x: 0, y: 0 }).y,
      ),
      textured,
    );
  for (const d of env.dressing) {
    const p = project(d.position);
    if (!night && (d.kind === "lamp" || d.kind === "sign"))
      glow(p, 55, d.kind === "lamp" ? "rgba(243,185,104,.14)" : "rgba(77,196,195,.13)");
    if (d.kind === "drain" && !textured) {
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

/**
 * The light of the scene's saved lamps and signs, on the ground, at night. The shop's
 * own streetlight is left to the storefront, which places its pool under its head.
 */
export function dressingLights(
  env: SceneEnvironment,
  night: NightLighting,
  skip: ReadonlySet<string>,
): GroundLight[] {
  return env.dressing.flatMap((d): GroundLight[] => {
    if (skip.has(d.id) || d.kind !== "lamp") return [];
    return [{ kind: "pool", centre: fixtureLamp(env, d.position).at, ...night.streetLamp }];
  });
}

/** Paint ground lights onto the open ground only: none falls inside a building. */
export function paintGroundLights(
  ctx: CanvasRenderingContext2D,
  project: Project,
  structures: readonly SceneStructure[],
  lights: readonly GroundLight[],
) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(-4000, -4000, 8000, 8000);
  for (const s of structures) {
    if (!blocksLight(s)) continue;
    const r = s.rect;
    [
      { x: r.x, y: r.y },
      { x: r.x + r.width, y: r.y },
      { x: r.x + r.width, y: r.y + r.height },
      { x: r.x, y: r.y + r.height },
    ]
      .map(project)
      .forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
  }
  ctx.clip("evenodd");
  for (const light of lights) paintGroundLight(ctx, project, light);
  ctx.restore();
}

/**
 * What each pixel of an intersection's ground is, for its reflections
 * (`groundReflection.ts`): the same zones and floors `paintComposedGround` lays its
 * materials on, as flat class codes in the red channel. Building footprints give
 * nothing back. Markings and joints are told from the albedo afterwards.
 */
export function paintSurfaceClasses(
  ctx: CanvasRenderingContext2D,
  arena: Arena,
  project: Project,
  /** Doorsteps the saved zones do not mark: the shop's recess under its awning. */
  thresholds: readonly Rect[] = [],
) {
  const { rect } = painter(ctx, project);
  const code = (k: SurfaceClass) => `rgb(${k},0,0)`;
  const env = arena.environment!;
  rect({ x: -20, y: -20, width: 72, height: 72 }, code(SurfaceClass.concrete));
  for (const z of groundSurfaceZones(env)) {
    const k =
      env.recipe === "residential" && residentialGround(z.kind)?.planted
        ? SurfaceClass.none
        : env.recipe === "residential" && z.kind === "driveway"
          ? SurfaceClass.concrete
          : env.recipe === "alley" && z.kind === "loading"
            ? SurfaceClass.concrete
            : z.kind === "road" ||
                z.kind === "intersection" ||
                z.kind === "crosswalk" ||
                z.kind === "loading" ||
                z.kind === "parking" ||
                z.kind === "alley"
              ? SurfaceClass.asphalt
              : z.kind === "sidewalk"
                ? SurfaceClass.paving
                : undefined;
    if (k !== undefined) rect(z.rect, code(k));
  }
  for (const z of env.zones.filter((z) => z.floorUse)) {
    if (z.floorUse === "handling")
      rect(z.rect, code(env.recipe === "alley" ? SurfaceClass.concrete : SurfaceClass.asphalt));
    else if (z.floorUse === "entry") rect(z.rect, code(SurfaceClass.threshold));
  }
  for (const r of thresholds) rect(r, code(SurfaceClass.threshold));
  for (const st of env.structures) if (blocksLight(st)) rect(st.rect, code(SurfaceClass.none));
}

/**
 * The night's material grade: one multiplier per kind of ground, so asphalt, paving
 * and everything else do not all settle into the same blue-grey under one ambient.
 * Drawn per saved zone, at scene resolution; a smooth layer needs no more.
 */
export function paintNightGrade(
  ctx: CanvasRenderingContext2D,
  arena: Arena,
  project: Project,
  night: NightLighting,
) {
  const { rect } = painter(ctx, project);
  const css = (c: readonly number[]) => `rgb(${c.map((v) => Math.round(v * 255)).join(",")})`;
  rect({ x: -20, y: -20, width: 72, height: 72 }, "#ffffff");
  for (const z of arena.environment!.zones) {
    const grade =
      z.kind === "road" ||
      z.kind === "intersection" ||
      z.kind === "crosswalk" ||
      z.kind === "parking"
        ? night.grade.asphalt
        : z.kind === "sidewalk"
          ? night.grade.paving
          : undefined;
    if (grade) rect(z.rect, css(grade));
  }
}
