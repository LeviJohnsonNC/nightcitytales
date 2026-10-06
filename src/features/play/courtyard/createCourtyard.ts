import { sceneryOrder } from "./sceneryOrder";
import { atlasPropRegistration } from "./atlasPropRegistration";
import { isInteriorProp } from "./interiorPropArt";
import { sceneryOccludes } from "./sceneryOcclusion";
import { createComposedEnvironment, type ComposedEnvironment } from "./composedEnvironment";
import { applyStreetPropArt, streetPropFiles } from "./streetPropArt";
import { OVERLAY, type OverlayMode } from "../overlayModel";
import {
  ARCHITECTURE_ART_FILES,
  architectureAssetKey,
  type ArchitectureArt,
  type ArchitectureArtKey,
} from "./architecturePack";
import { lightAt, tintFor } from "./nightLighting";
import {
  STOREFRONT_ART_FILES,
  storefrontAssetKey,
  type StorefrontArt,
  type StorefrontArtKey,
} from "./storefront";
import {
  MATERIAL_KEYS,
  materialAssetKey,
  materialUrl,
  type MaterialKey,
  type TileSource,
} from "./surfaceMaterials";
import { battlefieldFor } from "@/engine";
import { scenicTheme, STREET_PROPS, civilianCell } from "./scenicPresentation";
import { createStreetGround } from "./streetGround";
import { createCivilianAtlas } from "./civilianTextures";
import Phaser from "phaser";
import { coverStatuses, tileKey, TILE_METRES, type Point, type Tile, type Rect } from "@/engine";
import type { LiveEncounter } from "@/features/campaign/encounterState";
import { battlefieldProjection } from "../battlefieldProjection";
import { frameDuration, type PlaybackFrame } from "../combatPlayback";
import { courtyardCamera, composedUnitMetrics } from "./courtyardPresentation";
import {
  animationCell,
  facingFor,
  movementSample,
  muzzleOffset,
  poseFor,
  SHOT_TIMING,
  CHARACTER_FRAME,
  type Facing,
} from "./characterAnimation";
import { createCharacterAtlas } from "./characterTextures";

import { createPropTextures, propSource, propInkBounds } from "./propTextures";
import {
  GRID_DEPTH,
  PROP_KINDS,
  hasYardProps,
  propKind,
  propCondition,
  propTexture,
  propPlacement,
} from "./propPresentation";

/**
 * The movement overlay, painted INTO the scene rather than over it.
 *
 * The accessible SVG sits on top of this canvas, so anything it draws is drawn
 * over the art — a lit square would cross a crate and a body standing on the
 * ground behind it. Handing the squares to Phaser instead puts them on the
 * floor at a depth below everything standing on it, and the scene's own
 * painter's sort keeps them there while a unit walks.
 */
export type GridOverlay = {
  /** `firing` can see the target being aimed at; `faded` is reachable context. */
  squares: { tile: Tile; sheltered: boolean; firing?: boolean; faded?: boolean }[];
  /** The square under the cursor, drawn brighter. */
  chosen: Tile | null;
  /** The walked route, in metres. */
  route: Point[] | null;
  /** How loud to be (`overlayModel.ts`): at rest only the edge of reach is drawn. */
  mode?: OverlayMode;
  /** The edge of reachable ground, in metres (`squaresOutline`). */
  edge?: [Point, Point][];
};

export type CourtyardModel = {
  live: LiveEncounter;
  /** Inspection only; callers remount when switching the composition layer. */
  structureOnly?: boolean;
  /** Presentation only; solid geometry and targeting remain authoritative. */
  revealActivity?: boolean;
  /** The local lights (the shop, the streetlight, lamps and signs). `false` leaves
   * the night's ambient as it is and turns only the lights off. Defaults to on. */
  lights?: boolean;
  /** The night's ambient. `false` is a neutral inspection mode: the materials under
   * plain light, as painted, with no local lights. Defaults to on where a scene has
   * a night (the intersection); other scenes have none either way. */
  night?: boolean;
  playback?: PlaybackFrame | null | undefined;
  aimTargetId?: string | null;
  camera: { x: number; y: number; zoom: number };
  grid?: GridOverlay | null;
};
export type CourtyardRenderer = { sync: (model: CourtyardModel) => void; destroy: () => void };

type Unit = {
  container: Phaser.GameObjects.Container;
  sprite: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Ellipse;
  facing: Facing;
};

export function createCourtyard(
  host: HTMLElement,
  initial: CourtyardModel,
  onReady: () => void,
  onFailure: () => void,
): CourtyardRenderer {
  let model = initial;
  let ready = false;
  let disposed = false;
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const arena = battlefieldFor(initial.live);
  const theme = scenicTheme(arena);
  if (!theme) throw new Error("No scenic art for this layout");
  const composed = theme === "composed";
  const street = theme === "street" || composed;
  const unitScale = composed ? composedUnitMetrics(arena).scale : street ? 0.65 : 1;
  const kinds = composed
    ? arena.environment!.props.map((p) => p.art)
    : street
      ? Object.values(STREET_PROPS)
      : hasYardProps(arena.key)
        ? PROP_KINDS
        : ["cargo" as const];
  const assets = [
    ...(street ? ["workers"] : ["ground"]),
    "mercenary-animation",
    "hostile-animation",
    ...new Set(kinds.map(propSource).filter((source) => source !== "procedural-interior")),
  ];
  // Only the intersection recipe takes materials so far.
  const materialKeys: readonly MaterialKey[] =
    composed && arena.environment?.recipe === "intersection" ? MATERIAL_KEYS : [];
  const storefrontKeys = Object.keys(STOREFRONT_ART_FILES) as StorefrontArtKey[];
  const withStorefront = materialKeys.length > 0;
  const architectureKeys = Object.keys(ARCHITECTURE_ART_FILES) as ArchitectureArtKey[];
  // The painted street props, like the materials, belong to the intersection so far.
  const streetProps = materialKeys.length > 0 ? streetPropFiles(kinds) : [];
  const { project, unproject } = battlefieldProjection(arena.extent.width, arena.extent.height);
  let started = 0;
  let previousLive: LiveEncounter | null = null;
  let previousFrame: PlaybackFrame | null | undefined;
  const units = new Map<string, Unit>();
  const scenery: Phaser.GameObjects.Image[] = [];
  const structures: Phaser.GameObjects.Image[] = [];
  /** Everything the night tints, and the scene's night if it has one. */
  let lit: Phaser.GameObjects.Image[] = [];
  let night: ComposedEnvironment["night"];
  let tinted: boolean | null = null;
  let orderKey = "";
  let coverRevision = 0;
  const sortScenery = () => {
    if (!composed) return;
    const key = `${coverRevision}/${!!model.revealActivity}/${model.structureOnly}/${[...units.values()].map(({ container: u }) => `${u.x},${u.y},${u.visible}`).join(";")}`;
    if (key === orderKey) return;
    orderKey = key;
    const objects = [
      ...structures,
      ...scenery,
      ...[...units.values()].map((u) => u.container),
    ].filter((o) => o.visible && o.depth > -500 && !o.getData("destroyed"));
    const items = objects.map((o) => {
      const p = unproject({ x: o.x, y: o.getData("groundY") ?? o.y });
      const rect: Rect = o.getData("sortRect") ?? { x: p.x, y: p.y, width: 0, height: 0 };
      return {
        rect,
        groundY: project({ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }).y,
      };
    });
    const { ordered } = sceneryOrder(items);
    ordered.forEach((index, depth) => {
      const object = objects[index]!;
      object.setDepth(depth);
      const ink = object.getData("inkBounds");
      if (ink) ink.depth = depth;
    });
  };
  // Phaser's polygon helpers want its own vectors, not plain points.
  const screen = (p: Point) => {
    const q = project(p);
    return new Phaser.Math.Vector2(q.x, q.y);
  };
  const squareCorners = (tile: Tile) => {
    const x = tile.col * TILE_METRES,
      y = tile.row * TILE_METRES;
    return [
      { x, y },
      { x: x + TILE_METRES, y },
      { x: x + TILE_METRES, y: y + TILE_METRES },
      { x, y: y + TILE_METRES },
    ].map(screen);
  };
  let renderedCover: LiveEncounter["cover"] | null = null;

  class CourtyardScene extends Phaser.Scene {
    grid!: Phaser.GameObjects.Graphics;
    weather!: Phaser.GameObjects.Graphics;
    flash!: Phaser.GameObjects.Graphics;
    preload() {
      for (const key of assets)
        // WebP, encoded losslessly and unresized by tools/art/webp.mjs: these
        // are atlases Phaser slices into frames, so nothing may move and no
        // colour may bleed across a frame boundary.
        this.load.image(
          `source-${key}`,
          `/images/combat/${
            key === "street-props" || key === "workers" ? "north-heywood" : "night-shift"
          }/${key}.webp`,
        );
      // Surface materials are presentation: a tile that fails to load leaves its
      // surface flat, and never fails the scene the way a missing atlas does.
      if (materialKeys.length)
        for (const key of materialKeys) this.load.image(materialAssetKey(key), materialUrl(key));
      // The storefront's art is the same kind of thing: missing, the shop keeps its look.
      if (withStorefront)
        for (const key of storefrontKeys)
          this.load.image(storefrontAssetKey(key), STOREFRONT_ART_FILES[key]);
      // So is the architectural pilot's: missing, the drawn boxes and bays stay.
      if (withStorefront)
        for (const key of architectureKeys)
          this.load.image(architectureAssetKey(key), ARCHITECTURE_ART_FILES[key]);
      // A painted prop that fails to load leaves the procedural one: never a failure.
      for (const file of streetProps) this.load.image(file.key, file.url);
      this.load.on("loaderror", (file: { key?: string }) => {
        if (
          !file.key?.startsWith("material-") &&
          !file.key?.startsWith("storefront-") &&
          !file.key?.startsWith("architecture-") &&
          !file.key?.startsWith("streetprop-")
        )
          onFailure();
      });
    }
    create() {
      if (disposed) return;
      if (assets.some((key) => !this.textures.exists(`source-${key}`))) {
        onFailure();
        return;
      }
      try {
        createPropTextures(this, [...new Set(kinds)]);
        applyStreetPropArt(this, streetProps);
        createCharacterAtlas(this, "mercenary");
        createCharacterAtlas(this, "hostile");
        if (street) createCivilianAtlas(this);
      } catch {
        onFailure();
        return;
      }
      if (composed) {
        const visibleArena = model.structureOnly
          ? { ...arena, environment: { ...arena.environment!, dressing: [] } }
          : arena;
        const tiles: Partial<Record<MaterialKey, TileSource>> = {};
        for (const key of materialKeys)
          if (this.textures.exists(materialAssetKey(key)))
            tiles[key] = this.textures.get(materialAssetKey(key)).getSourceImage() as TileSource;
        const storefrontArt: StorefrontArt = {};
        for (const key of storefrontKeys)
          if (this.textures.exists(storefrontAssetKey(key)))
            storefrontArt[key] = this.textures
              .get(storefrontAssetKey(key))
              .getSourceImage() as TileSource;
        const architectureArt: ArchitectureArt = {};
        for (const key of architectureKeys)
          if (this.textures.exists(architectureAssetKey(key)))
            architectureArt[key] = this.textures
              .get(architectureAssetKey(key))
              .getSourceImage() as CanvasImageSource;
        const built = createComposedEnvironment(
          this,
          visibleArena,
          project,
          materialKeys.length && Object.keys(tiles).length ? tiles : undefined,
          withStorefront && Object.keys(storefrontArt).length ? storefrontArt : undefined,
          withStorefront && Object.keys(architectureArt).length ? architectureArt : undefined,
        );
        structures.push(...built.objects);
        lit = built.lit;
        night = built.night;
      } else if (street) createStreetGround(this, project);
      else this.add.image(550, 350, "source-ground").setDisplaySize(1200, 800).setDepth(-1000);
      // Baked lighting establishes the look. Small additive pools support it.
      this.add
        .ellipse(295, 330, 300, 170, 0x17cced, 0.025)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(-900);
      // Above the baked ground and its light pools, below everything standing
      // on the floor — which is every prop and every body, all of them sorted
      // by their own projected y.
      this.grid = this.add.graphics().setDepth(GRID_DEPTH);
      this.weather = this.add.graphics().setDepth(2000);
      this.flash = this.add.graphics().setDepth(1500);
      ready = true;
      reconcile(this);
      paintGrid(this);
      resize();
      onReady();
    }
    override update(time: number) {
      if (!ready || disposed) return;
      const frame = model.playback;
      const elapsed = Math.max(0, Date.now() - (frame?.startedAt ?? started));
      const duration = frame ? frameDuration(frame) : 0;
      paintCover(
        this,
        frame?.coverBefore &&
          frame.animate !== false &&
          !motion.matches &&
          elapsed < SHOT_TIMING.impact
          ? frame.coverBefore
          : model.live.cover,
      );
      for (const [id, unit] of units) {
        const actor = model.live.state.combatants[id],
          data = model.live.data[id];
        if (!actor || !data) continue;
        // Withdrawn actors leave the illustrated scene; the SVG retains a
        // labelled departure marker at their last known combat position.
        unit.container.setVisible(!(actor.defeated && data.exitReason === "withdrawn"));
        let position = data.position;
        const moving = frame?.kind === "move" && frame.actorId === id && frame.path;
        if (moving) {
          const sample = movementSample(
            moving,
            motion.matches || frame.animate === false ? 1 : elapsed / duration,
          );
          if (sample.position) position = sample.position;
          if (sample.from && sample.to)
            unit.facing = facingFor(project(sample.from), project(sample.to), unit.facing);
        }
        const p = project(position);
        unit.container.setPosition(p.x, p.y);
        if (!composed) unit.container.setDepth(p.y);
        let aim =
          actor.isPlayer && model.aimTargetId ? model.live.data[model.aimTargetId]?.position : null;
        if (frame?.actorId === id && (frame.kind === "attack" || frame.kind === "cover"))
          aim = frame.aim ?? (frame.targetId ? model.live.data[frame.targetId]?.position : null);
        if (aim && !moving) unit.facing = facingFor(p, project(aim), unit.facing);
        const pose = poseFor({
          actor,
          exitReason: data.exitReason,
          frame,
          elapsed,
          movementDuration: duration,
          reducedMotion: motion.matches,
        });
        const civilian = street && actor.side === "neutral";
        const cell = civilian
          ? {
              frame: civilianCell(pose === "dead" || pose === "fall", data.key === "worker_two"),
              flipX: false,
            }
          : animationCell(unit.facing, pose, elapsed, !actor.isPlayer);
        unit.sprite.setFrame(cell.frame).setFlipX(cell.flipX);
        const animated = !motion.matches && frame?.animate !== false;
        // A small recoil/settle supports the authored pose; feet never drive position.
        const recoil =
          pose === "fire" && animated
            ? Math.sin(
                Math.min(
                  1,
                  (elapsed - SHOT_TIMING.fire) / (SHOT_TIMING.recover - SHOT_TIMING.fire),
                ) * Math.PI,
              )
            : 0;
        const side = unit.facing.endsWith("e") ? 1 : -1;
        const fall =
          pose === "fall"
            ? Math.min(
                1,
                (elapsed - SHOT_TIMING.impact) / (SHOT_TIMING.settle - SHOT_TIMING.impact),
              )
            : 1;
        const breathe =
          pose === "aim" && !actor.defeated && animated
            ? Math.sin(time / 650 + id.length) * 0.35
            : 0;
        unit.sprite
          .setPosition(
            -side * recoil * 2,
            -recoil + breathe - (pose === "fall" ? (1 - fall) * 5 : 0),
          )
          .setAngle(pose === "hurt" && animated ? -side * 4 : 0);
        unit.sprite.setAlpha(actor.defeated && data.exitReason !== "dead" ? 0.4 : 1);
        const under = actor.defeated && data.exitReason !== "dead" ? 0x879aa5 : 0xffffff;
        // People stand in the same light as the pavement under their feet.
        const shade = nightTint(position, under);
        if (shade !== null) unit.sprite.setTint(shade);
        else if (under !== 0xffffff) unit.sprite.setTint(under);
        else unit.sprite.clearTint();
        unit.shadow.setSize(
          (pose === "dead" || pose === "fall" ? 55 : 30) * unitScale,
          12 * unitScale,
        );
      }
      for (const prop of structures) {
        const layer = prop.getData("activityLayer");
        const reveal = !model.structureOnly && !!model.revealActivity;
        // A canopy hangs from a wall: in the cutaway it shows only where that wall is kept.
        prop.setVisible(
          layer === "cutaway"
            ? reveal
            : layer === "full"
              ? !reveal
              : layer === "awning"
                ? !reveal || !!prop.getData("revealOk")
                : true,
        );
      }
      sortScenery();
      for (const prop of [...scenery, ...structures]) {
        if (prop.getData("destroyed")) continue;
        const obstructs = [...units.values()].some(({ container: unit }) =>
          sceneryOccludes(
            prop.getData("inkBounds") ?? prop,
            unit,
            composed ? composedUnitMetrics(arena).top : street ? 58 : 88,
          ),
        );
        const lowCutaway =
          prop.getData("activityLayer") === "cutaway" &&
          (prop.getData("cutawayHeight") ?? 0) <= 0.95;
        prop.setAlpha(lowCutaway ? 1 : obstructs ? 0.4 : 1);
      }
      // A fixture fades with what it hangs from: a sign on a ghosted wall is ghosted too.
      for (const prop of structures) {
        const parent = prop.getData("fadeWith") as Phaser.GameObjects.Image | undefined;
        if (parent) prop.setAlpha(Math.min(prop.alpha, parent.alpha));
      }
      applyNight();
      this.weather.clear();
      if (!street && !motion.matches) {
        this.weather.lineStyle(0.65, 0xbad8eb, 0.12);
        const count = host.clientWidth < 600 ? 22 : 48;
        for (let i = 0; i < count; i++) {
          const x = ((i * 139.7 + time * 0.027) % 1200) - 50;
          const y = ((i * 97.3 + time * 0.31) % 800) - 50;
          this.weather.lineBetween(x, y, x - 4, y + 13);
        }
      }
      this.flash.clear();
      if (
        frame &&
        ["attack", "cover"].includes(frame.kind) &&
        frame.attackStyle !== "melee" &&
        frame.animate !== false &&
        !motion.matches &&
        elapsed >= SHOT_TIMING.fire &&
        elapsed < SHOT_TIMING.impact + 80 &&
        frame.actorId
      ) {
        const unit = units.get(frame.actorId);
        const aim =
          frame.aim ?? (frame.targetId ? model.live.data[frame.targetId]?.position : null);
        if (unit && aim) {
          const muzzle = muzzleOffset(
              unit.facing,
              !model.live.state.combatants[frame.actorId]?.isPlayer,
            ),
            p = project(aim);
          const x = unit.container.x + unit.sprite.x + muzzle.x * unitScale,
            y = unit.container.y + unit.sprite.y + muzzle.y * unitScale;
          this.flash
            .lineStyle(2, 0xffd599, 0.8)
            .lineBetween(
              x,
              y,
              p.x + (frame.hit === false ? 32 : 0),
              p.y - (frame.kind === "cover" ? 16 : 42 * unitScale),
            );
          this.flash.fillStyle(0xffd599, 0.24).fillCircle(x, y, 18);
          this.flash.fillStyle(0xfff4cb, 0.95).fillCircle(x, y, 4);
        }
      }
      if (
        frame?.hit === true &&
        frame.animate !== false &&
        !motion.matches &&
        elapsed >= SHOT_TIMING.impact &&
        elapsed < SHOT_TIMING.impact + 250
      ) {
        const aim =
          frame.aim ?? (frame.targetId ? model.live.data[frame.targetId]?.position : null);
        if (aim) {
          const point = project(aim),
            progress = (elapsed - SHOT_TIMING.impact) / 250;
          const color = frame.kind === "cover" ? 0xffc783 : 0xc69587;
          this.flash.fillStyle(color, (1 - progress) * 0.85);
          for (let i = 0; i < 7; i++) {
            const angle = i * 2.4;
            this.flash.fillCircle(
              point.x + Math.cos(angle) * progress * 22,
              point.y -
                (frame.kind === "cover" ? 16 : 42 * unitScale) +
                Math.sin(angle) * progress * 15 +
                progress * progress * 12,
              (1 - progress) * 2.3,
            );
          }
        }
      }
    }
  }
  const dark = () => !!night && model.night !== false;
  const lightsOn = () => dark() && model.lights !== false;
  /** The tint for something standing at `p`: the ambient plus the lights reaching it. */
  function nightTint(p: Point, under = 0xffffff): number | null {
    if (!night || !dark()) return null;
    // The same light the pavement shows, at the same gain; the tint caps it at the art.
    const light = lightsOn()
      ? lightAt(night.lights, arena.environment!.structures, p).map((v) => v * night!.config.gain)
      : undefined;
    return tintFor(night.config.ambient, light, under);
  }
  /**
   * The night, each frame, after visibility, sorting and fading are settled: every
   * light sprite takes its parent's visibility, alpha and depth, so a light shows
   * only while its surface does, fades with it, and sorts directly above it.
   */
  function applyNight() {
    if (!night) return;
    const on = dark();
    if (tinted !== on) {
      tinted = on;
      night.grade?.setVisible(on);
      const ambient = tintFor(night.config.ambient);
      for (const image of lit) {
        if (on) image.setTint(ambient);
        else image.clearTint();
      }
    }
    const lights = lightsOn();
    for (const image of lit) {
      const light = image.getData("light") as Phaser.GameObjects.Image | undefined;
      light
        ?.setVisible(lights && image.visible)
        .setAlpha(image.alpha)
        .setDepth(image.depth + 0.5);
    }
    for (const prop of scenery) {
      const r: Rect = prop.getData("sortRect");
      const shade = nightTint({ x: r.x + r.width / 2, y: r.y + r.height / 2 });
      if (shade === null) prop.clearTint();
      else prop.setTint(shade);
    }
  }
  const scene = new CourtyardScene({ key: "courtyard" });
  function reconcile(current: CourtyardScene) {
    if (!ready) return;
    if (previousLive === model.live && previousFrame === model.playback) return;
    if (
      previousFrame?.sequence !== model.playback?.sequence ||
      previousFrame?.animate !== model.playback?.animate
    )
      started = Date.now();
    if (previousLive && previousLive.id !== model.live.id) {
      for (const unit of units.values()) unit.container.destroy();
      units.clear();
    }
    previousLive = model.live;
    previousFrame = model.playback;
    for (const [id, unit] of units)
      if (!model.live.state.combatants[id]) {
        unit.container.destroy();
        units.delete(id);
      }
    for (const id of model.live.state.order) {
      const actor = model.live.state.combatants[id];
      const data = model.live.data[id];
      if (!actor || !data) continue;
      if (units.has(id)) continue;
      const p = project(data.position);
      const shadow = current.add.ellipse(0, 0, 30, 12, 0x01050a, 0.6);
      const sprite = current.add
        .image(
          0,
          0,
          street && actor.side === "neutral"
            ? "civilian"
            : actor.isPlayer
              ? "mercenary"
              : "hostile",
          0,
        )
        .setOrigin(0.5, CHARACTER_FRAME.foot / CHARACTER_FRAME.size)
        .setScale(unitScale);
      const container = current.add.container(p.x, p.y, [shadow, sprite]).setDepth(p.y);
      const other = model.live.state.order.find((otherId) => {
        const otherActor = model.live.state.combatants[otherId];
        return otherActor && !otherActor.defeated && otherActor.side !== actor.side;
      });
      const toward = other ? model.live.data[other]?.position : null;
      units.set(id, {
        container,
        sprite,
        shadow,
        facing: toward
          ? facingFor(p, project(toward), actor.isPlayer ? "ne" : "sw")
          : actor.isPlayer
            ? "ne"
            : "sw",
      });
    }
  }
  /**
   * The movement overlay on the floor.
   *
   * Repainted on every sync rather than inside reconcile, because hovering a
   * square changes none of the encounter state reconcile watches.
   */
  function paintGrid(current: CourtyardScene) {
    const g = current.grid;
    if (!g) return;
    g.clear();
    const overlay = model.grid;
    if (!overlay) return;
    const fill = (corners: Phaser.Math.Vector2[], colour: number, alpha: number) =>
      g.fillStyle(colour, alpha).fillPoints(corners, true);
    const outline = (corners: Phaser.Math.Vector2[], colour: number, alpha: number, w = 1) =>
      g.lineStyle(w, colour, alpha).strokePoints(corners, true);
    const CYAN = 0x65eee0,
      AMBER = 0xf9bd72,
      GOLD = 0xffd166,
      INK = 0x061118;
    // Lines keep one width on screen at every zoom: a world-unit width scales.
    const px = 1 / Math.max(0.01, current.cameras.main.zoom);
    const mode = overlay.mode ?? "plan";
    const level = OVERLAY[mode];
    const chosen = overlay.chosen ? tileKey(overlay.chosen) : null;
    for (const { tile, sheltered, firing, faded } of overlay.squares) {
      const corners = squareCorners(tile);
      const colour = firing ? GOLD : mode === "plan" && sheltered ? AMBER : CYAN;
      const here = chosen === tileKey(tile);
      // Ground that cannot see the target stays visible as reach, but stops
      // competing with the ground that can.
      const strength = faded ? 0.35 : 1;
      const fillAlpha = here ? 0.26 : firing ? 0.16 : level.fill;
      if (fillAlpha > 0) fill(corners, colour, fillAlpha * strength);
      const lineAlpha = here ? 0.9 : firing ? 0.5 : level.square;
      if (lineAlpha > 0)
        outline(corners, here ? 0xa9fff5 : colour, lineAlpha * strength, (here ? 1.6 : 0.8) * px);
    }
    // The edge of reach: the Move Action's real boundary, dark under light so it
    // reads on asphalt and on pavement alike.
    for (const [a, b] of overlay.edge ?? []) {
      const p = screen(a),
        q = screen(b);
      g.lineStyle(3 * px, INK, 0.35 * level.edge).lineBetween(p.x, p.y, q.x, q.y);
      g.lineStyle(1.3 * px, CYAN, level.edge).lineBetween(p.x, p.y, q.x, q.y);
    }
    if (overlay.route?.length) {
      const path = overlay.route.map(screen);
      g.lineStyle(4.5 * px, INK, 0.45);
      g.strokePoints(path, false);
      g.lineStyle(2.4 * px, CYAN, 0.95);
      g.strokePoints(path, false);
    }
  }

  type PropRegistration = { originX: number; originY: number; groundWidth: number };
  function paintCover(current: CourtyardScene, damage: LiveEncounter["cover"]) {
    if (model.structureOnly) return;
    if (renderedCover === damage) return;
    renderedCover = damage;
    coverRevision++;
    for (const object of scenery) object.destroy();
    scenery.length = 0;
    for (const status of coverStatuses(arena, damage)) {
      const condition = propCondition(status);
      const binding = arena.environment?.props.find((p) => p.coverId === status.piece.id);
      const kind =
        binding?.art ??
        (street ? STREET_PROPS[status.piece.id]! : propKind(arena.key, status.piece.id));
      const placement = propPlacement(status, project);
      const procedural = isInteriorProp(kind);
      const texture =
        propTexture(kind, condition) + (procedural && binding?.rotation === 90 ? "-90" : "");
      const image = current.textures.get(texture).getSourceImage() as HTMLCanvasElement;
      const registration = procedural
        ? ((current.textures.get(texture).customData as { registration?: PropRegistration })
            .registration ?? { originX: 0.5, originY: 1, groundWidth: 1 })
        : atlasPropRegistration(kind, condition);
      const width = placement.width / registration.groundWidth;
      const height = (width * image.height) / image.width;
      const prop = current.add
        .image(placement.x, placement.y, texture)
        .setOrigin(
          !procedural && binding?.rotation === 90 ? 1 - registration.originX : registration.originX,
          registration.originY,
        )
        .setFlipX(!procedural && binding?.rotation === 90)
        .setDisplaySize(width, height)
        .setDepth(placement.depth);
      prop.setData("destroyed", status.destroyed).setData("sortRect", status.piece.rect);
      const cached = current.textures.get(texture).customData as {
        inkBounds?: ReturnType<typeof propInkBounds>;
      };
      const ink = cached.inkBounds ?? (cached.inkBounds = propInkBounds(image));
      const flip = !procedural && binding?.rotation === 90;
      const left = flip ? 1 - ink.right : ink.left,
        right = flip ? 1 - ink.left : ink.right;
      prop.setData("inkBounds", {
        x: prop.x + ((left + right) / 2 - prop.originX) * width,
        y: prop.y + (ink.bottom - prop.originY) * height,
        displayWidth: (right - left) * width,
        displayHeight: (ink.bottom - ink.top) * height,
        depth: prop.depth,
      });
      scenery.push(prop);
    }
  }
  function resize() {
    if (disposed || !ready || !host.clientWidth || !host.clientHeight) return;
    if (game.scale.width !== host.clientWidth || game.scale.height !== host.clientHeight)
      game.scale.resize(host.clientWidth, host.clientHeight);
    const camera = courtyardCamera(host.clientWidth, host.clientHeight, model.camera);
    scene.cameras.main.setZoom(camera.zoom).centerOn(camera.x, camera.y);
  }
  const game = new Phaser.Game({
    type: Phaser.WEBGL,
    parent: host,
    width: Math.max(1, host.clientWidth),
    height: Math.max(1, host.clientHeight),
    backgroundColor: "#050b10",
    transparent: false,
    banner: false,
    audio: { noAudio: true },
    input: { mouse: false, touch: false, keyboard: false, gamepad: false },
    fps: { target: 60 },
    scene,
  });
  const lost = () => {
    ready = false;
    onFailure();
  };
  game.canvas.addEventListener("webglcontextlost", lost);
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  return {
    sync(next) {
      model = next;
      reconcile(scene);
      if (ready) paintGrid(scene);
      resize();
    },
    destroy() {
      if (disposed) return;
      disposed = true;
      observer.disconnect();
      game.canvas.removeEventListener("webglcontextlost", lost);
      // Removing a canvas does not release its WebGL context. Repeated scene
      // reviews otherwise depend on GC and can evict a live renderer. Phaser
      // destroys on its next frame; release only after its GL cleanup finishes.
      const gl = (game.renderer as Phaser.Renderer.WebGL.WebGLRenderer | null)?.gl;
      game.events.once(Phaser.Core.Events.DESTROY, () => {
        queueMicrotask(() => gl?.getExtension("WEBGL_lose_context")?.loseContext());
      });
      game.destroy(true);
    },
  };
}
