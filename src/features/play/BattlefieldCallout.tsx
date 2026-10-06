import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { placeCallout, type CalloutPlacement } from "./calloutPlacement";

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
/** Boxes of everything matching, in the host's own pixels, grown by `pad`. */
function boxes(host: HTMLElement, selector: string, pad: number) {
  const h = host.getBoundingClientRect();
  return [...host.querySelectorAll(selector)].map((c) => {
    const r = c.getBoundingClientRect();
    return {
      left: r.left - h.left - pad,
      right: r.right - h.left + pad,
      top: r.top - h.top - pad,
      bottom: r.bottom - h.top + pad,
    };
  });
}

export type CalloutTone = "move" | "shoot" | "blocked";

export function BattlefieldCallout({
  anchor,
  under,
  onDismiss,
  tone,
  title,
  lines,
  hint,
  onConfirm,
  confirmLabel,
  children,
}: {
  anchor: { left: number; top: number } | null;
  /** Under the feet or the square: where it hangs when there is no room above. */
  under?: { left: number; top: number } | null;
  /** Steps back one level. Shown where there is no hover or Escape: on touch. */
  onDismiss?: (() => void) | undefined;
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
  // Kept inside the board and off the person it is about: above them, else under
  // their feet, else beside them (calloutPlacement.ts). Measured after layout.
  const [fit, setFit] = useState<CalloutPlacement | null>(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- measures every render, settles in one pass
  useLayoutEffect(() => {
    const el = ref.current;
    const host = el?.offsetParent as HTMLElement | null;
    if (!el || !host || !anchor) return;
    const next = placeCallout(
      anchor,
      under ?? anchor,
      { width: el.offsetWidth, height: el.offsetHeight },
      { width: host.clientWidth, height: host.clientHeight },
      // the camera's buttons, as laid out on this screen: never covered
      boxes(host, ".combat-camera > *", 6),
      [
        // the people standing on the board: the middle half of each hit area, the figure
        ...boxes(host, "g.combat-unit > rect", 0).map((b) => {
          const quarter = (b.right - b.left) / 4;
          return { ...b, left: b.left + quarter, right: b.right - quarter };
        }),
        // and what is printed over them: names, bars and the blocker's label
        ...boxes(host, "g.combat-marker, g.combat-blocker text", 2),
        // the place caption: covered sooner than a person, but not when avoidable
        ...boxes(host, ".combat-map-caption", 4),
      ],
    );
    if (
      !fit ||
      fit.mode !== next.mode ||
      Math.abs(fit.left - next.left) > 0.5 ||
      Math.abs(fit.top - next.top) > 0.5
    )
      setFit(next);
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
      className={`combat-callout is-${tone} is-${fit?.mode ?? "above"}`}
      style={{
        left: `${fit?.left ?? anchor.left}px`,
        top: `${fit?.top ?? anchor.top}px`,
        // unmeasured, it is drawn once out of sight rather than in the wrong place
        visibility: fit ? undefined : "hidden",
      }}
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
      {onDismiss && (
        <button
          type="button"
          className="combat-callout-dismiss"
          aria-label="Dismiss"
          onClick={(e) => {
            e.stopPropagation();
            onDismiss();
          }}
        >
          ×
        </button>
      )}
    </div>
  );
}
