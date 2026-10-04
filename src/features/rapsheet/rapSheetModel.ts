/**
 * The Rap Sheet: one character, as a fixer's file, ready to be drawn.
 *
 * People share their character the way they share a build — a card, one
 * picture — and the game had no way to make one. The creator is screenshot-grade
 * and the player had to screenshot a scrolling page. This is the card's CONTENT:
 * every field is read off something the game already holds (the saved sheet, the
 * Lifepath, the cast, and when there is a campaign behind it, its record), and
 * nothing is typed in or written by a model. The drawing is `rapSheetCanvas.ts`;
 * this stays pure so what a card says can be tested without a canvas.
 *
 * Three things it will not do:
 *
 *  - SHOW A NUMBER THE ENGINE DID NOT PRODUCE. The STATs are the sheet's. The one
 *    figure that is not a game value is the file number, and it is decoration, as
 *    the descent's counter is: it comes from a hash of the character's id, so it
 *    is the same every time and means nothing.
 *
 *  - LEAK THE ACCOUNT. No email, no user id, no campaign id: a card is made to be
 *    posted, and the only identifiers on it are the ones the character already
 *    goes by — a handle, a name, a face.
 *
 *  - CLAIM MORE THAN IT KNOWS. A character with no campaign is a FILE OPEN, with
 *    no days, no jobs and no standing, because they have none; the campaign's
 *    facts appear only when there is a campaign to read them from.
 *
 * Pure: rows in, a sheet out. No React, no canvas, no storage.
 */
import {
  CAST_ROLES,
  STAT_ORDER,
  generateCast,
  getCyberware,
  getDistrict,
  getFaction,
  getRoleSkillIds,
  hasCyberware,
  identityLine,
  isFactionId,
  isHostile,
  readIdentity,
  IDENTITY_KEY,
  roleAbilityOf,
  skillEntryName,
  type FactionStanding,
  type StatKey,
} from "@/engine";
import rolesData from "@/data/rules/roles.json";
import { castPlanFrom, lifepathTiesFrom } from "@/features/campaign/castSeeding";
import { placeNameOf } from "@/features/campaign/obituary";
import { findNpc, npcImage } from "@/features/cast/npcDirectory";
import { readGeneralLifepath, displayValue } from "@/features/chargen/lifepathState";
import { statFraction, statColor, statHighlights } from "@/features/chargen/statBands";
import { dispositionBand } from "@/features/life/hud/hudModel";
import type { Campaign, CampaignCyberware, CampaignNpc, FullCharacter } from "@/lib/backend";
import type { CampaignTally } from "@/features/campaign/tally";

const ROLE_NAMES = rolesData.roles as unknown as Record<string, { name: string }>;

// ---------------------------------------------------------------------------
// Formats
// ---------------------------------------------------------------------------

export type RapFormat = "post" | "story";

/** The two shapes people post: a feed card, and a full-height story. */
export const RAP_FORMATS: Record<RapFormat, { width: number; height: number; label: string }> = {
  post: { width: 1080, height: 1350, label: "Post · 4:5" },
  story: { width: 1080, height: 1920, label: "Story · 9:16" },
};

// ---------------------------------------------------------------------------
// The sheet
// ---------------------------------------------------------------------------

export type RapStatus = "open" | "active" | "flatlined";
export type RapTone = "good" | "bad" | "neutral" | "dead";

export type RapStat = {
  key: StatKey;
  /** "REF". */
  label: string;
  value: number;
  /** Where it sits on the printed 2–8 scale, 0 to 1. */
  fraction: number;
  /** The same colour the character sheet's own cards use for it. */
  color: string;
};

export type RapAssociate = {
  name: string;
  /** "FRIEND", "THE ONE WHO WANTS YOU DEAD". */
  relation: string;
  /** Same-origin cast art, or null when the atlas has no face for them. */
  image: string | null;
  tone: RapTone;
};

export type RapTheme = { accent: string; glow: string };

export type RapSheet = {
  /** A name for the picture file. */
  filename: string;
  /** Decorative, and stable: a hash of the character, dressed as a case number. */
  fileNo: string;
  handle: string;
  name: string;
  role: string | null;
  roleId: string | null;
  theme: RapTheme;
  /** "man, elderly" — a band, never the number. */
  readsAs: string | null;
  status: RapStatus;
  stamp: string;
  /** Where they were last seen, as the atlas names it. */
  lastSeen: { label: string; value: string } | null;
  /** The printed Reputation line, when the character has earned a Level. */
  knownFor: { level: number; line: string } | null;
  stats: RapStat[];
  edge: string | null;
  weak: string | null;
  skills: { name: string; level: number }[];
  ability: { name: string; rank: number } | null;
  chrome: string[];
  /** What the Lifepath says, by the file's own headings. */
  notes: { label: string; value: string }[];
  associates: RapAssociate[];
  wantedBy: string[];
  /** The campaign's own record, when there is one behind the card. */
  record: { label: string; value: string }[];
  /**
   * Whether there is a picture to fetch. The path itself is NOT on the sheet:
   * it holds the account's id, and a sheet is a thing that gets passed around,
   * logged and stringified. The one place that fetches the picture is handed
   * the path beside the sheet (`RapSheetSource.portraitPath`).
   */
  hasPortrait: boolean;
};

// ---------------------------------------------------------------------------
// What a card is made from
// ---------------------------------------------------------------------------

export type RapAssociateSource = {
  name: string;
  role: string | null;
  disposition: number | null;
  dead: boolean;
};

export type RapSheetSource = {
  /** Only ever hashed, for the file number. Never printed. */
  id: string;
  name: string;
  handle: string | null;
  roleId: string | null;
  stats: Partial<Record<StatKey, number>> | null;
  skills: { skillId: string; level: number; specialization: string | null }[];
  abilityRank: number | null;
  chromeIds: string[];
  lifepathGeneral: unknown;
  /** Where the picture is stored. Holds the account's id: fetched from, never printed or kept on the sheet. */
  portraitPath: string | null;
  homeDistrictKey: string | null;
  associates: RapAssociateSource[];
  campaign: null | {
    day: number;
    locationKey: string | null;
    jobsFinished: number;
    bodies: number;
    reputation: { level: number; whoKnows: string | null };
    standings: FactionStanding[];
    dead: boolean;
  };
};

// ---------------------------------------------------------------------------
// Looks
// ---------------------------------------------------------------------------

/**
 * One colour per Role, so a card reads as a Solo's or a Netrunner's before a
 * word of it is read. A look and nothing else: no rule reads these.
 */
const THEMES: Record<string, RapTheme> = {
  solo: { accent: "#ff4d4d", glow: "rgba(255,77,77,0.45)" },
  netrunner: { accent: "#34d5e6", glow: "rgba(52,213,230,0.45)" },
  tech: { accent: "#ffb020", glow: "rgba(255,176,32,0.42)" },
  fixer: { accent: "#a15cff", glow: "rgba(161,92,255,0.5)" },
  rockerboy: { accent: "#ff3d9a", glow: "rgba(255,61,154,0.5)" },
  nomad: { accent: "#e0a458", glow: "rgba(224,164,88,0.42)" },
  media: { accent: "#6ef2a0", glow: "rgba(110,242,160,0.4)" },
  medtech: { accent: "#4fe3d0", glow: "rgba(79,227,208,0.42)" },
  exec: { accent: "#b9c4ff", glow: "rgba(185,196,255,0.4)" },
  lawman: { accent: "#5c8cff", glow: "rgba(92,140,255,0.45)" },
};
const DEFAULT_THEME: RapTheme = { accent: "#ff3d9a", glow: "rgba(255,61,154,0.5)" };

export function themeFor(roleId: string | null): RapTheme {
  return (roleId && THEMES[roleId]) || DEFAULT_THEME;
}

const RELATION: Record<string, string> = {
  fixer: "FIXER",
  ripperdoc: "RIPPERDOC",
  landlord: "LANDLORD",
  friend: "FRIEND",
  enemy: "ENEMY",
  old_flame: "OLD FLAME",
};

/** How many of each list the card carries: a file, not a transcript. */
export const MAX_SKILLS = 3;
export const MAX_CHROME = 3;
export const MAX_WANTED_BY = 3;

function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** "NCT-0417-8832": a case number's costume, worn by a hash. Means nothing. */
export function fileNumber(id: string): string {
  const h = hash(id);
  const a = String(h % 10000).padStart(4, "0");
  const b = String(hash(`${id}:b`) % 10000).padStart(4, "0");
  return `NCT-${a}-${b}`;
}

function slug(text: string): string {
  return (
    text
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "runner"
  );
}

function toneOf(disposition: number | null, dead: boolean): RapTone {
  if (dead) return "dead";
  if (disposition === null) return "neutral";
  const { tone } = dispositionBand(disposition);
  return tone === "warm" ? "good" : tone === "hostile" || tone === "cold" ? "bad" : "neutral";
}

/** The best three, by Level, then by where the Role's own package lists them. */
function topSkills(
  skills: RapSheetSource["skills"],
  roleId: string | null,
  homeDistrictKey: string | null,
): RapSheet["skills"] {
  const order = roleId ? safeRoleSkills(roleId) : [];
  const rank = (id: string) => {
    const at = order.indexOf(id);
    return at === -1 ? order.length : at;
  };
  return skills
    .filter((s) => s.level > 0)
    .map((s) => ({
      level: s.level,
      rank: rank(s.skillId),
      name: safeSkillName(s, homeDistrictKey),
    }))
    .sort((a, b) => b.level - a.level || a.rank - b.rank || a.name.localeCompare(b.name))
    .slice(0, MAX_SKILLS)
    .map(({ name, level }) => ({ name, level }));
}

function safeRoleSkills(roleId: string): string[] {
  try {
    return getRoleSkillIds(roleId);
  } catch {
    return [];
  }
}

function safeSkillName(
  s: { skillId: string; specialization: string | null },
  home: string | null,
): string {
  try {
    return skillEntryName({ skillId: s.skillId, specialization: s.specialization }, home);
  } catch {
    return s.skillId; // a legacy row naming a Skill the printed list no longer has
  }
}

function chromeNames(ids: string[]): string[] {
  const names = ids.filter(hasCyberware).map((id) => getCyberware(id).name);
  const shown = names.slice(0, MAX_CHROME);
  return names.length > MAX_CHROME ? [...shown, `+${names.length - MAX_CHROME} more`] : shown;
}

const NOTES: { tableId: string; label: string }[] = [
  { tableId: "personality", label: "TEMPERAMENT" },
  { tableId: "value_most", label: "VALUES" },
  { tableId: "life_goals", label: "WANTS" },
];

export function rapSheet(source: RapSheetSource): RapSheet {
  const handle = source.handle?.trim() || source.name.trim() || "Nobody";
  const roleName = source.roleId ? (ROLE_NAMES[source.roleId]?.name ?? source.roleId) : null;
  const general = (source.lifepathGeneral ?? {}) as Record<string, unknown>;
  const entries = readGeneralLifepath(source.lifepathGeneral).entries;

  const statValues = source.stats ?? {};
  const stats: RapStat[] = STAT_ORDER.flatMap((key) => {
    const value = statValues[key];
    return typeof value === "number"
      ? [
          {
            key,
            label: key.toUpperCase(),
            value,
            fraction: statFraction(value),
            color: statColor(value),
          },
        ]
      : [];
  });
  const marks = stats.length === STAT_ORDER.length ? statHighlights(statValues, STAT_ORDER) : null;
  const say = (keys: StatKey[]) =>
    keys.length ? keys.map((k) => `${k.toUpperCase()} ${statValues[k]}`).join(" · ") : null;

  const ability = roleAbilityOf(source.roleId);
  const campaign = source.campaign;
  const status: RapStatus = !campaign ? "open" : campaign.dead ? "flatlined" : "active";

  const hostile = (campaign?.standings ?? [])
    .filter((s) => isFactionId(s.factionId) && isHostile(s.standing))
    .sort((a, b) => a.standing - b.standing)
    .slice(0, MAX_WANTED_BY)
    .map((s) => getFaction(s.factionId).name);

  const home = source.homeDistrictKey ? getDistrict(source.homeDistrictKey)?.name : undefined;
  const seen = campaign ? placeNameOf(campaign.locationKey) : null;

  const record: RapSheet["record"] = [];
  if (campaign) {
    record.push({ label: "DAYS", value: String(campaign.day) });
    record.push({ label: "JOBS", value: String(campaign.jobsFinished) });
    if (campaign.bodies > 0) record.push({ label: "BODIES", value: String(campaign.bodies) });
  }

  return {
    filename: `${slug(handle)}-rap-sheet.png`,
    fileNo: fileNumber(source.id),
    handle,
    name: source.name.trim(),
    role: roleName,
    roleId: source.roleId,
    theme: themeFor(source.roleId),
    readsAs: identityLine(readIdentity(general[IDENTITY_KEY])),
    status,
    stamp: status === "flatlined" ? "FLATLINED" : status === "active" ? "ACTIVE" : "FILE OPEN",
    lastSeen: seen
      ? { label: "LAST SEEN", value: seen }
      : home
        ? { label: "HOME TURF", value: home }
        : null,
    knownFor:
      campaign && campaign.reputation.level > 0 && campaign.reputation.whoKnows
        ? { level: campaign.reputation.level, line: campaign.reputation.whoKnows }
        : null,
    stats,
    edge: marks ? say(marks.edges) : null,
    weak: marks ? say(marks.weak) : null,
    skills: topSkills(source.skills, source.roleId, source.homeDistrictKey),
    ability: ability
      ? { name: ability.abilityName, rank: source.abilityRank ?? ability.startingRank }
      : null,
    chrome: chromeNames(source.chromeIds),
    notes: NOTES.flatMap(({ tableId, label }) => {
      const entry = entries[tableId];
      const value = entry ? displayValue(entry).trim() : "";
      return value ? [{ label, value }] : [];
    }),
    associates: CAST_ROLES.flatMap((role) => {
      const person = source.associates.find((a) => a.role === role);
      if (!person) return [];
      return [
        {
          name: person.name,
          relation: RELATION[role] ?? role.toUpperCase(),
          image: findNpc(person.name) ? npcImage(findNpc(person.name)!) : null,
          tone: toneOf(person.disposition, person.dead),
        },
      ];
    }),
    wantedBy: hostile,
    record,
    hasPortrait: !!source.portraitPath,
  };
}

// ---------------------------------------------------------------------------
// Adapters: from what the app holds to what a card is made from
// ---------------------------------------------------------------------------

function statsOf(character: FullCharacter): Partial<Record<StatKey, number>> | null {
  const row = character.stats as Record<string, unknown> | null;
  if (!row) return null;
  const out: Partial<Record<StatKey, number>> = {};
  for (const key of STAT_ORDER) {
    const value = row[key];
    if (typeof value === "number") out[key] = value;
  }
  return out;
}

function baseSource(character: FullCharacter): Omit<RapSheetSource, "associates" | "campaign"> {
  return {
    id: character.character.id,
    name: character.character.name,
    handle: character.character.handle ?? null,
    roleId: character.character.role ?? null,
    stats: statsOf(character),
    skills: character.skills.map((s) => ({
      skillId: s.skill_id,
      level: s.level,
      specialization: s.specialization ?? null,
    })),
    abilityRank: character.roleAbility?.rank ?? null,
    chromeIds: character.cyberware.map((c) => c.item_id),
    lifepathGeneral: character.lifepath?.general ?? null,
    portraitPath: character.character.portrait_path ?? null,
    homeDistrictKey: character.finance?.home_district_key ?? null,
  };
}

/** The six this character will meet, from the plan creation made: faces and all. */
function castOf(character: FullCharacter): RapAssociateSource[] {
  const plan = castPlanFrom(character);
  if (!plan) return [];
  return generateCast({
    seed: plan.seed,
    ties: lifepathTiesFrom(character),
    picks: plan.picks,
  }).map((m) => ({ name: m.name, role: m.role, disposition: m.disposition, dead: false }));
}

/** A saved character, with no campaign behind them: a file that is open. */
export function sourceFromCharacter(character: FullCharacter): RapSheetSource {
  return { ...baseSource(character), associates: castOf(character), campaign: null };
}

/**
 * A character in a campaign: the same file, with the days they have lived, the
 * people as they stand now, and who is looking for them. Pass `dead` for the
 * obituary's copy of the card.
 */
export function sourceFromCampaign(input: {
  character: FullCharacter;
  campaign: Pick<Campaign, "day" | "location_key">;
  chrome: Pick<CampaignCyberware, "item_id">[];
  npcs: Pick<CampaignNpc, "name" | "disposition" | "status" | "data">[];
  standings: FactionStanding[];
  tally: Pick<CampaignTally, "jobsFinished" | "bodies">;
  reputation: { level: number; whoKnows: string | null };
  dead: boolean;
}): RapSheetSource {
  const base = baseSource(input.character);
  return {
    ...base,
    // What is carried NOW: a campaign's chrome is its own, not the saved sheet's.
    chromeIds: input.chrome.map((c) => c.item_id),
    associates: input.npcs.flatMap((npc) => {
      const role = ((npc.data ?? {}) as { role?: unknown }).role;
      return typeof role === "string" && CAST_ROLES.includes(role as (typeof CAST_ROLES)[number])
        ? [
            {
              name: npc.name,
              role,
              disposition: npc.disposition,
              dead: npc.status === "dead",
            },
          ]
        : [];
    }),
    campaign: {
      day: input.campaign.day,
      locationKey: input.campaign.location_key,
      jobsFinished: input.tally.jobsFinished,
      bodies: input.tally.bodies,
      reputation: input.reputation,
      standings: input.standings,
      dead: input.dead,
    },
  };
}
