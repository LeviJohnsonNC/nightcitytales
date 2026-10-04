import { expect, it } from "vitest";
import {
  composeScene,
  readBattlefieldSnapshot,
  reachableTiles,
  tileKey,
  tileOf,
  rectsOverlap,
  coverMaxHp,
} from "../index";

it.each(["warehouse", "garage"] as const)(
  "%s preserves complete working groups and continuous routes across seeds and damage",
  (kind) => {
    for (let seed = 0; seed < 32; seed++) {
      const scene = composeScene(kind, seed);
      const { arena } = scene.layout;
      const env = arena.environment!;
      expect(composeScene(kind, seed)).toEqual(scene);
      expect(readBattlefieldSnapshot(JSON.parse(JSON.stringify(scene.layout)))).toEqual(
        scene.layout,
      );
      const groups = env.clusters.filter(
        (c) => c.kind === (kind === "garage" ? "service_bay" : "rack_aisle"),
      );
      expect(groups.length).toBeGreaterThanOrEqual(2);
      expect(env.clusters.filter((c) => c.kind === "repair_support")).toHaveLength(1);
      for (const group of groups) {
        const pieces = env.props.filter((p) => p.clusterId === group.id);
        // Two whole racks, or a car's two independent sections plus tool bench
        // and parts storage: never silently degrade to a lone object.
        expect(pieces).toHaveLength(kind === "garage" ? 5 : 4);
        const access = env.interior!.access.filter((a) => a.id.startsWith(`${group.id}_access_`));
        expect(access).toHaveLength(kind === "garage" ? 7 : 2);
      }
      if (kind === "warehouse") {
        expect(env.clusters.some((c) => c.id === "receiving_stock" && c.zoneId === "staging")).toBe(
          true,
        );
      }
      const routes = env.zones.filter((z) => z.kind === "aisle" || z.kind === "corridor");
      expect(routes.some((z) => Math.min(z.rect.width, z.rect.height) >= 4)).toBe(true);
      for (const route of routes) {
        expect(env.structures.some((s) => rectsOverlap(s.rect, route.rect))).toBe(false);
        expect(arena.cover!.some((c) => rectsOverlap(c.rect, route.rect))).toBe(false);
      }
      for (const destroyed of [false, true]) {
        const cover = Object.fromEntries(
          arena.cover!.map((c) => [c.id, destroyed ? coverMaxHp(c) : 0]),
        );
        const reached = reachableTiles({
          arena,
          cover,
          from: tileOf(arena, arena.playerStart),
          allowance: 1000,
        });
        for (const route of routes) {
          for (let x = route.rect.x + 1; x < route.rect.x + route.rect.width; x += 2)
            for (let y = route.rect.y + 1; y < route.rect.y + route.rect.height; y += 2)
              expect(reached.has(tileKey(tileOf(arena, { x, y })))).toBe(true);
        }
        for (const p of [
          ...env.interior!.access.map((a) => a.position),
          ...scene.actors.map((a) => a.position),
        ])
          expect(reached.has(tileKey(tileOf(arena, p)))).toBe(true);
      }
    }
  },
);
