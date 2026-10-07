/**
 * The storefront art pack: what is generated, at what size, mapped onto what.
 *
 * One source of truth for the numbers. `tools/scenes/storefront-guides.ts` draws
 * the guides Picaso is given from it, and the renderer (once artwork returns) places
 * the finished images from it, so a guide and the thing it was a guide for cannot
 * drift. Presentation only: nothing here is saved, collides or changes a rule.
 *
 * All lengths are metres on the storefront's own face. `s` runs along the wall
 * from the building's west corner; `z` is height above the pavement.
 */

/** The storefront the pack is built for: the corner shop of intersection seed 7. */
export const STOREFRONT_BENCHMARK = {
  recipe: "intersection",
  seed: 7,
  structureId: "building_0",
  entranceId: "entrance_0",
  attachmentId: "shop-canopy",
  /** The facade the camera sees: world y = rect.y, running along x. */
  edge: "north",
} as const;

/**
 * Heights on the face, from the pavement up. Window bays, the door and the
 * awning are the renderer's existing numbers (the bays start 3.5 m along, the door
 * is the saved 1.6 m entrance, the awning is the saved `shop-canopy` attachment);
 * the rest are presentation choices made here, each clear of those.
 */
export const STOREFRONT_LEVELS = {
  /** Glazing is 2.2 m wide and exactly 3:2, so a 3:2 canvas covers it with no waste. */
  riser: 2.35 - 2.2 / 1.5,
  glazingTop: 2.35,
  doorHeight: 2.2,
  housingTop: 2.4,
  awningWall: 2.7,
  awningOuter: 2.45,
  awningProjection: 1.5,
  awningSpan: 4,
  fasciaBottom: 2.75,
  fasciaTop: 3.65,
  parapetTop: 4,
} as const;

/** Where the door and bays fall along the face. */
export const STOREFRONT_FACE = {
  /** The saved entrance is at world x 25, 1.0 m from the building's west corner. */
  doorCentre: 1,
  doorWidth: 1.6,
  bayWidth: 2.2,
  /** The renderer starts a bay every 3 m from 0.5; the one the door sits in is skipped. */
  bayStarts: [3.5, 6.5],
} as const;

/**
 * The kanji sign, drawn in code: 深夜市場 ("Night Market"), the sign in the
 * reference frame. Not a generated asset: the glyphs are a mask rasterised from a
 * real font by `tools/art/kanji-sign.mjs`, so the renderer can light and glow them,
 * and nothing depends on the player having a CJK font. It is a flush light-box on
 * the fascia over the saved entrance, four square cells in a row. The larger cells
 * are prefiltered for the normal play view.
 */
export const STOREFRONT_SIGN = {
  text: "深夜市場",
  mask: "/images/signs/shenye-ichiba.webp",
  /** Distance along the face from the building's west corner, in metres. */
  s0: 0.05,
  width: 2.9,
  /** Height above the pavement of the panel's foot. */
  z0: 2.85,
  height: 0.75,
  /** Each glyph cell is square: 4 x 0.62 m inside a 0.21 m margin. */
  cell: 0.62,
} as const;

export type PackRect = { x: number; y: number; w: number; h: number };
export type PackZone = { id: string; label: string; rect: PackRect };
export type PackPoint = { id: string; label: string; x: number; y: number };

export interface PackAsset {
  id: "window-interior" | "awning-fabric" | "shutter-wear";
  /** File name Picaso saves it as, and the one the pack will be validated under. */
  file: string;
  canvas: { w: number; h: number };
  /** The face area the whole canvas covers, in metres. */
  metres: { w: number; h: number };
  /** The surface it is projected onto. */
  plane: "wall" | "awning-slope";
  /** Where the whole canvas lands on that plane. */
  placement: string;
  /** Pixels that must be flat key colour: the renderer makes them transparent. */
  key: "#ff00ff" | null;
  /** The left and right edges are joined when the canvas repeats along the span. */
  tilesAcross: boolean;
  /** Part of the canvas the renderer covers with its own geometry. Art here is wasted. */
  protectedZones: PackZone[];
  /** Points the renderer attaches geometry to. */
  attachments: PackPoint[];
}

const CANVAS_3_2 = { w: 1536, h: 1024 } as const;

/** Pixels per metre on a canvas of a given size. Equal on both axes by construction. */
export function packPixelsPerMetre(a: PackAsset) {
  return { x: a.canvas.w / a.metres.w, y: a.canvas.h / a.metres.h };
}

const zone = (a: PackAsset, id: string, label: string, m: PackRect): PackZone => {
  const { x } = packPixelsPerMetre(a);
  return {
    id,
    label,
    rect: {
      x: Math.round(m.x * x),
      y: Math.round(m.y * x),
      w: Math.round(m.w * x),
      h: Math.round(m.h * x),
    },
  };
};
const point = (a: PackAsset, id: string, label: string, mx: number, my: number): PackPoint => {
  const { x } = packPixelsPerMetre(a);
  return { id, label, x: Math.round(mx * x), y: Math.round(my * x) };
};

function build(
  base: Omit<PackAsset, "protectedZones" | "attachments">,
  make: (a: PackAsset) => {
    zones: PackZone[];
    points: PackPoint[];
  },
): PackAsset {
  const asset: PackAsset = { ...base, protectedZones: [], attachments: [] };
  const { zones, points } = make(asset);
  asset.protectedZones = zones;
  asset.attachments = points;
  return asset;
}

/** 2.2 m x 1.467 m of glazing: the saved bay width, from the riser to the existing head height. */
const windowInterior = build(
  {
    id: "window-interior",
    file: "storefront-window-interior.png",
    canvas: CANVAS_3_2,
    metres: { w: 2.2, h: 2.2 / 1.5 },
    plane: "wall",
    placement: `behind the glass of every shop bay, z ${STOREFRONT_LEVELS.riser.toFixed(3)}-${STOREFRONT_LEVELS.glazingTop} m, set 0.12 m back from the facade`,
    key: null,
    tilesAcross: false,
  },
  (a) => {
    const w = a.metres.w;
    const h = a.metres.h;
    return {
      zones: [
        zone(a, "frame-top", "frame", { x: 0, y: 0, w, h: 0.07 }),
        zone(a, "frame-bottom", "frame and sill", { x: 0, y: h - 0.07, w, h: 0.07 }),
        zone(a, "frame-left", "frame", { x: 0, y: 0, w: 0.07, h }),
        zone(a, "frame-right", "frame", { x: w - 0.07, y: 0, w: 0.07, h }),
        zone(a, "mullion", "mullion", { x: w / 2 - 0.025, y: 0, w: 0.05, h }),
      ],
      points: [
        point(a, "vanish", "eye-level vanishing point of the room", w / 2, h * 0.42),
        point(a, "floor", "where the interior floor meets the glass", w / 2, h * 0.9),
      ],
    };
  },
);

/** Four 0.4 m stripes, joined left to right; stripes run down the slope. */
const awningFabric = build(
  {
    id: "awning-fabric",
    file: "storefront-awning-fabric.png",
    canvas: { w: 1024, h: 1024 },
    metres: { w: 1.6, h: 1.6 },
    plane: "awning-slope",
    placement: `on the saved 4 m x ${STOREFRONT_LEVELS.awningProjection} m canopy: repeated along the span, run down the slope from the wall`,
    key: null,
    tilesAcross: true,
  },
  (a) => {
    const slope = Math.hypot(
      STOREFRONT_LEVELS.awningProjection,
      STOREFRONT_LEVELS.awningWall - STOREFRONT_LEVELS.awningOuter,
    );
    return {
      zones: [
        zone(a, "hem", "valance hem (drawn in code)", { x: 0, y: slope, w: 1.6, h: 1.6 - slope }),
      ],
      points: [
        point(a, "wall-edge", "wall bracket line", 0, 0),
        point(a, "slope-end", "end of the sloped fabric", 0, slope),
      ],
    };
  },
);

/** 1.6 m x 2.4 m: the 1.6 m door (z 0-2.2) and the 0.2 m of housing box above it. */
const shutterWear = build(
  {
    id: "shutter-wear",
    file: "storefront-shutter-wear.png",
    canvas: { w: 1024, h: 1536 },
    metres: { w: 1.6, h: 2.4 },
    plane: "wall",
    placement: `over the shutter door, s ${(STOREFRONT_FACE.doorCentre - 0.8).toFixed(1)}-${(STOREFRONT_FACE.doorCentre + 0.8).toFixed(1)} m, z 0-${STOREFRONT_LEVELS.housingTop} m`,
    key: "#ff00ff",
    tilesAcross: false,
  },
  (a) => {
    const w = a.metres.w;
    const h = a.metres.h;
    return {
      zones: [
        zone(a, "housing", "shutter housing box (drawn in code)", {
          x: 0,
          y: 0,
          w,
          h: STOREFRONT_LEVELS.housingTop - STOREFRONT_LEVELS.doorHeight,
        }),
        zone(a, "rail-left", "side rail", {
          x: 0,
          y: 0.2,
          w: 0.08,
          h: h - 0.2,
        }),
        zone(a, "rail-right", "side rail", { x: w - 0.08, y: 0.2, w: 0.08, h: h - 0.2 }),
        zone(a, "bottom-bar", "bottom bar", { x: 0, y: h - 0.05, w, h: 0.05 }),
      ],
      points: [
        point(a, "door-head", "door head, where the slats start", w / 2, 0.2),
        point(a, "ground", "pavement line", w / 2, h),
      ],
    };
  },
);

export const STOREFRONT_PACK: readonly PackAsset[] = [windowInterior, awningFabric, shutterWear];
