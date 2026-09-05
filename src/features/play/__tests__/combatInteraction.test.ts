/**
 * The interaction grammar, on its own.
 *
 * Movement and attacking are meant to read the same way — hover previews, one
 * click intends, a second click commits — and the bugs that grammar can have
 * are all about state that outlives the moment: a preview that survives a
 * commit, a target forgotten by a move, two modes live at once. None of that
 * needs a DOM to test.
 */
import { describe, expect, it } from "vitest";
import {
  IDLE,
  interactionOf,
  lockedTarget,
  nextInteraction,
  readTarget,
  readTile,
  type Interaction,
  type InteractionEvent,
} from "../combatInteraction";

const tile = (col: number, row: number) => ({ col, row });
const run = (start: Interaction, ...events: InteractionEvent[]) =>
  events.reduce(nextInteraction, start);

describe("moving", () => {
  it("previews on hover without locking anything", () => {
    const state = nextInteraction(IDLE, { kind: "hover-tile", tile: tile(3, 4) });
    expect(state).toEqual({ type: "move-hover", tile: tile(3, 4), locked: null });
    expect(readTile(state)).toEqual(tile(3, 4));
  });
  it("locks the preview on the first click", () => {
    const state = run(
      IDLE,
      { kind: "hover-tile", tile: tile(3, 4) },
      { kind: "click-tile", tile: tile(3, 4) },
    );
    expect(state.type).toBe("move-preview");
  });
  it("keeps a locked preview while the pointer wanders", () => {
    const locked = run(IDLE, { kind: "click-tile", tile: tile(3, 4) });
    expect(run(locked, { kind: "hover-tile", tile: tile(9, 9) })).toEqual(locked);
    expect(run(locked, { kind: "leave-board" })).toEqual(locked);
    // Hovering an enemy must not silently drop the route either.
    expect(run(locked, { kind: "hover-unit", targetId: "h1" })).toEqual(locked);
  });
  it("moves the preview when another square is clicked", () => {
    const state = run(
      IDLE,
      { kind: "click-tile", tile: tile(3, 4) },
      { kind: "click-tile", tile: tile(5, 5) },
    );
    expect(state).toMatchObject({ type: "move-preview", tile: tile(5, 5) });
  });
  it("cancels back to idle, not out of the fight", () => {
    const state = run(IDLE, { kind: "click-tile", tile: tile(3, 4) }, { kind: "cancel" });
    expect(state).toEqual({ type: "idle", locked: null });
  });
  it("drops the preview once the move is sent, so it cannot be sent twice", () => {
    const state = run(IDLE, { kind: "click-tile", tile: tile(3, 4) }, { kind: "moved" });
    expect(readTile(state)).toBeNull();
    expect(state.type).toBe("idle");
  });
});

describe("targeting", () => {
  it("hovering previews a target without selecting it", () => {
    const state = nextInteraction(IDLE, { kind: "hover-unit", targetId: "h1" });
    expect(state).toEqual({ type: "target-hover", targetId: "h1", locked: null });
    expect(readTarget(state)).toBe("h1");
    expect(lockedTarget(state)).toBeNull();
  });
  it("clicking selects, and hovering away from a selection returns to it", () => {
    const selected = run(IDLE, { kind: "click-unit", targetId: "h1" });
    expect(selected).toEqual({ type: "target-selected", targetId: "h1" });
    const wandered = run(selected, { kind: "hover-unit", targetId: "h2" }, { kind: "leave-unit" });
    expect(wandered).toEqual({ type: "target-selected", targetId: "h1" });
  });
  it("describes the enemy under the pointer over the one that is locked", () => {
    const state = run(
      IDLE,
      { kind: "click-unit", targetId: "h1" },
      { kind: "hover-unit", targetId: "h2" },
    );
    expect(readTarget(state)).toBe("h2");
    expect(lockedTarget(state)).toBe("h1");
  });
  it("keeps the target after firing, because ROF 2 is a second shot", () => {
    const state = run(IDLE, { kind: "click-unit", targetId: "h1" }, { kind: "fired" });
    expect(lockedTarget(state)).toBe("h1");
  });
});

describe("the two of them together", () => {
  it("keeps the target selected through a move, so the shot can follow", () => {
    const state = run(
      IDLE,
      { kind: "click-unit", targetId: "h1" },
      { kind: "hover-tile", tile: tile(2, 2) },
      { kind: "click-tile", tile: tile(2, 2) },
      { kind: "moved" },
    );
    expect(lockedTarget(state)).toBe("h1");
  });
  it("previewing a route never touches the target, and vice versa", () => {
    const state = run(
      IDLE,
      { kind: "click-unit", targetId: "h1" },
      { kind: "click-tile", tile: tile(2, 2) },
    );
    expect(state).toEqual({ type: "move-preview", tile: tile(2, 2), locked: "h1" });
  });
  it("is never in two states at once", () => {
    // Exhaustive over the events, from every reachable state: the result is one
    // variant, and a movement variant never also claims to be aiming.
    const states: Interaction[] = [
      IDLE,
      { type: "move-hover", tile: tile(1, 1), locked: "h1" },
      { type: "move-preview", tile: tile(1, 1), locked: "h1" },
      { type: "target-hover", targetId: "h2", locked: "h1" },
      { type: "target-selected", targetId: "h1" },
      { type: "find-firing-position", targetId: "h1", tile: tile(4, 4) },
    ];
    const events: InteractionEvent[] = [
      { kind: "hover-tile", tile: tile(6, 6) },
      { kind: "leave-board" },
      { kind: "click-tile", tile: tile(6, 6) },
      { kind: "hover-unit", targetId: "h2" },
      { kind: "leave-unit" },
      { kind: "click-unit", targetId: "h2" },
      { kind: "find-firing-position" },
      { kind: "cancel" },
      { kind: "moved" },
      { kind: "fired" },
    ];
    for (const state of states)
      for (const event of events) {
        const next = nextInteraction(state, event);
        expect(typeof next.type).toBe("string");
        if (next.type === "move-hover" || next.type === "move-preview")
          expect(next).not.toHaveProperty("targetId");
      }
  });
});

describe("finding a firing position", () => {
  it("keeps the enemy locked while looking for ground", () => {
    const state = run(
      IDLE,
      { kind: "click-unit", targetId: "h1" },
      { kind: "find-firing-position" },
    );
    expect(state).toEqual({ type: "find-firing-position", targetId: "h1", tile: null });
    expect(lockedTarget(state)).toBe("h1");
  });
  it("needs somebody to be aiming at first", () => {
    expect(nextInteraction(IDLE, { kind: "find-firing-position" })).toEqual(IDLE);
  });
  it("previews a candidate square without walking to it", () => {
    const state = run(
      IDLE,
      { kind: "click-unit", targetId: "h1" },
      { kind: "find-firing-position" },
      { kind: "hover-tile", tile: tile(4, 4) },
    );
    expect(state).toMatchObject({ type: "find-firing-position", tile: tile(4, 4) });
  });
  it("turns a click into a movement preview, never into a move or a shot", () => {
    const state = run(
      IDLE,
      { kind: "click-unit", targetId: "h1" },
      { kind: "find-firing-position" },
      { kind: "click-tile", tile: tile(4, 4) },
    );
    expect(state).toEqual({ type: "move-preview", tile: tile(4, 4), locked: "h1" });
  });
  it("cancels back to the target, not out of targeting", () => {
    const state = run(
      IDLE,
      { kind: "click-unit", targetId: "h1" },
      { kind: "find-firing-position" },
      { kind: "cancel" },
    );
    expect(state).toEqual({ type: "target-selected", targetId: "h1" });
  });
});

describe("while a command is running", () => {
  it("outranks whatever the pointer was doing", () => {
    const previewing: Interaction = { type: "move-preview", tile: tile(1, 1), locked: "h1" };
    expect(interactionOf(previewing, true)).toEqual({ type: "resolving-action" });
    expect(interactionOf(previewing, false)).toBe(previewing);
  });
  it("accepts nothing until it is over", () => {
    const busy: Interaction = { type: "resolving-action" };
    for (const event of [
      { kind: "click-tile", tile: tile(1, 1) },
      { kind: "click-unit", targetId: "h1" },
      { kind: "cancel" },
    ] as InteractionEvent[])
      expect(nextInteraction(busy, event)).toBe(busy);
  });
});
