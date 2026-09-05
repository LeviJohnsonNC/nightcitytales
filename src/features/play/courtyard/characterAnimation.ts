import type { Combatant, Point } from "@/engine";
import type { PlaybackFrame } from "../combatPlayback";
import { routePosition } from "./courtyardPresentation";

export type Facing = "ne" | "se" | "sw" | "nw";
export type CharacterPose = "aim" | "walk" | "fire" | "hurt" | "fall" | "dead";
export const SHOT_TIMING = { fire: 160, impact: 220, recover: 430, settle: 610 } as const;
export const CHARACTER_FRAME = { size: 128, foot: 112, height: 78 } as const;

/** Direction is screen-facing presentation, never a rules-engine orientation. */
export function facingFor(from: Point, to: Point, fallback: Facing): Facing {
  const dx = to.x - from.x,
    dy = to.y - from.y;
  if (Math.hypot(dx, dy) < 0.001) return fallback;
  return dx >= 0 ? (dy < 0 ? "ne" : "se") : dy < 0 ? "nw" : "sw";
}

export function movementSample(path: Point[], progress: number) {
  const p = Math.max(0, Math.min(1, progress));
  return {
    position: routePosition(path, p),
    from: routePosition(path, Math.max(0, p - 0.0001)),
    to: routePosition(path, Math.min(1, p + 0.0001)),
  };
}

/** Interpret explicit, already-saved outcomes. HP zero and withdrawal are not death. */
export function poseFor(input: {
  actor: Combatant;
  exitReason?: "dead" | "withdrawn" | undefined;
  frame?: PlaybackFrame | null | undefined;
  elapsed: number;
  movementDuration: number;
  reducedMotion: boolean;
}): CharacterPose {
  const { actor, frame, elapsed, reducedMotion } = input;
  const animate = !reducedMotion && frame?.animate !== false;
  if (actor.defeated && input.exitReason === "dead") {
    if (
      animate &&
      frame?.kind === "status" &&
      frame.actorId === actor.id &&
      elapsed < SHOT_TIMING.settle
    )
      return elapsed < SHOT_TIMING.impact ? "hurt" : "fall";
    return "dead";
  }
  if (!animate || actor.defeated) return "aim";
  if (
    frame?.kind === "move" &&
    frame.actorId === actor.id &&
    frame.path &&
    frame.path.length > 1 &&
    elapsed < input.movementDuration
  )
    return "walk";
  if (frame?.kind === "attack" || frame?.kind === "cover") {
    if (
      frame.attackStyle !== "melee" &&
      frame.actorId === actor.id &&
      elapsed >= SHOT_TIMING.fire &&
      elapsed < SHOT_TIMING.recover
    )
      return "fire";
    if (
      frame.kind === "attack" &&
      frame.targetId === actor.id &&
      typeof frame.targetHpBefore === "number" &&
      actor.hp < frame.targetHpBefore &&
      elapsed >= SHOT_TIMING.impact &&
      elapsed < SHOT_TIMING.settle
    )
      return "hurt";
  }
  return "aim";
}

export function animationCell(
  facing: Facing,
  pose: CharacterPose,
  elapsed: number,
  hostile: boolean,
) {
  // The hostile sheet's useful rows are NW and SW; mirror them for the east views.
  // Curated after inspection: generated row labels are not trusted as metadata.
  const row = hostile ? (facing.startsWith("n") ? 3 : 2) : ["ne", "se", "sw", "nw"].indexOf(facing);
  const column =
    pose === "walk"
      ? [1, 2, 4, 3][Math.floor(Math.max(0, elapsed) / 105) % 4]!
      : pose === "fire"
        ? 5
        : pose === "hurt"
          ? 6
          : pose === "dead" || pose === "fall"
            ? 7
            : 0;
  return { frame: row * 8 + column, flipX: hostile && (facing === "ne" || facing === "se") };
}

/** Curated barrel tips in the normalized firing frames, relative to ground contact. */
export function muzzleOffset(facing: Facing, hostile = false): Point {
  if (hostile) return { x: facing.endsWith("e") ? 23 : -23, y: facing.startsWith("n") ? -57 : -47 };
  return {
    ne: { x: 27, y: -68 },
    se: { x: 29, y: -66 },
    sw: { x: -27, y: -57 },
    nw: { x: -29, y: -69 },
  }[facing];
}
