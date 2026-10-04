import { describe, expect, it } from "vitest";
import { composeScene, readBattlefieldSnapshot, rectInside, rectsOverlap } from "../index";

describe("lived-in scene composition", () => {
  it("keeps compact office support space beyond reception", () => {
    for (let seed = 1; seed <= 3; seed++) {
      const arena = composeScene("office", seed).layout.arena;
      expect(arena.extent.width * arena.extent.height).toBeLessThanOrEqual(28 * 28);
      const connections = arena.environment!.interior!.connections;
      expect(connections.some((c) => c.from === "service" && c.to === "outside")).toBe(true);
      expect(
        connections.some(
          (c) => [c.from, c.to].includes("service") && [c.from, c.to].includes("reception"),
        ),
      ).toBe(false);
      expect(connections.some((c) => c.from === "reception" && c.to === "outside")).toBe(true);
    }
  });

  it("defines intersection corner identities in structure geometry before props", () => {
    for (let seed = 1; seed <= 3; seed++) {
      const structures = composeScene("intersection", seed).layout.arena.environment!.structures;
      const groups = [0, 1, 2, 3].map((n) =>
        structures.filter((s) => s.id === `building_${n}` || s.id.startsWith(`building_${n}_`)),
      );
      expect(groups.map((g) => g.length)).toEqual([3, 2, 2, 1]);
      expect(new Set(structures.map((s) => s.height)).size).toBeGreaterThanOrEqual(4);
      expect(groups[1]!.some((s) => s.style === "residential")).toBe(true);
      expect(groups[0]!.every((s) => s.style === "shop")).toBe(true);
      const env = composeScene("intersection", seed).layout.arena.environment!;
      const court = env.zones.find((z) => z.id === "service-court")!.rect;
      expect(structures.some((s) => rectsOverlap(s.rect, court))).toBe(false);
      // Its open court is visible inside the playable slice, including rotation.
      expect(Math.min(32, court.x + court.width) - Math.max(0, court.x)).toBeGreaterThanOrEqual(6);
      expect(Math.min(32, court.y + court.height) - Math.max(0, court.y)).toBeGreaterThanOrEqual(6);
      const lane = env.zones.find((z) => z.id === "service-access")!.rect;
      expect(Math.max(lane.x + lane.width, lane.y + lane.height)).toBeGreaterThan(32);
      expect(groups[0]!.every((s) => s.height <= 4)).toBe(true);
      expect(groups[3]![0]!.height).toBeLessThan(3);
      // Stepped footprints rather than filling each group's bounding rectangle.
      for (const group of [groups[0]!, groups[1]!, groups[2]!]) {
        const area = group.reduce((n, s) => n + s.rect.width * s.rect.height, 0);
        const width =
          Math.max(...group.map((s) => s.rect.x + s.rect.width)) -
          Math.min(...group.map((s) => s.rect.x));
        const height =
          Math.max(...group.map((s) => s.rect.y + s.rect.height)) -
          Math.min(...group.map((s) => s.rect.y));
        expect(area).toBeLessThan(width * height);
      }
    }
  });

  it.each(["office", "nightclub"] as const)(
    "furnishes %s without consuming circulation",
    (kind) => {
      for (let seed = 1; seed <= 3; seed++) {
        const { arena } = composeScene(kind, seed).layout;
        const env = arena.environment!;
        // Compare occupied area, not counts that reward oversized floor plans.
        const furnishingArea = arena.cover!.reduce(
          (sum, c) => sum + c.rect.width * c.rect.height,
          0,
        );
        // Furnish functional rooms; the deliberately empty circulation loop must
        // not create an incentive to add filler to meet an arena-wide quota.
        const usableArea = env.zones
          .filter((z) => !["aisle", "corridor", "doorway", "dance"].includes(z.kind))
          .reduce((sum, z) => sum + z.rect.width * z.rect.height, 0);
        expect(furnishingArea / usableArea).toBeGreaterThan(0.1);
        expect(furnishingArea / (arena.extent.width * arena.extent.height)).toBeLessThan(0.4);
        expect(new Set(env.props.map((p) => p.art)).size).toBeGreaterThanOrEqual(6);
        expect(env.structures.every((s) => Math.min(s.rect.width, s.rect.height) === 0.5)).toBe(
          true,
        );
        expect(
          readBattlefieldSnapshot(JSON.parse(JSON.stringify(composeScene(kind, seed).layout))),
        ).toEqual(composeScene(kind, seed).layout);
      }
    },
  );

  it("rejects a missing thin-wall connector even when tile centres remain blocked", () => {
    const snapshot = composeScene("office", 1).layout;
    const env = snapshot.arena.environment!;
    const connector = env.structures.findIndex(
      (s) => s.rect.width === 0.5 && s.rect.height === 1.5,
    );
    expect(connector).toBeGreaterThanOrEqual(0);
    env.structures.splice(connector, 1);
    expect(() => readBattlefieldSnapshot(snapshot)).toThrow();
  });

  it("still loads full-width version-three walls without regenerating them", () => {
    const snapshot = composeScene("office", 1).layout;
    const env = snapshot.arena.environment!;
    env.recipeVersion = 3;
    env.structures = [];
    for (let y = 0; y < snapshot.arena.extent.height; y += 2) {
      let start: number | null = null;
      for (let x = 0; x <= snapshot.arena.extent.width; x += 2) {
        const solid =
          x < snapshot.arena.extent.width &&
          !env.zones.some((z) => rectInside({ x, y, width: 2, height: 2 }, z.rect));
        if (solid && start === null) start = x;
        if (!solid && start !== null) {
          env.structures.push({
            id: `legacy_${x}_${y}`,
            label: "Legacy wall",
            rect: { x: start, y, width: x - start, height: 2 },
            style: "interior-wall",
            height: 1.4,
            blocksMovement: true,
            blocksShots: true,
          });
          start = null;
        }
      }
    }
    expect(readBattlefieldSnapshot(snapshot)).toEqual(snapshot);
  });

  it.each(["intersection", "alley"] as const)(
    "gives %s distinct building wings and functional edges",
    (kind) => {
      for (let seed = 1; seed <= 3; seed++) {
        const { arena } = composeScene(kind, seed).layout;
        const env = arena.environment!;
        expect(new Set(env.structures.map((s) => s.height)).size).toBeGreaterThanOrEqual(4);
        expect(
          new Set(env.structures.map((s) => `${s.rect.width}x${s.rect.height}`)).size,
        ).toBeGreaterThanOrEqual(4);
        if (kind === "alley")
          for (const id of ["court_delivery", "delivery_north", "waste_south", "service_east"])
            expect(env.clusters.some((c) => c.id === id)).toBe(true);
        else
          for (const id of ["broth_cart", "housing_entry", "deliveries", "utility_waiting"])
            expect(env.clusters.some((c) => c.id === id)).toBe(true);
        expect(
          env.entrances!.every((e) => env.structures.some((s) => s.id === e.structureId)),
        ).toBe(true);
      }
    },
  );
});
