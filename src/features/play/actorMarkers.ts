/**
 * What the board says over each person, and where.
 *
 * Presentation only: nothing here reads or changes a rule, a position, a hit area or
 * a target. It decides how much each actor's marker says (a hierarchy, not one size
 * for everybody) and lays the markers out in SCREEN pixels, so they keep one
 * readable size at every camera zoom instead of growing with the scene (the board's
 * SVG is in scene units; a 10 px label became 36 px at play zoom).
 *
 *   self      the player: a caret over the head and a slim bar; the name on demand
 *   target    the locked target: name, HP and bar, always
 *   pointed   hovered, keyboard-focused or aimed at: name, HP and bar
 *   threat    other hostiles: a diamond and a slim bar, no name
 *   ally      friendly non-players: a disc and a slim bar
 *   bystander neutral people: nothing over them at rest (their quiet ground ring
 *             says who they are); a ring and a bar once they are hurt
 *   out       defeated: a cross and what became of them (a status is never hidden)
 *
 * Faction is carried by the glyph's SHAPE as well as its colour.
 */
import type { CombatSide } from "@/engine";

export type MarkerRole = "self" | "target" | "pointed" | "threat" | "ally" | "bystander" | "out";
export type MarkerGlyph = "caret" | "diamond" | "disc" | "ring" | "cross";

export interface MarkerActor {
  id: string;
  name: string;
  side: CombatSide;
  isPlayer: boolean;
  hp: number;
  hpMax: number;
  defeated: boolean;
}

export interface MarkerAttention {
  /** The locked target. */
  locked: string | null;
  /** Aimed at, or hovered as a target. */
  pointed: string | null;
  /** Under the pointer (any actor, the player included). */
  hovered: string | null;
  /** Holding keyboard focus. */
  focused: string | null;
}

export interface Marker {
  role: MarkerRole;
  /** Nothing is drawn over this person at rest. */
  hidden: boolean;
  glyph: MarkerGlyph;
  /** Full information: the name and HP in words. */
  detail: boolean;
  /** The name line, when shown. */
  name: string | null;
  /** "12/20" beside the name, when shown. */
  hp: string | null;
  /** The bar's width in screen pixels and how full it is; null for none. */
  bar: { width: number; fraction: number } | null;
  /** A status line that must not be hidden (a defeated actor's fate). */
  status: string | null;
}

/** Screen sizes, in CSS pixels. One place, so the board and the tests agree. */
export const MARKER = {
  font: 11,
  lineHeight: 13,
  /** Monospace advance at `font`: IBM Plex Mono is 0.6 em. */
  charWidth: 6.6,
  glyph: 7,
  barDetail: 54,
  barCompact: 26,
  barHeight: 3,
  gap: 3,
  /** Kept clear of the board's own controls along the top and its edges. */
  margin: { top: 56, side: 8, bottom: 8 },
} as const;

/** The board's colour for a person: the player, a hostile, everybody else. */
export function actorColor(actor: Pick<MarkerActor, "isPlayer" | "side">) {
  return actor.isPlayer ? "#65eee0" : actor.side === "hostile" ? "#ff7770" : "#b3a2ff";
}

export function markerRole(actor: MarkerActor, attention: MarkerAttention): MarkerRole {
  if (actor.defeated) return "out";
  if (actor.isPlayer) return "self";
  if (attention.locked === actor.id) return "target";
  if ([attention.pointed, attention.hovered, attention.focused].includes(actor.id))
    return "pointed";
  return actor.side === "hostile" ? "threat" : actor.side === "friendly" ? "ally" : "bystander";
}

export function markerFor(
  actor: MarkerActor,
  attention: MarkerAttention,
  /** A defeated actor's fate in words ("Down", "Fled"...). */
  exitLabel: string,
): Marker {
  const role = markerRole(actor, attention);
  const noticed = [attention.hovered, attention.focused].includes(actor.id);
  const fraction = actor.hpMax > 0 ? Math.max(0, Math.min(1, actor.hp / actor.hpMax)) : 0;
  const hurt = actor.hp < actor.hpMax;
  const glyph: MarkerGlyph = actor.defeated
    ? "cross"
    : actor.isPlayer
      ? "caret"
      : actor.side === "hostile"
        ? "diamond"
        : actor.side === "friendly"
          ? "disc"
          : "ring";
  const detail = role === "target" || role === "pointed" || (role === "self" && noticed);
  const hp = `${Math.max(0, actor.hp)}/${actor.hpMax}`;
  if (role === "out")
    return {
      role,
      hidden: false,
      glyph,
      detail: noticed,
      name: noticed ? actor.name : null,
      hp: null,
      bar: null,
      status: exitLabel,
    };
  return {
    role,
    hidden: role === "bystander" && !hurt,
    glyph,
    detail,
    name: detail ? actor.name : null,
    hp: detail ? hp : null,
    bar: detail
      ? { width: MARKER.barDetail, fraction }
      : role === "bystander" && !hurt
        ? null
        : { width: MARKER.barCompact, fraction },
    status: null,
  };
}

/** The marker's box in screen pixels, above its anchor (the top of the head). */
export function markerSize(marker: Marker) {
  const text = Math.max(
    marker.name
      ? (marker.name.length + (marker.hp ? marker.hp.length + 2 : 0)) * MARKER.charWidth
      : 0,
    marker.status ? marker.status.length * MARKER.charWidth : 0,
  );
  const width = Math.max(MARKER.glyph * 2, marker.bar?.width ?? 0, text) + 6;
  const lines = (marker.name ? 1 : 0) + (marker.status ? 1 : 0);
  const height =
    MARKER.glyph +
    MARKER.gap +
    (marker.bar ? MARKER.barHeight + MARKER.gap : 0) +
    lines * MARKER.lineHeight;
  return { width, height };
}

export interface Placed {
  id: string;
  /** Screen position of the anchor (centre-bottom of the marker box). */
  x: number;
  y: number;
  /** How far the box had to move from its anchor to stay on screen and apart. */
  dx: number;
  dy: number;
}

/** Lower is placed first and never moves for a later one. */
const PRIORITY: Record<MarkerRole, number> = {
  target: 0,
  pointed: 1,
  self: 2,
  threat: 3,
  ally: 4,
  out: 5,
  bystander: 6,
};

/**
 * Keep every marker on screen and clear of the board's controls, and keep the
 * markers that carry words apart: a later one (by priority) moves up over an
 * earlier one rather than printing across it. A compact marker (a glyph and a
 * bar) is small enough to sit under its own person and is only kept on screen.
 */
export function layoutMarkers(
  items: { id: string; marker: Marker; x: number; y: number; inView?: boolean }[],
  viewport: { width: number; height: number },
  /** Fixed boxes already on the board (an "IN THE WAY" label), in screen pixels. */
  obstacles: { left: number; right: number; top: number; bottom: number }[] = [],
): Map<string, Placed> {
  const M = MARKER.margin;
  const placed = new Map<string, Placed>();
  const boxes: { left: number; right: number; top: number; bottom: number }[] = [...obstacles];
  const order = [...items].sort(
    (a, b) => PRIORITY[a.marker.role] - PRIORITY[b.marker.role] || a.y - b.y,
  );
  for (const item of order) {
    // a person off the screen has no marker to keep on it
    if (item.marker.hidden || item.inView === false) continue;
    const { width, height } = markerSize(item.marker);
    let x = Math.min(Math.max(item.x, M.side + width / 2), viewport.width - M.side - width / 2);
    let y = Math.min(Math.max(item.y, M.top + height), viewport.height - M.bottom);
    // A worded marker moves up past every worded box and fixed label it would print
    // across; a compact one (a glyph and a bar) only past the fixed labels.
    const worded = !!(item.marker.name || item.marker.status);
    const against = worded ? boxes : obstacles;
    for (let pass = 0; pass < against.length + 1; pass++) {
      const hit = against.find(
        (b) =>
          x - width / 2 < b.right && x + width / 2 > b.left && y - height < b.bottom && y > b.top,
      );
      if (!hit) break;
      y = hit.top - 2;
    }
    // pushed off the top: hang below the person instead
    if (y - height < M.top) y = Math.min(viewport.height - M.bottom, item.y + height + 40);
    if (worded)
      boxes.push({ left: x - width / 2, right: x + width / 2, top: y - height, bottom: y });
    x = Number.isFinite(x) ? x : item.x;
    placed.set(item.id, { id: item.id, x, y, dx: x - item.x, dy: y - item.y });
  }
  return placed;
}
