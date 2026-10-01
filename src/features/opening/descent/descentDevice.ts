/**
 * What the screen in front of the player can afford, and what they have asked
 * for. Shared by the descent and the scene it lands on, which draw the same
 * city and must draw it the same way.
 */
import { LIGHT_COUNT, LIGHT_COUNT_LOW } from "./cityLights";

export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false)
  );
}

/** A phone, or a machine with few cores: fewer lights, a lower pixel ratio. */
export function weakDevice(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  const cores = navigator.hardwareConcurrency ?? 8;
  const coarse = window.matchMedia?.("(pointer: coarse)").matches ?? false;
  return cores <= 4 || coarse;
}

export function lightCount(weak: boolean): number {
  return weak ? LIGHT_COUNT_LOW : LIGHT_COUNT;
}

/** The city is the same city every time: only the player's light is theirs. */
export const CITY_SEED = 0x7000000;
