import { describe, expect, it } from "vitest";
import {
  composeAdventureScene,
  readSceneFacts,
  readSceneManifest,
  SCENE_LOCATION_TYPES,
  reachableTiles,
  tileOf,
  tileKey,
} from "../index";
const enemy = { key: "guard", name: "Mara", profile: "street_thug" };
const base = {
  locationKey: "north_heywood",
  identity: "campaign:job:beat",
  name: "Loading dock confrontation",
  enemies: [enemy],
};
describe("adventure scene composition", () => {
  it.each(SCENE_LOCATION_TYPES)("replaces proof cast and freezes a deterministic %s", (kind) => {
    for (let seed = 0; seed < 9; seed++) {
      const input = {
        ...base,
        identity: `${base.identity}:${seed}`,
        facts: readSceneFacts({ locationType: kind }),
      };
      const scene = composeAdventureScene(input)!;
      expect(scene.actors.map((a) => a.name)).toEqual(["Mara"]);
      expect(scene.actors[0]!.profile!.key).toBe("street_thug");
      expect(scene.locationKey).toBe(base.locationKey);
      expect(composeAdventureScene(input)).toEqual(scene);
      expect(readSceneManifest(JSON.parse(JSON.stringify({ version: 1, scene })))).toEqual(scene);
    }
  });
  it("places the named mechanic beside the named bench, preserving identities and routes", () => {
    const scene = composeAdventureScene({
      ...base,
      facts: readSceneFacts({
        locationType: "garage",
        crowd: "busy",
        entities: [
          { id: "mechanic", name: "Kiro", role: "worker" },
          { id: "guard", name: "Mara", role: "guard" },
        ],
        objects: [{ id: "bench", label: "Kiro's repair bench", kind: "workbench" }],
        entrances: [{ id: "dock", label: "Loading entrance", kind: "loading" }],
        relationships: [
          { entity: "mechanic", relation: "works_at", target: "bench" },
          { entity: "guard", relation: "guards", target: "dock" },
        ],
      }),
    })!;
    expect(scene.actors).toHaveLength(7);
    expect(scene.actors.filter((a) => a.side === "hostile")).toHaveLength(1);
    expect(scene.actors.filter((a) => a.side === "neutral").every((a) => a.profile === null)).toBe(
      true,
    );
    const mechanic = scene.actors.find((a) => a.id === "mechanic")!;
    const parts = scene.context!.objects[0]!.coverIds.map((id) =>
      scene.layout.arena.cover!.find((c) => c.id === id)!,
    );
    expect(
      parts.some(
        (c) =>
          Math.abs(mechanic.position.x - c.rect.x) + Math.abs(mechanic.position.y - c.rect.y) <= 8,
      ),
    ).toBe(true);
    const arena = scene.layout.arena;
    const reached = reachableTiles({
      arena,
      cover: {},
      from: tileOf(arena, arena.playerStart),
      allowance: 1000,
    });
    expect(scene.actors.every((a) => reached.has(tileKey(tileOf(arena, a.position))))).toBe(true);
    expect(readSceneManifest({ version: 1, scene })).toEqual(scene);
  });
  it("rejects impossible contextual objects rather than dropping or scattering them", () => {
    expect(() =>
      composeAdventureScene({
        ...base,
        facts: readSceneFacts({
          locationType: "office",
          objects: [{ id: "car", label: "Escape car", kind: "vehicle" }],
        }),
      }),
    ).toThrow("cannot fit");
  });
  it("retains unsupported authored arenas and chooses coherent defaults for known ones", () => {
    expect(composeAdventureScene({ ...base, arena: "rooftop" })).toBeNull();
    expect(
      composeAdventureScene({ ...base, arena: "club_interior" })!.layout.arena.environment!.recipe,
    ).toBe("nightclub");
    expect(() =>
      composeAdventureScene({
        ...base,
        arena: "rooftop",
        facts: readSceneFacts({ crowd: "busy" }),
      }),
    ).toThrow("supported location");
  });
  it("drops model geometry/stats and rejects references, duplicates and cyclic relationships", () => {
    const facts = readSceneFacts({
      locationType: "office",
      x: 5,
      entities: [{ id: "worker", name: "Kiro", role: "worker", position: { x: 5, y: 5 }, hp: 999 }],
    });
    expect(facts.entities[0]).toEqual({ id: "worker", name: "Kiro", role: "worker" });
    expect(() =>
      readSceneFacts({
        entities: [{ id: "a", name: "A", role: "worker" }],
        relationships: [{ entity: "a", relation: "near", target: "missing" }],
      }),
    ).toThrow();
    const cyclic = readSceneFacts({
      locationType: "office",
      entities: [
        { id: "a", name: "A", role: "worker" },
        { id: "b", name: "B", role: "worker" },
      ],
      relationships: [
        { entity: "a", relation: "near", target: "b" },
        { entity: "b", relation: "near", target: "a" },
      ],
    });
    expect(() => composeAdventureScene({ ...base, facts: cyclic })).toThrow("Cyclic");
    expect(() => composeAdventureScene({ ...base, enemies: [enemy, enemy], facts })).toThrow(
      "opposition",
    );
  });
  it("rejects corrupt saved fact bindings", () => {
    const scene = composeAdventureScene({
      ...base,
      facts: readSceneFacts({
        locationType: "office",
        objects: [{ id: "desk", label: "Kiro's desk", kind: "workstation" }],
      }),
    })!;
    scene.context!.objects[0]!.coverIds = ["nonexistent"];
    expect(() => readSceneManifest({ version: 1, scene })).toThrow("binding");
  });
});
