import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

/**
 * The action, where the action is.
 *
 * Confirming a move used to mean leaving the destination you had just chosen,
 * crossing the screen to a sidebar button, and clicking a thing that was
 * nowhere near the thing it acted on. This puts the confirmation on the
 * battlefield beside the square or the body it belongs to, so choosing and
 * committing happen in the same place.
 *
 * Anchored in screen pixels by useBoardAnchor rather than drawn into the SVG,
 * so it stays a readable size instead of scaling with the camera's zoom.
 */
export type CalloutTone = "move" | "shoot" | "blocked";

export function BattlefieldCallout({
  anchor,
  tone,
  title,
  lines,
  hint,
  onConfirm,
  confirmLabel,
  children,
}: {
  anchor: { left: number; top: number } | null;
  tone: CalloutTone;
  title: string;
  /** Short facts, one per row: cost, cover, DV, range. */
  lines: string[];
  /** What committing would take. Omitted when there is nothing to commit. */
  hint?: string | undefined;
  onConfirm?: (() => void) | undefined;
  confirmLabel?: string | undefined;
  /** Anything extra — the Find Firing Position offer, for instance. */
  children?: ReactNode;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  // Kept inside the board: nudged along when it would run off a side, and hung
  // below its anchor when there is no room above (the board's controls sit there).
  const [fit, setFit] = useState({ x: 0, below: false });
  // eslint-disable-next-line react-hooks/exhaustive-deps -- measures every render, settles in one pass
  useLayoutEffect(() => {
    const el = ref.current;
    const host = el?.offsetParent as HTMLElement | null;
    if (!el || !host || !anchor) return;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const W = host.clientWidth;
    const left = anchor.left - w / 2;
    const x = left < 8 ? 8 - left : left + w > W - 8 ? W - 8 - (left + w) : 0;
    const below = anchor.top - h < 56;
    if (Math.abs(x - fit.x) > 0.5 || below !== fit.below) setFit({ x, below });
  });
  if (!anchor) return null;
  const body = (
    <>
      <strong>{title}</strong>
      {lines.map((line) => (
        <span key={line}>{line}</span>
      ))}
      {hint && <em>{hint}</em>}
      {children}
    </>
  );
  return (
    <div
      ref={ref}
      className={`combat-callout is-${tone} ${fit.below ? "is-below" : ""}`}
      style={{ left: `${anchor.left + fit.x}px`, top: `${anchor.top}px` }}
      // The callout hangs off a world position; clicks on it are its own.
      onPointerDown={(e) => e.stopPropagation()}
      onPointerMove={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {onConfirm ? (
        <button
          type="button"
          className="combat-callout-act"
          onClick={(e) => {
            e.stopPropagation();
            onConfirm();
          }}
        >
          {body}
          {confirmLabel && <span className="combat-callout-cue">{confirmLabel}</span>}
        </button>
      ) : (
        <div className="combat-callout-act is-static">{body}</div>
      )}
    </div>
  );
}
