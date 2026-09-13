/**
 * What the last turn actually cost.
 *
 * PRODUCT.md asks the interface to "show, do not explain", and gives the form
 * outright: `Armor SP 11 -> 8`, `Kiro ^`, `-E$450 +3 days`. The values were
 * always there — a Life turn moves money, minutes, wounds, opinions and clocks
 * — and every one of them was written to a row and never shown as a change. A
 * number that silently moves teaches the player nothing.
 *
 * So this is a DIFF, not a new record. Two snapshots of state the turn already
 * produced, in; the cards the screen draws, out. Nothing here is stored, which
 * means nothing here can disagree with the rows it came from.
 *
 * Pure and React-free.
 */
import { DOWNTIME_MONTH_DAYS, type LifeClock } from "@/engine";

export type ReceiptTone = "good" | "bad" | "neutral";

export type Receipt = {
  key: string;
  /** The line the player reads. Short enough to take in at a glance. */
  text: string;
  tone: ReceiptTone;
  /** A clock's fill, so a moved clock draws its dial rather than a fraction. */
  meter?: { filled: number; segments: number };
};

/** Everything a receipt could be about, as it stood at one moment. */
export type TurnSnapshot = {
  day: number;
  minute: number;
  eurobucks: number;
  hp: number;
  humanity: number;
  /** Disposition by npc key, with the name to print. */
  people: Record<string, { name: string; disposition: number }>;
  clocks: Record<string, LifeClock>;
};

export function snapshotOf(input: {
  clock: { day: number; minute: number };
  vitals: { eurobucks: number; hp_current: number; humanity_current: number };
  npcs: { npc_id: string | null; name: string; disposition: number }[];
  pressure: { clock: LifeClock }[];
}): TurnSnapshot {
  const people: TurnSnapshot["people"] = {};
  for (const npc of input.npcs) {
    const key = npc.npc_id ?? npc.name;
    people[key] = { name: npc.name, disposition: npc.disposition };
  }
  const clocks: TurnSnapshot["clocks"] = {};
  for (const entry of input.pressure) clocks[entry.clock.key] = entry.clock;
  return {
    day: input.clock.day,
    minute: input.clock.minute,
    eurobucks: input.vitals.eurobucks,
    hp: input.vitals.hp_current,
    humanity: input.vitals.humanity_current,
    people,
    clocks,
  };
}

function money(value: number): string {
  return `€$${Math.abs(value).toLocaleString()}`;
}

/**
 * Elapsed time in the largest unit that is honest.
 *
 * "+180 minutes" is arithmetic the player has to do; "+3 hours" is a fact. Days
 * win over hours because a day is the unit rent is charged in.
 */
export function elapsedLabel(days: number, minutes: number): string | null {
  const total = days * 24 * 60 + minutes;
  if (total <= 0) return null;
  if (total >= 24 * 60) {
    const wholeDays = Math.floor(total / (24 * 60));
    return `+${wholeDays} ${wholeDays === 1 ? "day" : "days"}`;
  }
  if (total >= 60) {
    const hours = Math.round(total / 60);
    return `+${hours} ${hours === 1 ? "hour" : "hours"}`;
  }
  return `+${total} min`;
}

/**
 * What changed between two moments, worst news first.
 *
 * Only differences appear. A turn where nothing moved produces no cards at all,
 * which is the honest answer and keeps the receipts meaning something: a strip
 * that is always lit is wallpaper.
 */
export function receiptsBetween(before: TurnSnapshot, after: TurnSnapshot): Receipt[] {
  const out: Receipt[] = [];

  const spent = before.eurobucks - after.eurobucks;
  if (spent !== 0) {
    out.push({
      key: "money",
      text: spent > 0 ? `−${money(spent)}` : `+${money(spent)}`,
      tone: spent > 0 ? "bad" : "good",
    });
  }

  const hp = after.hp - before.hp;
  if (hp !== 0) {
    out.push({
      key: "hp",
      text: `HP ${before.hp} → ${after.hp}`,
      tone: hp < 0 ? "bad" : "good",
    });
  }

  const humanity = after.humanity - before.humanity;
  if (humanity !== 0) {
    out.push({
      key: "humanity",
      text: `Humanity ${before.humanity} → ${after.humanity}`,
      tone: humanity < 0 ? "bad" : "good",
    });
  }

  // Opinions, before the clock: who thinks what of you is the thing a player
  // most wants confirmed, and the thing the fiction states least clearly.
  for (const [key, now] of Object.entries(after.people)) {
    const was = before.people[key];
    if (!was || was.disposition === now.disposition) continue;
    const up = now.disposition > was.disposition;
    out.push({
      key: `person:${key}`,
      text: `${now.name} ${up ? "↑" : "↓"}`,
      tone: up ? "good" : "bad",
    });
  }

  for (const [key, now] of Object.entries(after.clocks)) {
    const was = before.clocks[key];
    if (now.hidden) continue; // a clock they cannot feel coming is not a receipt
    if (was && was.filled === now.filled) continue;
    out.push({
      key: `clock:${key}`,
      text: `${now.label} ${now.filled}/${now.segments}`,
      tone: !was || now.filled > was.filled ? "bad" : "good",
      meter: { filled: now.filled, segments: now.segments },
    });
  }

  // Time last, because it is the one thing that moves on almost every turn and
  // would otherwise be the card the eye lands on first.
  const elapsed = elapsedLabel(after.day - before.day, after.minute - before.minute);
  if (elapsed) out.push({ key: "time", text: elapsed, tone: "neutral" });

  // Crossing a rent boundary is the one time-change worth calling out on its
  // own: the money chip will have moved and the player should know why.
  const monthsBefore = Math.floor(before.day / DOWNTIME_MONTH_DAYS);
  const monthsAfter = Math.floor(after.day / DOWNTIME_MONTH_DAYS);
  if (monthsAfter > monthsBefore) {
    out.push({ key: "month", text: "A month turned over", tone: "bad" });
  }

  return out;
}
