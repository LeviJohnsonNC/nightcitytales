import { describe, expect, it } from "vitest";
import { composeScene, type SceneStructure } from "@/engine";
import { buildingUse, faceOpenings, USE_WALL } from "../courtyard/buildingFaces";
import { facadeOpenings } from "../courtyard/architectureArt";

const scenes = [7, 0, 8].map(
  (seed) => composeScene("intersection", seed).layout.arena.environment!,
);
const of = (style: string) =>
  scenes.flatMap((env) => env.structures.filter((s) => s.style === style).map((s) => ({ s, env })));

describe("the homes and sheds of the intersection", () => {
  it("knows a home from a shed, and leaves every other mass alone", () => {
    expect(buildingUse({ style: "residential" } as SceneStructure)).toBe("residential");
    expect(buildingUse({ style: "workshop" } as SceneStructure)).toBe("industrial");
    expect(buildingUse({ style: "warehouse" } as SceneStructure)).toBe("industrial");
    for (const style of ["shop", "interior-wall", "mesh-fence"])
      expect(buildingUse({ style } as SceneStructure)).toBeUndefined();
    expect(USE_WALL).toEqual({ residential: "painted-render", industrial: "painted-metal" });
  });

  it("keeps every home's window where, and as big as, the generic face drew it", () => {
    for (const { s, env } of of("residential"))
      for (const edge of ["north", "east"] as const) {
        const windows = faceOpenings(s, edge, env.entrances).filter((o) => o.kind === "window");
        const length = edge === "north" ? s.rect.width : s.rect.height;
        const storeys = Array.from(
          { length: Math.max(1, Math.floor(s.height / 3)) },
          (_, i) => 3.8 + i * 3,
        ).filter((z) => z + 1.2 < s.height);
        expect(windows).toHaveLength(storeys.length * Math.ceil(length / 4));
        for (const w of windows) {
          expect(w.s1 - w.s0).toBeCloseTo(1.4);
          expect(w.z1 - w.z0).toBeCloseTo(1.2);
          expect(Math.abs((w.s0 - 0.2) / 4 - Math.round((w.s0 - 0.2) / 4))).toBeLessThan(1e-9);
        }
        const bays = faceOpenings(s, edge, env.entrances).filter((o) => o.kind === "bay");
        expect(bays.map((b) => b.s0)).toEqual(facadeOpenings(s, env.entrances, edge).bays);
      }
  });

  it("puts somebody's life behind a home's glass, varied, and never a dark shopfront at the street", () => {
    const all = of("residential").flatMap(({ s, env }) =>
      (["north", "east"] as const).flatMap((edge) => faceOpenings(s, edge, env.entrances)),
    );
    const kinds = new Set(all.filter((o) => o.kind === "window").map((o) => o.occupancy));
    expect(kinds.size).toBeGreaterThanOrEqual(4);
    for (const bay of all.filter((o) => o.kind === "bay"))
      expect(["nets", "blind", "curtains"]).toContain(bay.occupancy);
  });

  it("glazes a shed without a home's furnishings, and never twice in one place", () => {
    for (const { s, env } of [...of("workshop"), ...of("warehouse")])
      for (const edge of ["north", "east"] as const) {
        const openings = faceOpenings(s, edge, env.entrances);
        for (const o of openings) {
          expect(o.occupancy).toBeUndefined();
          expect(["clerestory", "light"]).toContain(o.kind);
        }
        const doors = facadeOpenings(s, env.entrances, edge).doors;
        for (const a of openings)
          for (const b of openings)
            if (a !== b)
              expect(a.s0 < b.s1 && b.s0 < a.s1 && a.z0 < b.z1 && b.z0 < a.z1).toBe(false);
        for (const o of openings.filter((o) => o.kind === "clerestory"))
          for (const d of doors) expect(o.s1 <= d - 1.1 || o.s0 >= d + 1.1).toBe(true);
      }
  });

  it("chooses each window's life from the window alone: the same street every time", () => {
    const { s, env } = of("residential")[0]!;
    expect(faceOpenings(s, "east", env.entrances)).toEqual(faceOpenings(s, "east", env.entrances));
  });
});
