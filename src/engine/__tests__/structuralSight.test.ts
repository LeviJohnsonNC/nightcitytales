import { expect, it } from "vitest";
import {
  composeScene,
  structuresBetween,
  walkToStructuralSight,
  blockedTiles,
  tileOf,
  tileKey,
  routeMetres,
} from "../index";
import { targetCapabilities } from "@/features/play/capabilityModel";
import type { LiveEncounter } from "@/features/campaign/encounterState";

function room() {
  const arena = composeScene("intersection").layout.arena;
  arena.cover = [];
  arena.environment!.structures = [
    {
      id: "wall",
      label: "Warehouse wall",
      rect: { x: 8, y: 4, width: 4, height: 16 },
      height: 4,
      style: "warehouse",
      blocksMovement: true,
      blocksShots: true,
    },
  ];
  return arena;
}
it("finds a firing lane around a wall over multiple legal moves, including initially moving away", () => {
  const arena = room(),
    target = { x: 15, y: 11 };
  let from = { x: 5, y: 11 };
  const first = walkToStructuralSight({ arena, cover: {}, from, target, squares: 3 });
  expect(first.metres).toBeGreaterThan(0);
  expect(Math.hypot(first.position.x - target.x, first.position.y - target.y)).toBeGreaterThan(10);
  for (let i = 0; i < 12 && structuresBetween(arena, from, target).length; i++) {
    const step = walkToStructuralSight({
      arena,
      cover: {},
      from,
      target,
      squares: 3,
      occupied: [target],
    });
    expect(routeMetres(step.path)).toBeLessThanOrEqual(6.01);
    for (const p of step.path)
      expect(blockedTiles(arena, {}).has(tileKey(tileOf(arena, p)))).toBe(false);
    from = step.position;
  }
  expect(structuresBetween(arena, from, target)).toEqual([]);
});
it("does not promise a shot through an indestructible wall to the player's capability gate", () => {
  const arena = room();
  const live = {
    arena: arena.key,
    layout: { version: 2, arena },
    cover: { wall: 100000 },
    state: {
      status: "active",
      combatants: {
        p: { id: "p", isPlayer: true },
        h: { id: "h", name: "Enemy", isPlayer: false, defeated: false },
      },
    },
    data: { p: { position: { x: 5, y: 11 } }, h: { key: "enemy", position: { x: 15, y: 11 } } },
  } as unknown as LiveEncounter;
  expect(targetCapabilities(live)[0]).toMatchObject({
    perceivable: false,
    coverLabel: "Warehouse wall",
  });
  expect(targetCapabilities(live, { x: 15, y: 3 })[0]).toMatchObject({ perceivable: true });
});
it("can model a permanent fence that blocks movement but not shots", () => {
  const arena = room();
  arena.environment!.structures[0]!.blocksShots = false;
  expect(structuresBetween(arena, { x: 5, y: 11 }, { x: 15, y: 11 })).toEqual([]);
  expect(blockedTiles(arena, {}).has(tileKey(tileOf(arena, { x: 9, y: 11 })))).toBe(true);
});
