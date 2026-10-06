import { describe, expect, it } from "vitest";
import { composeScene } from "@/engine";
import { oilDrips, slabFinish } from "../courtyard/groundFinish";
import { CONTACT, contactAlpha, contactPad } from "../courtyard/contactShade";
import { interiorPropPoint } from "../courtyard/interiorPropArt";

describe("the street's wear", () => {
  it("marks few slabs, the same ones every time, and repairs fewer still", () => {
    let marked = 0,
      repairs = 0;
    for (let x = 0; x < 100; x++)
      for (let y = 0; y < 100; y++) {
        const f = slabFinish(x, y);
        expect(slabFinish(x, y)).toBe(f);
        if (f) marked++;
        if (f === "repair") repairs++;
      }
    expect(marked / 10000).toBeLessThan(0.16);
    expect(repairs / 10000).toBeGreaterThan(0.005);
    expect(repairs / 10000).toBeLessThan(0.04);
  });

  it("drips oil only under engines and the generator, not under every car, each its own size", () => {
    for (const seed of [7, 0, 8]) {
      const arena = composeScene("intersection", seed).layout.arena;
      const env = arena.environment!;
      const engines = env.props.filter((p) => p.art === "sedan-engine").length;
      const drips = oilDrips(arena);
      expect(oilDrips(arena)).toEqual(drips);
      const sizes = new Set(drips.map((d) => d.r.toFixed(3)));
      expect(sizes.size).toBe(drips.length);
      // every drip sits on the piece it comes from
      for (const d of drips) {
        const under = (arena.cover ?? []).some((c) => {
          const r = c.rect;
          return (
            d.at.x >= r.x - 0.5 &&
            d.at.x <= r.x + r.width + 0.5 &&
            d.at.y >= r.y - 0.5 &&
            d.at.y <= r.y + r.height + 0.5
          );
        });
        expect(under).toBe(true);
      }
      const carDrips = drips.length - env.props.filter((p) => p.art === "generator").length;
      expect(carDrips).toBeLessThanOrEqual(engines);
    }
  });
});

describe("contact shade", () => {
  const W = 256,
    H = 320;
  const reg = { originX: 0.5, originY: 1, groundWidth: 1 };
  const front = (x: number) => H - Math.abs(x + 0.5 - W / 2) / Math.sqrt(3);
  /** A box standing on the footprint's front edge, `rise` px tall, `lift` px off the ground. */
  const box = (rise: number, lift = 0) => {
    const a = new Uint8ClampedArray(W * H);
    for (let x = 0; x < W; x++)
      for (let y = Math.floor(front(x) - rise - lift); y < Math.floor(front(x) - lift); y++)
        if (y >= 0) a[y * W + x] = 255;
    return a;
  };
  const sum = (s: Float32Array) => s.reduce((t, v) => t + v, 0);

  it("lies under what stands on the ground, and below its foot", () => {
    const pad = contactPad(W, reg);
    const s = contactAlpha(box(100), W, H, reg, CONTACT.intact, pad);
    expect(s.length).toBe(W * (H + pad));
    // the footprint's front corner: shade runs past the texture's own bottom edge
    expect(s[(H + 4) * W + W / 2]!).toBeGreaterThan(0.2);
  });

  it("casts nothing from a canopy held well above the ground", () => {
    const s = contactAlpha(box(30, 120), W, H, reg, CONTACT.intact, contactPad(W, reg));
    expect(sum(s)).toBe(0);
  });

  it("gives a wreck a fainter contact than the standing object", () => {
    const standing = sum(contactAlpha(box(100), W, H, reg, CONTACT.intact));
    const wreck = sum(contactAlpha(box(20), W, H, reg, CONTACT.wrecked));
    expect(wreck).toBeLessThan(standing * 0.7);
  });

  it("is registered to the same footprint as the kit's props", () => {
    // the kit's front corner is the texture's bottom centre
    const p = interiorPropPoint(2, 0);
    expect(p.x / W).toBeCloseTo(reg.originX);
    expect(p.y / H).toBeCloseTo(reg.originY);
  });
});
