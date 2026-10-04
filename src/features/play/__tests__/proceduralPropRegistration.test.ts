import { describe, expect, it } from "vitest";
import { composeScene, coverStatuses, applyCoverDamage, readSceneManifest } from "@/engine";
import { battlefieldProjection } from "../battlefieldProjection";
import { interiorPropPoint } from "../courtyard/interiorPropArt";
import { PROP_CANVAS } from "../courtyard/sceneArtMetrics";
import { propCondition, propPlacement } from "../courtyard/propPresentation";

describe("procedural art and the saved battlefield share one projection", () => {
  it.each([0, 90] as const)("registers adjoining conference modules at %s degrees", (rotation) => {
    for (const size of [24, 32, 48]) {
      const { project } = battlefieldProjection(size, size);
      // Independently compare texture registration with actual board coordinates.
      // The old 32px rise and horizontal mirroring leave a gap at this seam.
      const origin = { x: 4, y: 6 };
      const screenPoint = (module: number, x: number, y: number) => {
        const r = {
          x: origin.x + (rotation ? 0 : module * 2),
          y: origin.y + (rotation ? module * 2 : 0),
          width: 2,
          height: 2,
        };
        const front = project({ x: r.x + 2, y: r.y });
        const center = project({ x: r.x + 1, y: r.y + 1 });
        const scale = (project({ x: r.x + 2, y: r.y + 2 }).x - project(r).x) / 256;
        const pixel = interiorPropPoint(x, y, 40, rotation);
        return {
          x: center.x + (pixel.x - 128) * scale,
          y: front.y + (pixel.y - PROP_CANVAS.groundY) * scale,
        };
      };
      for (const y of [0.55, 1.45]) {
        const left = screenPoint(0, 2, y),
          right = screenPoint(1, 0, y);
        expect(left.x).toBeCloseTo(right.x, 8);
        expect(left.y).toBeCloseTo(right.y, 8);
      }
      for (const x of [0, 1, 2])
        for (const y of [0, 1, 2]) {
          const pixel = interiorPropPoint(x, y, 0, rotation);
          const scale = (project({ x: 2, y: 2 }).x - project({ x: 0, y: 0 }).x) / 256;
          const actual = {
            x: project({ x: 1, y: 1 }).x + (pixel.x - 128) * scale,
            y: project({ x: 2, y: 0 }).y + (pixel.y - PROP_CANVAS.groundY) * scale,
          };
          const expected = project(rotation ? { x: 2 - y, y: x } : { x, y });
          expect(actual.x).toBeCloseTo(expected.x, 8);
          expect(actual.y).toBeCloseTo(expected.y, 8);
        }
    }
  });

  it("preserves independent car sections and their registered footprint after destruction and reload", () => {
    const scene = composeScene("residential", 4),
      arena = scene.layout.arena;
    const before = JSON.stringify(scene);
    const engine = arena.environment!.props.find((p) => p.art === "sedan-engine")!;
    const piece = arena.cover!.find((p) => p.id === engine.coverId)!;
    const damage = applyCoverDamage(piece, {}, 10000).damageMap;
    const statuses = coverStatuses(arena, JSON.parse(JSON.stringify(damage)));
    expect(propCondition(statuses.find((s) => s.piece.id === piece.id)!)).toBe("wrecked");
    const cabin = arena.environment!.props.find(
      (p) => p.clusterId === engine.clusterId && p.art === "sedan-cabin",
    )!;
    expect(propCondition(statuses.find((s) => s.piece.id === cabin.coverId)!)).toBe("intact");
    const { project } = battlefieldProjection(arena.extent.width, arena.extent.height);
    const initial = propPlacement(
      coverStatuses(arena, {}).find((s) => s.piece.id === piece.id)!,
      project,
    );
    const destroyed = propPlacement(
      statuses.find((s) => s.piece.id === piece.id)!,
      project,
    );
    expect({ ...destroyed, depth: initial.depth }).toEqual(initial);
    expect(destroyed.depth).toBeLessThan(initial.depth);
    expect(readSceneManifest({ version: 1, scene: JSON.parse(before) })).toEqual(scene);
    expect(JSON.stringify(scene)).toBe(before);
  });
});
