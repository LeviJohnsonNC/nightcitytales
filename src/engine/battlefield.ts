/**
 * Where everybody is standing, in metres.
 *
 * This exists because of one line that used to be in the GM's system prompt:
 * "Always state a distance — the engine reads the printed Range DV table with
 * it." Range IS the DV. A model that wrote 8m made the shot DV 15; the same
 * shot at 30m is DV 30. Every die was honest, every table was the printed one,
 * and the difficulty of the fight was chosen by the narrator in the moment,
 * invisibly. This module takes that away: distance is MEASURED between two
 * positions the engine placed and the engine moves.
 *
 * Positions are continuous metres rather than grid squares on purpose. RED's
 * range bands are 6/12/25/50/100/200/400/800 and MOVE is a raw metre score, so
 * a 2m grid would quantise both — MOVE 6 becomes 3 tiles, MOVE 7 becomes three
 * and a half. A UI is free to draw squares over this; the numbers underneath
 * stay the printed ones.
 *
 * Pure: no React, no backend, no randomness that is not handed in.
 */
import { SINGLE_SHOT_DV, RANGE_BAND_MAX, singleShotDV, type WeaponRangeType } from "./combatTables";

export type Point = { x: number; y: number };

/** Straight-line metres between two positions. */
export function metresBetween(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * The distance a Range DV is read at.
 *
 * Rounded to whole metres because the printed table is a step function on whole
 * metres: 6.0001m is band 1 and 6m is band 0, and nobody at a table has ever
 * measured a firefight to the centimetre.
 */
export function rangeMetres(a: Point, b: Point): number {
  return Math.round(metresBetween(a, b));
}

// ---------------------------------------------------------------------------
// Arenas — the closed list of places a fight happens.
// ---------------------------------------------------------------------------

/**
 * A place, with somewhere for the character to start and slots for whoever is
 * shooting at them.
 *
 * Hand-authored rather than generated, and deliberately varied in scale: a
 * shotgun in a club and a rifle on a rooftop should be different problems, and
 * they only are if the opening distances differ by more than flavour text.
 * #09 generates these from the mission seed; the shape does not change.
 */
export type Arena = {
  key: string;
  label: string;
  /** The ground, in metres. Positions are clamped to it. */
  extent: { width: number; height: number };
  /** Where the character comes in. */
  playerStart: Point;
  /** Where hostiles stand, in order. Cycled when there are more of them. */
  hostileSlots: Point[];
};

export const ARENAS: Arena[] = [
  {
    key: "alley",
    label: "a service alley",
    extent: { width: 12, height: 40 },
    playerStart: { x: 6, y: 2 },
    hostileSlots: [
      { x: 5, y: 11 },
      { x: 8, y: 15 },
      { x: 4, y: 19 },
      { x: 7, y: 24 },
    ],
  },
  {
    key: "club_interior",
    label: "the floor of a club",
    extent: { width: 26, height: 26 },
    playerStart: { x: 13, y: 3 },
    hostileSlots: [
      { x: 9, y: 8 },
      { x: 17, y: 9 },
      { x: 13, y: 13 },
      { x: 20, y: 16 },
      { x: 6, y: 15 },
    ],
  },
  {
    key: "warehouse",
    label: "a warehouse floor",
    extent: { width: 45, height: 60 },
    playerStart: { x: 22, y: 4 },
    hostileSlots: [
      { x: 14, y: 20 },
      { x: 30, y: 24 },
      { x: 22, y: 33 },
      { x: 8, y: 30 },
      { x: 37, y: 36 },
    ],
  },
  {
    key: "street",
    label: "an open street",
    extent: { width: 30, height: 90 },
    playerStart: { x: 15, y: 5 },
    hostileSlots: [
      { x: 10, y: 27 },
      { x: 21, y: 33 },
      { x: 15, y: 44 },
      { x: 5, y: 39 },
      { x: 25, y: 50 },
    ],
  },
  {
    key: "parking_structure",
    label: "a parking structure",
    extent: { width: 40, height: 50 },
    playerStart: { x: 20, y: 4 },
    hostileSlots: [
      { x: 12, y: 16 },
      { x: 28, y: 21 },
      { x: 20, y: 28 },
      { x: 34, y: 31 },
    ],
  },
  {
    key: "rooftop",
    label: "a rooftop",
    extent: { width: 60, height: 120 },
    playerStart: { x: 30, y: 6 },
    hostileSlots: [
      { x: 20, y: 40 },
      { x: 42, y: 52 },
      { x: 30, y: 70 },
      { x: 10, y: 62 },
      { x: 52, y: 88 },
    ],
  },
  {
    key: "open_ground",
    label: "open ground",
    extent: { width: 50, height: 70 },
    playerStart: { x: 25, y: 5 },
    hostileSlots: [
      { x: 17, y: 22 },
      { x: 33, y: 27 },
      { x: 25, y: 36 },
      { x: 9, y: 32 },
      { x: 41, y: 42 },
    ],
  },
];

/** The arena used when nothing named one. Neutral ground at ordinary ranges. */
export const DEFAULT_ARENA_KEY = "open_ground";

/** Every arena key, for building the model's closed list from the data itself. */
export const ARENA_KEYS: string[] = ARENAS.map((a) => a.key);

export function isArenaKey(value: unknown): value is string {
  return typeof value === "string" && ARENA_KEYS.includes(value);
}

/** The named arena, falling back to open ground rather than throwing. */
export function arenaFor(key: string | null | undefined): Arena {
  const found = ARENAS.find((a) => a.key === key);
  if (found) return found;
  const fallback = ARENAS.find((a) => a.key === DEFAULT_ARENA_KEY);
  if (!fallback) throw new Error("battlefield: the default arena is missing.");
  return fallback;
}

/** Keep a position on the ground. */
export function clampToArena(arena: Arena, point: Point): Point {
  return {
    x: Math.min(Math.max(0, point.x), arena.extent.width),
    y: Math.min(Math.max(0, point.y), arena.extent.height),
  };
}

/**
 * Where each hostile stands at the top of the fight.
 *
 * Deterministic, and it cycles rather than running out: a sixth attacker in a
 * four-slot alley stands behind the second one instead of on top of them.
 */
export function placeHostiles(arena: Arena, count: number): Point[] {
  const out: Point[] = [];
  const slots = arena.hostileSlots;
  if (slots.length === 0) return out;
  for (let i = 0; i < Math.max(0, Math.trunc(count)); i += 1) {
    const slot = slots[i % slots.length]!;
    const lap = Math.floor(i / slots.length);
    // Each lap stands a couple of metres further back and a metre across, so
    // stacked hostiles are near each other without sharing a position.
    out.push(clampToArena(arena, { x: slot.x + lap, y: slot.y + lap * 3 }));
  }
  return out;
}

// ---------------------------------------------------------------------------
// Where a weapon wants to be fired from.
// ---------------------------------------------------------------------------

/**
 * The distance this weapon is best at, read off its own printed DV table.
 *
 * Not a judgement call: it is the FURTHEST distance at the weapon's lowest
 * printed DV. Furthest, because at equal difficulty a shooter would rather be
 * further away. A pistol wants 6m and a sniper rifle wants 100m, and neither
 * number is written down anywhere here — they fall out of the table in
 * combatTables.ts, which means they cannot drift from the rules.
 */
export function preferredRange(type: WeaponRangeType): number {
  const dvs = SINGLE_SHOT_DV[type];
  let bestBand = -1;
  let bestDv = Number.POSITIVE_INFINITY;
  for (let band = 0; band < dvs.length; band += 1) {
    const dv = dvs[band];
    if (dv === null || dv === undefined) continue;
    // A later band that ties the minimum replaces the earlier one, which is
    // what makes this the FURTHEST distance at the best DV rather than the
    // nearest — at equal difficulty, a shooter would rather be further away.
    if (dv < bestDv) {
      bestDv = dv;
      bestBand = band;
    } else if (dv === bestDv) {
      bestBand = band;
    }
  }
  if (bestBand < 0) throw new Error(`preferredRange: "${type}" has no printed DV at any range.`);
  return RANGE_BAND_MAX[bestBand]!;
}

// ---------------------------------------------------------------------------
// Moving.
// ---------------------------------------------------------------------------

export type MoveResult = {
  position: Point;
  /** Metres actually covered, which is what the Move allowance is spent on. */
  metres: number;
};

/** Step from one point toward another, stopping when the allowance runs out. */
export function moveToward(from: Point, to: Point, allowance: number): MoveResult {
  const gap = metresBetween(from, to);
  const budget = Math.max(0, allowance);
  if (gap <= 0.0001 || budget <= 0) return { position: { ...from }, metres: 0 };
  if (gap <= budget) return { position: { ...to }, metres: Math.round(gap) };
  const ratio = budget / gap;
  return {
    position: { x: from.x + (to.x - from.x) * ratio, y: from.y + (to.y - from.y) * ratio },
    metres: Math.round(budget),
  };
}

/**
 * Step along the line between two people until the distance between them is
 * `wanted`, spending at most `allowance` metres.
 *
 * Backing off as well as closing: a shotgunner at 40m wants to be much nearer,
 * and somebody with a sniper rifle who has been walked up on wants the opposite.
 */
export function stepToRange(
  from: Point,
  target: Point,
  wanted: number,
  allowance: number,
): MoveResult {
  const gap = metresBetween(from, target);
  const budget = Math.max(0, allowance);
  if (budget <= 0 || gap <= 0.0001) return { position: { ...from }, metres: 0 };

  // How far along the line we need to travel, positive toward the target.
  const travel = Math.min(Math.abs(gap - wanted), budget);
  if (travel <= 0.0001) return { position: { ...from }, metres: 0 };
  const direction = gap > wanted ? 1 : -1;
  const ratio = (direction * travel) / gap;
  return {
    position: { x: from.x + (target.x - from.x) * ratio, y: from.y + (target.y - from.y) * ratio },
    metres: Math.round(travel),
  };
}

export type TacticalStep = {
  position: Point;
  metres: number;
  /** The Range DV before and after, which is the entire reason to move. */
  dvBefore: number | null;
  dvAfter: number | null;
};

/**
 * Where a hostile should stand, decided by the engine and nothing else.
 *
 * Deliberately not clever, and deliberately not the model's: it moves toward
 * the distance its own weapon shoots best at, and ONLY if getting there makes
 * the shot easier. Everything about who to shoot, when to run and whether to
 * beg is #07's problem. This is here because positions without movement would
 * leave hostiles standing in the street while the player walks away, which
 * reads worse than the static fights it replaces.
 */
export function tacticalStep(input: {
  from: Point;
  target: Point;
  rangeType: WeaponRangeType;
  allowance: number;
  arena: Arena;
}): TacticalStep {
  const before = rangeMetres(input.from, input.target);
  const dvBefore = singleShotDV(input.rangeType, before);
  const wanted = preferredRange(input.rangeType);
  const bestDv = singleShotDV(input.rangeType, wanted);

  // Stand still once the shot is already as easy as this weapon gets. The test
  // is the BAND, not this one step: asking "does moving 8m lower the DV" makes
  // a pistol shooter at 40m stand in the street forever, because no single
  // Move crosses a band boundary from there. Comparing against the best the
  // weapon can do instead means they close over several Rounds and then stop.
  if (dvBefore !== null && bestDv !== null && dvBefore <= bestDv) {
    return { position: { ...input.from }, metres: 0, dvBefore, dvAfter: dvBefore };
  }

  const step = stepToRange(input.from, input.target, wanted, input.allowance);
  const position = clampToArena(input.arena, step.position);
  const metres = Math.round(metresBetween(input.from, position));
  if (metres <= 0) {
    return { position: { ...input.from }, metres: 0, dvBefore, dvAfter: dvBefore };
  }
  return {
    position,
    metres,
    dvBefore,
    dvAfter: singleShotDV(input.rangeType, rangeMetres(position, input.target)),
  };
}
