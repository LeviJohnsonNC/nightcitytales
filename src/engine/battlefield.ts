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

/** An axis-aligned box on the ground, in metres. */
export type Rect = { x: number; y: number; width: number; height: number };

/**
 * One thing worth standing behind.
 *
 * Authored per arena, exactly as the arena itself is: the id is stable and the
 * geometry lives here, so a fight in progress reads its cover out of this file
 * rather than out of a row somebody could have written a different shape into.
 * Only the DAMAGE a piece has taken is persisted — see engine/cover.ts.
 */
export type CoverPiece = {
  /** Stable within its arena; what persisted damage is keyed by. */
  id: string;
  label: string;
  /** A material key from data/rules/cover.json. */
  material: string;
  /** Which column of the printed HP table this reads (CP:R pg. 182). */
  thickness: "thick" | "thin";
  /**
   * Its footprint, in metres.
   *
   * pg. 182 makes a 2 m by 2 m section the unit that "can be attacked just
   * like you can", so every authored piece is one such section and a longer
   * object is authored as several adjacent ones. COVER_SECTION_METRES is the
   * cap, and a test holds every arena to it.
   */
  rect: Rect;
  /** Intact footprint blocks walking unless explicitly authored as passable. */
  blocksMovement?: boolean;
};

/**
 * The size of one attackable section of cover (CP:R pg. 182).
 *
 * Authoring pieces at this size is what makes "one piece is one section" true
 * by construction, so nothing downstream has to subdivide a wall to work out
 * which part of it somebody just shot.
 */
export const COVER_SECTION_METRES = 2;

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
  /**
   * What is standing on the ground. Absent means open sightlines everywhere.
   *
   * Hostile slots are placed to USE this: an arena with cover puts its
   * attackers near it, so enemies benefit from cover without anybody writing
   * cover-seeking AI. Choosing WHERE to go is a later feature.
   */
  cover?: CoverPiece[];
};

export const ARENAS: Arena[] = [
  // A new key freezes the original courtyard for encounters already in progress.
  // Vehicle halves remain independent 2m RED sections, never one shared HP pool.
  {
    key: "night_shift_yard",
    label: "Night Shift courtyard",
    extent: { width: 24, height: 24 },
    playerStart: { x: 5, y: 5 },
    hostileSlots: [
      { x: 16, y: 15 },
      { x: 20, y: 10 },
      { x: 9, y: 19 },
    ],
    cover: [
      {
        id: "cargo_west",
        label: "a sealed cargo crate",
        material: "steel",
        thickness: "thin",
        rect: { x: 6, y: 10, width: 2, height: 2 },
      },
      {
        id: "generator",
        label: "a yellow generator housing",
        material: "steel",
        thickness: "thin",
        rect: { x: 12, y: 11, width: 2, height: 2 },
      },
      {
        id: "cargo_east",
        label: "an armored cargo crate",
        material: "steel",
        thickness: "thick",
        rect: { x: 17, y: 7, width: 2, height: 2 },
      },
      {
        id: "dumpster",
        label: "a loading bay dumpster",
        material: "steel",
        thickness: "thin",
        rect: { x: 10, y: 17, width: 2, height: 2 },
      },
      {
        id: "truck_cargo",
        label: "the delivery truck's cargo section",
        material: "steel",
        thickness: "thin",
        rect: { x: 12, y: 3, width: 2, height: 2 },
      },
      {
        id: "truck_cab",
        label: "the delivery truck's cab and engine block",
        material: "steel",
        thickness: "thick",
        rect: { x: 14, y: 3, width: 2, height: 2 },
      },
      {
        id: "concrete",
        label: "a concrete roadblock",
        material: "concrete",
        thickness: "thick",
        rect: { x: 8, y: 5, width: 2, height: 2 },
      },
      {
        id: "pallets",
        label: "a timber packing case on pallets",
        material: "wood",
        thickness: "thin",
        rect: { x: 4, y: 15, width: 2, height: 2 },
      },
    ],
  },
  {
    key: "night_shift",
    label: "Night Shift courtyard (original layout)",
    extent: { width: 24, height: 24 },
    playerStart: { x: 5, y: 5 },
    hostileSlots: [
      { x: 16, y: 15 },
      { x: 20, y: 10 },
      { x: 9, y: 19 },
    ],
    // Each crate is one RED cover section. Art reads these same footprints.
    cover: [
      {
        id: "cargo_west",
        label: "a sealed cargo crate",
        material: "steel",
        thickness: "thin",
        rect: { x: 6, y: 10, width: 2, height: 2 },
      },
      {
        id: "cargo_middle",
        label: "a freight crate",
        material: "steel",
        thickness: "thin",
        rect: { x: 12, y: 11, width: 2, height: 2 },
      },
      {
        id: "cargo_east",
        label: "an armored cargo crate",
        material: "steel",
        thickness: "thick",
        rect: { x: 17, y: 7, width: 2, height: 2 },
      },
      {
        id: "cargo_rear",
        label: "a loading bay crate",
        material: "steel",
        thickness: "thin",
        rect: { x: 10, y: 17, width: 2, height: 2 },
      },
    ],
  },
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
    cover: [
      // A dumpster is thin steel, the way the book files a refrigerator.
      {
        id: "dumpster",
        label: "a dumpster",
        material: "steel",
        thickness: "thin",
        rect: { x: 1.5, y: 8, width: 2, height: 2 },
      },
      {
        id: "pallets",
        label: "a stack of pallets",
        material: "wood",
        thickness: "thin",
        rect: { x: 8.5, y: 13, width: 2, height: 2 },
      },
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
    cover: [
      // The bar is one object in the fiction and three attackable sections in the rules (pg. 182), so it is authored as three.
      {
        id: "bar_west",
        label: "the west end of the bar",
        material: "wood",
        thickness: "thick",
        rect: { x: 3, y: 10, width: 2, height: 2 },
      },
      {
        id: "bar_middle",
        label: "the middle of the bar",
        material: "wood",
        thickness: "thick",
        rect: { x: 5, y: 10, width: 2, height: 2 },
      },
      {
        id: "bar_east",
        label: "the east end of the bar",
        material: "wood",
        thickness: "thick",
        rect: { x: 7, y: 10, width: 2, height: 2 },
      },
      {
        id: "table_north",
        label: "an overturned table",
        material: "wood",
        thickness: "thin",
        rect: { x: 15, y: 6, width: 2, height: 2 },
      },
      {
        id: "table_south",
        label: "an overturned table",
        material: "wood",
        thickness: "thin",
        rect: { x: 18, y: 12.5, width: 2, height: 2 },
      },
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
    cover: [
      {
        id: "crates_west",
        label: "a stack of crates",
        material: "wood",
        thickness: "thin",
        rect: { x: 9.5, y: 14, width: 2, height: 2 },
      },
      {
        id: "crates_east",
        label: "a stack of crates",
        material: "wood",
        thickness: "thin",
        rect: { x: 26, y: 26, width: 2, height: 2 },
      },
      // A shipping container is thin steel, and long enough to be three sections of it.
      {
        id: "container_west",
        label: "the near end of a shipping container",
        material: "steel",
        thickness: "thin",
        rect: { x: 17, y: 38, width: 2, height: 2 },
      },
      {
        id: "container_middle",
        label: "the middle of a shipping container",
        material: "steel",
        thickness: "thin",
        rect: { x: 19, y: 38, width: 2, height: 2 },
      },
      {
        id: "container_east",
        label: "the far end of a shipping container",
        material: "steel",
        thickness: "thin",
        rect: { x: 21, y: 38, width: 2, height: 2 },
      },
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
    cover: [
      // A car door is thin steel; the engine block behind it is thick steel and twice as tough. Two sections, not one.
      {
        id: "car_west_door",
        label: "the door of a parked car",
        material: "steel",
        thickness: "thin",
        rect: { x: 5.5, y: 20, width: 2, height: 2 },
      },
      {
        id: "car_west_engine",
        label: "the engine block of a parked car",
        material: "steel",
        thickness: "thick",
        rect: { x: 7.5, y: 20, width: 2, height: 2 },
      },
      {
        id: "car_east_door",
        label: "the door of a parked car",
        material: "steel",
        thickness: "thin",
        rect: { x: 19.5, y: 36, width: 2, height: 2 },
      },
      {
        id: "car_east_engine",
        label: "the engine block of a parked car",
        material: "steel",
        thickness: "thick",
        rect: { x: 21.5, y: 36, width: 2, height: 2 },
      },
      {
        id: "vending",
        label: "a vending machine",
        material: "steel",
        thickness: "thin",
        rect: { x: 11.5, y: 13, width: 2, height: 2 },
      },
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
    cover: [
      // Thick concrete is 25 HP: less than steel or stone, which is worth knowing before treating a pillar as the safe option.
      {
        id: "pillar_west",
        label: "a concrete pillar",
        material: "concrete",
        thickness: "thick",
        rect: { x: 9, y: 12, width: 1.5, height: 1.5 },
      },
      {
        id: "pillar_east",
        label: "a concrete pillar",
        material: "concrete",
        thickness: "thick",
        rect: { x: 25.5, y: 18, width: 1.5, height: 1.5 },
      },
      {
        id: "pillar_mid",
        label: "a concrete pillar",
        material: "concrete",
        thickness: "thick",
        rect: { x: 17, y: 25.5, width: 1.5, height: 1.5 },
      },
      {
        id: "car_door",
        label: "the door of a parked car",
        material: "steel",
        thickness: "thin",
        rect: { x: 30, y: 28, width: 2, height: 2 },
      },
      {
        id: "car_engine",
        label: "the engine block of a parked car",
        material: "steel",
        thickness: "thick",
        rect: { x: 32, y: 28, width: 2, height: 2 },
      },
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
    cover: [
      {
        id: "hvac",
        label: "an air handler",
        material: "steel",
        thickness: "thin",
        rect: { x: 21, y: 30, width: 2, height: 2 },
      },
      {
        id: "parapet_west",
        label: "a low parapet",
        material: "concrete",
        thickness: "thick",
        rect: { x: 39, y: 48, width: 2, height: 2 },
      },
      {
        id: "parapet_east",
        label: "a low parapet",
        material: "concrete",
        thickness: "thick",
        rect: { x: 41, y: 48, width: 2, height: 2 },
      },
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

// ---------------------------------------------------------------------------
// Line of sight.
// ---------------------------------------------------------------------------

/** Whether a point is inside (or on the edge of) a box. */
export function rectContains(rect: Rect, p: Point): boolean {
  return (
    p.x >= rect.x && p.x <= rect.x + rect.width && p.y >= rect.y && p.y <= rect.y + rect.height
  );
}

/**
 * Whether the straight line between two points crosses a box.
 *
 * The slab test: clip the segment against each pair of parallel edges and see
 * whether any of it survives. Continuous, like everything else here — a shot
 * grazing the corner of a crate is decided by the geometry rather than by which
 * grid square somebody rounded to.
 */
export function segmentIntersectsRect(a: Point, b: Point, rect: Rect): boolean {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (Math.abs(dx) < 1e-9 && Math.abs(dy) < 1e-9) return false;

  // Liang-Barsky: clip the parameter range [0, 1] against each of the four
  // edges. Anything left over is the part of the segment inside the box.
  let t0 = 0;
  let t1 = 1;
  const clip = (p: number, q: number): boolean => {
    if (Math.abs(p) < 1e-9) return q >= 0; // parallel to this edge
    const t = q / p;
    if (p < 0) {
      if (t > t1) return false;
      if (t > t0) t0 = t;
    } else {
      if (t < t0) return false;
      if (t < t1) t1 = t;
    }
    return true;
  };

  return (
    clip(-dx, a.x - rect.x) &&
    clip(dx, rect.x + rect.width - a.x) &&
    clip(-dy, a.y - rect.y) &&
    clip(dy, rect.y + rect.height - a.y) &&
    t0 <= t1
  );
}

/**
 * The cover standing between two people.
 *
 * A piece that either of them is standing at does NOT block: you do not lose
 * the shot because of the crate you are crouched behind. `isGone` lets the
 * caller drop pieces that have been shot to bits — the engine keeps the
 * geometry, the encounter keeps the damage.
 */
export function coverBetween(
  arena: Arena,
  a: Point,
  b: Point,
  isGone: (piece: CoverPiece) => boolean = () => false,
): CoverPiece[] {
  const pieces = arena.cover ?? [];
  return pieces.filter((piece) => {
    if (isGone(piece)) return false;
    if (rectContains(piece.rect, a) || rectContains(piece.rect, b)) return false;
    return segmentIntersectsRect(a, b, piece.rect);
  });
}

/** The point on a box nearest to somewhere — where a shot at it lands. */
export function nearestPointOn(rect: Rect, from: Point): Point {
  return {
    x: Math.min(Math.max(from.x, rect.x), rect.x + rect.width),
    y: Math.min(Math.max(from.y, rect.y), rect.y + rect.height),
  };
}

/** Whether one combatant can see — and therefore shoot — another. */
export function hasLineOfSight(
  arena: Arena,
  a: Point,
  b: Point,
  isGone: (piece: CoverPiece) => boolean = () => false,
): boolean {
  return coverBetween(arena, a, b, isGone).length === 0;
}
