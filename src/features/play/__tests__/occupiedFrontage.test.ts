import { expect, it } from "vitest";
import { composeScene } from "@/engine";
import { occupiedUse, occupiedLights } from "../courtyard/occupiedFrontage";
import { lightAt } from "../courtyard/nightLighting";
import v12 from "@/engine/__tests__/fixtures/intersection-v12.json";
import { readSceneManifest } from "@/engine/persistentScene";

it("selects occupied repair and studios from saved attachments, leaving prior scenes alone", () => {
  const env = composeScene("intersection", 8).layout.arena.environment!;
  expect(env.structures.filter((s) => occupiedUse(s)).map((s) => [s.id, occupiedUse(s)])).toEqual([
    ["building_3", "repair"],
    ["building_3_loft_a", "studios"],
  ]);
  const old = readSceneManifest({ version: 1, scene: structuredClone(v12) }).layout.arena
    .environment!;
  expect(occupiedLights(old)).toEqual([]);
  for (const seed of [0, 7])
    expect(occupiedLights(composeScene("intersection", seed).layout.arena.environment!)).toEqual(
      [],
    );
});

it("lights the trading threshold and studio passage from their own faces without lighting interiors", () => {
  const env = composeScene("intersection", 8).layout.arena.environment!;
  const saved = JSON.stringify(env),
    lights = occupiedLights(env);
  expect(lights).toHaveLength(3);
  for (const p of [
    { x: 25, y: 21 },
    { x: 29, y: 25 },
    { x: 29, y: 31 },
  ])
    expect(lightAt(lights, env.structures, p).some((c) => c > 0.15)).toBe(true);
  for (const p of [
    { x: 25, y: 25 },
    { x: 25, y: 31 },
    { x: 10, y: 10 },
  ])
    expect(lightAt(lights, env.structures, p)).toEqual([0, 0, 0]);
  expect(JSON.stringify(env)).toBe(saved);
});

it("removes canopy and balcony silhouettes from additive light without leaking canvas state", async () => {
  const { paintFrontageIdentity } = await import("../courtyard/frontageIdentity");
  const env = composeScene("intersection", 8).layout.arena.environment!;
  const s = env.structures.find((s) => occupiedUse(s) === "repair")!;
  for (const pass of ["light", "glow", "albedo"] as const) {
    let mode = "source-over",
      cuts = 0;
    const stack: string[] = [];
    const ctx = new Proxy(
      {},
      {
        get: (_t, key) => {
          if (key === "save") return () => stack.push(mode);
          if (key === "restore")
            return () => {
              mode = stack.pop()!;
            };
          if (key === "createLinearGradient") return () => ({ addColorStop: () => undefined });
          if (key === "fill" || key === "stroke")
            return () => {
              if (mode === "destination-out") cuts++;
            };
          return () => undefined;
        },
        set: (_t, key, value) => {
          if (key === "globalCompositeOperation") mode = value;
          return true;
        },
      },
    ) as unknown as CanvasRenderingContext2D;
    paintFrontageIdentity(ctx, s, "east", env, (p) => ({ x: p.x * 15, y: p.y * 15 }), 15, pass);
    expect(cuts > 0).toBe(pass !== "albedo");
    expect(mode).toBe("source-over");
    expect(stack).toEqual([]);
  }
});
