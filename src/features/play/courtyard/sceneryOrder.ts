import type { Rect } from "@/engine";

export interface SpatialArt {
  rect: Rect;
  groundY: number;
  /** Metres above the ground; omitted for art without a measured volume. */
  elevation?: { bottom: number; top: number };
}

/** Camera looks along (+x, -y). Disjoint footprint intervals establish actual
 * front/back relationships; a long wall's centre or nearest corner cannot.
 * Opposite constraints on two axes mean diagonally separated objects, so their
 * order is immaterial and the stable ground-Y order breaks the tie.
 */
export function sceneryOrder(items: readonly SpatialArt[]) {
  const edges = items.map(() => [] as number[]),
    incoming = items.map(() => 0);
  for (let a = 0; a < items.length; a++)
    for (let b = a + 1; b < items.length; b++) {
      const p = items[a]!.rect,
        q = items[b]!.rect;
      let before = p.x + p.width <= q.x + 1e-6 || p.y >= q.y + q.height - 1e-6;
      let after = q.x + q.width <= p.x + 1e-6 || q.y >= p.y + p.height - 1e-6;
      // A low prop (or actor) beneath a canopy must paint first, even when
      // its ground centre is nearer the camera. Only overlapping footprints
      // qualify: elevation must not reverse a car standing in front of a wall.
      const pz = items[a]!.elevation,
        qz = items[b]!.elevation;
      const overlap =
        p.x < q.x + q.width && q.x < p.x + p.width && p.y < q.y + q.height && q.y < p.y + p.height;
      if (overlap && pz && qz) {
        if (pz.top <= qz.bottom) {
          before = true;
          after = false;
        } else if (qz.top <= pz.bottom) {
          before = false;
          after = true;
        }
      }
      if (before === after) continue;
      const from = before ? a : b,
        to = before ? b : a;
      edges[from]!.push(to);
      incoming[to]!++;
    }
  const remaining = new Set(items.map((_, i) => i)),
    ordered: number[] = [];
  let cycles = 0;
  while (remaining.size) {
    let available = [...remaining].filter((i) => incoming[i] === 0);
    if (!available.length) {
      cycles++;
      available = [...remaining];
    }
    available.sort((a, b) => items[a]!.groundY - items[b]!.groundY || a - b);
    const next = available[0]!;
    ordered.push(next);
    remaining.delete(next);
    for (const to of edges[next]!) incoming[to]!--;
  }
  return { ordered, cycles };
}
