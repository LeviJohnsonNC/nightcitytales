import type Phaser from "phaser";
import type { Arena, Point, SceneEnvironment } from "@/engine";
import { rainField } from "./afterRain";
import { COMMERCIAL_BASE } from "./commercialUpper";
import { paintWindowSurround, type PointLight } from "./wallLight";
import { facePainter, HOME_DEPTH, homeInterior, clipHomeFace, type Opening } from "./buildingFaces";
import { type ArchitectureArt } from "./architecturePack";
import { awningFootprint, streetLamp, type Storefront } from "./storefront";
import { lightColor, type GroundLight, type NightLighting } from "./nightLighting";
import { LAMP_SHADOW, type Box, type ShadowCaster } from "./lampShadow";
import {
  GroundShadows,
  incidentLight,
  lightPassCanvas,
  renderGroundLight,
  type GroundLightSetup,
} from "./groundShadows";
import { GroundReflection, type MirrorSource, type ReflectionView } from "./groundReflection";
import { type Project } from "./composedPainter";
import { paintGroundLights, paintSurfaceClasses, paintNightGrade } from "./composedGround";

/** The lamp shadows' patches on the board: `sync` with the destroyed cover ids. */
export interface ComposedShadows {
  ground: GroundShadows;
  sync: (destroyed: ReadonlySet<string>, visible: boolean) => void;
}

/** The shop corner's ground reflections (`groundReflection.ts`). */
export interface ComposedReflection {
  layer: GroundReflection;
  /**
   * Show the reflection for this destruction state: the fixtures' pictures, the lights'
   * glints, both or neither (`false` hides them all, as the lights switch does).
   */
  sync: (destroyed: ReadonlySet<string>, show: false | ReflectionView) => void;
}

/** The blade sign's ground line for its reflection: its foot runs out from the wall. */
export function bladeMirror(
  a: Point,
  b: Point,
  x0: number,
  y0: number,
  ends: readonly Point[],
  pad: number,
): Omit<MirrorSource, "paint" | "group"> {
  const x1 = Math.max(...ends.map((p) => p.x)) + pad;
  const y1 = Math.max(...ends.map((p) => p.y)) + pad;
  return {
    a,
    b,
    // A blade sign is a small emitter; retain its hue without dominating the street.
    gain: 3.1,
    extent: [
      { x: x0, y: y0 },
      { x: x1, y: y0 },
      { x: x1, y: y1 },
      { x: x0, y: y1 },
    ],
  };
}

/** The streetlight's head reflects about the level ground under it. */
export function lampMirror(
  project: Project,
  sf: Storefront,
  ppm: number,
): Omit<MirrorSource, "group">[] {
  const lamp = streetLamp(sf);
  if (!lamp) return [];
  const foot = project(lamp.head);
  // the lens alone: its halo is a glow in the air, not a thing a street reflects, and the
  // pole, lit grey, would reflect as a pale line
  const lens = foot.y - (lamp.headZ - 0.04) * ppm;
  const top = lens - 0.3 * ppm;
  const bottom = lens + 0.25 * ppm;
  return [
    {
      a: foot,
      b: { x: foot.x + 10, y: foot.y },
      gain: 5,
      // the lens as the glow pass lights it, and nothing of the cone it throws: the
      // street reflects the fixture, not the light in the air under it
      paint: (ctx) => {
        ctx.fillStyle = lightColor([1, 0.92, 0.78], 1);
        ctx.beginPath();
        ctx.ellipse(foot.x, lens, 0.36 * ppm, 0.1 * ppm, 0, 0, Math.PI * 2);
        ctx.fill();
      },
      extent: [
        { x: foot.x - 0.75 * ppm, y: top },
        { x: foot.x + 0.75 * ppm, y: top },
        { x: foot.x + 0.75 * ppm, y: bottom },
        { x: foot.x - 0.75 * ppm, y: bottom },
      ],
    },
  ];
}

/** A lit home window: the room and the glass give light, the sill and wall catch it. */
export function litHomesPainter(
  night: NightLighting | undefined,
  architecture: ArchitectureArt | undefined,
) {
  return (
    ctx: CanvasRenderingContext2D,
    pass: "light" | "glow",
    homes: {
      opening: Opening;
      face: ReturnType<typeof facePainter>;
    }[],
    clip?: { s0: number; s1: number; zMax: number },
  ) => {
    if (!night) return;
    const warm = night.home.color;
    for (const { opening: w, face } of homes) {
      ctx.save();
      if (clip) clipHomeFace(ctx, face, clip);
      const x0 = w.s0 + 0.05,
        x1 = w.s1 - 0.05,
        y0 = w.z0 + 0.05,
        y1 = w.z1 - 0.05;
      const middle = (x0 + x1) / 2;
      // Light never erases the timber mullion or the frame.
      ctx.beginPath();
      for (const [a, b] of [
        [x0, middle - 0.025],
        [middle + 0.025, x1],
      ]) {
        face
          .quad(a!, b!, y0, y1, -HOME_DEPTH)
          .forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
        ctx.closePath();
      }
      ctx.clip();
      const painted = homeInterior(w, architecture);
      if (pass === "glow" && painted) {
        // Registered to the cloth in the imported paintings: blinds conceal the
        // upper 61%; tied curtains open wider near the bottom. No glowing cloth.
        const width = x1 - x0,
          height = y1 - y0;
        const opening =
          w.occupancy === "blind"
            ? face.quad(x0, x1, y0, y0 + height * 0.38, -HOME_DEPTH)
            : [
                face.at(x0 + width * 0.29, -HOME_DEPTH, y1),
                face.at(x0 + width * 0.69, -HOME_DEPTH, y1),
                face.at(x0 + width * 0.81, -HOME_DEPTH, y0),
                face.at(x0 + width * 0.18, -HOME_DEPTH, y0),
              ];
        ctx.beginPath();
        opening.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
        ctx.closePath();
        ctx.clip();
      }
      // Painted upper rooms remain secondary to the street-level shops. Their
      // dim interiors must not become identical luminous orange rectangles.
      const paintedUpper = w.z0 >= COMMERCIAL_BASE && architecture?.paintedMarketUpper;
      ctx.fillStyle = lightColor(
        warm,
        (pass === "light" ? night.home.room : night.home.glass) * (paintedUpper ? 0.5 : 1),
      );
      const room = face.quad(x0, x1, y0, y1, -HOME_DEPTH);
      ctx.beginPath();
      room.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      if (pass === "light") {
        ctx.save();
        if (clip) clipHomeFace(ctx, face, clip);
        paintWindowSurround(ctx, face.at, w, warm, night.home.surround);
        ctx.restore();
      }
    }
  };
}

/**
 * A surface's light: what falls on it (multiplied by its own painted colour, so
 * light shows the material rather than covering it) and what it gives (added as
 * it is). Clipped to the surface's own pixels before the glow, so light never
 * lands where the surface is not.
 */
export function surfaceLightCanvas(night: NightLighting | undefined) {
  return (
    base: HTMLCanvasElement,
    prepare: (ctx: CanvasRenderingContext2D) => void,
    light: (ctx: CanvasRenderingContext2D, pass: "light" | "glow") => void,
    /** Only this box of `base`, in its pixels: a small sprite's light. */
    crop?: { x: number; y: number; width: number; height: number },
  ) => {
    const c = crop ?? { x: 0, y: 0, width: base.width, height: base.height };
    // what falls on it (`groundShadows.ts`, shared with the ground's lamp shadows)...
    const canvas = lightPassCanvas(
      base,
      prepare,
      (ctx) => light(ctx, "light"),
      night?.gain ?? 1,
      c,
    );
    // ...and what it gives
    const ctx = canvas.getContext("2d")!;
    ctx.save();
    ctx.translate(-c.x, -c.y);
    prepare(ctx);
    ctx.globalCompositeOperation = "lighter";
    light(ctx, "glow");
    ctx.restore();
    return canvas;
  };
}

/** The ground's light at night, its own additive sprite, and the lamp shadows' patches. */
export function buildGroundLight(
  scene: Phaser.Scene,
  {
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
  }: {
    ground: Phaser.Textures.CanvasTexture;
    groundFrame: (ctx: CanvasRenderingContext2D) => void;
    groundImage: Phaser.GameObjects.Image;
    project: Project;
    env: SceneEnvironment;
    lights: GroundLight[];
    casters: ShadowCaster[];
    wallLights: PointLight[];
    night: NightLighting | undefined;
    gx: number;
    gy: number;
    gw: number;
    gh: number;
    resolution: number;
  },
) {
  const zOf = (light: GroundLight) =>
    light.kind === "pool"
      ? (light.sourceZ ??
        wallLights.find((l) => Math.hypot(l.at.x - light.centre.x, l.at.y - light.centre.y) < 0.3)
          ?.z ??
        LAMP_SHADOW.poolZ)
      : LAMP_SHADOW.windowZ;
  const paintOne = (c: CanvasRenderingContext2D, light: GroundLight) =>
    paintGroundLights(c, project, env.structures, [light]);
  let shadows: ComposedShadows | undefined;
  let groundLightSetup: GroundLightSetup | undefined;
  if (night && lights.length) {
    const setup: GroundLightSetup = {
      base: ground.canvas,
      prepare: groundFrame,
      project,
      lights,
      casters,
      zOf,
      paintLight: paintOne,
      gain: night.gain,
    };
    groundLightSetup = setup;
    const canvas = renderGroundLight(setup, new Set());
    const texture = scene.textures.addCanvas("composed-ground-light", canvas)!;
    texture.refresh();
    groundImage.setData(
      "light",
      scene.add
        .image(gx + gw / 2, gy + gh / 2, "composed-ground-light")
        .setDisplaySize(gw, gh)
        .setBlendMode("ADD")
        .setDepth(-999.5)
        .setVisible(false),
    );
    // Where destroyed props give light back (`groundShadows.ts`): one patch per region,
    // rendered from the region's complete state when it changes, cached by state.
    const groundShadows = new GroundShadows(setup);
    const patches = groundShadows.regions.map((region, i) => ({
      region,
      key: "",
      image: scene.add
        .image(
          gx + (region.box.x + region.box.width / 2) / resolution,
          gy + (region.box.y + region.box.height / 2) / resolution,
          "__DEFAULT",
        )
        .setDisplaySize(region.box.width / resolution, region.box.height / resolution)
        .setBlendMode("ADD")
        .setDepth(-999.45)
        .setVisible(false),
      index: i,
    }));
    shadows = {
      ground: groundShadows,
      sync(destroyed, visible) {
        for (const p of patches) {
          const key = groundShadows.key(p.region, destroyed);
          if (key !== p.key) {
            p.key = key;
            const patch = groundShadows.patch(p.region, destroyed);
            if (patch) {
              const textureKey = `composed-ground-shadow-${p.index}-${key}`;
              if (!scene.textures.exists(textureKey))
                scene.textures.addCanvas(textureKey, patch)!.refresh();
              p.image
                .setTexture(textureKey)
                .setDisplaySize(p.region.box.width / resolution, p.region.box.height / resolution);
            }
          }
          p.image.setVisible(visible && p.key !== "");
        }
      },
    };
    if (import.meta.env.DEV)
      (window as unknown as { __groundLight?: unknown }).__groundLight = {
        setup,
        ground: groundShadows,
        canvas,
      };
  }
  return { shadows, groundLightSetup };
}

/** The night's material grade over the ground (`paintNightGrade`), as a multiply sprite. */
export function buildNightGrade(
  scene: Phaser.Scene,
  arena: Arena,
  project: Project,
  night: NightLighting | undefined,
  gx: number,
  gy: number,
  gw: number,
  gh: number,
) {
  let grade: Phaser.GameObjects.Image | undefined;
  if (night) {
    const g = scene.textures.createCanvas("composed-night-grade", gw, gh)!;
    g.context.translate(-gx, -gy);
    paintNightGrade(g.context, arena, project, night);
    g.refresh();
    grade = scene.add
      .image(gx + gw / 2, gy + gh / 2, "composed-night-grade")
      .setDisplaySize(gw, gh)
      .setBlendMode("MULTIPLY")
      .setDepth(-999.8)
      .setVisible(false);
  }
  return grade;
}

/** The shop corner's reflections in the street, built from the lit sprites' mirrors. */
export function buildReflection(
  scene: Phaser.Scene,
  {
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
  }: {
    reflects: boolean;
    mirrorSources: MirrorSource[];
    mirrorOwners: Map<string, Phaser.GameObjects.Image>;
    ground: Phaser.Textures.CanvasTexture;
    gx: number;
    gy: number;
    resolution: number;
    project: Project;
    metre: number;
    casters: ShadowCaster[];
    arena: Arena;
    env: SceneEnvironment;
    allCanopies: readonly Storefront[];
    groundLightSetup: GroundLightSetup | undefined;
    lights: GroundLight[];
  },
) {
  let reflection: ComposedReflection | undefined;
  if (reflects && mirrorSources.length) {
    const layer = new GroundReflection({
      ground: ground.canvas,
      origin: { x: gx, y: gy },
      resolution,
      project,
      ppm: metre,
      sources: mirrorSources,
      occluders: casters
        .filter((c) => !c.bottom)
        .map((c) => ({
          id: c.coverId,
          body: c.body,
          height: c.height,
          wreck: c.wreck,
        })),
      paintClasses: (ctx) =>
        paintSurfaceClasses(ctx, arena, project, allCanopies.map(awningFootprint)),
      wetness: rainField(env),
      // Only broken wet-grain highlights: no uniform incident sheen. Use the
      // same occluded light and complete wreck state as the diffuse ground.
      ...(groundLightSetup
        ? {
            incident: (destroyed: ReadonlySet<string>, crop: Box) =>
              incidentLight(groundLightSetup!, destroyed, crop),
          }
        : {}),
      reach: lights.flatMap((light) => {
        const centre =
          light.kind === "pool"
            ? light.centre
            : {
                x: light.origin.x + (light.along.x * (light.s0 + light.s1)) / 2,
                y: light.origin.y + (light.along.y * (light.s0 + light.s1)) / 2,
              };
        const radius =
          light.kind === "pool"
            ? light.radius
            : light.reach + Math.abs(light.s1 - light.s0) / 2 + light.spread;
        return [-1, 1].flatMap((x) =>
          [-1, 1].map((y) => project({ x: centre.x + x * radius, y: centre.y + y * radius })),
        );
      }),
      glintCasters: casters.map((c) => c.coverId),
    });
    // one sprite per reflected fixture, shown and faded with that fixture's own sprite
    // (the shopfront leaves with its wall in the reveal), and one for the lights' glints;
    // each over its own layer's box
    const sprite = () =>
      scene.add.image(0, 0, "__DEFAULT").setBlendMode("ADD").setDepth(-999.4).setVisible(false);
    const pictures = layer.groups.map((group) => ({ group, image: sprite() }));
    const glints = sprite();
    let shown: string | undefined;
    const uploaded = new Map<HTMLCanvasElement, string>();
    reflection = {
      layer,
      sync(destroyed, view) {
        const key = layer.key(destroyed);
        if (view && key !== shown) {
          shown = key;
          const layers = layer.render(destroyed);
          // a layer no prop changed is the same canvas: its texture is uploaded once
          const show = (
            image: Phaser.GameObjects.Image,
            l: { canvas: HTMLCanvasElement; box: Box } | undefined,
          ) => {
            if (!l) return;
            let textureKey = uploaded.get(l.canvas);
            if (!textureKey) {
              textureKey = `composed-reflection-${uploaded.size}`;
              uploaded.set(l.canvas, textureKey);
              scene.textures.addCanvas(textureKey, l.canvas)!.refresh();
            }
            if (image.texture.key !== textureKey)
              image
                .setTexture(textureKey)
                .setPosition(l.box.x + l.box.width / 2, l.box.y + l.box.height / 2)
                .setDisplaySize(l.box.width, l.box.height);
          };
          for (const p of pictures) show(p.image, layers.groups.get(p.group));
          show(glints, layers.glints);
        }
        const ready = !!view && shown !== undefined;
        for (const p of pictures) {
          const owner = mirrorOwners.get(p.group);
          p.image
            .setVisible(
              ready &&
                view !== "glints" &&
                p.image.texture.key !== "__DEFAULT" &&
                (owner?.visible ?? true),
            )
            .setAlpha(owner?.alpha ?? 1);
        }
        glints.setVisible(ready && view !== "pictures" && glints.texture.key !== "__DEFAULT");
      },
    };
    if (import.meta.env.DEV)
      (window as unknown as { __groundReflection?: unknown }).__groundReflection = layer;
  }
  return reflection;
}
