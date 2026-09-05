import type { ReactNode } from "react";

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
      className={`combat-callout is-${tone}`}
      style={{ left: `${anchor.left}px`, top: `${anchor.top}px` }}
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
