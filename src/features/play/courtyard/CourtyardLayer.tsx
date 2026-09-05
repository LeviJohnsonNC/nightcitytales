import { useEffect, useRef } from "react";
import type { CourtyardModel, CourtyardRenderer } from "./createCourtyard";

type Props = CourtyardModel & { onReady: (ready: boolean) => void; onFailure: () => void };

/** Client-only, optional art layer. The accessible SVG above it remains the input surface. */
export function CourtyardLayer({ onReady, onFailure, ...model }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const latest = useRef(model);
  const renderer = useRef<CourtyardRenderer | null>(null);
  useEffect(() => {
    latest.current = model;
    renderer.current?.sync(model);
  }, [model]);
  useEffect(() => {
    // Keep the browser-only renderer out of the server bundle as well as SSR execution.
    if (import.meta.env.SSR) return;
    let cancelled = false;
    const element = host.current;
    if (!element) return;
    onReady(false);
    import("./createCourtyard")
      .then(({ createCourtyard }) => {
        if (cancelled) return;
        renderer.current = createCourtyard(
          element,
          latest.current,
          () => {
            if (!cancelled) onReady(true);
          },
          () => {
            if (!cancelled) onFailure();
          },
        );
      })
      .catch(() => {
        if (!cancelled) onFailure();
      });
    return () => {
      cancelled = true;
      renderer.current?.destroy();
      renderer.current = null;
    };
  }, [onReady, onFailure]);
  return <div ref={host} className="courtyard-canvas" aria-hidden="true" />;
}
