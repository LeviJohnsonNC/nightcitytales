/**
 * The architectural art pilot: three painted assets that bring the buildings closer
 * to the painted cars and food cart, and the numbers every guide, importer check and
 * renderer placement is drawn from. Presentation only.
 *
 * WHICH FORMAT, AND WHY
 *   - The rooftop unit is an isolated isometric SPRITE, like a street prop. It is a
 *     free-standing 2 x 2 m object, all of one orientation (rooftop boxes are never
 *     rotated, and the camera is fixed), and it is drawn inside its building's own
 *     sprite, so it already sorts, fades and leaves with the roof. One image serves
 *     every plain rooftop box.
 *   - The window and the shutter are STRAIGHT-ON elevations, mapped onto the wall plane
 *     by the projection's own affine transform. A facade's sizes vary and its openings
 *     are saved; code keeps their dimensions, the recess, the sill, the housing's depth
 *     and the attachment to the wall (and so to every cutaway piece of it), and the art
 *     supplies only what code cannot: glass, frame, room, slats, rails, wear.
 * Nothing here flattens a facade into one picture.
 */
import { PROP_PIXELS_PER_METRE } from "./sceneArtMetrics";

/** Scene pixels per metre; the plain rooftop box is drawn 8 of them tall. */
export const SCENE_PPM = 15;

/**
 * The plain rooftop box `paintBuilding` draws on every shop-style roof without a
 * finished storefront: 2 x 2 m, 8 scene pixels (0.53 m) tall, placed at
 * x = r.x + 0.5 + 3i, y = r.y + min(3, r.height - 2.5). The art keeps that envelope.
 */
export const ROOF_UNIT = {
  footprint: 2,
  /** Height in scene pixels, as the renderer has always drawn it. */
  heightPx: 8,
  height: 8 / SCENE_PPM,
} as const;

/**
 * The unit's frame, in frame pixels (the street props' convention: the 2 m footprint
 * diamond spans the frame's width, its front corner on the bottom edge, 64 px per
 * metre across and PROP_PIXELS_PER_METRE up). Short, because the unit is low; the
 * runtime file is twice this.
 */
export const ROOF_UNIT_FRAME = {
  width: 256,
  /** diamond (147.8) + 0.53 m of unit (39.4) + room for nothing taller: 200 */
  height: 200,
  pxPerMetreUp: PROP_PIXELS_PER_METRE,
} as const;

/**
 * The generic shop bay: a 2.2 m opening from 0.65 m to min(2.35, height - 0.3) m,
 * every 3 m from 0.5 m along a face, none where a door is. On the 3 m annex it is
 * 2.2 x 1.7 m.
 */
export const BAY = {
  width: 2.2,
  sill: 0.65,
  head: 2.35,
  /** The glass is set back this far; the recess is code. */
  depth: 0.12,
  /** The art's aluminium frame and centre mullion, which the old drawing had. */
  frame: 0.07,
  mullion: 0.05,
} as const;

/**
 * The generic shop door: a 1.6 m roller shutter, 2.2 m high (min(2.2, height - 0.5)),
 * centred on the saved entrance. The art is its whole front: the curtain in the
 * opening, a guide rail either side, and the housing's front over the head. Code adds
 * the housing's top and side (its depth), and the contact shadow.
 */
export const SHUTTER = {
  opening: { width: 1.6, height: 2.2 },
  rail: 0.08,
  /** The housing runs 0.12 m past each side of the opening and 0.3 m above it. */
  housingOverhang: 0.12,
  housingHeight: 0.3,
  housingDepth: 0.22,
  bottomBar: 0.06,
} as const;

/** The whole shutter assembly, in metres: what the art's canvas region covers. */
export const SHUTTER_ASSEMBLY = {
  width: SHUTTER.opening.width + 2 * SHUTTER.housingOverhang,
  height: SHUTTER.opening.height + SHUTTER.housingHeight,
} as const;

/** The pack: what Picasso saves, at what canvas, and the region of it that is used. */
export const ARCHITECTURE_PILOT = {
  roofUnit: {
    file: "arch-roof-unit.png",
    canvas: { width: 1536, height: 1024 },
    /** a magenta key around the sprite; the importer keys and fits it */
    keyed: true,
  },
  window: {
    file: "arch-annex-window.png",
    canvas: { width: 1536, height: 1024 },
    /** full height; the central 2.2 : 1.7 is the opening, the side strips are cut */
    region: { aspect: BAY.width / (BAY.head - BAY.sill) },
    keyed: false,
  },
  shutter: {
    file: "arch-annex-shutter.png",
    canvas: { width: 1024, height: 1536 },
    /** full width; the central 1.84 : 2.5 is the assembly, magenta around its shape */
    region: { aspect: SHUTTER_ASSEMBLY.width / SHUTTER_ASSEMBLY.height },
    keyed: true,
  },
} as const;

/** Where a region of a given aspect sits, centred, on a canvas (pixels). */
export function centredRegion(canvas: { width: number; height: number }, aspect: number) {
  const fitsWidth = canvas.width / canvas.height <= aspect;
  const width = fitsWidth ? canvas.width : canvas.height * aspect;
  const height = fitsWidth ? canvas.width / aspect : canvas.height;
  return {
    x: (canvas.width - width) / 2,
    y: (canvas.height - height) / 2,
    width,
    height,
  };
}
