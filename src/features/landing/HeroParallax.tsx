/**
 * The key art leans a little toward the pointer, so the painting has depth
 * rather than being a flat picture. A few pixels, eased; nothing for touch
 * screens or anyone who asked for less motion.
 */
import { useEffect, useRef, type ReactNode } from "react";
import { prefersReducedMotion } from "@/features/opening/descent/descentDevice";

/** How far the art travels, in pixels, at the edge of the screen. */
export const PARALLAX_PX = 14;

export function HeroParallax({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion() || window.matchMedia("(pointer: coarse)").matches) return;
    let raf = 0;
    const onMove = (e: PointerEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const x = (e.clientX / window.innerWidth - 0.5) * 2;
        const y = (e.clientY / window.innerHeight - 0.5) * 2;
        el.style.transform = `translate3d(${(-x * PARALLAX_PX).toFixed(1)}px, ${(-y * PARALLAX_PX * 0.6).toFixed(1)}px, 0)`;
      });
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
    };
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden
      className="absolute -inset-4 transition-transform duration-500 ease-out will-change-transform"
    >
      {children}
    </div>
  );
}
