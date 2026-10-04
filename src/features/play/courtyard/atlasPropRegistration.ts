import type { PropKind, PropCondition } from "./propPresentation";

/** Ground contacts measured in each supplied atlas cell (fractions of the cell).
 * These are asset metadata, not alpha bounds: a bent exhaust, canopy or debris
 * must not change the object's metres-per-pixel scale when its HP changes.
 */
const CONTACTS: Partial<
  Record<PropKind, { width: number; x: number; feet: [number, number, number] }>
> = {
  cargo: { width: 0.88, x: 0.51, feet: [0.94, 0.94, 0.94] },
  pallet: { width: 0.92, x: 0.5, feet: [0.71, 0.71, 0.705] },
  dumpster: { width: 0.8, x: 0.49, feet: [0.94, 0.94, 0.94] },
  generator: { width: 0.86, x: 0.5, feet: [0.91, 0.91, 0.91] },
  barrier: { width: 0.92, x: 0.5, feet: [0.93, 0.93, 0.93] },
  "food-cart": { width: 0.72, x: 0.51, feet: [0.94, 0.94, 0.8] },
  "truck-cargo": { width: 0.75, x: 0.52, feet: [0.93, 0.86, 0.66] },
  "truck-cab": { width: 0.77, x: 0.49, feet: [0.98, 0.89, 0.72] },
};

export function atlasPropRegistration(kind: PropKind, condition: PropCondition) {
  const contact = CONTACTS[kind];
  if (!contact) throw new Error(`Missing ground registration: ${kind}`);
  return {
    originX: contact.x,
    originY: contact.feet[condition === "intact" ? 0 : condition === "damaged" ? 1 : 2],
    groundWidth: contact.width,
  };
}
