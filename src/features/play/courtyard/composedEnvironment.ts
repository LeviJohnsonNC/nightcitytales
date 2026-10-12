/** World-building art from the same resolved parcels that constrain play. */
import { nightclubLights } from "./nightclubFinish";
import { officeLights, paintOfficeFixture } from "./officeFinish";
import { industrialLights, paintIndustrialFixture } from "./industrialFinish";
import { hasServiceFrontage } from "./serviceFrontage";
import { marketReturnCanopies } from "./marketCanopy";
import { architecturalCasters } from "./architecturalShadows";
import {
  occupiedUse,
  occupiedLights,
  paintOccupiedBalcony,
  paintOccupiedCanopy,
  paintOccupiedFrontage,
} from "./occupiedFrontage";
import { fixtureExtent } from "./afterRainArt";
import { entranceLights, paintFrontageIdentity } from "./frontageIdentity";
import { createRainSurface } from "./afterRain";
import { fixtureLights, paintCityFixture, streetDirection } from "./cityFixtures";
import { commercialUpperWindows, COMMERCIAL_BASE } from "./commercialUpper";
import { commercialTerrace } from "./commercialTerrace";
import type Phaser from "phaser";
import { attachmentPoint } from "@/engine";
import { interiorThresholds } from "./interiorThresholds";
import { activityGroundPoints, activityOccluders } from "./activityReveal";
import { paintGroundFinish } from "./groundFinish";
import {
  lightOnFace,
  paintWallLights,
  paintWindowSurround,
  pointLights,
  storefrontWindows,
} from "./wallLight";
import { USE_WALL, buildingUse, litHomeWindows, facePainter, clipHomeFace } from "./buildingFaces";
import { cutawayWalls } from "./cutawayGeometry";
import {
  neighbourFronts,
  paintNeighbourLight,
  paintReturnLight,
  returnLights,
  shopReturns,
} from "./streetfront";
import { BAY, type ArchitectureArt } from "./architecturePack";
import { shopFace } from "./architectureArt";
import { STOREFRONT_LEVELS } from "./storefrontPack";
import { prepareMaterials, type MaterialKey, type TileSource } from "./surfaceMaterials";
import type { Arena, Rect, SceneStructure } from "@/engine";
import {
  awningFootprint,
  facePoint,
  paintAwning,
  paintStreetLamp,
  paintStorefrontGround,
  storefrontFor,
  storefrontLights,
  streetLamp,
  bladeSign,
  paintBladeSign,
  BLADE,
  type Pass,
  type StorefrontArt,
} from "./storefront";
import { paintFrontageGround, type Edge } from "./frontage";
import {
  INTERSECTION_NIGHT,
  nightFor,
  paintGroundLight,
  type GroundLight,
  type NightLighting,
} from "./nightLighting";
import { shadowCasters } from "./lampShadow";
import { type MirrorSource } from "./groundReflection";
import { painter, type Project } from "./composedPainter";
import { paintComposedGround, dressingLights } from "./composedGround";
import { paintCutawayFloor, paintCutawayWall, sectionBounds } from "./composedCutaway";
import { frontagePilot, paintBuilding, type Returns } from "./composedBuilding";
import {
  bladeMirror,
  lampMirror,
  litHomesPainter,
  surfaceLightCanvas,
  buildGroundLight,
  buildNightGrade,
  buildReflection,
  type ComposedShadows,
  type ComposedReflection,
} from "./composedNight";

export {
  paintComposedGround,
  dressingLights,
  paintGroundLights,
  paintSurfaceClasses,
  paintNightGrade,
} from "./composedGround";
export { paintCutawayFloor, paintCutawayWall } from "./composedCutaway";
export { frontagePilot, paintBuilding, type Returns, type BlockDetail } from "./composedBuilding";
export type { ComposedShadows, ComposedReflection } from "./composedNight";

/**
 * What the scene was built from. `objects` sort and fade with the actors; `lit` is
 * every image the night's ambient tints (the ground among them). An image whose
 * surface catches or gives light carries its light as `getData("light")`: an
 * additive sprite of the same size at the same place, which the renderer keeps at
 * its parent's visibility, alpha and depth, so a light can never come loose.
 */
export interface ComposedEnvironment {
  objects: Phaser.GameObjects.Image[];
  lit: Phaser.GameObjects.Image[];
  /** The night, if this scene has one, and what lights stand in it. `grade` is a
   * multiply layer over the ground that tells its materials apart at night. */
  night?: {
    config: NightLighting;
    lights: GroundLight[];
    grade?: Phaser.GameObjects.Image;
    /** The ground's lamp shadows as the street stands (`groundShadows.ts`). */
    shadows?: ComposedShadows;
    /** The shop corner's reflections in the street (`groundReflection.ts`). */
    reflection?: ComposedReflection;
  };
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
  /** The storefront's returned art. Without it the shop keeps its material-pass look. */
  storefrontArt?: StorefrontArt,
  /** The architectural pilot's art (`architecturePack.ts`). Without it, the drawn boxes and bays. */
  architectureArt?: ArchitectureArt,
  /** `false` builds no reflections at all, for measuring what they cost. */
  options: { reflections?: boolean } = {},
): ComposedEnvironment {
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
  const materialised =
    ["intersection", "alley", "warehouse", "garage", "office", "nightclub", "residential"].includes(
      arena.environment!.recipe,
    ) && tiles !== undefined;
  const resolution = materialised
    ? Math.max(1, Math.min(MATERIAL_SUPERSAMPLE, MAX_TEXTURE_PIXELS / Math.max(gw, gh)))
    : 1;
  const materials = materialised ? prepareMaterials(tiles, metre * resolution) : undefined;
  const env = arena.environment!;
  const storefronts =
    materials && storefrontArt
      ? env.structures.flatMap((s) => {
          const sf = storefrontFor(s, env, arena.cover ?? []);
          return sf ? [sf] : [];
        })
      : [];
  // the architectural pilot: each storefront's block, detailed as built
  const pilots = storefronts.map((sf) => frontagePilot(sf, env.structures, env.entrances));
  const detailOf = (s: SceneStructure) =>
    pilots.map((p) => p.detail(s)).find((d) => d !== undefined);
  // the shop's other faces, composed, where it has the art (`streetfront.ts`)
  const pipeAt = (s: SceneStructure, e: Edge) =>
    pilots.flatMap((p) => p.pipes).find((p) => p.structure === s && p.edge === e)?.s;
  const returns: Returns | undefined =
    materials && storefrontArt
      ? {
          faces: shopReturns(env, pipeAt),
          art: {
            ...(storefrontArt.window ? { interior: storefrontArt.window } : {}),
            ...(storefrontArt.paintedInterior ? { interior: storefrontArt.paintedInterior } : {}),
            ...(storefrontArt.paintedFrontage
              ? { paintedFrontage: storefrontArt.paintedFrontage }
              : {}),
            ...(storefrontArt.wall ? { wall: storefrontArt.wall } : {}),
            ...(storefrontArt.kanji ? { kanji: storefrontArt.kanji } : {}),
            ...(storefrontArt.service ? { service: storefrontArt.service } : {}),
          },
          neighbours: pilots.flatMap((p, i) =>
            neighbourFronts(p.neighbours, env.structures, pipeAt, {
              structure: storefronts[i]!.structure,
              edge: storefronts[i]!.edge,
            }),
          ),
        }
      : undefined;
  const returnCanopies = marketReturnCanopies(storefronts, env);
  const allCanopies = [...storefronts, ...returnCanopies];
  const returnsOf = (s: SceneStructure) => returns?.faces.filter((f) => f.structure === s) ?? [];
  const storefrontOf = (s: SceneStructure, pass: Pass = "albedo") => {
    const sf = storefronts.find((f) => f.structure.id === s.id);
    return sf && storefrontArt ? { sf, art: storefrontArt, pass } : undefined;
  };
  // the architectural art pilot, on the scenes that take materials only
  const architecture = materials ? architectureArt : undefined;
  const annexOf = (s: SceneStructure) => {
    const face = materials
      ? shopFace(s, env.entrances, architecture, !!storefrontOf(s), detailOf(s)?.role)
      : undefined;
    if (!face) return undefined;
    // the storefront's own face is its own routine's, on its pieces as on the wall
    const sf = storefrontOf(s)?.sf;
    return {
      ...face,
      edges: face.edges.filter((e) => e !== sf?.edge),
      entrances: env.entrances,
    };
  };
  const night = nightFor(env);
  const lights = night
    ? [
        ...industrialLights(env),
        ...officeLights(env),
        ...nightclubLights(env),
        ...storefronts.flatMap((sf) => storefrontLights(sf, night)),
        ...returnLights(returns?.faces ?? [], night),
        ...fixtureLights(env),
        ...entranceLights(env),
        ...occupiedLights(env),
        ...dressingLights(
          env,
          night,
          new Set(storefronts.some((sf) => sf.lamp) ? ["shop_lamp_detail_0"] : []),
        ),
      ]
    : [];
  // The same lights at their fixtures' heights, for the walls they reach (`wallLight.ts`).
  const wallLights = night ? pointLights(env, storefronts, night) : [];
  const reachesWall = (s: SceneStructure) =>
    wallLights.some((l) =>
      (["north", "east"] as const).some((e) => lightOnFace(s, e, l, env.structures)),
    );
  const paintLitHomes = litHomesPainter(night, architecture);
  const lit: Phaser.GameObjects.Image[] = [];
  const lightCanvas = surfaceLightCanvas(night);
  const ground = scene.textures.createCanvas(
    "composed-ground",
    Math.ceil(gw * resolution),
    Math.ceil(gh * resolution),
  )!;
  const groundFrame = (ctx: CanvasRenderingContext2D) => {
    ctx.scale(resolution, resolution);
    ctx.translate(-gx, -gy);
  };
  ground.context.save();
  groundFrame(ground.context);
  paintComposedGround(ground.context, arena, project, materials, night);
  // the street's wear, where its use puts it (`groundFinish.ts`); the shop's block
  // has its own wall feet and door wear, painted next
  if (materials)
    paintGroundFinish(
      ground.context,
      arena,
      project,
      new Set(pilots.flatMap((p) => p.masses.map((m) => m.id))),
      !!materials.sidewalk,
    );
  for (const sf of storefronts)
    paintStorefrontGround({
      ctx: ground.context,
      sf,
      project,
      ppm: metre,
      structures: env.structures,
      pass: "albedo",
    });
  for (const [k, sf] of storefronts.entries()) {
    const pilot = pilots[k]!;
    const entrance = (env.entrances ?? []).find((e) => e.structureId === sf.structure.id);
    paintFrontageGround({
      ctx: ground.context,
      project,
      ppm: metre,
      block: pilot.masses,
      structures: env.structures,
      pipes: pilot.pipes,
      ...(entrance
        ? {
            door: {
              at:
                sf.edge === "north"
                  ? { x: entrance.position.x, y: sf.structure.rect.y }
                  : { x: sf.structure.rect.x + sf.structure.rect.width, y: entrance.position.y },
              edge: sf.edge,
            },
          }
        : {}),
      // a vendor's stall cooks where it stands: its cover pieces
      stalls: env.props
        .filter((p) => p.art === "food-cart")
        .flatMap((p) => {
          const c = arena.cover?.find((q) => q.id === p.coverId);
          return c ? [c.rect] : [];
        }),
    });
  }
  if (night && materialised && !env.interior) {
    const wet = createRainSurface(env, project, { x: gx, y: gy, width: gw, height: gh });
    ground.context.drawImage(wet, gx, gy, gw, gh);
  }
  ground.context.restore();
  ground.refresh();
  const groundImage = scene.add
    .image(gx + gw / 2, gy + gh / 2, "composed-ground")
    .setDisplaySize(gw, gh)
    .setDepth(-1000);
  lit.push(groundImage);
  // Lamp shadows (`lampShadow.ts`): each prop near a light takes that light's share
  // off the ground behind it, on the intersection with materials.
  const casters =
    night && materialised
      ? [...shadowCasters(arena), ...architecturalCasters(env, allCanopies)]
      : [];
  const { shadows, groundLightSetup } = buildGroundLight(scene, {
    ground,
    groundFrame,
    groundImage,
    project,
    env,
    lights,
    casters,
    wallLights,
    night,
    gx,
    gy,
    gw,
    gh,
    resolution,
  });
  const grade = buildNightGrade(scene, arena, project, night, gx, gy, gw, gh);
  const objects: Phaser.GameObjects.Image[] = [];
  // The shop corner's lit things, for their reflections in the street (`groundReflection.ts`).
  const mirrorSources: MirrorSource[] = [];
  const mirrorOwners = new Map<string, Phaser.GameObjects.Image>();
  const reflects = !!night && materialised && !env.interior && options.reflections !== false;
  const occluders = activityOccluders(arena);
  const activity = activityGroundPoints(arena);
  const add = (
    key: string,
    paint: (ctx: CanvasRenderingContext2D) => void,
    depth: number,
    bounds: Rect = { x: 0, y: 0, width: 1100, height: 700 },
    /** Drawn at this many pixels per scene pixel, shown at scene size. */
    scale = 1,
    /** At night: the light this surface catches and gives, as its own sprite. */
    light?: (ctx: CanvasRenderingContext2D, pass: "light" | "glow") => void,
    /** Ground lines this sprite's lit picture is reflected about (`groundReflection.ts`). */
    mirrors?: readonly (Omit<MirrorSource, "paint" | "group"> &
      Partial<Pick<MirrorSource, "paint">>)[],
    /**
     * What of `light` the sprite emits, if not all of it: the passes it is reflected
     * from. Light that only falls on it (a wash on a wall) is not a source.
     */
    emissive?: (ctx: CanvasRenderingContext2D, pass: "light" | "glow") => void,
  ) => {
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(bounds.width * scale);
    canvas.height = Math.ceil(bounds.height * scale);
    const frame = (c: CanvasRenderingContext2D) => {
      c.scale(scale, scale);
      c.translate(-bounds.x, -bounds.y);
    };
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    ctx.save();
    frame(ctx);
    paint(ctx);
    ctx.restore();
    const glow = night && light ? lightCanvas(canvas, frame, light) : undefined;
    if (night && mirrors?.length && (emissive || glow)) {
      // what it emits, as the street sees it: its own light and glow passes, never its
      // art under the ambient
      const seen = emissive ? lightCanvas(canvas, frame, emissive) : glow!;
      for (const m of mirrors)
        mirrorSources.push({
          group: key,
          paint: (c) =>
            c.drawImage(seen, bounds.x, bounds.y, canvas.width / scale, canvas.height / scale),
          ...m,
        });
    }
    let left = canvas.width,
      right = 0,
      top = canvas.height,
      bottom = 0;
    const include = (x: number, y: number) => {
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
    };
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    for (let y = 0; y < canvas.height; y++)
      for (let x = 0; x < canvas.width; x++)
        if (pixels[(y * canvas.width + x) * 4 + 3]! > 5) include(x, y);
    // A halo past the albedo's edge widens its frame (kept as it was); the light
    // sprite is cropped to its own lit pixels, so a few lit windows on a big block
    // do not add a whole building's worth of additive fill every frame.
    let lightPixels = 0;
    const glowBox = { left: canvas.width, right: 0, top: canvas.height, bottom: 0 };
    if (glow) {
      const g = glow.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height).data;
      for (let y = 0; y < canvas.height; y++)
        for (let x = 0; x < canvas.width; x++) {
          const i = (y * canvas.width + x) * 4;
          if (g[i + 3]! > 5 && g[i]! + g[i + 1]! + g[i + 2]! > 6) {
            include(x, y);
            lightPixels++;
            glowBox.left = Math.min(glowBox.left, x);
            glowBox.right = Math.max(glowBox.right, x);
            glowBox.top = Math.min(glowBox.top, y);
            glowBox.bottom = Math.max(glowBox.bottom, y);
          }
        }
    }
    if (right <= left || bottom <= top) return;
    const [cropL, cropR, cropT, cropB] = [left, right, top, bottom];
    const crop = (
      source: HTMLCanvasElement,
      name: string,
      { left, right, top, bottom } = { left: cropL, right: cropR, top: cropT, bottom: cropB },
    ) => {
      const texture = scene.textures.createCanvas(name, right - left + 1, bottom - top + 1)!;
      texture.context.drawImage(
        source,
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
      return scene.add
        .image(bounds.x + (left + right) / 2 / scale, bounds.y + bottom / scale, name)
        .setOrigin(0.5, 1)
        .setScale(1 / scale);
    };
    const image = crop(canvas, key).setDepth(depth);
    if (mirrorSources.some((m) => m.group === key)) mirrorOwners.set(key, image);
    if (glow && lightPixels)
      image.setData(
        "light",
        crop(glow, `${key}-light`, glowBox)
          .setBlendMode("ADD")
          .setDepth(depth + 0.5)
          .setVisible(false),
      );
    objects.push(image);
    lit.push(image);
    return image;
  };
  for (const light of [...industrialLights(env), ...officeLights(env), ...nightclubLights(env)]) {
    const paintFixture = env.recipe === "office" ? paintOfficeFixture : paintIndustrialFixture;
    const p = project(light.centre);
    const lift = light.sourceZ! * metre;
    const fixture = add(
      light.id,
      (ctx) => paintFixture(ctx, project, metre, light),
      p.y + 0.4,
      { x: p.x - metre * 1.8, y: p.y - lift - metre, width: metre * 3.6, height: metre * 2 },
      2,
      (ctx) => paintFixture(ctx, project, metre, light, true),
    );
    // Hanging fixtures sort above their ground position without acting as cover.
    fixture
      ?.setData("groundY", p.y)
      .setData("sortRect", {
        x: light.centre.x - 0.65,
        y: light.centre.y - (env.recipe === "office" ? 0.25 : 0.09),
        width: 1.3,
        height: env.recipe === "office" ? 0.5 : 0.18,
      })
      .setData("elevation", { bottom: light.sourceZ! - 0.1, top: light.sourceZ! + 0.48 });
  }
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
      // Only a building that takes a material is worth drawing at double size; the
      // finished storefront, whose sign and windows are read up close, at more.
      const clad =
        materials && (s.style === "shop" || buildingUse(s))
          ? resolution * (storefrontOf(s) || returnsOf(s).length ? 1.5 : 1)
          : 1;
      const front = storefrontOf(s);
      const composed = returnsOf(s);
      const boards = (returns?.neighbours ?? []).filter((n) => n.structure === s && n.board);
      // the shop's display round the corner, lit like its shopfront, a little less
      const paintComposedLight = (ctx: CanvasRenderingContext2D, pass: "light" | "glow") => {
        for (const f of composed)
          paintReturnLight(ctx, f, project, metre, returns!.art, night!, pass);
      };
      // the secondary light: a few occupied homes (`litHomeWindows`), each a visible
      // source with its own room, glass, sill and the wall round it
      const upperRooms = materials ? (commercialTerrace(s) ?? s) : s;
      const homes = night
        ? [
            ...litHomeWindows(s, arena.environment!.entrances, env.structures),
            ...(["north", "east"] as const).flatMap((edge) =>
              commercialUpperWindows(upperRooms, edge)
                .filter((w) => w.occupancy !== "dark")
                .map((opening) => ({ edge, opening })),
            ),
          ].map((h) => ({
            ...h,
            face: facePainter(
              h.opening.z0 >= COMMERCIAL_BASE ? upperRooms : s,
              h.edge,
              project,
              metre,
            ),
          }))
        : [];
      // the shopfront and its composed returns, each face flipped about its own foot
      const faceMirrors =
        reflects && (front || occupiedUse(s) === "repair" || hasServiceFrontage(s))
          ? [
              ...new Set<Edge>(
                front ? [front.sf.edge, ...composed.map((c) => c.edge)] : ["north", "east"],
              ),
            ].map((edge) => {
              const r = s.rect;
              const lift = (s.height + 1.5) * metre;
              const [a, b] =
                edge === "north"
                  ? [project({ x: r.x, y: r.y }), project({ x: r.x + r.width, y: r.y })]
                  : [
                      project({ x: r.x + r.width, y: r.y }),
                      project({ x: r.x + r.width, y: r.y + r.height }),
                    ];
              return {
                a: a!,
                b: b!,
                gain: front ? 1.6 : 2,
                extent: [a!, b!, { x: b!.x, y: b!.y - lift }, { x: a!.x, y: a!.y - lift }],
              };
            })
          : undefined;
      const building = add(
        `structure-${s.id}`,
        (ctx) =>
          paintBuilding(
            ctx,
            s,
            project,
            arena.environment!.entrances,
            materials,
            storefrontOf(s),
            detailOf(structure),
            architecture,
            returns,
            env.recipe === "office",
            env.recipe === "nightclub",
            env.recipe === "residential",
          ),
        depth,
        bounds,
        clad,
        front
          ? (ctx, pass) => {
              paintBuilding(
                ctx,
                s,
                project,
                arena.environment!.entrances,
                materials,
                storefrontOf(s, pass),
                detailOf(structure),
                architecture,
              );
              paintComposedLight(ctx, pass);
              paintLitHomes(ctx, pass, homes);
              if (pass !== "light") return;
              paintWallLights(ctx, s, project, metre, wallLights, env.structures);
              // the lit rooms reach their sills, reveals and the wall round them
              const at = facePoint(front.sf, project, metre);
              for (const w of storefrontWindows(front.sf))
                paintWindowSurround(ctx, at, w, night!.window.color, 0.32);
            }
          : night &&
              (reachesWall(s) ||
                homes.length ||
                composed.length ||
                boards.length ||
                occupiedUse(s) ||
                hasServiceFrontage(s) ||
                s.style === "workshop" ||
                s.style === "residential")
            ? (ctx, pass) => {
                if (pass === "light")
                  paintWallLights(ctx, s, project, metre, wallLights, env.structures);
                paintLitHomes(ctx, pass, homes);
                for (const edge of ["north", "east"] as const)
                  paintFrontageIdentity(ctx, s, edge, env, project, metre, pass, architecture);
                paintComposedLight(ctx, pass);
                for (const b of boards) paintNeighbourLight(ctx, b, project, metre, night!, pass);
              }
            : undefined,
        faceMirrors,
        // what the shopfront emits: its glow, and its light inside the lit bays only (the
        // rooms), never the washes on its walls, sills and parapet
        faceMirrors && front
          ? (ctx, pass) => {
              ctx.save();
              if (pass === "light") {
                const bays = [
                  facePainter(s, front.sf.edge, project, metre).quad(
                    front.sf.door - 0.8,
                    front.sf.door + 0.8,
                    0.05,
                    1.84,
                  ),
                  ...storefrontWindows(front.sf).map((w) =>
                    facePainter(s, front.sf.edge, project, metre).quad(w.s0, w.s1, w.z0, w.z1),
                  ),
                  ...composed.flatMap((c) =>
                    c.display.map((s0) =>
                      facePainter(s, c.edge, project, metre).quad(
                        s0,
                        s0 + BAY.width,
                        BAY.sill,
                        BAY.head,
                      ),
                    ),
                  ),
                ];
                ctx.beginPath();
                for (const q of bays)
                  q.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
                ctx.clip();
              }
              paintBuilding(
                ctx,
                s,
                project,
                arena.environment!.entrances,
                materials,
                storefrontOf(s, pass),
                detailOf(structure),
                architecture,
              );
              paintComposedLight(ctx, pass);
              ctx.restore();
            }
          : faceMirrors && (occupiedUse(s) === "repair" || hasServiceFrontage(s))
            ? (ctx, pass) => {
                // Reflect emitters only; never mirror the wall wash as another light source.
                for (const edge of ["north", "east"] as const)
                  paintOccupiedFrontage(
                    ctx,
                    s,
                    edge,
                    env.entrances,
                    project,
                    metre,
                    pass,
                    architecture,
                    true,
                  );
              }
            : undefined,
      )
        ?.setData("activityLayer", occluders.has(structure.id) ? "full" : undefined)
        .setData("foregroundStructure", materialised ? s : undefined)
        .setData("foregroundRole", "building")
        .setData("sortRect", s.rect);
      if (occluders.has(structure.id)) {
        add(`cutaway-${s.id}-ground`, (ctx) => paintCutawayFloor(ctx, s, project), -950, bounds)
          ?.setData("activityLayer", "cutaway")
          .setData("foregroundStructure", materialised ? s : undefined)
          .setData("foregroundRole", "floor")
          .setVisible(false);
        for (const [index, part] of cutawayWalls(
          s,
          arena.environment!.entrances,
          activity,
        ).entries()) {
          const r = part.rect;
          add(
            `cutaway-${s.id}-wall-${index}`,
            (ctx) =>
              paintCutawayWall(
                ctx,
                s,
                part,
                project,
                materials,
                storefrontOf(s),
                buildingUse(s)
                  ? USE_WALL[buildingUse(s)!]
                  : detailOf(structure)?.role === "neighbour"
                    ? "painted-render"
                    : undefined,
                annexOf(s),
                returns,
                { entrances: arena.environment!.entrances, art: architecture },
              ),
            project({ x: r.x + r.width / 2, y: r.y + r.height / 2 }).y,
            bounds,
            clad,
            front ||
              (night &&
                (reachesWall(s) ||
                  composed.length ||
                  homes.length ||
                  occupiedUse(s) ||
                  hasServiceFrontage(s) ||
                  s.style === "workshop" ||
                  s.style === "residential"))
              ? (ctx, pass) => {
                  if (front)
                    paintCutawayWall(ctx, s, part, project, materials, storefrontOf(s, pass));
                  // a piece of a lit face keeps that face's light, up to its own height
                  const edge =
                    r.y === s.rect.y
                      ? ("north" as const)
                      : r.x + r.width === s.rect.x + s.rect.width
                        ? ("east" as const)
                        : undefined;
                  if (!edge) return;
                  const s0 = edge === "north" ? r.x - s.rect.x : r.y - s.rect.y;
                  const piece = {
                    s0,
                    s1: s0 + (edge === "north" ? r.width : r.height),
                    zMax: part.height,
                  };
                  paintLitHomes(
                    ctx,
                    pass,
                    homes.filter((h) => h.edge === edge),
                    piece,
                  );
                  ctx.save();
                  clipHomeFace(ctx, facePainter(s, edge, project, metre), piece);
                  paintFrontageIdentity(ctx, s, edge, env, project, metre, pass, architecture);
                  ctx.restore();
                  for (const f of composed.filter((c) => c.edge === edge))
                    paintReturnLight(ctx, f, project, metre, returns!.art, night!, pass, piece);
                  if (pass !== "light") return;
                  paintWallLights(ctx, s, project, metre, wallLights, env.structures, {
                    edge,
                    s0,
                    s1: s0 + (edge === "north" ? r.width : r.height),
                    zMax: part.height,
                  });
                }
              : undefined,
          )
            ?.setData("activityLayer", "cutaway")
            .setData("sortRect", r)
            .setData("cutawayHeight", part.height)
            .setVisible(false);
        }
      }
      // Automatic foreground cutaway: cache small wall sections from the exact
      // finished full-building art. No repainting during movement, and no duplicate
      // facade implementation that could drop a shopfront or its light.
      if (materialised && building && occluders.has(s.id)) {
        const parts = cutawayWalls(s, arena.environment!.entrances);
        for (const [index, part] of parts.entries()) {
          const r = part.rect;
          const north = r.y === s.rect.y;
          const east = r.x + r.width === s.rect.x + s.rect.width;
          const high = north || east;
          const mark = (image: Phaser.GameObjects.Image | undefined, role: string) =>
            image
              ?.setData("activityLayer", "automatic")
              .setData("foregroundStructure", s)
              .setData("foregroundRole", role)
              .setData("sectionRect", r)
              .setData("hasTallSection", high)
              .setData("sortRect", r)
              .setVisible(false);
          const edge = north ? "north" : "east";
          const face = facePainter(s, edge, project, metre);
          const s0 = north ? r.x - s.rect.x : r.y - s.rect.y;
          const s1 = s0 + (north ? r.width : r.height);
          const draw = (
            ctx: CanvasRenderingContext2D,
            image: Phaser.GameObjects.Image,
            height = s.height,
          ) => {
            const polygon = face.quad(s0, s1, 0, height);
            ctx.save();
            ctx.beginPath();
            polygon.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
            ctx.closePath();
            ctx.clip();
            ctx.drawImage(
              image.texture.getSourceImage() as CanvasImageSource,
              image.x - image.displayWidth / 2,
              image.y - image.displayHeight,
              image.displayWidth,
              image.displayHeight,
            );
            ctx.restore();
          };
          const light = building.getData("light") as Phaser.GameObjects.Image | undefined;
          const low = { ...part, height: 0.65 };
          const lowerBounds = sectionBounds(r, 0.65, project, metre);
          mark(
            add(
              `automatic-${s.id}-${index}-low`,
              (ctx) =>
                paintCutawayWall(
                  ctx,
                  s,
                  low,
                  project,
                  materials,
                  storefrontOf(s),
                  buildingUse(s)
                    ? USE_WALL[buildingUse(s)!]
                    : detailOf(s)?.role === "neighbour"
                      ? "painted-render"
                      : undefined,
                  annexOf(s),
                  returns,
                  { entrances: arena.environment!.entrances, art: architecture },
                ),
              project({ x: r.x + r.width / 2, y: r.y + r.height / 2 }).y,
              lowerBounds,
              clad,
              high && light
                ? (ctx, pass) => {
                    if (pass === "glow") draw(ctx, light, low.height);
                  }
                : undefined,
            ),
            "low",
          );
          if (!high) continue;
          mark(
            add(
              `automatic-${s.id}-${index}-high`,
              (ctx) => draw(ctx, building),
              project({ x: r.x + r.width / 2, y: r.y + r.height / 2 }).y,
              sectionBounds(r, s.height, project, metre),
              clad,
              light
                ? (ctx, pass) => {
                    if (pass === "glow") draw(ctx, light);
                  }
                : undefined,
            ),
            "high",
          );
        }
      }
      // Projecting repair fittings are independent volumes. Baking them into the
      // wall made a foreground prop win against the whole balcony, and clipping
      // that image to a revealed wall sliced the canopy in half.
      if (materialised && occupiedUse(s) === "repair") {
        for (const edge of ["north", "east"] as const) {
          const face = facePainter(s, edge, project, metre);
          for (const balcony of edge === "east" ? [false, true] : [false]) {
            const a = balcony ? 0.86 : 0.08;
            const b = balcony ? Math.min(5.14, face.length - 0.08) : face.length - 0.08;
            const reach = balcony ? 0.98 : 0.72;
            const low = balcony ? 3.65 : 2.25; // Include the shade below the projecting fitting.
            const high = balcony ? 6.98 : 3.05;
            const points = [a, b].flatMap((x) =>
              [0, reach].flatMap((out) => [low, high].map((z) => face.at(x, out, z))),
            );
            const x = Math.min(...points.map((p) => p.x)) - 5;
            const y = Math.min(...points.map((p) => p.y)) - 5;
            const footprint =
              edge === "north"
                ? { x: s.rect.x + a, y: s.rect.y - reach, width: b - a, height: reach }
                : { x: s.rect.x + s.rect.width, y: s.rect.y + a, width: reach, height: b - a };
            const section =
              edge === "north"
                ? { x: s.rect.x + a, y: s.rect.y, width: b - a, height: 0.24 }
                : {
                    x: s.rect.x + s.rect.width - 0.24,
                    y: s.rect.y + a,
                    width: 0.24,
                    height: b - a,
                  };
            const supports = cutawayWalls(s, env.entrances, activity).filter(
              (p) =>
                p.rect.x < section.x + section.width &&
                p.rect.x + p.rect.width > section.x &&
                p.rect.y < section.y + section.height &&
                p.rect.y + p.rect.height > section.y,
            );
            add(
              `repair-${balcony ? "balcony" : "canopy"}-${s.id}-${edge}`,
              (ctx) =>
                (balcony ? paintOccupiedBalcony : paintOccupiedCanopy)(
                  ctx,
                  s,
                  edge,
                  project,
                  metre,
                  architecture,
                ),
              Math.max(...points.map((p) => p.y)) + low * metre,
              {
                x,
                y,
                width: Math.max(...points.map((p) => p.x)) - x + 5,
                height: Math.max(...points.map((p) => p.y)) - y + 5,
              },
              clad,
            )
              ?.setData("activityLayer", "awning")
              .setData("foregroundStructure", s)
              .setData("sectionRect", section)
              .setData(
                "revealOk",
                !occluders.has(s.id) ||
                  (supports.length > 0 && supports.every((p) => p.height >= high)),
              )
              .setData("sortRect", footprint)
              .setData("elevation", { bottom: balcony ? 4.27 : 2.45, top: high })
              .setData("fadeWith", building);
          }
        }
      }
      // The canopy is its own sprite: it sorts by its footprint, fades for actors
      // under it, and in the cutaway shows only while the wall it hangs from is kept.
      if (storefrontArt)
        for (const sf of [
          ...(front ? [front.sf] : []),
          ...returnCanopies.filter((c) => c.structure === s),
        ]) {
          const at = facePoint(sf, project, metre);
          const { offset, span, projection } = sf.awning;
          const L = STOREFRONT_LEVELS;
          const edges = [
            at(offset, 0, L.awningWall - 0.7),
            at(offset + span, 0, L.awningWall - 0.7),
            at(offset + span, projection, L.awningOuter - 0.4),
            at(offset, projection, L.awningOuter - 0.4),
            at(offset, 0, L.awningWall),
            at(offset + span, 0, L.awningWall),
          ];
          const awningBounds = {
            x: Math.floor(Math.min(...edges.map((p) => p.x))) - 10,
            y: Math.floor(Math.min(...edges.map((p) => p.y))) - 10,
            width:
              Math.ceil(Math.max(...edges.map((p) => p.x)) - Math.min(...edges.map((p) => p.x))) +
              20,
            height:
              Math.ceil(Math.max(...edges.map((p) => p.y)) - Math.min(...edges.map((p) => p.y))) +
              20,
          };
          const wall = s.rect;
          const supports = cutawayWalls(s, arena.environment!.entrances, activity).filter((p) =>
            sf.edge === "north"
              ? p.rect.y === wall.y &&
                p.rect.x < wall.x + offset + span &&
                p.rect.x + p.rect.width > wall.x + offset
              : p.rect.x + p.rect.width === wall.x + wall.width &&
                p.rect.y < wall.y + offset + span &&
                p.rect.y + p.rect.height > wall.y + offset,
          );
          const kept =
            !occluders.has(s.id) ||
            (supports.length > 0 && supports.every((p) => p.height >= L.awningWall - 1e-9));
          const footprint = awningFootprint(sf);
          const lamp = streetLamp(sf);
          const awning = (ctx: CanvasRenderingContext2D, pass: Pass) => {
            paintAwning({ ctx, sf, project, ppm: metre, art: storefrontArt, materials, pass });
            // the streetlight's pool lands on the canvas before the pavement under it:
            // the same pool, laid on the awning's top at its height, clipped to it
            if (pass !== "light" || !night) return;
            const L = STOREFRONT_LEVELS;
            ctx.save();
            ctx.beginPath();
            [
              at(offset, 0, L.awningWall),
              at(offset + span, 0, L.awningWall),
              at(offset + span, projection, L.awningOuter),
              at(offset, projection, L.awningOuter),
            ].forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
            ctx.closePath();
            ctx.clip();
            if (lamp)
              paintGroundLight(
                ctx,
                project,
                {
                  kind: "pool",
                  centre: lamp.head,
                  radius: night.lamp.radius,
                  color: night.lamp.color,
                  intensity: night.lamp.intensity,
                },
                ((L.awningWall + L.awningOuter) / 2) * metre,
              );
            for (const light of storefrontLights(sf, night))
              if (light.kind === "pool" && light.sourceZ !== undefined)
                paintGroundLight(ctx, project, light, ((L.awningWall + L.awningOuter) / 2) * metre);
            ctx.restore();
          };
          add(
            `awning-${s.id}-${sf.edge}`,
            (ctx) => awning(ctx, "albedo"),
            Math.max(
              ...[
                { x: footprint.x, y: footprint.y },
                { x: footprint.x + footprint.width, y: footprint.y + footprint.height },
              ].map((p) => project(p).y),
            ),
            awningBounds,
            // small, and carrying the valance sign: drawn at four pixels per scene pixel
            4,
            awning,
          )
            ?.setData("activityLayer", "awning")
            .setData("foregroundStructure", materialised ? s : undefined)
            .setData(
              "sectionRect",
              sf.edge === "north"
                ? { x: s.rect.x + offset, y: s.rect.y, width: span, height: 0.24 }
                : {
                    x: s.rect.x + s.rect.width - 0.24,
                    y: s.rect.y + offset,
                    width: 0.24,
                    height: span,
                  },
            )
            .setData("revealOk", kept)
            .setData("sortRect", footprint)
            .setData("elevation", { bottom: L.awningOuter - 0.4, top: L.awningWall });
          // The blade sign hangs on the fascia: it shows only while the full building
          // does, and never stays brighter or more solid than the wall it hangs from.
          const blade = sf === front?.sf ? bladeSign(sf) : undefined;
          if (blade && building && front) {
            const t = BLADE.thickness;
            const ends = [blade.out0, blade.out1].flatMap((out) =>
              [blade.z0 - 0.3, blade.z1 + 0.1].flatMap((z) => [
                at(blade.s - t, out, z),
                at(blade.s + t, out, z),
                at(blade.s, 0, z),
              ]),
            );
            const pad = 0.6 * metre;
            const x0 = Math.min(...ends.map((p) => p.x)) - pad;
            const y0 = Math.min(...ends.map((p) => p.y)) - pad;
            const sign = (ctx: CanvasRenderingContext2D, pass: Pass) =>
              paintBladeSign(ctx, project, metre, sf, front.art, pass);
            const f = blade.footprint;
            add(
              `blade-${s.id}`,
              (ctx) => sign(ctx, "albedo"),
              project({ x: f.x + f.width / 2, y: f.y + f.height / 2 }).y,
              {
                x: Math.floor(x0),
                y: Math.floor(y0),
                width: Math.ceil(Math.max(...ends.map((p) => p.x)) + pad - x0),
                height: Math.ceil(Math.max(...ends.map((p) => p.y)) + pad - y0),
              },
              4,
              sign,
              // the blade stands edge-on across the face: its foot runs out from the wall
              reflects
                ? [
                    bladeMirror(
                      at(blade.s, blade.out0, 0),
                      at(blade.s, blade.out1, 0),
                      x0,
                      y0,
                      ends,
                      pad,
                    ),
                  ]
                : undefined,
            )
              ?.setData("activityLayer", "fixture")
              .setData("revealHide", occluders.has(s.id))
              .setData("foregroundStructure", materialised ? s : undefined)
              .setData(
                "sectionRect",
                cutawayWalls(s, arena.environment!.entrances).find(({ rect: r }) =>
                  sf.edge === "north"
                    ? r.y === s.rect.y &&
                      s.rect.x + blade.s >= r.x &&
                      s.rect.x + blade.s < r.x + r.width
                    : r.x + r.width === s.rect.x + s.rect.width &&
                      s.rect.y + blade.s >= r.y &&
                      s.rect.y + blade.s < r.y + r.height,
                )?.rect ?? s.rect,
              )
              .setData("sortRect", f)
              .setData("fadeWith", building);
          }
        }
    }
  }
  for (const d of arena.environment!.dressing) {
    if (d.kind === "litter" || d.kind === "drain") continue;
    const p = project(d.position);
    const shopLamp =
      d.id === "shop_lamp_detail_0" ? storefronts.find((f) => f.lamp !== undefined) : undefined;
    // At night a lamp's lens and glow are its light sprite; by day they are baked in.
    const lampGlow = (ctx: CanvasRenderingContext2D) => {
      painter(ctx, project).glow({ x: p.x + 12, y: p.y - 43 }, 13, "rgba(255,199,115,.35)");
      ctx.fillStyle = "#e1c294";
      ctx.fillRect(p.x + 8, p.y - 44, 7, 2);
    };
    add(
      `dressing-${d.id}`,
      (ctx) => {
        const { line, poly } = painter(ctx, project);
        if (shopLamp) {
          paintStreetLamp(ctx, project, metre, shopLamp, "albedo");
          return;
        }
        if (materialised && (d.kind === "lamp" || d.kind === "sign")) {
          paintCityFixture(ctx, env, d, project, metre, "albedo", architecture);
          return;
        }
        ctx.fillStyle = "rgba(0,0,0,.24)";
        ctx.beginPath();
        ctx.ellipse(p.x + 3, p.y, 8, 3, 0, 0, Math.PI * 2);
        ctx.fill();
        if (d.kind === "lamp") {
          line(p, { x: p.x, y: p.y - 48 }, "#18232b", 3);
          line({ x: p.x + 1, y: p.y }, { x: p.x + 1, y: p.y - 48 }, "#7e8274", 0.8);
          line({ x: p.x, y: p.y - 48 }, { x: p.x + 12, y: p.y - 43 }, "#7e8274", 2);
          if (night) {
            ctx.fillStyle = "#7f8574";
            ctx.fillRect(p.x + 8, p.y - 44, 7, 2);
          } else lampGlow(ctx);
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
      // the finished streetlight is tall and fine: its own bounds, at three times
      shopLamp
        ? {
            x: p.x - 70,
            y: p.y - (INTERSECTION_NIGHT.lamp.poleHeight + 1.5) * metre,
            width: 140,
            height: (INTERSECTION_NIGHT.lamp.poleHeight + 1.5) * metre + 20,
          }
        : materialised && (d.kind === "lamp" || d.kind === "sign")
          ? { x: p.x - 100, y: p.y - 130, width: 200, height: 180 }
          : undefined,
      shopLamp || materialised ? 3 : 1,
      shopLamp
        ? (ctx, pass) => paintStreetLamp(ctx, project, metre, shopLamp, pass)
        : materialised && (d.kind === "lamp" || d.kind === "sign")
          ? (ctx, pass) => paintCityFixture(ctx, env, d, project, metre, pass, architecture)
          : d.kind === "lamp"
            ? (ctx, pass) => {
                if (pass === "glow") lampGlow(ctx);
              }
            : undefined,
      // the streetlight's head reflects about the ground under it
      reflects
        ? shopLamp
          ? lampMirror(project, shopLamp, metre).map((m) => ({ ...m, gain: 1.2 }))
          : materialised && (d.kind === "sign" || d.kind === "lamp")
            ? (() => {
                const dir = streetDirection(env, d.position);
                const a = project({ x: d.position.x - dir.x * 0.5, y: d.position.y - dir.y * 0.5 });
                const b = project({ x: d.position.x + dir.x * 0.5, y: d.position.y + dir.y * 0.5 });
                return [
                  {
                    a,
                    b,
                    extent: fixtureExtent(
                      d.kind === "lamp"
                        ? dir.y > 0 || dir.x < 0
                          ? "signal90"
                          : "signal0"
                        : dir.y > 0 || dir.x < 0
                          ? "transit90"
                          : "transit0",
                      p,
                      metre,
                      dir.x + dir.y < 0,
                    ),
                  },
                ];
              })()
            : undefined
        : undefined,
    )?.setData("sortRect", { ...d.position, width: 0, height: 0 });
  }
  const reflection = buildReflection(scene, {
    reflects,
    mirrorSources,
    mirrorOwners,
    ground,
    gx,
    gy,
    resolution,
    project,
    metre,
    casters,
    arena,
    env,
    allCanopies,
    groundLightSetup,
    lights,
  });
  return {
    objects,
    lit,
    ...(night
      ? {
          night: {
            config: night,
            lights,
            ...(shadows ? { shadows } : {}),
            ...(reflection ? { reflection } : {}),
            ...(grade ? { grade } : {}),
          },
        }
      : {}),
  };
}
