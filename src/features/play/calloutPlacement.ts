/**
 * Where the battlefield's information card goes, in the board's own pixels.
 *
 * Presentation only. The card belongs to a person or a square, so it should sit
 * next to it without covering it, the board's controls or the board's edges:
 *
 *   above   over the head (or the square), the default
 *   below   under the feet, when there is no room above
 *   beside  to the side with more room, when there is room neither above nor below
 *
 * Before this, "no room above" hung the card a fixed 56 px under the head anchor,
 * which on a phone put it across the body of the person it was about, and "room"
 * was a fixed 56 px band that missed the place caption on a narrow screen.
 */
export type CalloutMode = "above" | "below" | "beside";

export interface CalloutPlacement {
  mode: CalloutMode;
  /** The card's centre, left to right. */
  left: number;
  /** above: the card's bottom; below: its top; beside: its middle. */
  top: number;
}

export interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** With nothing measured, the band at the top of the board kept for its controls. */
export const CALLOUT_TOP = 56;
const EDGE = 8;
const GAP = 10;
/** Half a person's width on screen, which a card beside them keeps clear of. */
const BODY = 22;

export function placeCallout(
  /** Over the head, or just above a square. */
  over: { left: number; top: number },
  /** Under the feet, or just below the square; the same as `over` when unknown. */
  under: { left: number; top: number },
  card: { width: number; height: number },
  board: { width: number; height: number },
  /** The board's own controls and caption, measured; a top band when not given. */
  controls: readonly Box[] = [{ left: 0, top: 0, right: board.width, bottom: CALLOUT_TOP }],
  /** Everyone else on screen: covered only when every clear place covers someone. */
  people: readonly Box[] = [],
): CalloutPlacement {
  const centre = (x: number) =>
    Math.min(Math.max(x, EDGE + card.width / 2), board.width - EDGE - card.width / 2);
  const apart = (b: Box, c: Box) =>
    b.right <= c.left || c.right <= b.left || b.bottom <= c.top || c.bottom <= b.top;
  const clear = (b: Box) =>
    b.top >= EDGE && b.bottom <= board.height - EDGE && controls.every((c) => apart(b, c));
  const at = (mode: CalloutMode, left: number, top: number): Box => {
    const y = mode === "above" ? top - card.height : mode === "below" ? top : top - card.height / 2;
    return {
      left: left - card.width / 2,
      right: left + card.width / 2,
      top: y,
      bottom: y + card.height,
    };
  };
  const candidates: CalloutPlacement[] = [
    { mode: "above", left: centre(over.left), top: over.top },
    { mode: "below", left: centre(under.left), top: under.top + GAP },
  ];
  const middle = Math.min(
    Math.max((over.top + under.top) / 2, EDGE + card.height / 2),
    board.height - EDGE - card.height / 2,
  );
  candidates.push(
    { mode: "beside", left: under.left + BODY + GAP + card.width / 2, top: middle },
    { mode: "beside", left: under.left - BODY - GAP - card.width / 2, top: middle },
  );
  // the first clear place that covers nobody, else the clear place covering fewest
  let best: { c: CalloutPlacement; covered: number } | null = null;
  for (const c of candidates) {
    const b = at(c.mode, c.left, c.top);
    if (b.left < EDGE - 0.5 || b.right > board.width - EDGE + 0.5 || !clear(b)) continue;
    const covered = people.filter((p) => !apart(b, p)).length;
    if (!covered) return c;
    if (!best || covered < best.covered) best = { c, covered };
  }
  if (best) return best.c;
  // Nowhere clear: above, held under the controls, which is what it always did.
  const floor = Math.max(CALLOUT_TOP, ...controls.map((c) => c.bottom + GAP));
  return { mode: "above", left: centre(over.left), top: Math.max(over.top, floor + card.height) };
}
