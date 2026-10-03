import { northHeywoodScene, type Arena } from "@/engine";
import { isCourtyard, type PropKind } from "./propPresentation";

export const STREET_PROPS: Record<string, PropKind> = {
  thorton_engine: "sedan-engine",
  thorton_cabin: "sedan-cabin",
  broth_cart_cart: "food-cart",
};
const street = northHeywoodScene().layout.arena;

/** Art is authored for this version's geometry. Unknown layouts keep the diagram. */
export function scenicTheme(arena: Arena): "courtyard" | "street" | "composed" | null {
  if (arena.environment) return "composed";
  if (isCourtyard(arena.key)) return "courtyard";
  if (
    arena.key !== street.key ||
    arena.extent.width !== street.extent.width ||
    arena.extent.height !== street.extent.height ||
    (arena.cover?.length ?? 0) !== street.cover!.length
  )
    return null;
  return street.cover!.every((expected) => {
    const actual = arena.cover?.find((piece) => piece.id === expected.id);
    return (
      actual &&
      Object.entries(expected.rect).every(
        ([axis, value]) => actual.rect[axis as keyof typeof actual.rect] === value,
      )
    );
  })
    ? "street"
    : null;
}

/** Neutral turns already say 'stays down'. Only an explicit death uses the prone art. */
export function civilianCell(dead: boolean, hasToolBag: boolean) {
  return (hasToolBag ? 3 : 0) + (dead ? 2 : 1);
}
