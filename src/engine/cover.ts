/**
 * What is between you and the person shooting at you.
 *
 * engine/battlefield.ts owns the GEOMETRY — where cover stands and whether a
 * line crosses it. This owns the RULES: what a material is worth, what fire
 * does to it, and when it stops being cover at all.
 *
 * Two decisions worth stating, because both could have gone the other way:
 *
 * Cover is binary, not a modifier. While a piece stands in the way the engine
 * REFUSES the shot; it does not price it as a penalty. A "-2 for cover" would
 * be a number nobody printed reaching the dice, which is the exact failure
 * battlefield.ts and threats.json exist to prevent. The Core Rulebook's cover
 * rules are not transcribed in this repository, so data/rules/cover.json says
 * out loud that its numbers are house values rather than citing a page.
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

export type CoverMaterial = {
  key: string;
  label: string;
  /** How much of a single hit the material simply eats. */
  sp: number;
  /** How much punishment it takes before it is no longer cover. */
  hp: number;
  note: string;
};

export const COVER_MATERIALS: CoverMaterial[] = (
  coverData.materials as unknown as CoverMaterial[]
).map((m) => ({ ...m }));

/** The plainest thing worth hiding behind, and the fallback for a bad key. */
export const DEFAULT_COVER_MATERIAL_KEY = "crate";

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

export function coverMaxHp(piece: CoverPiece): number {
  return coverMaterial(piece.material).hp;
}

export function coverSp(piece: CoverPiece): number {
  return coverMaterial(piece.material).sp;
}

export function coverHpRemaining(piece: CoverPiece, damage: CoverDamage): number {
  const taken = Math.max(0, damage[piece.id] ?? 0);
  return Math.max(0, coverMaxHp(piece) - taken);
}

/** Shot to bits: it no longer blocks anything. */
export function coverDestroyed(piece: CoverPiece, damage: CoverDamage): boolean {
  return coverHpRemaining(piece, damage) <= 0;
}

/** The cover actually blocking a shot, ignoring anything already destroyed. */
export function coverBlocking(
  arena: Arena,
  from: { x: number; y: number },
  to: { x: number; y: number },
  damage: CoverDamage,
): CoverPiece[] {
  return coverBetween(arena, from, to, (piece) => coverDestroyed(piece, damage));
}

export type CoverHit = {
  pieceId: string;
  label: string;
  material: string;
  sp: number;
  absorbed: number;
  through: number;
  hpBefore: number;
  hpAfter: number;
  destroyed: boolean;
  /** The damage map after the hit; the caller persists this. */
  damage: CoverDamage;
};

/**
 * Fire that could not reach a person hits what was in the way.
 *
 * Damage is reduced by the material's SP and the remainder comes off its HP.
 * SP does not ablate: one fewer moving part, and the HP already carries the
 * sense of a thing coming apart. A hit that the SP eats entirely still reads as
 * a hit — it just does not shorten the wall's life.
 */
export function applyCoverDamage(
  piece: CoverPiece,
  damage: CoverDamage,
  incoming: number,
): CoverHit {
  const sp = coverSp(piece);
  const hpBefore = coverHpRemaining(piece, damage);
  const through = Math.max(0, Math.round(incoming) - sp);
  const absorbed = Math.max(0, Math.round(incoming)) - through;
  const hpAfter = Math.max(0, hpBefore - through);
  // A hit the SP ate entirely leaves no mark: writing a 0 would put a key in
  // the damage map for a piece nothing has actually happened to.
  const taken = Math.max(0, damage[piece.id] ?? 0) + through;
  const nextDamage = through > 0 ? { ...damage, [piece.id]: taken } : { ...damage };
  return {
    pieceId: piece.id,
    label: piece.label,
    material: piece.material,
    sp,
    absorbed,
    through,
    hpBefore,
    hpAfter,
    destroyed: hpAfter <= 0,
    damage: nextDamage,
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
  sp: number;
  hp: number;
  hpMax: number;
  destroyed: boolean;
};

export function coverStatuses(arena: Arena, damage: CoverDamage): CoverStatus[] {
  return (arena.cover ?? []).map((piece) => {
    const hp = coverHpRemaining(piece, damage);
    return {
      piece,
      label: piece.label,
      material: piece.material,
      sp: coverSp(piece),
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
  const known = new Set((arena.cover ?? []).map((piece) => piece.id));
  const out: CoverDamage = {};
  for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!known.has(id)) continue;
    if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) continue;
    out[id] = Math.min(
      Math.round(value),
      coverMaxHp((arena.cover ?? []).find((p) => p.id === id)!),
    );
  }
  return out;
}
