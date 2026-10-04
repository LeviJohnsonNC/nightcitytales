import { describe, expect, it } from "vitest";
import type Phaser from "phaser";
import { composeScene } from "@/engine";
import { COMPOSITION_REVIEW_SEEDS } from "@/features/dev/sceneReviewQuery";
import { battlefieldProjection } from "../battlefieldProjection";
import {
  battlefieldCameraPreset,
  composedUnitMetrics,
  courtyardCamera,
} from "../courtyard/courtyardPresentation";
import { createInteriorPropTextures, INTERIOR_PROP_KINDS } from "../courtyard/interiorPropArt";
import { propHeightMetres, PROP_PIXELS_PER_METRE } from "../courtyard/sceneArtMetrics";

describe("physical scenic scale", () => {
  it("calibrates people, desks and joined vehicle modules in metres", () => {
    for (const size of [24, 32, 48]) {
      const arena = {
        ...composeScene("office", 4).layout.arena,
        extent: { width: size, height: size },
      };
      const { pixelsPerMetre } = battlefieldProjection(size, size);
      const person = composedUnitMetrics(arena);
      expect(person.top / pixelsPerMetre).toBeCloseTo(1.8);
      expect(person.scale * 78).toBeCloseTo(person.top);
      expect(propHeightMetres("desk", 38)).toBeCloseTo(0.76);
      for (const kind of ["sedan-engine", "sedan-cabin"])
        expect(propHeightMetres(kind, 83)).toBeCloseTo(1.45);
      const textureScale = pixelsPerMetre / PROP_PIXELS_PER_METRE;
      expect(
        (propHeightMetres("desk", 38) * PROP_PIXELS_PER_METRE * textureScale) / person.top,
      ).toBeCloseTo(0.76 / 1.8);
    }
  });

  for (const kind of INTERIOR_PROP_KINDS)
    it(`${kind} stays inside its texture in every rotation and damage state`, () => {
      for (const rotation of [0, 90] as const) {
        let canvases = 0;
        const scene = {
          textures: {
            createCanvas: (_key: string, width: number, height: number) => {
              canvases++;
              const check = (x: number, y: number) => {
                expect(x, `${_key}: x`).toBeGreaterThanOrEqual(1);
                expect(x, `${_key}: x`).toBeLessThanOrEqual(width - 1);
                expect(y, `${_key}: y`).toBeGreaterThanOrEqual(1);
                expect(y, `${_key}: y`).toBeLessThanOrEqual(height - 1);
              };
              return {
                refresh: () => {},
                context: {
                  beginPath() {},
                  closePath() {},
                  fill() {},
                  stroke() {},
                  moveTo: check,
                  lineTo: check,
                  fillRect(x: number, y: number, w: number, h: number) {
                    check(x, y);
                    check(x + w, y + h);
                  },
                  ellipse(x: number, y: number, rx: number, ry: number) {
                    const radius = Math.max(rx, ry);
                    check(x - radius, y - radius);
                    check(x + radius, y + radius);
                  },
                },
              };
            },
          },
        } as unknown as Phaser.Scene;
        createInteriorPropTextures(scene, kind, rotation);
        expect(canvases).toBe(3);
      }
    });

  it("fits all saved building corners and roof heights in overview at desktop and narrow sizes", () => {
    for (const [kind, seeds] of Object.entries(COMPOSITION_REVIEW_SEEDS))
      for (const seed of seeds) {
        const arena = composeScene(kind as keyof typeof COMPOSITION_REVIEW_SEEDS, seed).layout
          .arena;
        const preset = battlefieldCameraPreset(arena, "overview");
        const { project, pixelsPerMetre } = battlefieldProjection(
          arena.extent.width,
          arena.extent.height,
        );
        for (const [width, height] of [
          [1440, 640],
          [390, 440],
        ]) {
          const camera = courtyardCamera(width!, height!, preset);
          for (const s of arena.environment!.structures)
            for (const x of [s.rect.x, s.rect.x + s.rect.width])
              for (const y of [s.rect.y, s.rect.y + s.rect.height])
                for (const z of [0, s.height]) {
                  const p = project({ x, y });
                  const sx = (p.x - camera.x) * camera.zoom + width! / 2;
                  const sy = (p.y - z * pixelsPerMetre - camera.y) * camera.zoom + height! / 2;
                  expect(sx).toBeGreaterThan(0);
                  expect(sx).toBeLessThan(width!);
                  expect(sy).toBeGreaterThan(0);
                  expect(sy).toBeLessThan(height!);
                }
        }
      }
  });
});
