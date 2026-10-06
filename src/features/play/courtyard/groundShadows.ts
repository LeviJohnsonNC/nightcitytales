/**
 * The ground's light for the street as it stands now: lamp shadows (`lampShadow.ts`)
 * that follow the complete destruction state.
 *
 * The ground's light is painted once with every prop standing. A prop that is destroyed
 * leaves a lower wreck, whose shadow is smaller, so the light it no longer blocks has to
 * come back. #299 gave each prop its own restore sprite, computed as if every other prop
 * still stood. Where two props' shadows overlapped and both were destroyed, the overlap
 * stayed dark: each sprite assumed the other prop still shaded it.
 *
 * Here the props whose shadows touch (across every light) form a REGION
 * (`shadowRegions`). Inside a region's box no other prop's shadow reaches the ground,
 * so its light depends on its own props' states alone. When that state changes, the
 * region's patch is rendered from the complete state: the light pass with every prop
 * standing or wrecked as it now is, less the light pass with all of them standing, per
 * pixel. A patch is cached by state, so destroying and restoring (a reload, a replay)
 * never renders twice. Nothing is rendered per frame, and no combination is rendered
 * before it happens.
 *
 * Added over the ground's light (`ADD`), base + patch is exactly the light pass for that
 * state: a wreck's shadow lies inside its intact shadow, so the state's light is never
 * below the base, and the difference never clips.
 *
 * Unchanged: each light is still painted on its own (one light's shadow never takes away
 * another's light), the ambient is untouched, and the contact shade is a separate sprite.
 * A patch shows by damage and the lights switch only, never by a prop's fading.
 */
import type { Point } from "@/engine";
import type { GroundLight } from "./nightLighting";
import {
  ALIGN,
  BLUR_MARGIN,
  castersAsStanding,
  deviceBox,
  LAMP_SHADOW,
  paintShadowedLights,
  shadowArea,
  shadowRegions,
  type Box,
  type ShadowCaster,
} from "./lampShadow";

type Project = (p: Point) => Point;

/**
 * The light that falls on a surface, as the board shows it: painted by `paint`,
 * multiplied by the surface's own colour (`base`), kept to its pixels, and added to
 * itself up to `gain`. `crop` renders only that box of `base`.
 */
export function lightPassCanvas(
  base: HTMLCanvasElement,
  prepare: (ctx: CanvasRenderingContext2D) => void,
  paint: (ctx: CanvasRenderingContext2D) => void,
  gain: number,
  crop: Box = { x: 0, y: 0, width: base.width, height: base.height },
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = crop.width;
  canvas.height = crop.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(-crop.x, -crop.y);
  prepare(ctx);
  ctx.globalCompositeOperation = "lighter";
  paint(ctx);
  ctx.restore();
  ctx.globalCompositeOperation = "multiply";
  ctx.drawImage(base, -crop.x, -crop.y);
  ctx.globalCompositeOperation = "destination-in";
  ctx.drawImage(base, -crop.x, -crop.y);
  // A canvas holds light up to 1; real light on a dark surface goes past it. The
  // night's `gain` adds the lit surface to itself until a pool reads at play zoom.
  if (gain > 1) {
    const copy = document.createElement("canvas");
    copy.width = canvas.width;
    copy.height = canvas.height;
    copy.getContext("2d")!.drawImage(canvas, 0, 0);
    ctx.globalCompositeOperation = "lighter";
    for (let g = gain - 1; g > 0; g--) {
      ctx.globalAlpha = Math.min(1, g);
      ctx.drawImage(copy, 0, 0);
    }
    ctx.globalAlpha = 1;
  }
  ctx.globalCompositeOperation = "source-over";
  return canvas;
}

/** Everything the ground's light is made from. */
export interface GroundLightSetup {
  /** The ground's painted colour, the canvas its light is multiplied by. */
  base: HTMLCanvasElement;
  /** Maps scene units onto `base`'s pixels. */
  prepare: (ctx: CanvasRenderingContext2D) => void;
  project: Project;
  lights: readonly GroundLight[];
  casters: readonly ShadowCaster[];
  /** A light's fixture height. */
  zOf: (light: GroundLight) => number;
  /** Paint one light's ground footprint, before shadows. */
  paintLight: (ctx: CanvasRenderingContext2D, light: GroundLight) => void;
  gain: number;
}

/** A region of the ground whose light depends on these casters alone. */
export interface ShadowRegion {
  /** Its casters' cover ids, sorted. */
  ids: string[];
  /** Its box on the ground canvas, in pixels. */
  box: Box;
}

/** The ground's light for one destruction state, fresh: every light, every caster as it stands. */
export function renderGroundLight(
  setup: GroundLightSetup,
  destroyed: ReadonlySet<string>,
  crop?: Box,
): HTMLCanvasElement {
  const casters = castersAsStanding(setup.casters, destroyed);
  return lightPassCanvas(
    setup.base,
    setup.prepare,
    (ctx) =>
      paintShadowedLights(ctx, setup.project, setup.lights, casters, setup.zOf, setup.paintLight),
    setup.gain,
    crop,
  );
}

/** A destruction state's key within a region: its destroyed ids, in order. */
const stateKey = (ids: readonly string[], destroyed: ReadonlySet<string>) =>
  ids.filter((id) => destroyed.has(id)).join("|");

/**
 * The ground's lamp shadows as regions with cached patches. `patch` answers, for a
 * region and the street's complete destruction state, the light to add over the base
 * (or null when every one of its casters stands).
 */
export class GroundShadows {
  readonly regions: ShadowRegion[];
  private readonly standing = new Map<string, Uint8ClampedArray>();
  private readonly patches = new Map<string, HTMLCanvasElement>();
  /** How many patches have been rendered, for the checks. */
  rendered = 0;

  constructor(readonly setup: GroundLightSetup) {
    // the regions' boxes are measured on a context framed as the ground canvas is
    const probe = document.createElement("canvas");
    probe.width = setup.base.width;
    probe.height = setup.base.height;
    const ctx = probe.getContext("2d")!;
    setup.prepare(ctx);
    const m = ctx.getTransform();
    const pixels = Math.hypot(
      (setup.project({ x: 1, y: 0 }).x - setup.project({ x: 0, y: 0 }).x) * m.a,
      (setup.project({ x: 1, y: 0 }).y - setup.project({ x: 0, y: 0 }).y) * m.d,
    );
    const pad = 3 * LAMP_SHADOW.softness * pixels + 2;
    this.regions = shadowRegions(
      setup.casters.flatMap((c) => {
        const area = shadowArea(setup.lights, c, setup.zOf);
        const box = area && deviceBox(ctx, setup.project, area, pad);
        return box ? [{ id: c.coverId, box }] : [];
      }),
    );
  }

  /**
   * A region's box grown by the blur margin, for rendering it whole, with its origin on
   * a multiple of `ALIGN` pixels: the browser dithers gradients by a pattern fixed to
   * the canvas's pixels, so a crop rendered at another phase differs from the full
   * canvas by a level or two.
   */
  private framed(region: ShadowRegion): Box {
    const x = Math.floor((region.box.x - BLUR_MARGIN) / ALIGN) * ALIGN;
    const y = Math.floor((region.box.y - BLUR_MARGIN) / ALIGN) * ALIGN;
    return {
      x,
      y,
      width: region.box.x + region.box.width + BLUR_MARGIN - x,
      height: region.box.y + region.box.height + BLUR_MARGIN - y,
    };
  }

  /** The region's pixels for a state, from a render with its margin. */
  private pixels(region: ShadowRegion, destroyed: ReadonlySet<string>) {
    const frame = this.framed(region);
    const canvas = renderGroundLight(this.setup, destroyed, frame);
    return canvas
      .getContext("2d")!
      .getImageData(
        region.box.x - frame.x,
        region.box.y - frame.y,
        region.box.width,
        region.box.height,
      ).data;
  }

  /** The light to add over the base for this region in this state; null if none. */
  patch(region: ShadowRegion, destroyed: ReadonlySet<string>): HTMLCanvasElement | null {
    const key = stateKey(region.ids, destroyed);
    if (!key) return null;
    const cacheKey = `${region.ids.join("|")}#${key}`;
    const cached = this.patches.get(cacheKey);
    if (cached) return cached;
    const regionKey = region.ids.join("|");
    let standing = this.standing.get(regionKey);
    if (!standing) {
      standing = this.pixels(region, new Set());
      this.standing.set(regionKey, standing);
    }
    // only this region's casters matter inside its box
    const now = this.pixels(region, new Set(region.ids.filter((id) => destroyed.has(id))));
    const canvas = document.createElement("canvas");
    canvas.width = region.box.width;
    canvas.height = region.box.height;
    const ctx = canvas.getContext("2d")!;
    const out = ctx.createImageData(region.box.width, region.box.height);
    for (let i = 0; i < out.data.length; i += 4) {
      for (let c = 0; c < 3; c++) out.data[i + c] = Math.max(0, now[i + c]! - standing[i + c]!);
      out.data[i + 3] = 255;
    }
    ctx.putImageData(out, 0, 0);
    this.patches.set(cacheKey, canvas);
    this.rendered++;
    return canvas;
  }

  /** The cache key of a region's current state, so a caller can tell when it changed. */
  key(region: ShadowRegion, destroyed: ReadonlySet<string>) {
    return stateKey(region.ids, destroyed);
  }
}

/**
 * What the board shows for a state: the base (every caster standing) with each region's
 * patch added. The checks compare it with `renderGroundLight` for the same state.
 */
export function composeGroundLight(
  shadows: GroundShadows,
  base: HTMLCanvasElement,
  destroyed: ReadonlySet<string>,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = base.width;
  canvas.height = base.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(base, 0, 0);
  ctx.globalCompositeOperation = "lighter";
  for (const region of shadows.regions) {
    const patch = shadows.patch(region, destroyed);
    if (patch) ctx.drawImage(patch, region.box.x, region.box.y);
  }
  return canvas;
}

/**
 * How what the board shows compares with a fresh render, channel by channel. `standing`
 * is the base (every caster standing).
 *
 * A patch only adds light. Where rounding in the shadow's blur leaves a wreck's render a
 * level or two below the standing one, the board keeps the standing value. Those
 * channels are counted as `rounding`. Every other difference is `unexplained`, and the
 * checks require none.
 */
export function comparePixels(
  shown: ArrayLike<number>,
  fresh: ArrayLike<number>,
  standing: ArrayLike<number>,
) {
  let rounding = 0;
  let roundingMax = 0;
  let unexplained = 0;
  let unexplainedMax = 0;
  for (let i = 0; i < shown.length; i += 4)
    for (let c = 0; c < 3; c++) {
      const d = Math.abs(shown[i + c]! - fresh[i + c]!);
      if (!d) continue;
      if (shown[i + c] === standing[i + c] && fresh[i + c]! < standing[i + c]!) {
        rounding++;
        roundingMax = Math.max(roundingMax, d);
      } else {
        unexplained++;
        unexplainedMax = Math.max(unexplainedMax, d);
      }
    }
  return { rounding, roundingMax, unexplained, unexplainedMax };
}
