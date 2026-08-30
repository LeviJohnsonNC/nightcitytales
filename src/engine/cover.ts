/**
 * What is between you and the person shooting at you.
 *
 * engine/battlefield.ts owns the GEOMETRY — where cover stands and whether a
 * line crosses it. This owns the RULES, and they are the printed ones:
 * Cyberpunk RED, Friday Night Firefight, pg. 182-183.
 *
 * The Golden Rules of Cover (pg. 182) decide the shape of this module:
 *
 *   "You are considered to be in cover if you are fully behind something that
 *    could stop a bullet. If they have line of sight on you, you aren't in
 *    cover. There is no 'partial' cover. It can either stop a bullet or it
 *    can't. If it cannot stop a bullet, it provides no cover and thus has no
 *    HP."
 *
 * So cover is binary and never a modifier on the dice. A piece either takes the
 * shot away or it is not there.
 *
 * Cover has HP and nothing else — no SP, no ablation. The book's own example
 * puts a 17-damage sniper round into a Thick Concrete barricade of 25 HP and
 * leaves it at 8, with nothing subtracted first. And a section is SHOT AT
 * rather than merely damaged: the example rolls a Shoulder Arms Check against
 * a DV read off the weapon and the range, exactly as if shooting a person.
 *
 * Only DAMAGE is persisted, keyed by the piece's authored id. Geometry stays in
 * the engine, the way an arena key does: if a stored fight carried its own
 * copy of the shape, editing an arena would silently disagree with every
 * encounter in flight.
 *
 * Pure: no React, no backend, no randomness that is not handed in.
 */
import coverData from "@/data/rules/cover.json";
import type { Arena, CoverPiece } from "./battlefield";
import { coverBetween } from "./battlefield";

/** How much of a thing is in the way (pg. 182: the HP table is by thickness). */
export type CoverThickness = "thick" | "thin";

export type CoverMaterial = {
  key: string;
  label: string;
  thickHp: number;
  thinHp: number;
  note: string;
};

export const COVER_MATERIALS: CoverMaterial[] = (
  coverData.materials as unknown as CoverMaterial[]
).map((m) => ({ ...m }));

/** The fallback for a key nobody authored. Thin wood is the book's flimsiest real cover. */
export const DEFAULT_COVER_MATERIAL_KEY = "wood";

export const COVER_MATERIAL_KEYS: string[] = COVER_MATERIALS.map((m) => m.key);

/**
 * The named material, falling back rather than throwing.
 *
 * Arena cover is authored in this repository, so a bad key is a typo somebody
 * will see in a test rather than something a model sent — but a fight already
 * running is not the place to discover it.
 */
export function coverMaterial(key: string | null | undefined): CoverMaterial {
  const found = COVER_MATERIALS.find((m) => m.key === key);
  if (found) return found;
  const fallback = COVER_MATERIALS.find((m) => m.key === DEFAULT_COVER_MATERIAL_KEY);
  if (!fallback) throw new Error("cover: the default material is missing.");
  return fallback;
}

/**
 * Damage taken by each piece of cover, keyed by its authored id.
 *
 * Damage TAKEN rather than HP remaining, so an absent entry means intact and
 * retuning a material in the rules data cannot leave a stored fight with more
 * HP than its material has.
 */
export type CoverDamage = Record<string, number>;

/** The printed HP for this piece's material and thickness (pg. 182). */
export function coverMaxHp(piece: CoverPiece): number {
  const material = coverMaterial(piece.material);
  return piece.thickness === "thick" ? material.thickHp : material.thinHp;
}

/**
 * Whether this is cover at all.
 *
 * pg. 182: a thing that cannot stop a bullet "provides no cover and thus has no
 * HP" — the table prints Thin Plaster/Foam/Plastic as "0 HP (Not Cover)". Such
 * a piece is not weak cover, it is scenery: it never blocks a line and can
 * never be shot at.
 */
export function isCover(piece: CoverPiece): boolean {
  return coverMaxHp(piece) > 0;
}

export function coverHpRemaining(piece: CoverPiece, damage: CoverDamage): number {
  const taken = Math.max(0, damage[piece.id] ?? 0);
  return Math.max(0, coverMaxHp(piece) - taken);
}

/** At 0 HP cover is destroyed (pg. 182) and stops blocking anything. */
export function coverDestroyed(piece: CoverPiece, damage: CoverDamage): boolean {
  return coverHpRemaining(piece, damage) <= 0;
}

/**
 * The cover actually blocking a shot.
 *
 * Ignores anything destroyed, and anything that was never cover to begin with.
 */
export function coverBlocking(
  arena: Arena,
  from: { x: number; y: number },
  to: { x: number; y: number },
  damage: CoverDamage,
): CoverPiece[] {
  return coverBetween(arena, from, to, (piece) => !isCover(piece) || coverDestroyed(piece, damage));
}

export type CoverHit = {
  pieceId: string;
  label: string;
  material: string;
  thickness: CoverThickness;
  /** Damage rolled. Anything past the last point of HP is lost (pg. 182). */
  damage: number;
  applied: number;
  hpBefore: number;
  hpAfter: number;
  destroyed: boolean;
  /** The damage map after the hit; the caller persists this. */
  damageMap: CoverDamage;
};

/**
 * Damage from a shot that HIT this section.
 *
 * Straight off HP: cover has no SP and does not ablate. Excess damage past 0 is
 * lost and never reaches whoever is behind it (pg. 182) — "You can hurt them
 * with your next Attack."
 */
export function applyCoverDamage(
  piece: CoverPiece,
  damage: CoverDamage,
  incoming: number,
): CoverHit {
  const rolled = Math.max(0, Math.round(incoming));
  const hpBefore = coverHpRemaining(piece, damage);
  const applied = Math.min(rolled, hpBefore);
  const hpAfter = hpBefore - applied;
  const taken = Math.max(0, damage[piece.id] ?? 0) + applied;
  return {
    pieceId: piece.id,
    label: piece.label,
    material: piece.material,
    thickness: piece.thickness,
    damage: rolled,
    applied,
    hpBefore,
    hpAfter,
    destroyed: hpAfter <= 0,
    // A hit that applied nothing leaves no mark: writing a 0 would file damage
    // against a piece nothing has actually happened to.
    damageMap: applied > 0 ? { ...damage, [piece.id]: taken } : { ...damage },
  };
}

/**
 * Every piece on the ground with what it is currently worth.
 *
 * This is the read model. There is no battlefield to draw yet, so today it
 * feeds a line of text in the combat HUD and a fact in the GM's context; when
 * a board arrives it consumes this same function and nothing in the engine
 * changes. That is the whole reason cover state is computed rather than stored
 * in a shape a screen happened to want.
 */
export type CoverStatus = {
  piece: CoverPiece;
  label: string;
  material: string;
  thickness: CoverThickness;
  hp: number;
  hpMax: number;
  destroyed: boolean;
};

export function coverStatuses(arena: Arena, damage: CoverDamage): CoverStatus[] {
  return (arena.cover ?? []).filter(isCover).map((piece) => {
    const hp = coverHpRemaining(piece, damage);
    return {
      piece,
      label: piece.label,
      material: piece.material,
      thickness: piece.thickness,
      hp,
      hpMax: coverMaxHp(piece),
      destroyed: hp <= 0,
    };
  });
}

/**
 * Persisted damage, read defensively.
 *
 * The client hands this back to the database, so the database cannot know
 * whether an id belongs to the arena — the same boundary the cyberware
 * transaction draws. Identity is checked HERE, against the authored arena:
 * an id no arena knows is dropped rather than trusted into a live fight.
 */
export function coverDamageFrom(arena: Arena, raw: unknown): CoverDamage {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const pieces = arena.cover ?? [];
  const out: CoverDamage = {};
  for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
    const piece = pieces.find((p) => p.id === id);
    if (!piece) continue;
    if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) continue;
    out[id] = Math.min(Math.round(value), coverMaxHp(piece));
  }
  return out;
}
