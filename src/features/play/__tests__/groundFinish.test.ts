import { describe, expect, it } from "vitest";
import { composeScene } from "@/engine";
import { entryAprons, oilDrips, roadRepairs, slabFinish } from "../courtyard/groundFinish";
import { CONTACT, contactAlpha, contactPad } from "../courtyard/contactShade";
import { interiorPropPoint } from "../courtyard/interiorPropArt";

describe("the street's wear", () => {
  it("keeps utility repairs on saved roads with a small coverage budget, without changing the arena", () => {
    for (const seed of [0, 7, 8, 19]) {
      const arena = composeScene("intersection", seed).layout.arena;
      const before = JSON.stringify(arena);
      const env = arena.environment!;
      const roads = env.zones.filter((z) => z.kind === "road");
      const repairs = roadRepairs(env);
      expect(repairs.length).toBeGreaterThan(0);
      expect(roadRepairs(env)).toEqual(repairs);
      for (const r of repairs) {
        expect(r.width).toBeGreaterThan(0);
        expect(r.height).toBeGreaterThan(0);
        expect(
          roads.some(
            ({ rect: q }) =>
              r.x >= q.x &&
              r.y >= q.y &&
              r.x + r.width <= q.x + q.width &&
              r.y + r.height <= q.y + q.height,
          ),
        ).toBe(true);
      }
      const area = repairs.reduce((sum, r) => sum + r.width * r.height, 0);
      const roadArea = roads.reduce((sum, z) => sum + z.rect.width * z.rect.height, 0);
      expect(area / roadArea).toBeLessThan(0.12);
      expect(JSON.stringify(arena)).toBe(before);
    }
  });

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

  it("drips oil only under engines and the generator, not under every car, with varied car stains", () => {
    for (const seed of [7, 0, 8]) {
      const arena = composeScene("intersection", seed).layout.arena;
      const env = arena.environment!;
      const engines = env.props.filter((p) => p.art === "sedan-engine").length;
      const drips = oilDrips(arena);
      expect(oilDrips(arena)).toEqual(drips);
      // Generator drip radii are deliberately fixed; v12 can have two generators.
      const generators = env.props
        .filter((p) => p.art === "generator")
        .map((p) => arena.cover!.find((c) => c.id === p.coverId)!.rect);
      const isGenerator = (d: (typeof drips)[number]) =>
        generators.some((r) => d.at.x === r.x + r.width * 0.5 && d.at.y === r.y + r.height + 0.25);
      expect(drips.filter(isGenerator)).toHaveLength(generators.length);
      for (const d of drips.filter(isGenerator)) expect(d.r).toBe(0.45);
      const carStains = drips.filter((d) => !isGenerator(d));
      const sizes = new Set(carStains.map((d) => d.r.toFixed(3)));
      expect(sizes.size).toBe(carStains.length);
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

it("keeps threshold inserts outside saved buildings and anchored to shop entrances", () => {
  for (const seed of [0, 1, 7, 8, 19]) {
    const env = composeScene("intersection", seed).layout.arena.environment!;
    const before = JSON.stringify(env);
    const aprons = entryAprons(env);
    expect(aprons.length).toBeGreaterThan(0);
    for (const r of aprons) {
      expect(
        env.entrances!.some(
          (e) =>
            e.position.x >= r.x &&
            e.position.x <= r.x + r.width &&
            e.position.y >= r.y &&
            e.position.y <= r.y + r.height,
        ),
      ).toBe(true);
      for (const s of env.structures.filter((s) => s.style !== "mesh-fence")) {
        const q = s.rect;
        expect(
          r.x + r.width <= q.x ||
            r.x >= q.x + q.width ||
            r.y + r.height <= q.y ||
            r.y >= q.y + q.height,
        ).toBe(true);
      }
    }
    expect(JSON.stringify(env)).toBe(before);
  }
});
