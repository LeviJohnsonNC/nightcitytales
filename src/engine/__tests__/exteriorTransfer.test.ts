import { expect, it } from "vitest";
import {
  composeScene,
  readBattlefieldSnapshot,
  reachableTiles,
  tileKey,
  tileOf,
  rectsOverlap,
} from "../index";
import { attachmentPoint } from "../sceneEnvironment";

it.each(["alley", "residential"] as const)(
  "preserves %s approach and working routes across orientations and damage",
  (kind) => {
    for (let seed = 0; seed < 32; seed++) {
      const layout = composeScene(kind, seed).layout;
      const arena = layout.arena,
        env = arena.environment!;
      expect(readBattlefieldSnapshot(JSON.parse(JSON.stringify(layout)))).toEqual(layout);
      for (const entry of env.entrances!) {
        const host = env.structures.find((s) => s.id === entry.structureId)!;
        const surround = host.attachments!.find((a) => a.id === `${entry.id}_surround`)!;
        expect(attachmentPoint(host, surround, 1, 1)).toEqual(entry.position);
      }
      for (const destroyed of [false, true]) {
        const damage = Object.fromEntries(
          arena.cover!.map((c) => [c.id, destroyed ? c.maxHp! : 0]),
        );
        const reached = reachableTiles({
          arena,
          cover: damage,
          from: tileOf(arena, arena.playerStart),
          allowance: 1000,
        });
        for (const z of env.zones.filter((z) => z.kind === "aisle")) {
          expect(env.structures.some((s) => rectsOverlap(s.rect, z.rect))).toBe(false);
          expect(arena.cover!.some((c) => rectsOverlap(c.rect, z.rect))).toBe(false);
          for (let x = z.rect.x + 1; x < z.rect.x + z.rect.width; x += 2)
            for (let y = z.rect.y + 1; y < z.rect.y + z.rect.height; y += 2)
              expect(reached.has(tileKey(tileOf(arena, { x, y })))).toBe(true);
        }
        for (const entry of env.entrances!)
          expect(reached.has(tileKey(tileOf(arena, entry.position)))).toBe(true);
      }
      if (kind === "alley") {
        expect(env.clusters.filter((c) => c.kind === "workshop_delivery")).toHaveLength(2);
        expect(env.clusters.filter((c) => c.kind === "workshop_service")).toHaveLength(2);
        expect(env.clusters.some((c) => c.id.includes("infill"))).toBe(false);
      } else {
        expect(env.clusters.filter((c) => c.kind === "residential_entry")).toHaveLength(2);
        expect(env.zones.filter((z) => z.floorUse === "entry")).toHaveLength(9);
        expect(
          env.zones.filter((z) => z.kind === "sidewalk").every((z) => z.rect.x < 0 || z.rect.y < 0),
        ).toBe(true);
      }
    }
  },
);
