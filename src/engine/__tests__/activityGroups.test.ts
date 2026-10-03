import { expect, it } from "vitest";
import {
  composeScene,
  composeAdventureScene,
  readBattlefieldSnapshot,
  readSceneFacts,
  readSceneManifest,
  rectsOverlap,
} from "../index";
import { placeSceneClusters } from "../sceneClusters";

it("keeps complete work pods and their shared working aisles in all office topologies", () => {
  for (let seed = 0; seed < 32; seed++) {
    const arena = composeScene("office", seed).layout.arena;
    const env = arena.environment!;
    const work = env.clusters.filter((c) => c.zoneId === "work" && c.kind !== "garden");
    expect(work.length).toBeGreaterThanOrEqual(2);
    expect(work.every((c) => c.kind === "work_pod")).toBe(true);
    for (const pod of work) {
      expect(env.props.filter((p) => p.clusterId === pod.id).map((p) => p.art)).toEqual([
        "desk",
        "desk",
        "cabinet",
      ]);
      const access = env.interior!.access.filter((a) => a.id.startsWith(`${pod.id}_access_`));
      expect(access).toHaveLength(3);
      for (const a of access)
        expect(
          arena.cover!.some((c) =>
            rectsOverlap(c.rect, {
              x: a.position.x - 1,
              y: a.position.y - 1,
              width: 2,
              height: 2,
            }),
          ),
        ).toBe(false);
    }
  }
});

it("preserves outdoor customer/handling space through saving and later placement", () => {
  for (let seed = 0; seed < 32; seed++) {
    const saved = composeScene("intersection", seed).layout;
    const arena = readBattlefieldSnapshot(JSON.parse(JSON.stringify(saved))).arena;
    const env = arena.environment!;
    const customer = env.zones.find((z) => z.id === "broth_cart_access_0")!;
    expect(customer.kind).toBe("aisle");
    expect(env.zones.filter((z) => z.id.startsWith("deliveries_access_"))).toHaveLength(3);
    expect(env.props.filter((p) => p.clusterId === "broth_cart").map((p) => p.art)).toEqual([
      "food-cart",
      "cargo",
    ]);
    const before = JSON.stringify(arena);
    // A later pass cannot consume saved access even without the original reserved array.
    placeSceneClusters(
      arena,
      [
        {
          id: "would_block_queue",
          kind: "garden",
          zone: "west-walk",
          at: { x: customer.rect.x, y: customer.rect.y },
        },
      ],
      [],
      seed,
      false,
    );
    expect(JSON.stringify(arena)).toBe(before);
  }
});

it.each([
  ["office", "workstation"],
  ["office", "meeting"],
  ["intersection", "vendor"],
  ["intersection", "freight"],
  ["intersection", "utilities"],
])("keeps adventure facts bound to %s %s groups", (locationType, kind) => {
  for (let seed = 0; seed < 6; seed++) {
    const scene = composeAdventureScene({
      locationKey: "north_heywood",
      identity: `activity:${seed}`,
      name: "Activity review",
      enemies: [{ key: "guard", name: "Mara", profile: "street_thug" }],
      facts: readSceneFacts({
        locationType,
        objects: [{ id: "anchor", label: "Named activity", kind }],
        entities: [{ id: "worker", name: "Kiro", role: "worker" }],
        relationships: [{ entity: "worker", relation: "works_at", target: "anchor" }],
      }),
    })!;
    expect(scene.context!.objects[0]!.coverIds.length).toBeGreaterThan(0);
    expect(scene.actors.some((a) => a.id === "worker")).toBe(true);
    expect(readSceneManifest(JSON.parse(JSON.stringify({ version: 1, scene })))).toEqual(scene);
  }
});
