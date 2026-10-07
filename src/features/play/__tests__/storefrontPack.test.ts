import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { composeScene } from "@/engine";
import {
  STOREFRONT_BENCHMARK,
  STOREFRONT_FACE,
  STOREFRONT_LEVELS,
  STOREFRONT_PACK,
  STOREFRONT_SIGN,
  packPixelsPerMetre,
} from "../courtyard/storefrontPack";

const scene = composeScene(STOREFRONT_BENCHMARK.recipe, STOREFRONT_BENCHMARK.seed);
const env = scene.layout.arena.environment!;
const shop = env.structures.find((s) => s.id === STOREFRONT_BENCHMARK.structureId)!;

describe("storefront art pack", () => {
  it("is built on the saved geometry, not a copy of it", () => {
    const entrance = env.entrances!.find((e) => e.id === STOREFRONT_BENCHMARK.entranceId)!;
    expect(entrance.structureId).toBe(shop.id);
    expect(entrance.position.x - shop.rect.x).toBe(STOREFRONT_FACE.doorCentre);
    expect(entrance.position.y).toBe(shop.rect.y - 1);
    const awning = shop.attachments!.find((a) => a.id === STOREFRONT_BENCHMARK.attachmentId)!;
    expect(awning.edge).toBe(STOREFRONT_BENCHMARK.edge);
    expect(awning.kind).toBe("awning");
    expect(awning.span).toBe(STOREFRONT_LEVELS.awningSpan);
    expect(awning.projection).toBe(STOREFRONT_LEVELS.awningProjection);
    expect(awning.height).toBe(STOREFRONT_LEVELS.awningWall);
    // The original shop coping is now the trading-floor cornice below new upper rooms.
    expect(STOREFRONT_LEVELS.parapetTop).toBe(4);
    expect(shop.height).toBe(7.2);
  });

  it("draws the sign in code: four square glyph cells that fit the panel", () => {
    expect(STOREFRONT_PACK.some((a) => (a.id as string) === "sign-panel")).toBe(false);
    expect([...STOREFRONT_SIGN.text]).toHaveLength(4);
    const margin = (STOREFRONT_SIGN.width - 4 * STOREFRONT_SIGN.cell) / 2;
    expect(margin).toBeGreaterThan(0.05);
    expect(STOREFRONT_SIGN.cell).toBeLessThan(STOREFRONT_SIGN.height);
    expect(existsSync(`public${STOREFRONT_SIGN.mask}`)).toBe(true);
  });

  it("keeps every element clear of the others on the face", () => {
    const L = STOREFRONT_LEVELS;
    expect(L.glazingTop).toBeLessThan(L.awningWall);
    expect(L.awningWall).toBeLessThan(L.fasciaBottom);
    expect(L.doorHeight).toBeLessThan(L.housingTop);
    expect(L.housingTop).toBeLessThan(L.awningWall);
    expect(L.fasciaTop).toBeLessThan(L.parapetTop);
    // The sign sits wholly on the fascia and the building's face, over the entrance.
    expect(STOREFRONT_SIGN.s0).toBeGreaterThan(0);
    expect(STOREFRONT_SIGN.s0 + STOREFRONT_SIGN.width).toBeLessThan(STOREFRONT_FACE.bayStarts[0]!);
    expect(STOREFRONT_SIGN.z0).toBeGreaterThanOrEqual(L.fasciaBottom);
    expect(STOREFRONT_SIGN.z0 + STOREFRONT_SIGN.height).toBeLessThanOrEqual(L.fasciaTop);
    const doorCentre = STOREFRONT_FACE.doorCentre;
    expect(STOREFRONT_SIGN.s0).toBeLessThan(doorCentre);
    expect(STOREFRONT_SIGN.s0 + STOREFRONT_SIGN.width).toBeGreaterThan(doorCentre);
    // Bays do not run into the door or each other.
    const door = STOREFRONT_FACE.doorCentre + STOREFRONT_FACE.doorWidth / 2;
    const [first, second] = STOREFRONT_FACE.bayStarts;
    expect(first).toBeGreaterThan(doorCentre);
    expect(second).toBeGreaterThanOrEqual(first! + STOREFRONT_FACE.bayWidth);
  });

  it("gives each asset a generator-friendly canvas at one scale on both axes", () => {
    for (const a of STOREFRONT_PACK) {
      const ratio = a.canvas.w / a.canvas.h;
      expect([1, 1.5, 1 / 1.5].some((r) => Math.abs(ratio - r) < 1e-9)).toBe(true);
      const ppm = packPixelsPerMetre(a);
      expect(ppm.x).toBeCloseTo(ppm.y, 6);
      for (const z of a.protectedZones) {
        expect(z.rect.x).toBeGreaterThanOrEqual(0);
        expect(z.rect.y).toBeGreaterThanOrEqual(0);
        expect(z.rect.x + z.rect.w).toBeLessThanOrEqual(a.canvas.w);
        expect(z.rect.y + z.rect.h).toBeLessThanOrEqual(a.canvas.h);
      }
      for (const p of a.attachments) {
        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.x).toBeLessThanOrEqual(a.canvas.w);
        expect(p.y).toBeGreaterThanOrEqual(0);
        expect(p.y).toBeLessThanOrEqual(a.canvas.h);
      }
    }
  });

  it("covers the surfaces it says it covers, in whole numbers of the saved sizes", () => {
    const byId = Object.fromEntries(STOREFRONT_PACK.map((a) => [a.id, a]));
    expect(byId["window-interior"]!.metres.w).toBe(STOREFRONT_FACE.bayWidth);
    expect(byId["window-interior"]!.metres.h).toBeCloseTo(
      STOREFRONT_LEVELS.glazingTop - STOREFRONT_LEVELS.riser,
    );
    const shutter = byId["shutter-wear"]!;
    expect(shutter.metres.w).toBe(STOREFRONT_FACE.doorWidth);
    expect(shutter.metres.h).toBe(STOREFRONT_LEVELS.housingTop);
    // Four 0.4 m stripes per repeat: the awning's stripes are 0.4 m.
    const awning = byId["awning-fabric"]!;
    expect(awning.metres.w / 0.4).toBe(4);
    expect(awning.tilesAcross).toBe(true);
    // Only the shutter overlay needs a key colour.
    expect(STOREFRONT_PACK.filter((a) => a.key).map((a) => a.id)).toEqual(["shutter-wear"]);
  });
});
