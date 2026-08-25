/**
 * Who runs Night City, and what they currently think of you.
 *
 * A faction is not an NPC. It has no dossier, no disposition to read off a face,
 * and no memory of a conversation: it has an institutional opinion that moves
 * slowly and does not forget. Kill three Tyger Claws and the Claws as an
 * organisation are a degree colder toward you for the rest of the campaign,
 * whether or not anyone who saw it is still breathing.
 *
 * Pure TypeScript. This module owns the roster and the scale; engine/clocks.ts
 * owns what moves a standing, and features/campaign/pressure.ts is the only
 * place either becomes a database row.
 */

export const FACTION_IDS = [
  "arasaka",
  "militech",
  "tyger_claws",
  "maelstrom",
  "valentinos",
  "sixth_street",
  "voodoo_boys",
  "scavengers",
  "ncpd",
  "trauma_team",
  "nomads",
] as const;
export type FactionId = (typeof FACTION_IDS)[number];

export type Faction = {
  id: FactionId;
  name: string;
  /** One line the prompt can use, so the model does not reinvent who they are. */
  blurb: string;
  /**
   * True when crossing them tends to produce an investigation rather than a
   * beating. Corps and cops build a file; gangs come to your door.
   */
  investigates: boolean;
  /**
   * What people actually call them. Job content says "a scavver crew" and a
   * model says "the cops"; both mean a faction with a standing on file.
   */
  aliases?: string[];
};

export const FACTIONS: Faction[] = [
  {
    id: "arasaka",
    aliases: ["arasaka security", "saka"],
    name: "Arasaka",
    blurb: "Corporate security and the longest memory in the city.",
    investigates: true,
  },
  {
    id: "militech",
    aliases: ["militech contractors", "militech security"],
    name: "Militech",
    blurb: "Arms dealer and private army, and never only one of the two.",
    investigates: true,
  },
  {
    id: "tyger_claws",
    aliases: ["tyger claw", "claws", "tygers"],
    name: "Tyger Claws",
    blurb: "Westbrook and Japantown, run on protection and very long knives.",
    investigates: false,
  },
  {
    id: "maelstrom",
    aliases: ["maelstromers"],
    name: "Maelstrom",
    blurb: "Chrome past the point of sense, and nothing left that negotiates.",
    investigates: false,
  },
  {
    id: "valentinos",
    aliases: ["valentino"],
    name: "Valentinos",
    blurb: "Heywood's own, bound by family, faith and reputation.",
    investigates: false,
  },
  {
    id: "sixth_street",
    aliases: ["6th street", "sixth street", "6th st"],
    name: "6th Street",
    blurb: "Veterans policing Santo Domingo because somebody has to, they say.",
    investigates: false,
  },
  {
    id: "voodoo_boys",
    aliases: ["voodoo boy", "voodooboys"],
    name: "Voodoo Boys",
    blurb: "Pacifica's netrunners, who trade in access and never in trust.",
    investigates: true,
  },
  {
    id: "scavengers",
    aliases: ["scavvers", "scavver", "scav", "scavs"],
    name: "Scavengers",
    blurb: "They take people apart for the parts. There is no deeper motive.",
    investigates: false,
  },
  {
    id: "ncpd",
    aliases: ["police", "the cops", "cops", "night city police"],
    name: "NCPD",
    blurb: "Underpaid, over-armed, and interested in you only above a threshold.",
    investigates: true,
  },
  {
    id: "trauma_team",
    aliases: ["trauma"],
    name: "Trauma Team",
    blurb: "Medical extraction for subscribers. Everyone else is terrain.",
    investigates: true,
  },
  {
    id: "nomads",
    aliases: ["nomad", "nomad pack", "the badlands families"],
    name: "Nomad packs",
    blurb: "The Badlands families who move what nobody else will move.",
    investigates: false,
  },
];

const BY_ID = new Map(FACTIONS.map((f) => [f.id, f]));

export function isFactionId(value: unknown): value is FactionId {
  return typeof value === "string" && BY_ID.has(value as FactionId);
}

export function getFaction(id: FactionId): Faction {
  const faction = BY_ID.get(id);
  if (!faction) throw new Error(`No registered faction "${id}".`);
  return faction;
}

/** Lowercase, with every run of punctuation or space collapsed to one underscore. */
function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

/**
 * Read a faction id off a short label: an id, a display name, or something
 * people actually say. Exact matching only, because this reads a field the model
 * filled in, and a loose match there would file a grudge against whoever
 * happened to be mentioned.
 */
export function resolveFactionId(value: unknown): FactionId | null {
  if (typeof value !== "string") return null;
  const key = normalize(value);
  if (!key) return null;
  if (isFactionId(key)) return key;
  const match = FACTIONS.find(
    (f) => normalize(f.name) === key || (f.aliases ?? []).some((a) => normalize(a) === key),
  );
  return match?.id ?? null;
}

/**
 * Find a faction NAMED INSIDE a longer piece of authored text, e.g. a mission's
 * "a Tyger Claws crew, and they are not new at this".
 *
 * Deliberately separate from resolveFactionId: scanning prose for a name is the
 * right call on content this project wrote and the wrong call on anything a
 * model produced, where "nothing to do with Arasaka" would file an Arasaka
 * grudge. Callers have to choose which of the two they are holding.
 */
export function findFactionIn(text: string | null | undefined): FactionId | null {
  if (!text) return null;
  // Padded with the same separator the normalizer produces, so a name only
  // matches on whole-word boundaries: "scav" must not match "scavenging".
  const haystack = `_${normalize(text)}_`;
  for (const faction of FACTIONS) {
    const needles = [faction.name, ...(faction.aliases ?? [])]
      .map(normalize)
      .sort((a, b) => b.length - a.length);
    if (needles.some((n) => n && haystack.includes(`_${n}_`))) return faction.id;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Standing.
// ---------------------------------------------------------------------------

/**
 * Wider than NPC disposition on purpose. A person's opinion of you swings on one
 * conversation; an organisation's takes a body of work, so the scale needs room
 * for a dozen small provocations to add up to something.
 */
export const FACTION_STANDING_MIN = -10;
export const FACTION_STANDING_MAX = 10;

export function clampStanding(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(FACTION_STANDING_MIN, Math.min(FACTION_STANDING_MAX, Math.round(value)));
}

export const STANDING_BANDS = [
  { atMost: -7, label: "hunted", hostile: true },
  { atMost: -4, label: "hostile", hostile: true },
  { atMost: -1, label: "cold", hostile: false },
  { atMost: 1, label: "unknown", hostile: false },
  { atMost: 4, label: "useful", hostile: false },
  { atMost: 7, label: "trusted", hostile: false },
  { atMost: FACTION_STANDING_MAX, label: "connected", hostile: false },
] as const;

export function standingBand(standing: number): (typeof STANDING_BANDS)[number] {
  const value = clampStanding(standing);
  return STANDING_BANDS.find((band) => value <= band.atMost) ?? STANDING_BANDS[3];
}

/** "Tyger Claws: hostile (-5)" */
export function formatStanding(id: FactionId, standing: number): string {
  return `${getFaction(id).name}: ${standingBand(standing).label} (${clampStanding(standing)})`;
}

/** True when this faction would start trouble on sight. */
export function isHostile(standing: number): boolean {
  return standingBand(standing).hostile;
}

export type FactionStanding = { factionId: FactionId; standing: number };

/** Standings worth showing or telling the model about: everyone off zero. */
export function notableStandings(standings: FactionStanding[]): FactionStanding[] {
  return standings
    .filter((s) => clampStanding(s.standing) !== 0)
    .sort((a, b) => a.standing - b.standing || a.factionId.localeCompare(b.factionId));
}
