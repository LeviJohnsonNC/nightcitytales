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
import { tintFor } from "./landingTint";
import "./descent/descent.css";

export function LandingBackdrop({ facts }: { facts: DescentFacts | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rainRef = useRef<HTMLCanvasElement>(null);
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
      // Thirty a second is plenty for lights breathing behind glass.
      if (now - last >= 33 && !document.hidden) {
        last = now;
        const ms = DIVE_END_MS + (reduced ? 0 : now - started);
        renderer.draw(ms);
        rain?.draw(ms, now, { still: reduced });
      }
      if (!reduced) raf = requestAnimationFrame(frame);
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
    <div aria-hidden className="open-backdrop absolute inset-0 overflow-hidden">
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
