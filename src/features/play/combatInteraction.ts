/**
 * What the player is in the middle of doing on the battlefield.
 *
 * This used to be four independent pieces of state — a mode, a destination, a
 * hover point and a selected target — which could and did contradict each
 * other: a locked movement preview while the mode said "shoot", a hover left
 * behind after a commit. One value with one shape cannot.
 *
 * Two things deliberately live OUTSIDE this union:
 *
 * - The camera tool (pan). Panning is a way of looking, not a thing you are
 *   doing to the fight; it must not cancel a locked preview.
 * - Whether a command is in flight. That truth belongs to the mutation layer,
 *   so `resolving-action` is DERIVED from it (see `interactionOf`) rather than
 *   stored here, where it could disagree with the request actually running.
 *
 * Pure: no React, no engine, no rules. It decides what the player is looking at
 * and pointing at. Whether an action is legal is still the engine's answer.
 */
import type { Tile } from "@/engine";

/**
 * A target stays LOCKED across movement, because moving to get a shot and then
 * taking it is one tactical thought. The lock therefore rides along on the
 * movement states rather than being cancelled by them.
 */
export type Interaction =
  | { type: "idle"; locked: string | null }
  | { type: "move-hover"; tile: Tile; locked: string | null }
  | { type: "move-preview"; tile: Tile; locked: string | null }
  /** Pointing at an enemy. `locked` is whoever stays selected on hover-out. */
  | { type: "target-hover"; targetId: string; locked: string | null }
  | { type: "target-selected"; targetId: string }
  /** Reachable squares that can see the locked target; `tile` is the hovered one. */
  | { type: "find-firing-position"; targetId: string; tile: Tile | null }
  | { type: "resolving-action" };

export type InteractionEvent =
  | { kind: "hover-tile"; tile: Tile }
  | { kind: "leave-board" }
  | { kind: "click-tile"; tile: Tile }
  | { kind: "hover-unit"; targetId: string }
  | { kind: "leave-unit" }
  | { kind: "click-unit"; targetId: string }
  | { kind: "find-firing-position" }
  /** Escape, right-click: back one level. */
  | { kind: "cancel" }
  /** A move was sent. The target survives it, so the shot can follow. */
  | { kind: "moved" }
  /** A shot was sent. The target stays selected: ROF 2 is a second shot. */
  | { kind: "fired" };

export const IDLE: Interaction = { type: "idle", locked: null };

/** Whoever stays selected when the pointer wanders off. */
export function lockedTarget(state: Interaction): string | null {
  switch (state.type) {
    case "idle":
    case "move-hover":
    case "move-preview":
    case "target-hover":
      return state.locked;
    case "target-selected":
    case "find-firing-position":
      return state.targetId;
    case "resolving-action":
      return null;
  }
}

/** The enemy the readout should describe: the one under the pointer, else the lock. */
export function readTarget(state: Interaction): string | null {
  return state.type === "target-hover" ? state.targetId : lockedTarget(state);
}

/** The square a movement readout should describe, if any. */
export function readTile(state: Interaction): Tile | null {
  switch (state.type) {
    case "move-hover":
    case "move-preview":
      return state.tile;
    case "find-firing-position":
      return state.tile;
    default:
      return null;
  }
}

const sameTile = (a: Tile, b: Tile) => a.col === b.col && a.row === b.row;

export function nextInteraction(state: Interaction, event: InteractionEvent): Interaction {
  // Nothing the pointer does reaches the board while a command is running; the
  // only way out is the mutation finishing, which recomputes the state.
  if (state.type === "resolving-action") return state;
  const locked = lockedTarget(state);

  switch (event.kind) {
    case "hover-tile":
      // A locked preview is not disturbed by the pointer drifting over other
      // ground: it was chosen deliberately and is cancelled deliberately.
      if (state.type === "move-preview") return state;
      if (state.type === "find-firing-position") return { ...state, tile: event.tile };
      return { type: "move-hover", tile: event.tile, locked };

    case "leave-board":
      if (state.type === "move-hover") return { type: "idle", locked };
      if (state.type === "find-firing-position") return { ...state, tile: null };
      return state;

    case "click-tile":
      if (state.type === "find-firing-position")
        // Picking a firing square is still just picking a square: it previews,
        // it does not walk, and it certainly does not shoot.
        return { type: "move-preview", tile: event.tile, locked: state.targetId };
      if (state.type === "move-preview" && sameTile(state.tile, event.tile)) return state;
      return { type: "move-preview", tile: event.tile, locked };

    case "hover-unit":
      if (state.type === "move-preview") return state;
      return { type: "target-hover", targetId: event.targetId, locked };

    case "leave-unit":
      if (state.type !== "target-hover") return state;
      return state.locked
        ? { type: "target-selected", targetId: state.locked }
        : { type: "idle", locked: null };

    case "click-unit":
      return { type: "target-selected", targetId: event.targetId };

    case "find-firing-position": {
      const target = readTarget(state);
      return target ? { type: "find-firing-position", targetId: target, tile: null } : state;
    }

    case "cancel":
      // One level back, not all the way out: abandoning a route should not also
      // forget who you were aiming at.
      if (state.type === "move-preview" || state.type === "move-hover")
        return { type: "idle", locked };
      if (state.type === "find-firing-position")
        return { type: "target-selected", targetId: state.targetId };
      return { type: "idle", locked: null };

    case "moved":
      return { type: "idle", locked };

    case "fired":
      return locked
        ? { type: "target-selected", targetId: locked }
        : { type: "idle", locked: null };
  }
}

/**
 * The state the screen actually renders.
 *
 * A command in flight outranks whatever the pointer was doing. Deriving it here
 * — rather than storing it on commit — is what guarantees the board cannot show
 * a live preview while a write is running, however the write started.
 */
export function interactionOf(state: Interaction, resolving: boolean): Interaction {
  return resolving ? { type: "resolving-action" } : state;
}
