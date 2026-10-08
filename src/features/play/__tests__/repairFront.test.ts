import { describe, expect, it } from "vitest";
import { composeScene } from "@/engine";
import { repairFront } from "../courtyard/repairFront";
import { facadeOpenings } from "../courtyard/architectureArt";
import { faceOpenings } from "../courtyard/buildingFaces";

describe("repair frontage fits saved walls", () => {
  it.each([0, 7, 8, 19])("preserves glazing and door clearances in seed %i", (seed) => {
    const env = composeScene("intersection", seed).layout.arena.environment!;
    const before = JSON.stringify(env);
    let signs = 0;
    for (const s of env.structures.filter((s) => s.style === "workshop")) {
      for (const edge of ["north", "east"] as const) {
        const detail = repairFront(s, edge, env.entrances);
        const { length, doors } = facadeOpenings(s, env.entrances, edge);
        const holes = [
          ...faceOpenings(s, edge, env.entrances),
          ...doors.map((c) => ({
            s0: c - 1.02,
            s1: c + 1.02,
            z0: 0,
            z1: Math.min(2.65, s.height),
          })),
        ];
        signs += detail.signs.length;
        for (const p of [...detail.signs, ...detail.aprons, ...detail.frames]) {
          expect(p.s0).toBeGreaterThanOrEqual(0);
          expect(p.s1).toBeLessThanOrEqual(length);
          expect(p.z0).toBeGreaterThan(0);
          expect(p.z1).toBeLessThan(s.height);
          expect(holes.some((o) => p.s0 < o.s1 && p.s1 > o.s0 && p.z0 < o.z1 && p.z1 > o.z0)).toBe(
            false,
          );
        }
      }
    }
    expect(signs).toBeGreaterThan(0);
    expect(JSON.stringify(env)).toBe(before);
  });
  it("omits signs on short/narrow legacy walls and leaves other building uses alone", () => {
    const env = composeScene("intersection", 8).layout.arena.environment!;
    const s = env.structures.find((s) => s.style === "workshop")!;
    const short = { ...s, height: 0.9, rect: { ...s.rect, width: 2, height: 2 } };
    expect(repairFront(short, "north", []).signs).toEqual([]);
    expect(repairFront({ ...s, style: "residential" }, "north", env.entrances)).toEqual({
      signs: [],
      aprons: [],
      frames: [],
    });
  });
});
