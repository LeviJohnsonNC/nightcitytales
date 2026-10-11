import { expect, it } from "vitest";
import { composeScene } from "@/engine";
import {
  occupiedUse,
  occupiedLights,
  paintOccupiedFrontage,
  repairBays,
} from "../courtyard/occupiedFrontage";
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
  expect(lights).toHaveLength(8);
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

it("reflects the lit repair bays but excludes the cyan facade wash", () => {
  const env = composeScene("intersection", 8).layout.arena.environment!;
  const s = env.structures.find((s) => occupiedUse(s) === "repair")!;
  const draw = (emissionOnly: boolean) => {
    const fills: unknown[] = [];
    let style: unknown;
    const ctx = new Proxy(
      {},
      {
        get: (_t, key) => {
          if (key === "createLinearGradient") return () => ({ addColorStop() {} });
          if (key === "fill") return () => fills.push(style);
          return () => undefined;
        },
        set: (_t, key, value) => {
          if (key === "fillStyle") style = value;
          return true;
        },
      },
    ) as unknown as CanvasRenderingContext2D;
    paintOccupiedFrontage(
      ctx,
      s,
      "east",
      env.entrances,
      (p) => p,
      15,
      "light",
      undefined,
      emissionOnly,
    );
    return fills;
  };
  const visible = draw(false),
    reflected = draw(true);
  // Every reflected patch is also visible, but no gradient falling on masonry is a source.
  expect(reflected.length).toBeGreaterThan(0);
  expect(reflected.every((v) => typeof v === "string" && visible.includes(v))).toBe(true);
  expect(visible.filter((v) => typeof v !== "string")).toHaveLength(1);
  expect(visible.length).toBe(reflected.length + 1);
});

it("gives the repair sign the same source position and colour on pavement and walls", async () => {
  const { pointLights } = await import("../courtyard/wallLight");
  const { INTERSECTION_NIGHT } = await import("../courtyard/nightLighting");
  const env = composeScene("intersection", 8).layout.arena.environment!;
  const pools = occupiedLights(env).filter((l) => l.kind === "pool");
  const walls = pointLights(env, [], INTERSECTION_NIGHT);
  expect(pools).toHaveLength(2);
  for (const l of pools) {
    if (l.kind !== "pool") continue;
    expect(walls).toContainEqual({
      at: l.centre,
      z: l.sourceZ,
      color: l.color,
      intensity: l.intensity,
      radius: l.radius,
    });
    expect(l.color[2]).toBeGreaterThan(l.color[0]);
  }
  for (const l of occupiedLights(env).filter((l) => l.kind === "spill" && l.color[0] === 1))
    expect(l.color[0]).toBeGreaterThan(l.color[2]);
});

it("fits distinct repair displays around moved saved doors without changing the entrance", async () => {
  const { facadeOpenings } = await import("../courtyard/architectureArt");
  const env = composeScene("intersection", 8).layout.arena.environment!;
  const s = env.structures.find((s) => occupiedUse(s) === "repair")!;
  const entrance = env.entrances!.find((e) => e.structureId === s.id)!;
  for (const edge of ["north", "east"] as const) {
    const length = edge === "north" ? s.rect.width : s.rect.height;
    for (const c of [1, length / 2, length - 1]) {
      const entrances = [
        {
          ...entrance,
          position:
            edge === "north"
              ? { x: s.rect.x + c, y: s.rect.y - 1 }
              : { x: s.rect.x + s.rect.width + 1, y: s.rect.y + c },
        },
      ];
      const saved = JSON.stringify(entrances);
      const bays = repairBays(s, edge, entrances);
      expect(bays.length).toBeGreaterThan(0);
      for (const b of bays) {
        expect(b.a).toBeGreaterThanOrEqual(0);
        expect(b.b).toBeLessThanOrEqual(length);
        expect(b.b - b.a).toBeGreaterThan(0.7);
        expect(b.b <= c - 1.04 || b.a >= c + 1.04).toBe(true);
      }
      expect(facadeOpenings(s, entrances, edge).doors).toEqual([c]);
      expect(JSON.stringify(entrances)).toBe(saved);
    }
    const displays = repairBays(s, edge, []);
    expect(new Set(displays.map((b) => b.lo)).size).toBe(2);
  }
});
