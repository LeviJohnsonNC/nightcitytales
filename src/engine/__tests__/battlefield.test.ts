import { describe, expect, it } from "vitest";
import {
  ARENAS,
  ARENA_KEYS,
  DEFAULT_ARENA_KEY,
  arenaFor,
  clampToArena,
  isArenaKey,
  metresBetween,
  moveToward,
  placeHostiles,
  preferredRange,
  rangeMetres,
  singleShotDV,
  stepToRange,
  tacticalStep,
  type WeaponRangeType,
} from "@/engine";

describe("measuring", () => {
  it("measures a straight line", () => {
    expect(metresBetween({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });

  it("is zero for the same spot, and symmetric", () => {
    const a = { x: 7, y: 2 };
    const b = { x: 19, y: 40 };
    expect(metresBetween(a, a)).toBe(0);
    expect(metresBetween(a, b)).toBeCloseTo(metresBetween(b, a));
  });

  it("rounds to whole metres for the table, because the table is a step", () => {
    // 6m is band 0 and 6.5m is band 1. Reading DVs off a float would make the
    // band depend on arithmetic nobody can see.
    expect(rangeMetres({ x: 0, y: 0 }, { x: 6.4, y: 0 })).toBe(6);
    expect(rangeMetres({ x: 0, y: 0 }, { x: 6.6, y: 0 })).toBe(7);
  });
});

describe("arenas", () => {
  it("has a unique key for every arena", () => {
    expect(new Set(ARENA_KEYS).size).toBe(ARENAS.length);
  });

  it("starts every fight inside its own ground", () => {
    for (const arena of ARENAS) {
      expect(clampToArena(arena, arena.playerStart)).toEqual(arena.playerStart);
      for (const slot of arena.hostileSlots) {
        expect(clampToArena(arena, slot)).toEqual(slot);
      }
    }
  });

  it("gives every arena somewhere for hostiles to stand", () => {
    for (const arena of ARENAS) expect(arena.hostileSlots.length).toBeGreaterThan(0);
  });

  it("never starts anybody already on top of the character", () => {
    // An opening distance of nothing would be a knife fight the fiction never
    // described, and would read a melee DV off a rifle.
    for (const arena of ARENAS) {
      for (const slot of arena.hostileSlots) {
        expect(metresBetween(arena.playerStart, slot)).toBeGreaterThan(2);
      }
    }
  });

  it("puts fights at genuinely different scales", () => {
    // The whole point of a list rather than one arena: a club and a rooftop
    // must not open at the same range, or the choice is only flavour text.
    const opening = (key: string) => {
      const a = arenaFor(key);
      return metresBetween(a.playerStart, a.hostileSlots[0]!);
    };
    expect(opening("club_interior")).toBeLessThan(12);
    expect(opening("rooftop")).toBeGreaterThan(25);
  });

  it("falls back to open ground rather than throwing on an unknown key", () => {
    expect(arenaFor("a nightclub on the moon").key).toBe(DEFAULT_ARENA_KEY);
    expect(arenaFor(null).key).toBe(DEFAULT_ARENA_KEY);
    expect(arenaFor(undefined).key).toBe(DEFAULT_ARENA_KEY);
  });

  it("knows its own keys", () => {
    expect(isArenaKey("alley")).toBe(true);
    expect(isArenaKey("moon_base")).toBe(false);
    expect(isArenaKey(7)).toBe(false);
  });
});

describe("placing hostiles", () => {
  const arena = arenaFor("alley");

  it("puts each one in its own slot", () => {
    const spots = placeHostiles(arena, 3);
    expect(spots).toEqual(arena.hostileSlots.slice(0, 3));
  });

  it("is deterministic", () => {
    expect(placeHostiles(arena, 4)).toEqual(placeHostiles(arena, 4));
  });

  it("does not stack two people on one spot when it runs out of slots", () => {
    const spots = placeHostiles(arena, arena.hostileSlots.length * 2);
    const seen = new Set(spots.map((p) => `${p.x},${p.y}`));
    expect(seen.size).toBe(spots.length);
  });

  it("keeps everyone on the ground even when it runs out of slots", () => {
    for (const spot of placeHostiles(arena, 20)) {
      expect(clampToArena(arena, spot)).toEqual(spot);
    }
  });

  it("places nobody for a fight with no hostiles", () => {
    expect(placeHostiles(arena, 0)).toEqual([]);
    expect(placeHostiles(arena, -3)).toEqual([]);
  });
});

describe("preferredRange", () => {
  const TYPES: WeaponRangeType[] = [
    "pistol",
    "smg",
    "shotgun_slug",
    "assault_rifle",
    "sniper_rifle",
    "bow_crossbow",
    "grenade_launcher",
    "rocket_launcher",
  ];

  it("is the distance with the weapon's lowest printed DV", () => {
    for (const type of TYPES) {
      const best = singleShotDV(type, preferredRange(type));
      expect(best).not.toBeNull();
      for (const metres of [1, 6, 12, 25, 50, 100, 200, 400, 800]) {
        const dv = singleShotDV(type, metres);
        if (dv !== null) expect(dv).toBeGreaterThanOrEqual(best!);
      }
    }
  });

  it("takes the furthest distance when two bands tie", () => {
    // A shooter at equal difficulty would rather be further away.
    expect(preferredRange("shotgun_slug")).toBe(6);
    expect(preferredRange("sniper_rifle")).toBe(100);
  });

  it("reads as the weapon it is", () => {
    // Not asserted values pulled from thin air: a pistol is a close-range
    // weapon and a sniper rifle is not, and the printed table agrees.
    expect(preferredRange("pistol")).toBeLessThan(preferredRange("assault_rifle"));
    expect(preferredRange("assault_rifle")).toBeLessThan(preferredRange("sniper_rifle"));
  });
});

describe("moving", () => {
  const origin = { x: 0, y: 0 };

  it("arrives when the allowance covers the gap", () => {
    expect(moveToward(origin, { x: 3, y: 4 }, 10)).toEqual({ position: { x: 3, y: 4 }, metres: 5 });
  });

  it("stops short when it does not", () => {
    const step = moveToward(origin, { x: 10, y: 0 }, 4);
    expect(step.position).toEqual({ x: 4, y: 0 });
    expect(step.metres).toBe(4);
  });

  it("never spends more than the allowance", () => {
    for (const allowance of [0, 1, 6, 9, 30]) {
      expect(moveToward(origin, { x: 100, y: 0 }, allowance).metres).toBeLessThanOrEqual(allowance);
    }
  });

  it("does nothing on no allowance, or when already there", () => {
    expect(moveToward(origin, { x: 10, y: 0 }, 0).metres).toBe(0);
    expect(moveToward(origin, origin, 10).metres).toBe(0);
    expect(moveToward(origin, { x: 10, y: 0 }, -5).metres).toBe(0);
  });
});

describe("stepToRange", () => {
  const me = { x: 0, y: 0 };
  const them = { x: 40, y: 0 };

  it("closes when it is too far", () => {
    const step = stepToRange(me, them, 6, 10);
    expect(step.position.x).toBeCloseTo(10);
    expect(step.metres).toBe(10);
  });

  it("backs off when it is too close", () => {
    const step = stepToRange({ x: 36, y: 0 }, them, 25, 8);
    expect(step.position.x).toBeCloseTo(28);
    expect(metresBetween(step.position, them)).toBeCloseTo(12);
  });

  it("stops at the range it wanted rather than overshooting", () => {
    const step = stepToRange(me, them, 25, 100);
    expect(metresBetween(step.position, them)).toBeCloseTo(25);
  });

  it("stands still when it is already at the range it wants", () => {
    expect(stepToRange({ x: 34, y: 0 }, them, 6, 10).metres).toBe(0);
  });
});

describe("tacticalStep", () => {
  const arena = arenaFor("street");

  it("closes with a pistol, even when one step is not enough to help yet", () => {
    // 40m with a pistol is DV 25 and one Move of 8m lands at 32m, still DV 25.
    // Asking "does THIS step lower the DV" would leave them standing there for
    // the rest of the fight; asking "am I in my best band" walks them in.
    const from = { x: 15, y: 45 };
    const target = { x: 15, y: 5 };
    const step = tacticalStep({ from, target, rangeType: "pistol", allowance: 8, arena });
    expect(step.metres).toBe(8);
    expect(step.dvAfter).toBe(step.dvBefore);
    expect(metresBetween(step.position, target)).toBeLessThan(metresBetween(from, target));
  });

  it("gets the DV down eventually, which is the point of walking", () => {
    let position = { x: 15, y: 45 };
    const target = { x: 15, y: 5 };
    const opening = singleShotDV("pistol", rangeMetres(position, target));
    for (let round = 0; round < 6; round += 1) {
      position = tacticalStep({
        from: position,
        target,
        rangeType: "pistol",
        allowance: 8,
        arena,
      }).position;
    }
    expect(singleShotDV("pistol", rangeMetres(position, target))!).toBeLessThan(opening!);
  });

  it("stands still when moving would not make the shot easier", () => {
    // Already inside a pistol's best band: shuffling around inside it is noise
    // in the log and a lie in the narration.
    const step = tacticalStep({
      from: { x: 15, y: 9 },
      target: { x: 15, y: 5 },
      rangeType: "pistol",
      allowance: 8,
      arena,
    });
    expect(step.metres).toBe(0);
    expect(step.position).toEqual({ x: 15, y: 9 });
  });

  it("never spends more than its MOVE", () => {
    for (const allowance of [1, 4, 6, 9]) {
      const step = tacticalStep({
        from: { x: 15, y: 80 },
        target: { x: 15, y: 5 },
        rangeType: "pistol",
        allowance,
        arena,
      });
      expect(step.metres).toBeLessThanOrEqual(allowance);
    }
  });

  it("closes out of a range with no printed DV at all", () => {
    // A pistol past 200m has no printed DV, so the engine cannot roll one and
    // will not invent one. Walking forward is strictly better than standing in
    // a place the rules cannot resolve.
    const plain = {
      key: "test_range",
      label: "a very long field",
      extent: { width: 20, height: 600 },
      playerStart: { x: 10, y: 5 },
      hostileSlots: [{ x: 10, y: 400 }],
    };
    const step = tacticalStep({
      from: { x: 10, y: 400 },
      target: { x: 10, y: 5 },
      rangeType: "pistol",
      allowance: 9,
      arena: plain,
    });
    expect(step.dvBefore).toBeNull();
    expect(step.metres).toBe(9);
  });

  it("stays on the ground", () => {
    const step = tacticalStep({
      from: { x: 15, y: 40 },
      target: { x: 15, y: 5 },
      rangeType: "sniper_rifle",
      allowance: 60,
      arena,
    });
    expect(clampToArena(arena, step.position)).toEqual(step.position);
  });

  it("converges rather than oscillating round after round", () => {
    // A hostile that closes then backs off then closes again would look broken
    // and would spend a Move every Round achieving nothing.
    let position = { x: 15, y: 70 };
    const target = { x: 15, y: 5 };
    const moves: number[] = [];
    for (let round = 0; round < 12; round += 1) {
      const step = tacticalStep({ from: position, target, rangeType: "smg", allowance: 8, arena });
      position = step.position;
      moves.push(step.metres);
    }
    expect(moves.at(-1)).toBe(0);
    // Once it stops, it stays stopped.
    expect(moves.slice(moves.indexOf(0)).every((m) => m === 0)).toBe(true);
  });
});
