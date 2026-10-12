/**
 * The seed-7 corner shop, finished: window recesses with interiors, a shutter
 * door with housing and rails, a fascia with a kanji sign, a canvas awning, and the
 * contact shadows and light that sit them in the street.
 *
 * Presentation only. Every position is read from the saved structure, its saved
 * entrance and awning attachment, and the numbers in `storefrontPack.ts`; nothing
 * here moves a wall, a door, a cover piece or a shot line. It paints into the same
 * canvases the renderer already makes (the building sprite, its cutaway pieces, one
 * awning sprite and the ground), through the scene's own projection, so scale,
 * registration and depth ordering are the renderer's.
 *
 * Coordinates: `s` is metres along the face from the building's first corner, `out`
 * is metres away from the wall (negative: into the building), `z` is height.
 *
 * The parts live in `storefront/`: `model.ts` (the storefront read from saved
 * geometry, the lamp's arm, face coordinates), `draw.ts` (canvas primitives),
 * `face.ts` (the face and its fascia sign), `blade.ts`, `awning.ts`, `ground.ts`,
 * `roof.ts` (rooftop units) and `lamp.ts` (the streetlight). This module is their
 * one public entry point.
 */
export {
  STOREFRONT_ART_FILES,
  awningFootprint,
  facePoint,
  faceWorld,
  lampArm,
  storefrontAssetKey,
  storefrontFor,
  type FaceOptions,
  type LampArm,
  type Pass,
  type Storefront,
  type StorefrontArt,
  type StorefrontArtKey,
} from "./storefront/model";
export { METER_BOX, meterBox, paintStorefrontFace, storefrontOpenings } from "./storefront/face";
export { BLADE, bladeSign, paintBladeSign } from "./storefront/blade";
export { paintAwning } from "./storefront/awning";
export { paintStorefrontGround, storefrontLights, type GroundOptions } from "./storefront/ground";
export { paintRoofShade, paintRooftopUnit } from "./storefront/roof";
export { paintStreetLamp, streetLamp } from "./storefront/lamp";
