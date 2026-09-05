/** Shared, pure decisions for the board, intent parser and committed actions. */
import {
  type Arena,
  type Point,
  metresBetween,
  moveToward,
  segmentIntersectsRect,
} from "./battlefield";
import { coverDestroyed, type CoverDamage } from "./cover";
import { findTargetCapability, findWeapon, type CapabilitySnapshot } from "./capability";
import { judgeAction, type ActionCost, type LegalityVerdict } from "./legality";
import { weaponAttackDv, weaponAttackGap, weaponProfile } from "./weaponProfile";

type Refusal = Extract<LegalityVerdict, { ok: false }>;
export type MovementPreview =
  { ok: true; position: Point; path: Point[]; moved: number; cost: ActionCost } | Refusal;

const EPSILON = 0.000001;
const inside = (r: { x: number; y: number; width: number; height: number }, p: Point) =>
  p.x > r.x + EPSILON &&
  p.x < r.x + r.width - EPSILON &&
  p.y > r.y + EPSILON &&
  p.y < r.y + r.height - EPSILON;

/** Shortest walk around intact footprints, with continuous-metre endpoints.
 * Boundary edges are walkable. Legacy actors inside a footprint can leave it.
 * No grid, actor collision, climbing or new movement-rate rule is introduced.
 */
export function walkingPath(
  arena: Arena,
  damage: CoverDamage,
  from: Point,
  to: Point,
): Point[] | null {
  const onBoard = (p: Point) =>
    Number.isFinite(p.x) &&
    Number.isFinite(p.y) &&
    p.x >= 0 &&
    p.y >= 0 &&
    p.x <= arena.extent.width &&
    p.y <= arena.extent.height;
  if (!onBoard(from) || !onBoard(to)) return null;
  const obstacles = (arena.cover ?? []).filter(
    (p) => p.blocksMovement !== false && !coverDestroyed(p, damage),
  );
  if (obstacles.some((p) => inside(p.rect, to))) return null;
  const rects = obstacles.filter((p) => !inside(p.rect, from)).map((p) => ({ ...p.rect }));
  // Adjacent authored sections form one solid footprint, not a zero-width passage.
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      const a = rects[i]!,
        b = rects[j]!;
      if (a.y === b.y && a.height === b.height && a.x <= b.x + b.width && b.x <= a.x + a.width) {
        const right = Math.max(a.x + a.width, b.x + b.width);
        a.x = Math.min(a.x, b.x);
        a.width = right - a.x;
      } else if (
        a.x === b.x &&
        a.width === b.width &&
        a.y <= b.y + b.height &&
        b.y <= a.y + a.height
      ) {
        const bottom = Math.max(a.y + a.height, b.y + b.height);
        a.y = Math.min(a.y, b.y);
        a.height = bottom - a.y;
      } else continue;
      rects.splice(j, 1);
      i = -1;
      break;
    }
  }
  const clear = (a: Point, b: Point) =>
    !rects.some((r) =>
      segmentIntersectsRect(a, b, {
        x: r.x === 0 ? -EPSILON : r.x + EPSILON,
        y: r.y === 0 ? -EPSILON : r.y + EPSILON,
        width:
          r.width -
          EPSILON * 2 +
          (r.x === 0 ? EPSILON * 2 : 0) +
          (r.x + r.width === arena.extent.width ? EPSILON * 2 : 0),
        height:
          r.height -
          EPSILON * 2 +
          (r.y === 0 ? EPSILON * 2 : 0) +
          (r.y + r.height === arena.extent.height ? EPSILON * 2 : 0),
      }),
    );
  if (clear(from, to)) return [from, to];
  const corners = rects
    .flatMap((r) => [
      { x: r.x, y: r.y },
      { x: r.x + r.width, y: r.y },
      { x: r.x, y: r.y + r.height },
      { x: r.x + r.width, y: r.y + r.height },
    ])
    .filter((p) => onBoard(p) && !rects.some((r) => inside(r, p)));
  const nodes = [from, to, ...corners];
  const distances = nodes.map(() => Infinity);
  const previous = nodes.map(() => -1);
  const visited = new Set<number>();
  distances[0] = 0;
  while (visited.size < nodes.length) {
    let current = -1;
    for (let i = 0; i < nodes.length; i++) {
      if (!visited.has(i) && (current === -1 || distances[i]! < distances[current]!)) current = i;
    }
    if (current < 0 || !Number.isFinite(distances[current]!)) return null;
    if (current === 1) {
      const path: Point[] = [];
      for (let i = 1; i !== -1; i = previous[i]!) path.unshift(nodes[i]!);
      return path;
    }
    visited.add(current);
    for (let i = 0; i < nodes.length; i++) {
      if (visited.has(i) || !clear(nodes[current]!, nodes[i]!)) continue;
      const distance = distances[current]! + metresBetween(nodes[current]!, nodes[i]!);
      if (distance < distances[i]!) {
        distances[i] = distance;
        previous[i] = current;
      }
    }
  }
  return null;
}

/** Walk as much of a planned route as the allowance permits (NPC movement). */
export function walkRoute(path: Point[], allowance: number): { position: Point; metres: number } {
  let position = path[0]!;
  let spent = 0;
  for (const next of path.slice(1)) {
    const length = metresBetween(position, next);
    if (length > allowance - spent) {
      position = moveToward(position, next, allowance - spent).position;
      spent = allowance;
      break;
    }
    spent += length;
    position = next;
  }
  return { position, metres: Math.round(spent) };
}

export function previewMovement(input: {
  arena: Arena;
  cover: CoverDamage;
  from: Point;
  to: Point;
  capability: CapabilitySnapshot;
}): MovementPreview {
  const path = walkingPath(input.arena, input.cover, input.from, input.to);
  if (!path)
    return { ok: false, code: "move_exceeded", reason: "There is no walking route to that spot." };
  const moved = Math.round(
    path.slice(1).reduce((sum, p, i) => sum + metresBetween(path[i]!, p), 0),
  );
  if (moved <= 0)
    return { ok: false, code: "move_exceeded", reason: "That would leave you where you are." };
  const verdict = judgeAction(input.capability, { kind: "move", metres: moved });
  if (!verdict.ok) return verdict;
  return { ok: true, position: input.to, path, moved, cost: verdict.cost };
}

/** The very same ranged-shot support and DV used by the attack card. */
export function previewAttack(capability: CapabilitySnapshot, targetKey: string, weaponId: string) {
  const target = findTargetCapability(capability, targetKey);
  const distance = target?.distance ?? 0;
  const verdict = judgeAction(capability, {
    kind: "attack",
    targetKey,
    weapon: weaponId,
    distance,
  });
  if (!verdict.ok) return { distance, dv: null, gap: verdict.reason, verdict };
  const profile = weaponProfile(findWeapon(capability, weaponId)!.itemId);
  return {
    distance,
    dv: weaponAttackDv(profile, distance),
    gap: weaponAttackGap(profile, distance),
    verdict,
  };
}
