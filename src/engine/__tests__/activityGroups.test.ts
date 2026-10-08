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
    expect(
      work.every((c) =>
        ["work_facing", "work_island", "work_pod", "work_parallel"].includes(c.kind),
      ),
    ).toBe(true);
    for (const pod of work) {
      const bindings = env.props.filter((p) => p.clusterId === pod.id);
      // Opposed chairs face the reserved outer aisles, including open-core rooms.
      expect(bindings.filter((p) => p.art.startsWith("desk")).every((p) => p.rotation === 0)).toBe(
        true,
      );
      const art = bindings.map((p) => p.art);
      const desks = ["work_island", "work_parallel"].includes(pod.kind) ? 2 : 1;
      expect(art.filter((a) => a === "desk")).toHaveLength(
        pod.kind === "work_parallel" ? 4 : pod.kind === "work_pod" ? 2 : desks,
      );
      expect(art.filter((a) => a === "desk-reverse")).toHaveLength(
        ["work_pod", "work_parallel"].includes(pod.kind) ? 0 : desks,
      );
      expect(art.filter((a) => a === "cabinet")).toHaveLength(1);
      const access = env.interior!.access.filter((a) => a.id.startsWith(`${pod.id}_access_`));
      expect(access).toHaveLength(desks * 2 + 1);
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
  ["office", "reception"],
  ["office", "seating"],
  ["office", "server"],
  ["nightclub", "bar"],
  ["nightclub", "seating"],
  ["nightclub", "freight"],
  ["nightclub", "reception"],
  ["nightclub", "performance"],
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

it("makes reception a complete visitor/staff arrangement and keeps support functional", () => {
  for (let seed = 0; seed < 32; seed++) {
    const arena = composeScene("office", seed).layout.arena;
    const env = arena.environment!;
    const reception = env.clusters.find((c) => c.zoneId === "reception")!;
    const props = env.props.filter((p) => p.clusterId === reception.id);
    expect(props.filter((p) => p.art === "reception")).toHaveLength(2);
    expect(
      env.props.some(
        (p) => p.clusterId === "reception_waiting" && p.art.startsWith("waiting-seat"),
      ),
    ).toBe(true);
    expect(env.clusters.find((c) => c.zoneId === "service")!.kind).toBe("equipment_support");
    for (const use of ["staff", "visitor"])
      expect(env.zones.some((z) => z.floorUse === use)).toBe(true);
    const meeting = env.clusters.find((c) => c.zoneId === "meeting")!;
    const table = env.props
      .filter((p) => p.clusterId === meeting.id && p.art === "conference-table")
      .map((p) => arena.cover!.find((c) => c.id === p.coverId)!.rect);
    expect(table).toHaveLength(meeting.kind === "conference_suite" ? 3 : 2);
    expect(Math.abs(table[0]!.x - table[1]!.x) + Math.abs(table[0]!.y - table[1]!.y)).toBe(2);
    if (["meeting_support", "conference_suite"].includes(meeting.kind)) {
      const cabinet = env.props.find((p) => p.clusterId === meeting.id && p.art === "cabinet")!;
      const bounds = arena.cover!.find((c) => c.id === cabinet.coverId)!.rect;
      const room = env.zones.find((z) => z.id === meeting.zoneId)!.rect;
      expect(bounds.x + bounds.width).toBe(room.x + room.width);
    }
  }
});

it.each(["office", "intersection"] as const)(
  "saves clear, purposeful floor reservations in %s",
  (kind) => {
    for (let seed = 0; seed < 32; seed++) {
      const snapshot = composeScene(kind, seed).layout;
      const arena = readBattlefieldSnapshot(JSON.parse(JSON.stringify(snapshot))).arena;
      const areas = arena.environment!.zones.filter((z) => z.floorUse);
      expect(areas.length).toBeGreaterThan(0);
      for (const area of areas) {
        expect(area.kind).toBe("aisle");
        expect(
          [...arena.cover!, ...arena.environment!.structures].some((c) =>
            rectsOverlap(c.rect, area.rect),
          ),
        ).toBe(false);
      }
      if (kind === "intersection") {
        expect(areas.filter((z) => z.floorUse === "handling")).toHaveLength(2);
        expect(areas.some((z) => z.floorUse === "forecourt")).toBe(true);
        for (const id of ["housing_entry", seed === 8 ? "repair_power" : "utility_waiting"])
          expect(arena.environment!.clusters.some((c) => c.id === id)).toBe(true);
      }
      expect(readBattlefieldSnapshot(JSON.parse(JSON.stringify(snapshot)))).toEqual(snapshot);
      const invalid = JSON.parse(JSON.stringify(snapshot));
      invalid.arena.environment.zones.find((z: { floorUse?: string }) => z.floorUse).floorUse =
        "invented";
      expect(() => readBattlefieldSnapshot(invalid)).toThrow();
      // Older snapshots without floor treatments remain valid and are not regenerated.
      for (const z of snapshot.arena.environment!.zones) delete z.floorUse;
      expect(readBattlefieldSnapshot(snapshot)).toEqual(snapshot);
    }
  },
);

it("composes a complete staffed bar and distinct lounge groups in every nightclub topology", () => {
  for (let seed = 0; seed < 32; seed++) {
    const snapshot = composeScene("nightclub", seed).layout;
    const arena = snapshot.arena;
    const env = arena.environment!;
    const bar = env.clusters.filter((c) => c.zoneId === "bar");
    expect(bar.map((c) => c.kind)).toEqual(["bar_service"]);
    const art = env.props.filter((p) => p.clusterId === bar[0]!.id);
    expect(art.filter((p) => p.art === "bar")).toHaveLength(2);
    expect(art.filter((p) => p.art === "backbar")).toHaveLength(2);
    expect(art.every((p) => p.rotation === 0)).toBe(true);
    const counter = art
      .filter((p) => p.art === "bar")
      .map((p) => arena.cover!.find((c) => c.id === p.coverId)!.rect);
    expect(Math.abs(counter[0]!.x - counter[1]!.x)).toBe(2);
    expect(counter[0]!.y).toBe(counter[1]!.y);
    const backbar = art
      .filter((p) => p.art === "backbar")
      .map((p) => arena.cover!.find((c) => c.id === p.coverId)!.rect);
    expect(backbar.every((r) => r.y === counter[0]!.y + 4)).toBe(true);
    for (const id of ["bar_customers", "bar_staff", "bar_end_access"]) {
      const area = env.zones.find((z) => z.id === id)!;
      expect(area.kind).toBe("aisle");
      expect(arena.cover!.some((c) => rectsOverlap(c.rect, area.rect))).toBe(false);
    }
    const lounges = env.clusters.filter((c) => c.zoneId === "seating");
    expect(lounges.length).toBeGreaterThanOrEqual(2);
    for (const group of lounges) {
      expect(["lounge_bench", "lounge_conversation"]).toContain(group.kind);
      const props = env.props.filter((p) => p.clusterId === group.id);
      expect(props.filter((p) => p.art.startsWith("seat"))).toHaveLength(2);
      expect(props.filter((p) => p.art === "lounge-table")).toHaveLength(
        group.kind === "lounge_bench" ? 2 : 1,
      );
    }
    expect(env.clusters.filter((c) => c.zoneId === "service").map((c) => c.kind)).toEqual(
      env.composition!.family === 1 ? ["club_prep", "service_stock"] : ["service_stock"],
    );
    const dance = env.zones.find((z) => z.kind === "dance")!;
    expect(arena.cover!.some((c) => rectsOverlap(c.rect, dance.rect))).toBe(false);
    expect(readBattlefieldSnapshot(JSON.parse(JSON.stringify(snapshot)))).toEqual(snapshot);
  }
});

it("separates the shop forecourt from through walking and keeps quiet cues sparse", () => {
  for (let seed = 0; seed < 32; seed++) {
    const { arena } = composeScene("intersection", seed).layout;
    const env = arena.environment!;
    const forecourt = env.zones.find((z) => z.id === "shop-customers")!;
    const through = env.zones.find((z) => z.id === "walk-west-north")!;
    expect(forecourt.rect.width * forecourt.rect.height).toBe(8);
    expect(rectsOverlap(forecourt.rect, through.rect)).toBe(false);
    expect(arena.cover!.some((c) => rectsOverlap(c.rect, forecourt.rect))).toBe(false);
    for (const [id, cue] of [
      ["housing_entry", "mailboxes"],
      seed === 8 ? ["repair_power", "generator"] : ["utility_waiting", "shop-display"],
    ]) {
      const props = env.props.filter((p) => p.clusterId === id);
      expect(props).toHaveLength(2);
      expect(props.filter((p) => p.art === cue)).toHaveLength(1);
      expect(props.filter((p) => p.art === "planter")).toHaveLength(1);
    }
  }
});
