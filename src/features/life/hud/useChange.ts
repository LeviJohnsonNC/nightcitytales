import { useEffect, useRef, useState } from "react";
import { changeDirection, tween } from "./hudModel";

/** "up" or "down" for a moment after a value moves, then null. Silent on first render. */
export function useChangeFlash(value: number, ms = 700): "up" | "down" | null {
  const prev = useRef<number | undefined>(undefined);
  const [flash, setFlash] = useState<"up" | "down" | null>(null);
  useEffect(() => {
    const dir = changeDirection(prev.current, value);
    prev.current = value;
    if (!dir) return;
    setFlash(dir);
    const id = window.setTimeout(() => setFlash(null), ms);
    return () => window.clearTimeout(id);
  }, [value, ms]);
  return flash;
}

/** A number that counts to its new value rather than jumping. Instant under reduced motion. */
export function useCountTo(value: number, ms = 600): number {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced || from.current === value) {
      from.current = value;
      setShown(value);
      return;
    }
    const start = performance.now();
    const origin = from.current;
    let raf = 0;
    const step = (now: number) => {
      const t = (now - start) / ms;
      const v = Math.round(tween(origin, value, t));
      setShown(v);
      from.current = v;
      if (t < 1) raf = requestAnimationFrame(step);
      else from.current = value;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, ms]);
  return shown;
}
