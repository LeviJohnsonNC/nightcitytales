import { describe, expect, it } from "vitest";
import { composeScene } from "@/engine";
import { FIXTURE_REGISTRATION, fixtureMatrix, type FixtureArt } from "../courtyard/afterRainArt";
import { fixtureLamp, streetDirection } from "../courtyard/cityFixtures";
import { entranceLights } from "../courtyard/frontageIdentity";
import { rainField } from "../courtyard/afterRain";

describe("registered After Rain fixtures", () => {
  it("holds every ground anchor at zero through scaling and opposite orientations", () => {
    for (const key of Object.keys(FIXTURE_REGISTRATION) as FixtureArt[])
      for (const ppm of [9, 15, 32])
        for (const flip of [false, true]) {
          const m = fixtureMatrix(key, ppm, flip),
            r = FIXTURE_REGISTRATION[key];
          const at = (p: { x: number; y: number }) => ({
            x: m.a * (p.x - m.x),
            y: m.b * (p.x - m.x) + m.d * (p.y - m.y),
          });
          expect(at(r.anchor).x).toBeCloseTo(0);
          expect(at(r.anchor).y).toBeCloseTo(0);
          const a = at(r.joint),
            b = at(r.end);
          expect(Math.abs(b.x - a.x)).toBeCloseTo(((r.arm * Math.sqrt(3)) / 2) * ppm);
          expect(b.y - a.y).toBeCloseTo((key.endsWith("90") ? -1 : 1) * r.arm * 0.5 * ppm);
          expect(a.y).toBeCloseTo(-r.z * ppm, 0);
        }
  });
  it.each([0, 7, 8, 19])(
    "derives lamps, doors and wetness without changing seed %i geometry",
    (seed) => {
      const env = composeScene("intersection", seed).layout.arena.environment!;
      const before = JSON.stringify(env);
      for (const d of env.dressing.filter((d) => d.kind === "lamp")) {
        const dir = streetDirection(env, d.position),
          l = fixtureLamp(env, d.position);
        expect(Math.abs(dir.x) + Math.abs(dir.y)).toBe(1);
        expect(Math.hypot(l.at.x - d.position.x, l.at.y - d.position.y)).toBeCloseTo(0.78);
        expect(l.z).toBeGreaterThan(4.5);
      }
      for (const l of entranceLights(env)) {
        expect(l.kind).toBe("spill");
        if (l.kind === "spill") expect(l.s1 - l.s0).toBeCloseTo(1.6);
      }
      const wet = rainField(env);
      for (let x = -5; x < 40; x += 1.7)
        for (let y = -5; y < 40; y += 2.1) {
          expect(wet(x, y)).toBeGreaterThanOrEqual(0);
          expect(wet(x, y)).toBeLessThanOrEqual(1);
          expect(wet(x, y)).toBe(wet(x, y));
        }
      expect(JSON.stringify(env)).toBe(before);
    },
  );
});
