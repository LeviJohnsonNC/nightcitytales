import { describe, expect, it } from "vitest";
import {
  arenaFor,
  coverMaxHp,
  battlefieldFor,
  northHeywoodScene,
  readBattlefieldSnapshot,
  snapshotBattlefield,
  reachableTiles,
  tileOf,
  tileKey,
  encounterEndEventData,
  readSceneCombatEnd,
} from "../index";

describe("frozen scene geometry", () => {
  it("keeps geometry and HP when a template is edited after entry", () => {
    const arena = structuredClone(arenaFor("night_shift_grid"));
    const snapshot = snapshotBattlefield(arena);
    const first = snapshot.arena.cover![0]!;
    const hp = coverMaxHp(first);
    arena.cover![0]!.rect.x += 2;
    arena.cover![0]!.material = "wood";
    const restored = readBattlefieldSnapshot(JSON.parse(JSON.stringify(snapshot)));
    expect(restored).toEqual(snapshot);
    expect(restored.arena.cover![0]!.rect.x).not.toBe(arena.cover![0]!.rect.x);
    expect(coverMaxHp({ ...first, material: "wood" })).toBe(hp);
    expect(battlefieldFor({ arena: "open_ground", layout: restored })).toEqual(snapshot.arena);
  });

  it("keeps the legacy arena path for rows without a snapshot", () => {
    expect(battlefieldFor({ arena: "street" })).toBe(arenaFor("street"));
  });

  it.each([
    (s: ReturnType<typeof snapshotBattlefield>) => {
      s.version = 2 as 1;
    },
    (s: ReturnType<typeof snapshotBattlefield>) => {
      s.arena.extent.width = Infinity;
    },
    (s: ReturnType<typeof snapshotBattlefield>) => {
      s.arena.playerStart.x = 0;
    },
    (s: ReturnType<typeof snapshotBattlefield>) => {
      s.arena.cover![0]!.maxHp = -1;
    },
    (s: ReturnType<typeof snapshotBattlefield>) => {
      s.arena.cover!.push({ ...s.arena.cover![0]! });
    },
    (s: ReturnType<typeof snapshotBattlefield>) => {
      s.arena.hostileSlots.push(s.arena.playerStart);
    },
  ])("rejects malformed layouts instead of switching to open ground", (corrupt) => {
    const snapshot = northHeywoodScene().layout;
    corrupt(snapshot);
    expect(() => readBattlefieldSnapshot(snapshot)).toThrow();
  });
});

describe("North Heywood fixture", () => {
  it("has stable people and objects, correct weapons, and reachable unoccupied spawns", () => {
    const scene = northHeywoodScene();
    expect(northHeywoodScene()).toEqual(scene);
    expect(scene.actors.filter((a) => a.side === "neutral")).toHaveLength(2);
    expect(scene.actors.find((a) => a.id === "rifle_ganger")?.profile?.weaponName).toBe(
      "Assault Rifle",
    );
    const arena = scene.layout.arena;
    expect(arena.cover?.some((c) => c.id.startsWith("thorton_"))).toBe(true);
    expect(arena.cover?.some((c) => c.id.startsWith("broth_cart_"))).toBe(true);
    expect(() =>
      readBattlefieldSnapshot({
        ...scene.layout,
        arena: { ...arena, hostileSlots: scene.actors.map((a) => a.position) },
      }),
    ).not.toThrow();
    const field = reachableTiles({
      arena,
      cover: {},
      from: tileOf(arena, arena.playerStart),
      allowance: 100,
    });
    for (const actor of scene.actors)
      expect(field.has(tileKey(tileOf(arena, actor.position)))).toBe(true);
  });
});

it("returns named casualties, withdrawals and damaged objects without treating zero HP as death", async () => {
  const { battlefieldResult, battlefieldResultText } = await import("../battlefieldResult");
  const arena = northHeywoodScene().layout.arena;
  const actor = {
    hp: 0,
    woundState: "mortal",
    position: { x: 3, y: 3 },
    side: "hostile",
    isPlayer: false,
  };
  const result = battlefieldResult({
    arena,
    cover: { [arena.cover![0]!.id]: 100 },
    state: {
      status: "friendlies_won",
      round: 3,
      order: [],
      activeIndex: 0,
      combatants: {
        dead: { ...actor, id: "dead", name: "Dead ganger", defeated: true },
        fled: { ...actor, id: "fled", name: "Lookout", defeated: true },
        p: { ...actor, id: "p", name: "Player", side: "friendly", isPlayer: true, defeated: false },
      },
    } as never,
    data: {
      dead: { key: "rifle_ganger", position: { x: 17, y: 9 }, exitReason: "dead" },
      fled: { key: "lookout", position: { x: 17, y: 13 }, exitReason: "withdrawn" },
      p: { key: "player", position: { x: 9, y: 19 } },
    },
  });
  expect(result.actors.find((a) => a.isPlayer)?.disposition).toBe("present");
  expect(result.objects[0]?.destroyed).toBe(true);
  const text = battlefieldResultText(result);
  expect(text).toContain("Dead ganger is dead");
  expect(text).toContain("Lookout has withdrawn");
  expect(text).toContain("Player remains here at 0 HP, mortally wounded");
  expect(text).not.toContain("Player is dead");
  const receipt = encounterEndEventData({
    encounterId: "fight",
    status: "friendlies_won",
    sceneResult: result,
  });
  expect(readSceneCombatEnd(JSON.parse(JSON.stringify(receipt)))).toEqual({ title: arena.label });
  expect(
    readSceneCombatEnd(encounterEndEventData({ encounterId: "legacy", status: "friendlies_won" })),
  ).toBeNull();
});
