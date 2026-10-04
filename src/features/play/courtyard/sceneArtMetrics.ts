/** Presentation dimensions in metres; these never resize saved collision sections. */
export const CHARACTER_FRAME = { size: 128, foot: 112, height: 78 } as const;
export const SCENE_PERSON_HEIGHT = 1.8;
export const PROP_CANVAS = { width: 256, height: 320, groundY: 320 } as const;
export const PROP_PIXELS_PER_METRE = 64 / Math.cos(Math.PI / 6);

/** The blockout kit was authored in small integer height units. Give those units
 * a physical meaning, instead of accidentally using texture pixels as metres.
 * Vehicle modules share one conversion, including independently damaged halves.
 */
export function propHeightMetres(kind: string, height: number) {
  return height * (kind.startsWith("sedan-") ? 1.45 / 83 : 1 / 50);
}
