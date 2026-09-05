/** Shared, pure decisions for the board, intent parser and committed actions. */
import { type Arena, type Point, metresBetween } from "./battlefield";
import type { CoverDamage } from "./cover";
import {
  centreOf,
  pathTo,
  reachableTiles,
  tileKey,
  tileOf,
  type ReachField,
  type Tile,
} from "./grid";
import { findTargetCapability, findWeapon, type CapabilitySnapshot } from "./capability";
import { judgeAction, type ActionCost, type LegalityVerdict } from "./legality";
import { combatMoveSquares } from "./combat";
import { weaponAttackDv, weaponAttackGap, weaponProfile } from "./weaponProfile";

type Refusal = Extract<LegalityVerdict, { ok: false }>;
export type MovementPreview =
  { ok: true; position: Point; path: Point[]; moved: number; cost: ActionCost } | Refusal;

/**
 * Everywhere a Move Action can put this character, walked over the 2m lattice.
 *
 * One traversal answers both questions the board asks — which squares to light
 * up, and the route into any one of them — so the highlight and the path can
 * never disagree.
 */
export function movementField(input: {
  arena: Arena;
  cover: CoverDamage;
  from: Point;
  capability: CapabilitySnapshot;
  /** Where everybody else is standing. */
  occupied?: Point[];
}): ReachField {
  return reachableTiles({
    arena: input.arena,
    cover: input.cover,
    from: tileOf(input.arena, input.from),
    allowance: combatMoveSquares(input.capability.move, input.capability.woundState),
    ...(input.occupied ? { occupied: input.occupied } : {}),
  });
}

const onGround = (arena: Arena, p: Point) =>
  Number.isFinite(p.x) &&
  Number.isFinite(p.y) &&
  p.x >= 0 &&
  p.y >= 0 &&
  p.x <= arena.extent.width &&
  p.y <= arena.extent.height;

/** Metres walked along a route of tile centres. What the Move actually spends. */
export function routeMetres(path: Point[]): number {
  return path.slice(1).reduce((sum, p, i) => sum + metresBetween(path[i]!, p), 0);
}

/**
 * The square nearest a destination that this Move can actually reach.
 *
 * Hostiles want to close to their weapon's band; they get the same lattice, the
 * same diagonal price and the same corner rule the player does, so nobody ends
 * a turn standing between squares or inside a crate.
 */
export function walkTowardTile(input: {
  arena: Arena;
  cover: CoverDamage;
  from: Point;
  toward: Point;
  /** Squares, not metres. */
  squares: number;
  occupied?: Point[];
}): { position: Point; path: Point[]; metres: number } {
  const origin = tileOf(input.arena, input.from);
  const field = reachableTiles({
    arena: input.arena,
    cover: input.cover,
    from: origin,
    allowance: input.squares,
    ...(input.occupied ? { occupied: input.occupied } : {}),
  });
  let best = field.get(tileKey(origin))!;
  let bestGap = metresBetween(centreOf(origin), input.toward);
  for (const reached of field.values()) {
    const gap = metresBetween(centreOf(reached.tile), input.toward);
    if (gap < bestGap - 1e-9 || (gap < bestGap + 1e-9 && reached.cost < best.cost)) {
      best = reached;
      bestGap = gap;
    }
  }
  const path = (pathTo(field, best.tile) ?? [origin]).map(centreOf);
  return { position: path[path.length - 1]!, path, metres: Math.round(routeMetres(path)) };
}

export function previewMovement(input: {
  arena: Arena;
  cover: CoverDamage;
  from: Point;
  to: Point;
  capability: CapabilitySnapshot;
  occupied?: Point[];
  /** Reuse a field already computed for the same origin, rather than re-walking it. */
  field?: ReachField;
}): MovementPreview {
  // tileOf clamps, which is what an intent wants and not what a board click
  // wants: a destination off the ground is a refusal, not the nearest corner.
  if (!onGround(input.arena, input.to))
    return { ok: false, code: "move_exceeded", reason: "That is not on this ground." };
  const destination: Tile = tileOf(input.arena, input.to);
  const origin = tileOf(input.arena, input.from);
  if (tileKey(destination) === tileKey(origin))
    return { ok: false, code: "move_exceeded", reason: "That would leave you where you are." };
  const field = input.field ?? movementField(input);
  const tiles = pathTo(field, destination);
  if (!tiles)
    return {
      ok: false,
      code: "move_exceeded",
      reason: "That square is beyond this Move, or nothing walks to it.",
    };
  // The route is metres between square centres; the Move is priced in squares,
  // which the reach field has already bounded. Rounding is for the readout.
  const path = tiles.map(centreOf);
  const position = path[path.length - 1]!;
  const moved = Math.max(1, Math.round(routeMetres(path)));
  const verdict = judgeAction(input.capability, { kind: "move", metres: moved });
  if (!verdict.ok) return verdict;
  return { ok: true, position, path, moved, cost: verdict.cost };
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

/**
 * "Get closer" / "back off": walk as far toward a spot as the Move allows.
 *
 * previewMovement refuses a square it cannot reach, which is right for a board
 * click and wrong for an intent — a player who says "close on him" means as
 * close as they can get, not nothing at all.
 */
export function previewMovementToward(input: {
  arena: Arena;
  cover: CoverDamage;
  from: Point;
  toward: Point;
  capability: CapabilitySnapshot;
  occupied?: Point[];
}): MovementPreview {
  const walked = walkTowardTile({
    arena: input.arena,
    cover: input.cover,
    from: input.from,
    toward: input.toward,
    squares: combatMoveSquares(input.capability.move, input.capability.woundState),
    ...(input.occupied ? { occupied: input.occupied } : {}),
  });
  return previewMovement({ ...input, to: walked.position });
}
