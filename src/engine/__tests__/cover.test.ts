/**
 * Cover: the geometry that decides whether there is a shot, and the rules that
 * decide how long that stays true.
 *
 * The property these pin down is that cover is BINARY and MEASURED. It never
 * becomes a modifier on the dice — inventing a "-2 for cover" would put a
 * number nobody printed into a roll, which is the failure engine/battlefield.ts
 * and data/rules/threats.json exist to prevent.
 */
import { describe, expect, it } from "vitest";
import {
  ARENAS,
  COVER_MATERIALS,
  applyCoverDamage,
  arenaFor,
  coverBetween,
  coverBlocking,
  coverDamageFrom,
  coverDestroyed,
  coverHpRemaining,
  coverMaterial,
  coverMaxHp,
  coverStatuses,
  hasLineOfSight,
  rectContains,
  segmentIntersectsRect,
  type Arena,
  type CoverPiece,
} from "@/engine";

const WALL: CoverPiece = {
  id: "wall",
  label: "a concrete wall",
  material: "concrete",
  rect: { x: 4, y: 4, width: 4, height: 2 },
};

/** A small square arena with one wall across the middle. */
const ROOM: Arena = {
  key: "test_room",
  label: "a test room",
  extent: { width: 12, height: 12 },
  playerStart: { x: 6, y: 1 },
  hostileSlots: [{ x: 6, y: 10 }],
  cover: [WALL],
};

describe("cover geometry", () => {
  it("blocks a line that crosses the box", () => {
    expect(segmentIntersectsRect({ x: 6, y: 1 }, { x: 6, y: 10 }, WALL.rect)).toBe(true);
  });

  it("lets a line past the edge of the box through", () => {
    // Down the side of the room: the wall spans x 4..8, this runs at x 1.
    expect(segmentIntersectsRect({ x: 1, y: 1 }, { x: 1, y: 10 }, WALL.rect)).toBe(false);
  });

  it("does not block a line that stops short of the box", () => {
    expect(segmentIntersectsRect({ x: 6, y: 1 }, { x: 6, y: 3 }, WALL.rect)).toBe(false);
  });

  it("does not block a line that starts past the box", () => {
    expect(segmentIntersectsRect({ x: 6, y: 7 }, { x: 6, y: 10 }, WALL.rect)).toBe(false);
  });

  it("knows what is inside the box", () => {
    expect(rectContains(WALL.rect, { x: 5, y: 5 })).toBe(true);
    expect(rectContains(WALL.rect, { x: 5, y: 9 })).toBe(false);
  });

  it("never blocks somebody standing at their own cover", () => {
    // Crouched against the wall, shooting over it: the piece you are using is
    // not the piece that stops you.
    const atTheWall = { x: 5, y: 5 };
    expect(coverBetween(ROOM, atTheWall, { x: 6, y: 10 })).toEqual([]);
    expect(hasLineOfSight(ROOM, atTheWall, { x: 6, y: 10 })).toBe(true);
  });

  it("has no opinion about a zero-length line", () => {
    expect(segmentIntersectsRect({ x: 5, y: 5 }, { x: 5, y: 5 }, WALL.rect)).toBe(false);
  });

  it("reports the piece that is in the way", () => {
    const blocking = coverBetween(ROOM, { x: 6, y: 1 }, { x: 6, y: 10 });
    expect(blocking.map((p) => p.id)).toEqual(["wall"]);
    expect(hasLineOfSight(ROOM, { x: 6, y: 1 }, { x: 6, y: 10 })).toBe(false);
  });

  it("stops blocking once the piece is gone", () => {
    expect(hasLineOfSight(ROOM, { x: 6, y: 1 }, { x: 6, y: 10 }, () => true)).toBe(true);
  });

  it("leaves open ground open", () => {
    const open = arenaFor("open_ground");
    expect(open.cover ?? []).toEqual([]);
    expect(hasLineOfSight(open, open.playerStart, open.hostileSlots[0]!)).toBe(true);
  });
});

describe("authored arenas", () => {
  it("gives every cover piece a real material and a positive footprint", () => {
    for (const arena of ARENAS) {
      for (const piece of arena.cover ?? []) {
        expect(COVER_MATERIALS.map((m) => m.key)).toContain(piece.material);
        expect(piece.rect.width).toBeGreaterThan(0);
        expect(piece.rect.height).toBeGreaterThan(0);
      }
    }
  });

  it("keeps cover ids unique within an arena", () => {
    for (const arena of ARENAS) {
      const ids = (arena.cover ?? []).map((p) => p.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("never starts anybody standing inside cover", () => {
    // A combatant inside a piece is degenerate: their own cover would be
    // ignored for every shot, in both directions.
    for (const arena of ARENAS) {
      for (const piece of arena.cover ?? []) {
        expect(rectContains(piece.rect, arena.playerStart)).toBe(false);
        for (const slot of arena.hostileSlots) {
          expect(rectContains(piece.rect, slot)).toBe(false);
        }
      }
    }
  });

  it("keeps every piece on the ground it is standing on", () => {
    for (const arena of ARENAS) {
      for (const piece of arena.cover ?? []) {
        expect(piece.rect.x).toBeGreaterThanOrEqual(0);
        expect(piece.rect.y).toBeGreaterThanOrEqual(0);
        expect(piece.rect.x + piece.rect.width).toBeLessThanOrEqual(arena.extent.width);
        expect(piece.rect.y + piece.rect.height).toBeLessThanOrEqual(arena.extent.height);
      }
    }
  });
});

describe("cover materials", () => {
  it("falls back rather than throwing on a key nobody authored", () => {
    expect(coverMaterial("not_a_material").key).toBe("crate");
  });

  it("makes concrete outlast the vending machine", () => {
    const concrete = coverMaterial("concrete");
    const machine = coverMaterial("machine");
    expect(concrete.hp).toBeGreaterThan(machine.hp);
    expect(concrete.sp).toBeGreaterThan(machine.sp);
  });
});

describe("shooting cover apart", () => {
  it("eats damage up to its SP without shortening its life", () => {
    const sp = coverMaterial("concrete").sp;
    const hit = applyCoverDamage(WALL, {}, sp);
    expect(hit.through).toBe(0);
    expect(hit.absorbed).toBe(sp);
    expect(hit.hpAfter).toBe(coverMaxHp(WALL));
    expect(hit.destroyed).toBe(false);
  });

  it("takes the remainder off its HP", () => {
    const sp = coverMaterial("concrete").sp;
    const hit = applyCoverDamage(WALL, {}, sp + 6);
    expect(hit.through).toBe(6);
    expect(hit.hpAfter).toBe(coverMaxHp(WALL) - 6);
    expect(hit.damage["wall"]).toBe(6);
  });

  it("accumulates damage across hits and then is gone", () => {
    let damage = {};
    for (let i = 0; i < 40; i += 1) {
      damage = applyCoverDamage(WALL, damage, 100).damage;
      if (coverDestroyed(WALL, damage)) break;
    }
    expect(coverDestroyed(WALL, damage)).toBe(true);
    expect(coverHpRemaining(WALL, damage)).toBe(0);
    // And a destroyed piece stops standing in the way.
    expect(coverBlocking(ROOM, { x: 6, y: 1 }, { x: 6, y: 10 }, damage)).toEqual([]);
  });

  it("never drops below zero HP however hard it is hit", () => {
    const hit = applyCoverDamage(WALL, {}, 10_000);
    expect(hit.hpAfter).toBe(0);
    expect(coverHpRemaining(WALL, hit.damage)).toBe(0);
  });
});

describe("reading persisted damage", () => {
  it("drops ids the arena does not have", () => {
    // The database validated shape and sign; it cannot know which ids are real.
    expect(coverDamageFrom(ROOM, { wall: 5, invented: 99 })).toEqual({ wall: 5 });
  });

  it("refuses junk instead of trusting it into a fight", () => {
    expect(coverDamageFrom(ROOM, { wall: -4 })).toEqual({});
    expect(coverDamageFrom(ROOM, { wall: "lots" })).toEqual({});
    expect(coverDamageFrom(ROOM, null)).toEqual({});
    expect(coverDamageFrom(ROOM, [1, 2, 3])).toEqual({});
  });

  it("caps damage at what the material can take", () => {
    // Retuning a material downward must not leave a stored fight owing more
    // damage than the piece has HP.
    expect(coverDamageFrom(ROOM, { wall: 10_000 })).toEqual({ wall: coverMaxHp(WALL) });
  });
});

describe("the read model", () => {
  it("reports what each piece is currently worth", () => {
    const damage = applyCoverDamage(WALL, {}, coverMaterial("concrete").sp + 10).damage;
    const [status] = coverStatuses(ROOM, damage);
    expect(status).toMatchObject({
      label: "a concrete wall",
      material: "concrete",
      hp: coverMaxHp(WALL) - 10,
      hpMax: coverMaxHp(WALL),
      destroyed: false,
    });
  });

  it("is empty for ground with nothing on it", () => {
    expect(coverStatuses(arenaFor("open_ground"), {})).toEqual([]);
  });
});
