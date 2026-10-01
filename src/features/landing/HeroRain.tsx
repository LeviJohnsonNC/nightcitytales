/**
 * The storm over the key art. Presentation only: the opening's rain, drawn
 * again over a still painting, with the sky lighting the runner's face when it
 * flashes. It draws nothing at all for someone who asked for less motion.
 */
import { useEffect, useRef } from "react";
import { createRain } from "@/features/opening/descent/rain";
import {
  RAIN_SEED,
  prefersReducedMotion,
  weakDevice,
} from "@/features/opening/descent/descentDevice";
import { STORM_HORIZON_MS, STORM_SEED, flashAt, stormIntensity, strikeTimes } from "./landingStorm";

/** A rain you watch rather than one you fall through: a third of the descent's pace. */
export const RAIN_SPEED = 0.35;

/** Where the wind's phase starts, so the first gust is not the descent's. */
const WIND_OFFSET_MS = 12_000;

export function HeroRain({ faceAt = "74% 38%" }: { faceAt?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const flashRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || prefersReducedMotion()) return;
    const weak = weakDevice();
    const rain = createRain(canvas, {
      source: null,
      weak,
      seed: RAIN_SEED ^ STORM_SEED,
      dprCap: weak ? 1 : 1.5,
    });
    const strikes = strikeTimes(STORM_SEED, STORM_HORIZON_MS);
    const start = performance.now();
    let raf = 0;
    let visible = true;
    const onVisibility = () => {
      visible = !document.hidden;
    };
    document.addEventListener("visibilitychange", onVisibility);
    const onResize = () => rain.resize();
    window.addEventListener("resize", onResize);
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (!visible) return;
      const ms = now - start;
      const lit = flashAt(ms, strikes);
      rain.draw(WIND_OFFSET_MS + ms, now, {
        intensity: stormIntensity(ms),
        lightning: lit,
        wetness: 0,
        speed: RAIN_SPEED,
      });
      if (flashRef.current) flashRef.current.style.opacity = String(Math.min(1, lit * 1.2));
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("resize", onResize);
      rain.dispose();
    };
  }, []);

  return (
    <>
      <canvas
        ref={canvasRef}
        aria-hidden
        className="pointer-events-none absolute inset-0 h-full w-full"
        style={{
          // Heavy on the skyline, easing off behind the copy so it stays readable.
          maskImage: "linear-gradient(90deg, rgba(0,0,0,0.08) 0%, rgba(0,0,0,0.22) 40%, #000 66%)",
          WebkitMaskImage:
            "linear-gradient(90deg, rgba(0,0,0,0.08) 0%, rgba(0,0,0,0.22) 40%, #000 66%)",
        }}
      />
      {/* The flash on the runner's face: a cold light from above and behind him. */}
      <div
        ref={flashRef}
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 mix-blend-screen"
        style={{
          backgroundImage: `radial-gradient(38% 52% at ${faceAt}, rgba(190,200,255,0.5), rgba(150,110,255,0.18) 55%, transparent 80%)`,
        }}
      />
    </>
  );
}
