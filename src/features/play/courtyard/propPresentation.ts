import type { CoverStatus, Point } from "@/engine";

export type PropKind =
  "cargo" | "generator" | "dumpster" | "barrier" | "pallet" | "truck-cargo" | "truck-cab";
export type PropCondition = "intact" | "damaged" | "wrecked";

export function isCourtyard(key: string | null | undefined) {
  return key === "night_shift" || key === "night_shift_yard";
}

/** Only art associations live here. Footprints, materials and HP come from the engine. */
export const YARD_PROPS: Record<string, PropKind> = {
  cargo_west: "cargo",
  cargo_east: "cargo",
  generator: "generator",
  dumpster: "dumpster",
  concrete: "barrier",
  pallets: "pallet",
  truck_cargo: "truck-cargo",
  truck_cab: "truck-cab",
};
export const PROP_KINDS: PropKind[] = [
  "cargo",
  "generator",
  "dumpster",
  "barrier",
  "pallet",
  "truck-cargo",
  "truck-cab",
];
export function propKind(arena: string, id: string): PropKind {
  return arena === "night_shift_yard" ? (YARD_PROPS[id] ?? "cargo") : "cargo";
}
export function propCondition(status: CoverStatus): PropCondition {
  return status.destroyed ? "wrecked" : status.hp < status.hpMax ? "damaged" : "intact";
}
export function propTexture(kind: PropKind, condition: PropCondition) {
  return `prop-${kind}-${condition}`;
}
/** Register the sprite to the same front corner and width as the clickable footprint. */
export function propPlacement(status: CoverStatus, project: (p: Point) => Point) {
  const r = status.piece.rect;
  const left = project({ x: r.x, y: r.y });
  const right = project({ x: r.x + r.width, y: r.y + r.height });
  const front = project({ x: r.x + r.width, y: r.y });
  const back = project({ x: r.x, y: r.y + r.height });
  const center = project({ x: r.x + r.width / 2, y: r.y + r.height / 2 });
  return {
    x: center.x,
    y: front.y,
    width: right.x - left.x,
    groundDepth: front.y - back.y,
    // Walkable wreckage must stay underneath every unit, even one at its far edge.
    depth: status.destroyed ? -500 : center.y,
  };
}
