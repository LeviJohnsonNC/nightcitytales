/**
 * The window, behind the prose.
 *
 * The descent lands on a window and this is the same window, kept: the bokeh of
 * the player's own district, breathing, behind rain on the glass, tinted for the
 * hour it is. It draws exactly the frame the descent held on (same city, same
 * camera) so the cut into the prose is a change of what is in front of it, not
 * of where you are. Presentation only.
 */
import { useEffect, useMemo, useRef } from "react";
import { cityLights } from "./descent/cityLights";
import type { DescentFacts } from "./descent/descentFacts";
import {
  CITY_SEED,
  RAIN_SEED,
  lightCount,
  prefersReducedMotion,
  weakDevice,
} from "./descent/descentDevice";
import { createRain } from "./descent/rain";
import { createRenderer } from "./descent/descentRender";
import { DIVE_END_MS } from "./descent/descentTimeline";
import { exitFade } from "./descent/rainModel";
import { tintFor } from "./landingTint";
import "./descent/descent.css";

/**
 * A rain to read under rather than fall through: three tenths of the descent's
 * pace, so each drop can be followed.
 */
export const LANDING_RAIN_SPEED = 0.3;

/**
 * `leaving` is the player having taken a door: the rain stops falling and the
 * glass dries in under half a second, and the window goes dark behind it, so
 * the next screen never arrives with the storm still running.
 */
export function LandingBackdrop({
  facts,
  leaving = false,
}: {
  facts: DescentFacts | null;
  leaving?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rainRef = useRef<HTMLCanvasElement>(null);
  /** When the scene began to go, on the real clock, or null while it stays. */
  const leftAt = useRef<number | null>(null);
  useEffect(() => {
    leftAt.current = leaving ? performance.now() : null;
  }, [leaving]);
  const weak = useMemo(weakDevice, []);
  const city = useMemo(
    () =>
      facts
        ? cityLights({
            count: lightCount(weak),
            seed: CITY_SEED,
            districtKey: facts.districtKey,
            placeKey: facts.placeKey,
          })
        : null,
    [facts, weak],
  );
  const tint = tintFor(facts?.hour);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !city) return;
    const renderer = createRenderer(canvas, city, weak ? 1 : 1.5);
    // The same storm the descent ended in, and the same lens: beads on the glass
    // refracting the lights, still running down it under the prose.
    const rain = rainRef.current
      ? createRain(rainRef.current, {
          source: canvas,
          weak,
          seed: RAIN_SEED,
          dprCap: weak ? 1 : 1.5,
        })
      : null;
    renderer.resize();
    rain?.resize();
    const onResize = () => {
      renderer.resize();
      rain?.resize();
    };
    window.addEventListener("resize", onResize);
    const reduced = prefersReducedMotion();
    const started = performance.now();
    let raf = 0;
    let last = 0;
    const frame = (now: number) => {
      if (!reduced) raf = requestAnimationFrame(frame);
      if (document.hidden) return;
      const ms = DIVE_END_MS + (reduced ? 0 : now - started);
      // Thirty a second is plenty for lights breathing behind glass; the rain
      // moves, and gets every frame.
      if (now - last >= 33 || reduced) {
        last = now;
        renderer.draw(ms);
      }
      const fade = leftAt.current === null ? 1 : exitFade(now - leftAt.current);
      rain?.draw(ms, now, { still: reduced, speed: LANDING_RAIN_SPEED, fade });
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      renderer.dispose();
      rain?.dispose();
    };
  }, [city, weak]);

  return (
    <div
      aria-hidden
      className="open-backdrop absolute inset-0 overflow-hidden"
      data-leaving={leaving || undefined}
    >
      <canvas ref={canvasRef} className="open-backdrop-canvas absolute inset-0 h-full w-full" />
      <canvas ref={rainRef} className="dsc-rain-canvas" />
      <div className="dsc-frame open-backdrop-frame" />
      <div
        className="absolute inset-0"
        style={{ background: tint.gradient }}
        data-tint={tint.label}
      />
      <div className="dsc-scan" />
      <div className="open-backdrop-veil absolute inset-0" />
    </div>
  );
}
