import { expect, it } from "vitest";
import {
  composeScene,
  readBattlefieldSnapshot,
  reachableTiles,
  tileOf,
  tileKey,
  rectsOverlap,
  coverMaxHp,
  type Arena,
} from "../index";

it("keeps nightclub public destinations reachable without entering staff or performance rooms", () => {
  for (let seed = 0; seed < 32; seed++) {
    const { arena } = composeScene("nightclub", seed).layout;
    const env = arena.environment!;
    const publicArena: Arena = {
      ...arena,
      environment: {
        ...env,
        structures: [
          ...env.structures,
          ...env.zones
            .filter((z) => ["performance", "service"].includes(z.id))
            .map((z) => ({
              id: `exclude_${z.id}`,
              label: "Excluded staff area",
              rect: z.rect,
              height: 2,
              style: "interior-wall" as const,
              blocksMovement: true,
              blocksShots: true,
            })),
        ],
      },
    };
    const reached = reachableTiles({
      arena: publicArena,
      cover: {},
      from: tileOf(arena, arena.playerStart),
      allowance: 1000,
    });
    for (const id of ["reception", "dance", "bar", "seating"]) {
      const p = env.interior!.access.find((a) => a.id === `${id}_approach`)!.position;
      expect(reached.has(tileKey(tileOf(arena, p))), `${seed}: public route to ${id}`).toBe(true);
    }
  }
});

it("preserves complete nightclub arrivals, performance and working space through damage and reload", () => {
  for (let seed = 0; seed < 32; seed++) {
    const scene = composeScene("nightclub", seed);
    const { arena } = scene.layout;
    const env = arena.environment!;
    expect(composeScene("nightclub", seed)).toEqual(scene);
    expect(readBattlefieldSnapshot(JSON.parse(JSON.stringify(scene.layout)))).toEqual(scene.layout);
    const rig = env.props.filter((p) => p.clusterId === "club_performance");
    expect(rig.filter((p) => p.art === "dj")).toHaveLength(1);
    expect(rig.filter((p) => p.art === "speaker")).toHaveLength(2);
    expect(env.clusters.filter((c) => c.zoneId === "reception").map((c) => c.kind)).toEqual([
      "club_checkin",
    ]);
    expect(env.clusters.filter((c) => c.kind === "club_prep")).toHaveLength(
      env.composition!.family === 1 ? 1 : 0,
    );
    expect(env.clusters.some((c) => c.id.includes("detail"))).toBe(false);
    const areas = env.zones.filter((z) => z.kind === "aisle" || z.kind === "dance");
    for (const area of areas)
      expect(
        [...arena.cover!, ...env.structures].some((c) => rectsOverlap(c.rect, area.rect)),
      ).toBe(false);
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
      for (const area of areas)
        for (let x = area.rect.x + 1; x < area.rect.x + area.rect.width; x += 2)
          for (let y = area.rect.y + 1; y < area.rect.y + area.rect.height; y += 2)
            expect(reached.has(tileKey(tileOf(arena, { x, y })))).toBe(true);
      for (const p of [
        ...env.interior!.access.map((a) => a.position),
        ...scene.actors.map((a) => a.position),
      ])
        expect(reached.has(tileKey(tileOf(arena, p)))).toBe(true);
    }
  }
});
