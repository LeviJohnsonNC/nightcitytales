import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import type { Point } from "@/engine";

/**
 * A board position, in screen pixels, for UI that has to sit on the battlefield.
 *
 * The board is an SVG with a camera baked into its viewBox, drawn with the
 * default `xMidYMid meet`, so mapping a metre position to a pixel involves the
 * zoom, the pan, the element's size AND the letterboxing that fitting a viewBox
 * introduces. Rather than recomputing all of that alongside the viewBox — where
 * it would drift the first time either changed — this asks the browser through
 * getScreenCTM, the same matrix pointer events are read back through. Pan,
 * zoom, resize and fullscreen are then all one event: the matrix changed, ask
 * again.
 *
 * The point arrives through a ref written during render rather than as an
 * argument, because the board only knows where the callout belongs after a
 * pile of work that sits below an early return — and a hook cannot.
 */
export function useBoardAnchor(
  svgRef: RefObject<SVGSVGElement | null>,
  /** The anchor in the SVG's own user space — i.e. already projected. */
  pointRef: RefObject<Point | null>,
): { left: number; top: number } | null {
  const [anchor, setAnchor] = useState<{ left: number; top: number } | null>(null);
  const [resizes, setResizes] = useState(0);
  const previous = useRef<{ left: number; top: number } | null>(null);

  // No dependency array on purpose: the anchor moves whenever anything about
  // the camera, the layout or the chosen square moves, and enumerating that
  // list is how it goes stale. Measuring is a matrix multiply, and the write
  // below is skipped when nothing moved, so this settles in one extra pass.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- deliberate: see above.
  useLayoutEffect(() => {
    const svg = svgRef.current;
    const point = pointRef.current;
    if (!svg || !point) {
      if (previous.current) {
        previous.current = null;
        setAnchor(null);
      }
      return;
    }
    const matrix = svg.getScreenCTM();
    if (!matrix) return;
    const screen = new DOMPoint(point.x, point.y).matrixTransform(matrix);
    const host = (svg.parentElement ?? svg).getBoundingClientRect();
    const next = { left: screen.x - host.left, top: screen.y - host.top };
    const was = previous.current;
    if (was && Math.abs(was.left - next.left) < 0.5 && Math.abs(was.top - next.top) < 0.5) return;
    previous.current = next;
    setAnchor(next);
  });

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const observer = new ResizeObserver(() => setResizes((n) => n + 1));
    observer.observe(svg);
    return () => observer.disconnect();
  }, [svgRef]);
  // Referenced so the resize tick is not dead state to the linter.
  void resizes;

  return anchor;
}
