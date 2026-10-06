import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { composeScene } from "@/engine";
import {
  bodyPaintMask,
  paintLikeness,
  paintedTexture,
  parkedAt,
  repaint,
  sedanPaints,
  SEDAN_PAINT_ORDER,
} from "../courtyard/sedanPaint";

describe("the sedan's body-paint mask", () => {
  it("takes the beige paint, lit or in shade", () => {
    expect(paintLikeness(188, 166, 128)).toBeGreaterThan(0.9); // the lit roof
    expect(paintLikeness(118, 98, 66)).toBeGreaterThan(0.5); // a door in shade
  });
  it("leaves glass, tyres, trim, lamps and rust alone", () => {
    for (const [name, rgb] of [
      ["tinted glass", [52, 64, 66]],
      ["tyre", [24, 24, 26]],
      ["grey bumper", [74, 74, 72]],
      ["amber lamp", [214, 120, 30]],
      ["red lamp", [170, 40, 34]],
      ["rust", [128, 66, 30]],
    ] as const)
      expect(paintLikeness(rgb[0], rgb[1], rgb[2]), name).toBe(0);
  });
});

describe("a painted sedan", () => {
  const load = async (name: string) => {
    const { data, info } = await sharp(readFileSync(`public/images/street-props/${name}.webp`))
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    return { data: new Uint8Array(data), width: info.width, height: info.height };
  };

  it("keeps its outline and every pixel outside the paint", async () => {
    const art = await load("sedan-cabin-intact");
    const mask = bodyPaintMask(art.data, art.width, art.height);
    const painted = new Uint8Array(art.data);
    const coverage = repaint(painted, art.width, art.height, "burgundy");
    expect(coverage).toBeGreaterThan(0.3);
    expect(coverage).toBeLessThan(0.85);
    let outside = 0,
      alphaChanged = 0,
      outsideChanged = 0;
    for (let i = 0; i < mask.length; i++) {
      if (painted[i * 4 + 3] !== art.data[i * 4 + 3]) alphaChanged++;
      if (mask[i] === 0) {
        outside++;
        for (let c = 0; c < 3; c++)
          if (painted[i * 4 + c] !== art.data[i * 4 + c]) outsideChanged++;
      }
    }
    expect(alphaChanged).toBe(0);
    expect(outsideChanged).toBe(0);
    expect(outside).toBeGreaterThan(0);
  }, 30000);

  it("matches the baked file, so the files are the code's", async () => {
    const art = await load("sedan-engine-damaged-90");
    const baked = await load("sedan-engine-damaged-90-charcoal");
    repaint(art.data, art.width, art.height, "charcoal");
    // WebP is lossy: compare the mean difference, not each pixel
    let sum = 0;
    for (let i = 0; i < art.data.length; i++) sum += Math.abs(art.data[i]! - baked.data[i]!);
    expect(sum / art.data.length).toBeLessThan(3);
  }, 30000);

  it("leaves the beige car as its own art", () => {
    expect(paintedTexture("prop-sedan-engine-intact-90", "beige")).toBe(
      "prop-sedan-engine-intact-90",
    );
    expect(paintedTexture("prop-sedan-engine-intact-90", "burgundy")).toBe(
      "prop-sedan-engine-intact-90~burgundy",
    );
  });
});

describe("which car is which paint", () => {
  for (const seed of [7, 0, 8])
    it(`seed ${seed}: one paint per car, more than one on the street, the same every time`, () => {
      const env = composeScene("intersection", seed).layout.arena.environment!;
      const sedans = env.props.filter((p) => p.art.startsWith("sedan-"));
      const salt = parkedAt(
        sedans.map(
          (p) =>
            composeScene("intersection", seed).layout.arena.cover!.find((c) => c.id === p.coverId)!
              .rect,
        ),
      );
      const paints = sedanPaints(
        sedans.map((p) => p.clusterId!),
        salt,
      );
      // both sections of a car belong to one cluster, so share its paint
      for (const p of sedans) expect(SEDAN_PAINT_ORDER).toContain(paints.get(p.clusterId!));
      expect(new Set(paints.values()).size).toBeGreaterThan(1);
      expect(
        sedanPaints(
          [...sedans].reverse().map((p) => p.clusterId!),
          salt,
        ),
      ).toEqual(paints);
    });
});

describe("the three variants", () => {
  it("are not all painted alike", () => {
    const assignments = [7, 0, 8].map((seed) => {
      const arena = composeScene("intersection", seed).layout.arena;
      const sedans = arena.environment!.props.filter((p) => p.art.startsWith("sedan-"));
      const paints = sedanPaints(
        sedans.map((p) => p.clusterId!),
        parkedAt(sedans.map((p) => arena.cover!.find((c) => c.id === p.coverId)!.rect)),
      );
      return JSON.stringify([...paints]);
    });
    expect(new Set(assignments).size).toBeGreaterThan(1);
  });
});
