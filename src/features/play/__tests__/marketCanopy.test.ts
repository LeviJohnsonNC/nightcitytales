import { expect, it } from "vitest";
import { composeScene } from "@/engine";
import { marketReturnCanopies } from "../courtyard/marketCanopy";
import { storefrontFor } from "../courtyard/storefront";
import { architecturalCasters } from "../courtyard/architecturalShadows";
it("joins only occupied return faces, stays within their length and preserves saved gameplay", () => {
  for (let seed = 0; seed < 41; seed++) {
    const scene = composeScene("intersection", seed);
    const arena = scene.layout.arena,
      env = arena.environment!;
    const saved = JSON.stringify(scene.layout);
    const shops = env.structures.flatMap((s) => {
      const sf = storefrontFor(s, env, arena.cover ?? []);
      return sf ? [sf] : [];
    });
    const returns = marketReturnCanopies(shops, env);
    for (const c of returns) {
      expect(c.awning.offset).toBeGreaterThanOrEqual(0);
      expect(c.awning.offset + c.awning.span).toBeLessThanOrEqual(c.length);
      expect(c.awning.span).toBeGreaterThan(0);
      expect(c.litBays).toEqual([]);
      expect(c.structure.attachments ?? []).not.toContainEqual(c.awning);
    }
    for (const c of architecturalCasters(env, [...shops, ...returns])) {
      expect(c.bottom).toBeGreaterThan(2);
      expect(c.height).toBeGreaterThan(c.bottom!);
      expect(c.body.flatMap((p) => [p.x, p.y]).every(Number.isFinite)).toBe(true);
      expect(c.wreck).toBe(c.height);
    }
    expect(JSON.stringify(scene.layout)).toBe(saved);
  }
});

it("connects seed8's market to the next trading floor on the same street", () => {
  const a = composeScene("intersection", 8).layout.arena,
    e = a.environment!;
  const shops = e.structures.flatMap((s) => {
    const f = storefrontFor(s, e, a.cover ?? []);
    return f ? [f] : [];
  });
  const c = marketReturnCanopies(shops, e).find((c) => c.structure.id === "building_0_middle");
  expect(c).toBeDefined();
  expect(c!.awning.offset + c!.awning.span).toBe(c!.length);
  expect(c!.awning.projection).toBe(shops[0]!.awning.projection);
});
