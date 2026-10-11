import { expect, it } from "vitest";
import { composeScene, readSceneManifest } from "@/engine";
import { serviceDoors } from "../courtyard/serviceFrontage";
import { rainField } from "../courtyard/afterRain";

it("anchors one warm workroom to an actual saved door across both alley orientations", () => {
  for (const seed of [0, 4, 11, 5, 17, 63]) {
    const scene = composeScene("alley", seed),
      env = scene.layout.arena.environment!;
    const saved = JSON.stringify(scene);
    const doors = env.structures.flatMap((s) =>
      ["north", "east"].flatMap((edge) => serviceDoors(s, edge as "north" | "east", env.entrances)),
    );
    expect(doors.filter((d) => d.warm)).toHaveLength(1);
    expect(doors.length).toBeGreaterThan(1);
    expect(readSceneManifest(JSON.parse(JSON.stringify({ version: 1, scene })))).toEqual(scene);
    expect(JSON.stringify(scene)).toBe(saved);
  }
});

it("keeps alley handling aprons drier while retaining pools around their drains", () => {
  const env = composeScene("alley", 4).layout.arena.environment!;
  const apron = env.zones.find((z) => z.id === "west-service")!;
  const bare = rainField({
    ...env,
    zones: env.zones.filter((z) => z.kind !== "loading"),
    dressing: [],
  });
  const dry = rainField({ ...env, dressing: [] });
  const wet = rainField(env);
  let reduced = 0;
  for (let y = 0; y < 32; y += 0.3) {
    const x = apron.rect.x + 0.35;
    expect(dry(x, y)).toBeLessThanOrEqual(bare(x, y));
    if (dry(x, y) < bare(x, y)) reduced++;
  }
  expect(reduced).toBeGreaterThan(10);
  for (const d of env.dressing.filter((d) => d.kind === "drain"))
    expect(wet(d.position.x, d.position.y)).toBeGreaterThan(dry(d.position.x, d.position.y));
});
