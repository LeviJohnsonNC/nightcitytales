/**
 * The Screamsheet: what the city prints about what you did.
 *
 * Night City reacts to the character — a market the law has been through, a
 * building that has changed its badges, a job that left bodies — and until now
 * every one of those reactions happened out of sight. The player learned a
 * market had gone quiet by finding it quiet, and never learned that it was
 * theirs. `reputation-deeds.json` says so outright: "Nothing in the game writes
 * the news yet." The book (p.193) has a word for where the news is written. This
 * is that.
 *
 * It is DERIVED, never stored, exactly as Reputation is. The ledger already
 * holds everything a headline needs — `place_changed` rows for a flag a place
 * gained, `job_settled` receipts for what a job left behind — so the sheet is a
 * function of those rows, and cannot disagree with them. A headline's wording is
 * picked from a template list by a hash of its own event, so it reads the same
 * every time the sheet is opened.
 *
 * Four rules keep it a newspaper and not a notification tray:
 *
 *  - IT SAYS NOTHING THE ENGINE DID NOT RECORD. Atmosphere may colour a fact
 *    ("they know the address now"); it may not add one — no sum, no name, no
 *    quoted statement. The data file says so too, and a test holds it.
 *
 *  - THE CHARACTER IS NAMED ONLY WHEN THE ENGINE SAYS THEY WERE. `named` is an
 *    observation with a price — somebody said their handle where it could be
 *    heard — so it is what puts a handle in print. A job nobody could place the
 *    character at (`clean`) is not printed at all: getting away without a trace
 *    is what keeps your name out of the story, and that trade is the point.
 *
 *  - NO DIAL IS EVER SHOWN. A place's dials are hidden on purpose; the sheet
 *    reports a flag that has been SET, which is something that happened, and
 *    never how close anything is to happening.
 *
 *  - QUIET IS AN ANSWER. A campaign where nothing has happened has an empty
 *    sheet, and the screen says so rather than filling it.
 *
 * Pure: ledger rows in, items out. No React, no storage.
 */
import data from "@/data/atlas/screamsheet.json";
import { getDistrict, getPlace } from "./geography";
import {
  LEDGER_EVENTS,
  payloadOf,
  readJobSettledEventData,
  readJobSettledMeta,
  readPlaceChangedEventData,
} from "./ledger";
import { findMission } from "./missions";
import type { Observation } from "./clocks";
import { deedLevel } from "./reputation";
import { REPUTATION } from "./rulesData";

type Template = { h: string; d: string };
type Group = { tone: SheetTone; kicker: string; items: Template[] };
type FameBand = { from: number; to: number; kicker: string; items: Template[] };

type SheetFile = {
  houseRule: boolean;
  note: string;
  places: Record<string, Group>;
  unprinted: Record<string, string>;
  jobs: Record<string, Group>;
  decks: { named: string; unnamed: string; witness: string; seen: string };
  counts: string[];
  fame: FameBand[];
};

const FILE = data as unknown as SheetFile;

export const SCREAMSHEET_IS_HOUSE_RULE: boolean = FILE.houseRule;

/** The flags a place can gain that make the news. */
export const PRINTED_FLAGS: string[] = Object.keys(FILE.places);

/** Flags that are deliberately not printed, each with the reason. */
export const UNPRINTED_FLAGS: Record<string, string> = FILE.unprinted;

/**
 * What a job can leave behind, loudest first. The loudest one is the headline;
 * a quieter one only ever becomes the line under it.
 */
export const JOB_HEADLINE_ORDER: Observation[] = [
  "killed",
  "burned",
  "property",
  "loud",
  "wounded",
  "witness",
  "seen",
  "favour",
];

/** The row shape this reads: an event, structurally. */
export type SheetEvent = { id: string; seq: number; type: string; data?: unknown };

export type SheetKind = "place" | "job" | "fame";
export type SheetTone = "good" | "bad" | "neutral";

export type SheetItem = {
  /** Stable across loads, so "new since last read" has something to remember. */
  key: string;
  /** The ledger row it came from. */
  seq: number;
  /** The in-world day, or null for a row written before the day was kept. */
  day: number | null;
  kind: SheetKind;
  tone: SheetTone;
  /** The small all-caps label above a headline: "RAID", "BODIES". */
  kicker: string;
  headline: string;
  deck: string | null;
  /** The venue it is about, as the atlas keys it. Null when the job names none. */
  placeKey: string | null;
  /** The venue as the atlas prints it, or the district, or null. */
  placeName: string | null;
};

/** FNV-1a: small, deterministic, and good enough to pick between two sentences. */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function pick<T>(items: T[], key: string): T {
  return items[hash(key) % items.length]!;
}

/** Fill {tokens}. A token with no value is a bug in a template, not a blank. */
function fill(text: string, tokens: Record<string, string>): string {
  return text.replace(/\{(\w+)\}/g, (whole, name: string) => tokens[name] ?? whole);
}

const FALLBACK_PLACE = "an address in Night City";

type Where = { placeKey: string | null; placeName: string | null };

/** The venue, or failing that its district: whatever the atlas can name. */
function whereIs(placeKey: string | null, districtKey?: string | null): Where {
  const place = placeKey ? getPlace(placeKey) : undefined;
  if (place) return { placeKey: place.key, placeName: place.name };
  const district = districtKey ? getDistrict(districtKey) : undefined;
  return { placeKey: null, placeName: district?.name ?? null };
}

function placeItem(event: SheetEvent): SheetItem | null {
  if (event.type !== LEDGER_EVENTS.placeChanged) return null;
  const change = readPlaceChangedEventData(payloadOf(event));
  // Only a flag GAINED is news. The one a raid clears (`market_open`) is the
  // same story, and a flag lost for any other reason is not a headline.
  if (!change || !change.set) return null;
  const group = FILE.places[change.flag];
  const place = getPlace(change.placeKey);
  // An unknown place is never printed as "undefined", and never guessed at.
  if (!group || !place) return null;
  const key = `place:${event.id}`;
  const template = pick(group.items, key);
  const tokens = { place: place.name };
  return {
    key,
    seq: event.seq,
    day: change.day,
    kind: "place",
    tone: group.tone,
    kicker: group.kicker,
    headline: fill(template.h, tokens),
    deck: template.d ? fill(template.d, tokens) : null,
    placeKey: place.key,
    placeName: place.name,
  };
}

function primaryObservation(noticed: Partial<Record<Observation, number>>): Observation | null {
  return JOB_HEADLINE_ORDER.find((o) => (noticed[o] ?? 0) > 0) ?? null;
}

/**
 * The line under a headline, when there is something true to add: a name if one
 * was said, else who saw it, else that nobody has a name for it. One line only —
 * a headline with three sentences under it is a paragraph.
 */
function secondary(
  primary: Observation,
  noticed: Partial<Record<Observation, number>>,
  handle: string,
): string | null {
  if ((noticed.named ?? 0) > 0) return fill(FILE.decks.named, { handle });
  if (primary !== "witness" && (noticed.witness ?? 0) > 0) return FILE.decks.witness;
  if (primary !== "seen" && (noticed.seen ?? 0) > 0) return FILE.decks.seen;
  // Nobody said a name, and nobody got a look: that is what "unnamed" means.
  if (primary === "favour" || primary === "witness" || primary === "seen") return null;
  return FILE.decks.unnamed;
}

function jobItem(
  event: SheetEvent,
  where: Where,
  day: number | null,
  handle: string,
): SheetItem | null {
  const job = readJobSettledEventData(payloadOf(event));
  if (!job) return null;
  // Nobody can place the character there at all: there is no story to print.
  if ((job.noticed.clean ?? 0) > 0) return null;
  const primary = primaryObservation(job.noticed);
  if (!primary) return null;
  const group = FILE.jobs[primary];
  if (!group) return null;

  const key = `job:${event.id}`;
  const template = pick(group.items, key);
  const killed = job.noticed.killed ?? 0;
  const tokens = {
    place: where.placeName ?? FALLBACK_PLACE,
    count: FILE.counts[Math.min(Math.max(killed, 0), FILE.counts.length - 1)] ?? "",
    handle,
  };
  const own = template.d ? fill(template.d, tokens) : "";
  const extra = secondary(primary, job.noticed, handle);
  const deck = [own, extra].filter((line): line is string => !!line).join(" ");
  return {
    key,
    seq: event.seq,
    day,
    kind: "job",
    tone: group.tone,
    kicker: group.kicker,
    headline: fill(template.h, tokens),
    deck: deck || null,
    placeKey: where.placeKey,
    placeName: where.placeName,
  };
}

function fameItem(
  event: SheetEvent,
  level: number,
  named: boolean,
  where: Where,
  day: number | null,
  handle: string,
): SheetItem | null {
  const band = FILE.fame.find((b) => level >= b.from && level <= b.to);
  const ladder = REPUTATION.levels.find((l) => l.level === level)?.whoKnows;
  if (!band || !ladder) return null;
  const key = `fame:${event.id}`;
  const template = pick(band.items, key);
  // The printed ladder first says the NAME is out at Level 5 ("recognize your
  // name"); before that it is only what happened, stories and word going round,
  // and the name goes in print only if it was said.
  const who = named || level >= 5 ? handle : "a runner";
  const tokens = { who, ladder };
  return {
    key,
    seq: event.seq,
    day,
    kind: "fame",
    tone: "good",
    kicker: band.kicker,
    headline: fill(template.h, tokens),
    deck: fill(template.d, tokens),
    placeKey: where.placeKey,
    placeName: where.placeName,
  };
}

const KIND_ORDER: Record<SheetKind, number> = { job: 0, fame: 1, place: 2 };

export type ScreamsheetInput = {
  /** Every `place_changed`, `job_settled` and `mission_started` row, in any order. */
  events: SheetEvent[];
  /** The character's handle — what goes in print when the engine says they were named. */
  handle: string;
  /** The most items to return, newest first. */
  limit?: number;
};

/** The default depth of the sheet: a long campaign should not be an archive. */
export const SCREAMSHEET_LIMIT = 40;

/**
 * Everything the city has printed, newest first.
 *
 * A `job_settled` receipt written before the venue and day were kept falls back
 * to the job's own `mission_started` row, which names the mission and so the
 * venue. Reputation is replayed in order so a Level is announced once, on the
 * job that earned it.
 */
export function screamsheet(input: ScreamsheetInput): SheetItem[] {
  const ordered = [...input.events].sort((a, b) => a.seq - b.seq);
  const handle = input.handle.trim() || "a runner";
  const items: SheetItem[] = [];
  let reputation = REPUTATION.startingValue;
  let lastMission: string | null = null;

  for (const event of ordered) {
    if (event.type === "mission_started") {
      const id = payloadOf(event)["missionId"];
      lastMission = typeof id === "string" ? id : null;
      continue;
    }
    const place = placeItem(event);
    if (place) {
      items.push(place);
      continue;
    }
    if (event.type !== LEDGER_EVENTS.jobSettled) continue;

    const meta = readJobSettledMeta(payloadOf(event));
    const mission = findMission(meta.missionId ?? lastMission);
    const where = whereIs(
      meta.placeKey ?? mission?.offer?.placeKey ?? null,
      mission?.offer?.districtKey,
    );
    const job = jobItem(event, where, meta.day, handle);
    if (job) items.push(job);

    const settled = readJobSettledEventData(payloadOf(event));
    if (!settled) continue;
    const deed = deedLevel(settled);
    if (deed > reputation) {
      const fame = fameItem(event, deed, (settled.noticed.named ?? 0) > 0, where, meta.day, handle);
      if (fame) items.push(fame);
    }
    reputation = Math.max(reputation, deed);
  }

  return items
    .sort((a, b) => b.seq - a.seq || KIND_ORDER[a.kind] - KIND_ORDER[b.kind])
    .slice(0, Math.max(1, input.limit ?? SCREAMSHEET_LIMIT));
}

export type SheetDay = { day: number | null; items: SheetItem[] };

/** Items under the morning they are about, newest first. Undated ones sit together at the end. */
export function groupByDay(items: SheetItem[]): SheetDay[] {
  const dated = new Map<number, SheetItem[]>();
  const undated: SheetItem[] = [];
  for (const item of items) {
    if (item.day === null) undated.push(item);
    else dated.set(item.day, [...(dated.get(item.day) ?? []), item]);
  }
  const days = [...dated.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([day, rows]) => ({ day, items: rows }));
  return undated.length ? [...days, { day: null, items: undated }] : days;
}

/** How many items are newer than the last row a reader has seen. */
export function unseenCount(items: SheetItem[], lastSeenSeq: number | null): number {
  if (lastSeenSeq === null) return items.length;
  return items.filter((item) => item.seq > lastSeenSeq).length;
}

/** The newest row a reader has now seen, or null for an empty sheet. */
export function newestSeq(items: SheetItem[]): number | null {
  return items.reduce<number | null>(
    (best, item) => (best === null || item.seq > best ? item.seq : best),
    null,
  );
}
